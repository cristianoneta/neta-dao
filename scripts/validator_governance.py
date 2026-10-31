"""Export governance evidence from our local observations only. Never fetch history."""
from datetime import timedelta
import hashlib
import json
import re
import sqlite3
import time
import zlib
from validator_active_set import instant

CHARS = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
TERMINAL = {'proposal_passed', 'proposal_rejected', 'proposal_failed'}


def account_bytes(address, prefix):
    """Validate Bech32 checksum and canonical padding before matching account bytes."""
    if not isinstance(address, str) or address != address.lower() or not address.startswith(prefix + '1'):
        raise ValueError('Invalid governance voter address')
    data = address[len(prefix) + 1:]
    if len(data) not in (38, 58) or any(c not in CHARS for c in data):
        raise ValueError('Invalid governance voter length')
    words = [CHARS.index(c) for c in data]
    check = 1
    for value in [ord(c) >> 5 for c in prefix] + [0] + [ord(c) & 31 for c in prefix] + words:
        top = check >> 25
        check = ((check & 0x1ffffff) << 5) ^ value
        for i, generator in enumerate((0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3)):
            if (top >> i) & 1:
                check ^= generator
    if check != 1:
        raise ValueError('Invalid governance voter checksum')
    bits, acc, result = 0, 0, bytearray()
    for word in words[:-6]:
        acc = (acc << 5) | word
        bits += 5
        if bits >= 8:
            bits -= 8
            result.append((acc >> bits) & 255)
    if bits >= 5 or (acc & ((1 << bits) - 1)):
        raise ValueError('Invalid governance voter padding')
    return bytes(result)


def attributes(event):
    result = {}
    for attr in event.get('attributes', []):
        key, value = attr['key'], attr['value']
        if not isinstance(key, str) or not isinstance(value, str) or key in result:
            raise ValueError('Ambiguous governance event attributes')
        result[key] = value
    return result


def proposal_id(value):
    if not isinstance(value, str) or not re.fullmatch(r'[1-9][0-9]{0,19}', value):
        raise ValueError('Invalid observed proposal identity')
    return value


