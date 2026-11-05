"""Permanently retain direct Juno ballots from Cosmoot's own contiguous block history."""
from collections import Counter
from contextlib import closing
from decimal import Decimal
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3

from evidence_archive import atomic_json
from validator_governance import account_bytes, attributes, proposal_id, TERMINAL, verified_events
from validator_history import canonical, get_meta, instant, MESSAGE_ACTIONS, set_meta

# The two native votes open at the owner's cutover. The local read starts before
# their voting periods. A later voting-period start is eligible regardless of ID.
CUTOVER = '2026-11-05T17:16:00Z'
OPEN_AT_CUTOVER = {'387', '388'}
LOCAL_FLOOR = '2026-11-02T00:00:00Z'
CHOICES = ('YES', 'ABSTAIN', 'NO', 'NO_WITH_VETO')
EMPTY_HASH = hashlib.sha256(b'[]').digest()
BATCH = 10000
ROOT = Path(__file__).resolve().parents[1]
PUBLIC = 'data/governance/juno-votes'


def ballot_options(raw):
    options = json.loads(raw)
    if not isinstance(options, list) or not 1 <= len(options) <= 4:
        raise ValueError('Invalid vote options')
    result, seen = [], set()
    for part in options:
        value, weight = part['option'], part['weight']
        if type(value) is int and 1 <= value <= 4:
            value = 'VOTE_OPTION_' + CHOICES[value - 1]
        if (value not in {'VOTE_OPTION_' + x for x in CHOICES} or value in seen or
                not isinstance(weight, str) or not re.fullmatch(r'[01](?:\.[0-9]{1,18})?', weight) or
                not 0 < Decimal(weight) <= 1):
            raise ValueError('Invalid weighted vote')
        seen.add(value)
        result.append({'option': value, 'weight': weight})
    if sum(Decimal(opt['weight']) for opt in result) != 1:
        raise ValueError('Vote weights do not total one')
    return result


def setup(db):
    db.executescript('''
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY, start TEXT, stop TEXT, outcome TEXT, dirty INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS ballots (
        proposal TEXT NOT NULL REFERENCES proposals(id), voter TEXT NOT NULL, options TEXT NOT NULL,
        PRIMARY KEY(proposal,voter));
    ''')


def apply_events(db, events, block):
    # Comet returns finalize-block events before transaction results. SDK EndBlock
    # tallies AFTER the successful transactions, including votes in this same block.
    def position(event):
        if event['scope'] == 'block':
            return (1, 0, event['index'])
        match = re.fullmatch(r'tx:(\d+)', event['scope'])
        if not match or type(event['index']) is not int or event['index'] < 0:
            raise ValueError('Invalid vote event position')
        return (0, int(match[1]), event['index'])

    accepted, ballots, seen = Counter(), Counter(), set()
    for event in sorted((e for e in events if e['type'] in {
            'submit_proposal', 'proposal_deposit', 'proposal_vote', 'active_proposal',
            'inactive_proposal', 'cancel_proposal', 'message'}), key=position):
        scope, kind = event['scope'], event['type']
        pos = position(event)
        if pos in seen:
            raise ValueError('Duplicate governance event position')
        seen.add(pos)
        a = attributes(event)
        if kind == 'message':
            if a.get('action') in MESSAGE_ACTIONS and a['action'].endswith(('MsgVote', 'MsgVoteWeighted')):
                accepted[scope] += 1
            continue
        start = a.get('voting_period_start') if kind in {'submit_proposal','proposal_deposit'} else None
        if kind in {'submit_proposal','proposal_deposit'} and start is None:
            continue
        pid = proposal_id(start if start is not None else a.get('proposal_id'))
        if kind == 'proposal_vote':
            ballots[scope] += 1
        if pid not in OPEN_AT_CUTOVER and instant(block['time']) < instant(CUTOVER):
            continue
        current = db.execute('SELECT start,stop FROM proposals WHERE id=?', (pid,)).fetchone()
        if start is not None:
            if scope == 'block' or current:
                raise ValueError('Duplicate or invalid voting start')
            db.execute('INSERT INTO proposals(id,start) VALUES (?,?)', (pid, canonical(block)))
        elif kind == 'proposal_vote':
            if scope == 'block' or (current and current[1]):
                raise ValueError('Vote outside active period')
            if not current:
                # A freshly installed/incomplete upstream history may begin mid-vote.
                # Keep received ballots, never call the resulting address count complete.
                db.execute('INSERT INTO proposals(id) VALUES (?)', (pid,))
            voter = a['voter']
            account_bytes(voter, 'juno')
            opts = canonical(ballot_options(a['option']))
            db.execute('INSERT INTO ballots VALUES (?,?,?) ON CONFLICT(proposal,voter) '
                       'DO UPDATE SET options=excluded.options', (pid, voter, opts))
        elif current:
            outcome = a.get('proposal_result') if kind == 'active_proposal' else kind
            if kind == 'active_proposal' and scope != 'block':
                raise ValueError('Unexpected voting result in transaction')
            if outcome == 'expedited_proposal_rejected':
                # SDK v0.53 Tally removes ballots when converting to a regular vote.
                db.execute('DELETE FROM ballots WHERE proposal=?', (pid,))
            elif outcome in TERMINAL | {'cancel_proposal', 'inactive_proposal'}:
                if current[1]:
                    raise ValueError('Duplicate voting end')
                db.execute('UPDATE proposals SET stop=?,outcome=?,dirty=1 WHERE id=?',
                           (canonical(block), outcome, pid))
            else:
                raise ValueError('Unrecognized voting result')
    if accepted - ballots:
        raise ValueError('Successful vote has no captured ballot event')