def governance_history(path, snapshot, seconds=25):
    deadline = time.monotonic() + seconds
    db = sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True, timeout=1)
    db.set_progress_handler(lambda: int(time.monotonic() > deadline), 10000)
    try:
        db.execute('BEGIN')
        row = db.execute("SELECT value FROM meta WHERE key='identity'").fetchone()
        identity = json.loads(row[0]) if row else None
        if not identity or identity.get('chain') != 'juno-1':
            raise ValueError('Governance collection identity unavailable')
        cutoff = (instant(snapshot['blockTime']) - timedelta(days=180)).timestamp()
        first = db.execute('SELECT height FROM blocks WHERE epoch>=? AND height<=? ORDER BY height LIMIT 1',
                           (cutoff, snapshot['height'])).fetchone()
        if first and instant(identity['startTime']).timestamp() >= cutoff and first[0] != identity['firstHeight']:
            raise ValueError('Governance collection origin is missing')
        checks = db.execute("SELECT value FROM meta WHERE key='eventChecksStart'").fetchone()
        checks_start = json.loads(checks[0]) if checks else None
        if not first:
            raise ValueError('No governance observation coverage')
        operators = {account_bytes(v['address'], 'junovaloper'): v['address'] for v in snapshot['validators']}
        # Entries are preserved independently of rolling block retention and re-entry.
        entries = {a: (h, t) for a, h, t in db.execute('SELECT address,height,time FROM first_entries')}
        validators = [{'address': v['address'], 'firstHeight': entries[v['consensusAddress']][0],
                       'firstTime': entries[v['consensusAddress']][1]}
                      for v in snapshot['validators'] if v['consensusAddress'] in entries
                      and entries[v['consensusAddress']][0] <= snapshot['height']]
        starts, ends, votes, cancelled = {}, {}, {}, set()
        previous, origin = None, None
        for h, stamp, block_hash, prior, payload, checksum in db.execute('''
                SELECT b.height,b.time,b.hash,b.previous,e.payload,c.sha256 FROM blocks b
                LEFT JOIN events e ON e.height=b.height LEFT JOIN event_checks c ON c.height=b.height WHERE b.height BETWEEN ? AND ? ORDER BY b.height''',
                (first[0], snapshot['height'])):
            if time.monotonic() > deadline:
                raise TimeoutError('Governance export time budget exceeded')
            if len(block_hash) != 32 or (previous and (h != previous['height'] + 1 or
                    prior.hex().upper() != previous['hash'] or instant(stamp) < instant(previous['time']))):
                raise ValueError('Governance observation continuity mismatch')
            anchor = {'height': h, 'time': stamp, 'hash': block_hash.hex().upper()}
            origin = origin or anchor
            previous = anchor
            if checks_start is not None and h >= checks_start and checksum is None:
                raise ValueError('Missing governance event integrity record')
            if payload is None:
                if checksum is not None and checksum != hashlib.sha256(b'[]').digest():
                    raise ValueError('Missing captured governance events')
                continue
            decoder = zlib.decompressobj()
            raw = decoder.decompress(payload, 8 * 1024 * 1024 + 1)
            if len(raw) > 8 * 1024 * 1024 or not decoder.eof or decoder.unused_data:
                raise ValueError('Invalid governance event payload')
            if checksum is not None and checksum != hashlib.sha256(raw).digest():
                raise ValueError('Captured governance events changed')
            events = json.loads(raw)
            if not isinstance(events, list):
                raise ValueError('Invalid governance event list')
            actions, ballots, positions = {}, {}, set()
            for event in events:
                kind = event['type']
                if kind not in {'submit_proposal', 'proposal_deposit', 'proposal_vote', 'active_proposal',
                                'inactive_proposal', 'cancel_proposal', 'message'}:
                    continue
                attrs = attributes(event)
                scope, index = event['scope'], event['index']
                if scope != 'block' and not re.fullmatch(r'tx:[0-9]+', scope):
                    raise ValueError('Invalid governance event scope')
                if not isinstance(index, int) or index < 0 or (scope, index) in positions:
                    raise ValueError('Duplicate governance event position')
                positions.add((scope, index))
                if kind == 'message':
                    if attrs.get('action') in {'/cosmos.gov.v1.MsgVote', '/cosmos.gov.v1.MsgVoteWeighted',
                                               '/cosmos.gov.v1beta1.MsgVote', '/cosmos.gov.v1beta1.MsgVoteWeighted'}:
                        actions[scope] = actions.get(scope, 0) + 1
                    continue
                if 'voting_period_start' in attrs:
                    pid = proposal_id(attrs['voting_period_start'])
                    if kind not in {'submit_proposal', 'proposal_deposit'} or scope == 'block' or pid in starts:
                        raise ValueError('Ambiguous observed voting start')
                    starts[pid] = {'height': h, 'time': stamp}
                if kind == 'proposal_vote':
                    pid = proposal_id(attrs.get('proposal_id'))
                    voter = account_bytes(attrs.get('voter'), 'juno')
                    option = attrs.get('option')
                    if scope == 'block' or not isinstance(option, str) or not option or len(option) > 500:
                        raise ValueError('Incomplete governance ballot evidence')
                    ballots[scope] = ballots.get(scope, 0) + 1
                    if voter in operators:
                        votes.setdefault(pid, []).append({'voter': operators[voter], 'height': h,
                                                         'scope': scope, 'index': index, 'option': option})
                elif kind == 'active_proposal':
                    pid = proposal_id(attrs.get('proposal_id'))
                    result = attrs.get('proposal_result')
                    if result in TERMINAL:
                        if scope != 'block' or pid in ends:
                            raise ValueError('Ambiguous observed voting end')
                        ends[pid] = {'height': h, 'time': stamp, 'result': result}
                    elif result != 'expedited_proposal_rejected':
                        raise ValueError('Unsupported observed proposal outcome')
                elif kind in {'cancel_proposal', 'inactive_proposal'}:
                    cancelled.add(proposal_id(attrs.get('proposal_id')))
            if any(count > ballots.get(scope, 0) for scope, count in actions.items()):
                raise ValueError('Accepted voting message has no complete ballot evidence')
        if not previous or previous['height'] != snapshot['height'] or previous['time'] != snapshot['blockTime']:
            raise ValueError('Governance coverage does not reach the planner snapshot')
        proposals, excluded = [], []
        for pid, end in ends.items():
            if pid in cancelled or pid not in starts:
                excluded.append({'id': pid, 'reason': 'cancelled' if pid in cancelled else 'voting-start-not-observed'})
                continue
            start = starts[pid]
            if start['height'] > end['height']:
                raise ValueError('Governance lifecycle order mismatch')
            own = {}
            for vote in votes.get(pid, []):
                if not start['height'] <= vote['height'] <= end['height']:
                    raise ValueError('Governance vote outside the observed voting period')
                own[vote['voter']] = vote  # Last accepted own vote; repeats earn nothing extra.
            proposals.append({'id': pid, 'start': start, 'end': end,
                              'votes': sorted(own.values(), key=lambda v: v['voter'])})
        if len(proposals) > 1000 or len(excluded) > 1000:
            raise ValueError('Governance review evidence bound exceeded')
        return {'schema': 1, 'chainId': 'juno-1', 'source': identity['rpc'],
                'collectionStart': {'height': identity['firstHeight'], 'time': identity['startTime']},
                'coverage': {'start': origin, 'end': previous}, 'validators': sorted(validators, key=lambda v: v['address']),
                'proposals': sorted(proposals, key=lambda p: (p['end']['height'], int(p['id']))),
                'excluded': sorted(excluded, key=lambda p: int(p['id']))}
    finally:
        db.close()