def advance(source, archive):
    identity, tip = get_meta(source, 'identity'), get_meta(source, 'cursor')
    if not identity or identity.get('chain') != 'juno-1' or not tip:
        raise ValueError('Juno block history is unavailable')
    last = get_meta(archive, 'cursor')
    if last and tip['height'] < last['height']:
        raise ValueError('Block history is behind the retained archive')
    if last:
        first = last['height'] + 1
        if first > tip['height'] and tip['hash'].lower() != last['hash'].lower():
            raise ValueError('Governance archive head mismatch')
    else:
        row = source.execute('SELECT height FROM blocks WHERE epoch>=? ORDER BY epoch,height LIMIT 1',
                             (instant(LOCAL_FLOOR).timestamp(),)).fetchone()
        if not row:
            return None
        first = row[0]
    through = last
    while first <= tip['height']:
        end = min(first + BATCH - 1, tip['height'])
        with archive:
            for h, stamp, digest, previous, payload, checksum in source.execute('''
              SELECT b.height,b.time,b.hash,b.previous,e.payload,c.sha256 FROM blocks b
              LEFT JOIN events e ON e.height=b.height LEFT JOIN event_checks c ON c.height=b.height
              WHERE b.height BETWEEN ? AND ? ORDER BY b.height''', (first, end)):
                if (h != first or len(digest) != 32 or
                        through and (previous.hex() != through['hash'] or instant(stamp) < instant(through['time']))):
                    raise ValueError('Gap or fork in governance archive')
                through = {'height': h, 'hash': digest.hex(), 'time': stamp}
                if checksum is None:
                    raise ValueError('Missing governance event integrity record')
                if payload is not None or checksum != EMPTY_HASH:
                    apply_events(archive, verified_events(payload, checksum), through)
                first += 1
            if first != end + 1:
                raise ValueError('Incomplete governance archive range')
            set_meta(archive, 'cursor', through)
    return through


def export(archive, public_dir):
    tip = get_meta(archive, 'cursor')
    if not tip:
        return
    public_dir.mkdir(parents=True, exist_ok=True)
    for pid, start, stop, outcome, dirty in archive.execute(
            'SELECT id,start,stop,outcome,dirty FROM proposals ORDER BY id').fetchall():
        target = public_dir / (proposal_id(pid) + '.json')
        if stop and not dirty and target.is_file():
            continue
        rows = [{'voter': address, 'options': json.loads(options)} for address, options in
                archive.execute('SELECT voter,options FROM ballots WHERE proposal=? ORDER BY voter', (pid,))]
        record = {'schema': 1, 'chainId': 'juno-1', 'proposalId': pid,
                  'start': json.loads(start) if start else None,
                  'through': json.loads(stop) if stop else tip, 'outcome': outcome, 'votes': rows}
        if target.is_file():
            previous = json.loads(target.read_bytes())
            if previous['proposalId'] != pid or previous['chainId'] != 'juno-1':
                raise ValueError('Archive projection identity mismatch')
            power = previous.get('power') or previous.get('previousPower')
            if power:
                key = 'power' if power['blockHash'] == record['through']['hash'] else 'previousPower'
                record[key] = power
        atomic_json(target, record, mode=0o644)
        with archive:
            archive.execute('UPDATE proposals SET dirty=0 WHERE id=?', (pid,))


def collect(history_db, state_dir, public_dir):
    state_dir.mkdir(parents=True, exist_ok=True)
    # The main collector holds collector.lock; the backup copies these closed files under the same lock.
    with closing(sqlite3.connect(state_dir / 'ballots.sqlite3')) as archive:
        setup(archive)
        with closing(sqlite3.connect(history_db.resolve().as_uri()+'?mode=ro', uri=True, timeout=5)) as source:
            source.execute('BEGIN')
            advance(source, archive)
        export(archive, public_dir)


if __name__ == '__main__':
    collect(Path(os.environ['COSMOOT_VALIDATOR_HISTORY_DB']),
            Path(os.environ['COSMOOT_ARCHIVE_DIRECTORY']) / 'juno-votes', ROOT / PUBLIC)
