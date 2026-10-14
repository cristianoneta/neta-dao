#!/usr/bin/env python3
"""Read-only, resumable Juno validator evidence. Never authorizes allocations.

Canonical commits describe height H, not the block fetching them. Every height
must have a complete validator set and ABCI results before the cursor advances.
SQLite is private operator state, independent of the website snapshot publisher.
"""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import threading
import time
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import zlib

CHAIN = 'juno-1'
RPC = 'https://juno.rpc.m.stavr.tech'
REST = 'https://juno.api.m.stavr.tech'
EVENTS = {'slash', 'unjail', 'edit_validator', 'create_validator', 'proposal_vote',
          'submit_proposal', 'active_proposal', 'inactive_proposal', 'upgrade',
          'software_upgrade', 'cancel_software_upgrade'}
MESSAGE_ACTIONS = {'/cosmos.slashing.v1beta1.MsgUnjail', '/cosmos.staking.v1beta1.MsgEditValidator',
                   '/cosmos.gov.v1.MsgVote', '/cosmos.gov.v1.MsgVoteWeighted',
                   '/cosmos.gov.v1beta1.MsgVote', '/cosmos.gov.v1beta1.MsgVoteWeighted'}
LIMIT = 8 * 1024 * 1024


class BudgetExhausted(TimeoutError):
    pass


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True)


def instant(value):
    if not isinstance(value, str) or not value.endswith('Z'):
        raise ValueError('Expected UTC timestamp')
    return datetime.fromisoformat(value[:-1] + '+00:00')


def stamp():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def integer(value, minimum=0, maximum=2**63 - 1):
    if isinstance(value, bool) or not re.fullmatch(r'[0-9]{1,19}', str(value)):
        raise ValueError('Invalid integer')
    value = int(value)
    if not minimum <= value <= maximum:
        raise ValueError('Integer out of range')
    return value


def digest(value, size=32):
    if not isinstance(value, str) or not re.fullmatch('[A-Fa-f0-9]{' + str(size * 2) + '}', value):
        raise ValueError('Invalid hash or address')
    return bytes.fromhex(value)


def varint(number):
    result = bytearray()
    while number > 127:
        result.append((number & 127) | 128)
        number >>= 7
    return bytes(result + bytes([number]))


def merkle(items):
    # CometBFT v0.38 SimpleValidator protobuf and RFC-6962 tree, in RPC order.
    if len(items) == 1:
        return hashlib.sha256(b'\x00' + items[0]).digest()
    split = 1 << ((len(items) - 1).bit_length() - 1)
    return hashlib.sha256(b'\x01' + merkle(items[:split]) + merkle(items[split:])).digest()


def validator_set(rows):
    if not isinstance(rows, list) or not 1 <= len(rows) <= 1000:
        raise ValueError('Invalid validator set size')
    addresses, powers, encoded = [], [], []
    for row in rows:
        key = row['pub_key']
        if key['type'] != 'tendermint/PubKeyEd25519':
            raise ValueError('Unsupported consensus key')
        raw = base64.b64decode(key['value'], validate=True)
        address = digest(row['address'], 20)
        power = integer(row['voting_power'], 1)
        if len(raw) != 32 or hashlib.sha256(raw).digest()[:20] != address:
            raise ValueError('Consensus key/address mismatch')
        addresses.append(address.hex().upper())
        powers.append(power)
        encoded.append(b'\x0a\x22\x0a\x20' + raw + b'\x10' + varint(power))
    if len(set(addresses)) != len(addresses):
        raise ValueError('Duplicate validator')
    return addresses, powers, merkle(encoded)


def selected_events(results):
    if not isinstance(results.get('finalize_block_events'), list):
        raise ValueError('Missing finalize-block events')
    groups = [('block', results['finalize_block_events'])]
    if 'txs_results' not in results:
        raise ValueError('Missing transaction-results field')
    txs = results['txs_results']
    if txs is not None and not isinstance(txs, list):
        raise ValueError('Invalid transaction results')
    for index, tx in enumerate(txs or []):
        if integer(tx['code']) == 0:
            if not isinstance(tx.get('events'), list):
                raise ValueError('Missing transaction events')
            groups.append((f'tx:{index}', tx['events']))
    kept = []
    for scope, events in groups:
        for index, event in enumerate(events):
            watched_message = event['type'] == 'message' and any(
                a.get('key') == 'action' and a.get('value') in MESSAGE_ACTIONS
                for a in event.get('attributes', []))
            if event['type'] not in EVENTS and not watched_message:
                continue
            attrs = event['attributes']
            if not isinstance(attrs, list) or any(
                    not isinstance(a.get('key'), str) or not isinstance(a.get('value'), str) for a in attrs):
                raise ValueError('Invalid event attributes')
            # Keep a list: duplicate keys can be legitimate and must not be lost.
            kept.append({'scope': scope, 'index': index, 'type': event['type'],
                         'attributes': [{'key': a['key'], 'value': a['value']} for a in attrs]})
    updates = results.get('validator_updates')
    if updates:
        kept.append({'scope': 'block', 'index': -1, 'type': 'validator_updates', 'updates': updates})
    if results.get('consensus_param_updates'):
        kept.append({'scope': 'block', 'index': -2, 'type': 'consensus_param_updates',
                     'updates': results['consensus_param_updates']})
    return kept


def observation(height, commit_response, validators, results):
    if commit_response.get('canonical') is not True:
        raise ValueError('Non-canonical commit')
    signed = commit_response['signed_header']
    header, commit = signed['header'], signed['commit']
    if header['chain_id'] != CHAIN or any(integer(h, 1) != height for h in
            (header['height'], commit['height'], results['height'])):
        raise ValueError('Wrong chain or height')
    instant(header['time'])
    addresses, powers, root = validator_set(validators)
    if root != digest(header['validators_hash']):
        raise ValueError('Validator set does not match block header')
    signatures = commit['signatures']
    if len(signatures) != len(addresses):
        raise ValueError('Incomplete commit signatures')
    flags, signed_power = {}, 0
    for address, power, sig in zip(addresses, powers, signatures):
        flag = integer(sig['block_id_flag'], 1, 3)
        if flag == 1:
            if sig.get('validator_address') or sig.get('signature'):
                raise ValueError('Absent signature has identity or signature')
        else:
            if digest(sig['validator_address'], 20).hex().upper() != address:
                raise ValueError('Signature order/identity mismatch')
            if len(base64.b64decode(sig['signature'], validate=True)) != 64:
                raise ValueError('Malformed signature')
            if flag == 2:
                signed_power += power
        flags[address] = flag
    if signed_power * 3 <= sum(powers) * 2:
        raise ValueError('Commit lacks two-thirds voting power')
    roster = sorted(addresses)
    proposer = digest(header['proposer_address'], 20)
    if proposer.hex().upper() not in flags:
        raise ValueError('Proposer outside validator set')
    return {'height': height, 'time': header['time'],
            'hash': digest(commit['block_id']['hash']),
            'previous': digest(header['last_block_id']['hash']), 'validatorHash': root,
            'resultsHash': hashlib.sha256(canonical(results).encode()).digest(),
            'roster': roster, 'flags': bytes(flags[a] for a in roster), 'proposer': proposer,
            'round': integer(commit['round']), 'events': selected_events(results)}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('RPC redirects are not accepted')


class Reader:
    def __init__(self, rpc=RPC, rest=REST, seconds=45, rate=4):
        for url in (rpc, rest):
            p = urlsplit(url)
            if p.scheme != 'https' or not p.hostname or p.username or p.password or p.query or p.fragment:
                raise ValueError('Use an explicit HTTPS provider without credentials')
        self.rpc_base, self.rest_base = rpc.rstrip('/'), rest.rstrip('/')
        self.deadline = time.monotonic() + seconds
        self.rate, self.next_request, self.throttle = rate, 0.0, threading.Lock()

    def get(self, url, height=None, payload=None, weight=1):
        with self.throttle:
            wait = max(0, self.next_request - time.monotonic())
            if time.monotonic() + wait >= self.deadline:
                raise BudgetExhausted('Collection time budget exhausted')
            time.sleep(wait)
            self.next_request = time.monotonic() + weight / self.rate
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise BudgetExhausted('Collection time budget exhausted')
        headers = {'Accept': 'application/json', 'User-Agent': 'Cosmoot-Validator-History/1'}
        if height is not None:
            headers['x-cosmos-block-height'] = str(height)
        body = None
        if payload is not None:
            body = canonical(payload).encode()
            headers['Content-Type'] = 'application/json'
        try:
            with build_opener(NoRedirect()).open(Request(url, data=body, headers=headers), timeout=min(20, remaining)) as response:
                if height is not None and response.headers.get('x-cosmos-block-height') != str(height):
                    raise ValueError('REST provider did not confirm height')
                body = response.read(LIMIT + 1)
        except TimeoutError:
            if time.monotonic() >= self.deadline:
                raise BudgetExhausted('Collection time budget exhausted') from None
            raise
        if len(body) > LIMIT:
            raise ValueError('Response too large')
        return json.loads(body)

    def rpc(self, method, **params):
        value = self.get(self.rpc_base + '/' + method + '?' + urlencode(params))
        if value.get('error') or not isinstance(value.get('result'), dict):
            raise ValueError(f'RPC {method} unavailable')
        return value['result']

    def header(self, height):
        result = self.rpc('commit', height=height)
        h = result['signed_header']['header']
        if h['chain_id'] != CHAIN or integer(h['height'], 1) != height or result.get('canonical') is not True:
            raise ValueError('Wrong canonical header')
        return h

    def block(self, height):
        commit = self.rpc('commit', height=height)
        rows = self.validators(height)
        return observation(height, commit, rows, self.rpc('block_results', height=height))

    def validators(self, height, first=None):
        rows, total = [], None
        for page in range(1, 11):
            data = first if page == 1 and first is not None else self.rpc('validators', height=height, page=page, per_page=100)
            n = integer(data['total'], 1, 1000)
            if integer(data['block_height'], 1) != height or (total is not None and total != n):
                raise ValueError('Validator pagination identity changed')
            total = n
            part = data['validators']
            if not isinstance(part, list) or len(part) != integer(data['count'], 1, 100):
                raise ValueError('Invalid validator page')
            rows.extend(part)
            if len(rows) >= total:
                break
        if len(rows) != total:
            raise ValueError('Incomplete validator pagination')
        return rows

    def blocks(self, heights):
        payload = []
        for height in heights:
            for method in ('commit', 'validators', 'block_results'):
                params = {'height': str(height)}
                if method == 'validators':
                    params.update(page='1', per_page='100')
                payload.append({'jsonrpc': '2.0', 'id': f'{height}:{method}', 'method': method, 'params': params})
        if not 1 <= len(payload) <= 9:
            raise ValueError('RPC batch bound exceeded')
        data = self.get(self.rpc_base, payload=payload, weight=len(payload))
        wanted = {v['id'] for v in payload}
        if not isinstance(data, list) or len(data) != len(payload):
            raise ValueError('Incomplete RPC batch')
        by_id = {row['id']: row for row in data}
        if set(by_id) != wanted or any(row.get('error') or not isinstance(row.get('result'), dict) for row in data):
            raise ValueError('RPC batch identity/error mismatch')
        return [observation(h, by_id[f'{h}:commit']['result'],
                            self.validators(h, by_id[f'{h}:validators']['result']),
                            by_id[f'{h}:block_results']['result']) for h in heights]

    def pages(self, path, field, height):
        rows, key, seen = [], '', set()
        for _ in range(20):
            data = self.get(self.rest_base + path + '?' + urlencode(
                {'pagination.limit': '200', 'pagination.key': key}), height)
            if not isinstance(data.get(field), list) or not isinstance(data.get('pagination'), dict):
                raise ValueError('Missing REST pagination')
            rows.extend(data[field])
            key = data['pagination'].get('next_key') or ''
            if not key:
                return rows
            if key in seen:
                raise ValueError('Repeated REST page')
            seen.add(key)
        raise ValueError('REST pagination limit')

    def metadata(self, height):
        # Bind REST observations to the same chain/block as the RPC stream.
        rest_block = self.get(self.rest_base + f'/cosmos/base/tendermint/v1beta1/blocks/{height}', height)
        header = rest_block['block']['header']
        commit = self.rpc('commit', height=height)
        if (header['chain_id'] != CHAIN or integer(header['height'], 1) != height or
                commit.get('canonical') is not True or
                base64.b64decode(rest_block['block_id']['hash'], validate=True) !=
                digest(commit['signed_header']['commit']['block_id']['hash'])):
            raise ValueError('REST and RPC block identity disagree')
        validators = self.pages('/cosmos/staking/v1beta1/validators', 'validators', height)
        info = self.pages('/cosmos/slashing/v1beta1/signing_infos', 'info', height)
        parameters = {module: self.get(self.rest_base + f'/cosmos/{module}/v1beta1/params', height)['params']
                      for module in ('slashing', 'staking')}
        return normalize_metadata(validators, info, parameters)


def normalize_metadata(validators, infos, parameters):
    rows, operators, keys, signing = [], set(), set(), set()
    for v in validators:
        key = v['consensus_pubkey']
        raw = base64.b64decode(key['key'], validate=True)
        if key['@type'] != '/cosmos.crypto.ed25519.PubKey' or len(raw) != 32:
            raise ValueError('Unsupported staking key')
        operator = v['operator_address']
        address = hashlib.sha256(raw).digest()[:20].hex().upper()
        if operator in operators or address in keys or not isinstance(v['jailed'], bool):
            raise ValueError('Duplicate or malformed staking identity')
        operators.add(operator)
        keys.add(address)
        rows.append({'operator': operator, 'consensusHex': address, 'pubkey': key['key'],
                     'name': str(v['description']['moniker'])[:200], 'status': v['status'],
                     'jailed': v['jailed'], 'tokens': str(integer(v['tokens'])),
                     'commission': v['commission']['commission_rates'],
                     'commissionUpdated': v['commission']['update_time'],
                     'minSelfDelegation': v['min_self_delegation'],
                     'unbondingHeight': str(integer(v['unbonding_height']))})
    for row in infos:
        if row['address'] in signing or not isinstance(row['tombstoned'], bool):
            raise ValueError('Duplicate or invalid signing identity')
        signing.add(row['address'])
        for field in ('start_height', 'index_offset', 'missed_blocks_counter'):
            integer(row[field])
        instant(row['jailed_until'])
    if not rows or not infos:
        raise ValueError('Empty metadata')
    return {'validators': sorted(rows, key=lambda r: r['operator']),
            'signingInfos': sorted(infos, key=lambda r: r['address']), 'parameters': parameters}


def connect(path):
    db = sqlite3.connect(path, timeout=1)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA synchronous=FULL')
    # Two GiB database ceiling. WAL is separately bounded by small transactions.
    page_size = db.execute('PRAGMA page_size').fetchone()[0]
    db.execute(f'PRAGMA max_page_count={2 * 1024**3 // page_size}')
    db.executescript('''
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rosters (id INTEGER PRIMARY KEY, addresses TEXT UNIQUE NOT NULL);
      CREATE TABLE IF NOT EXISTS blocks (
        height INTEGER PRIMARY KEY, time TEXT NOT NULL, epoch REAL NOT NULL, hash BLOB NOT NULL,
        previous BLOB NOT NULL, roster INTEGER NOT NULL, flags BLOB NOT NULL,
        validators_hash BLOB NOT NULL, results_hash BLOB NOT NULL, proposer BLOB NOT NULL, round INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS blocks_time ON blocks(epoch);
      CREATE TABLE IF NOT EXISTS events (height INTEGER PRIMARY KEY, payload BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS daily (day TEXT NOT NULL, address TEXT NOT NULL,
        expected INTEGER NOT NULL, signed INTEGER NOT NULL, absent INTEGER NOT NULL, nil INTEGER NOT NULL,
        proposed INTEGER NOT NULL, PRIMARY KEY(day,address));
      CREATE TABLE IF NOT EXISTS streaks (address TEXT PRIMARY KEY, entered_height INTEGER NOT NULL,
        entered_time TEXT NOT NULL, observed_at_start INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS transitions (height INTEGER NOT NULL, address TEXT NOT NULL,
        type TEXT NOT NULL, PRIMARY KEY(height,address));
      CREATE TABLE IF NOT EXISTS snapshots (height INTEGER PRIMARY KEY, epoch REAL NOT NULL,
        payload BLOB NOT NULL, sha256 TEXT NOT NULL);
    ''')
    version = get_meta(db, 'schema')
    if version is not None and version != 1:
        db.close()
        raise ValueError('Unsupported history schema')
    return db


def get_meta(db, key):
    row = db.execute('SELECT value FROM meta WHERE key=?', (key,)).fetchone()
    return json.loads(row[0]) if row else None


def set_meta(db, key, value):
    db.execute('INSERT OR REPLACE INTO meta VALUES (?,?)', (key, canonical(value)))


def initialize(db, start_time, first_height, rpc, rest):
    identity = {'chain': CHAIN, 'startTime': start_time, 'firstHeight': first_height,
                'rpc': rpc, 'rest': rest, 'verification': 'single-provider; no allocation authorization'}
    existing = get_meta(db, 'identity')
    if existing is not None:
        if existing != identity:
            raise ValueError('History identity cannot be changed')
        return
    with db:
        set_meta(db, 'schema', 1)
        set_meta(db, 'identity', identity)


def append(db, item):
    height = item['height']
    identity = get_meta(db, 'identity')
    last = get_meta(db, 'cursor')
    expected = last['height'] + 1 if last else identity['firstHeight']
    if height != expected:
        raise ValueError('Non-contiguous append (including duplicate)')
    if last and (item['previous'].hex() != last['hash'] or instant(item['time']) < instant(last['time'])):
        raise ValueError('Block continuity mismatch')
    if not last and instant(item['time']) < instant(identity['startTime']):
        raise ValueError('Block precedes requested coverage')
    roster = canonical(item['roster'])
    with db:
        db.execute('INSERT OR IGNORE INTO rosters(addresses) VALUES (?)', (roster,))
        rid = db.execute('SELECT id FROM rosters WHERE addresses=?', (roster,)).fetchone()[0]
        db.execute('INSERT INTO blocks VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                   (height, item['time'], instant(item['time']).timestamp(), item['hash'], item['previous'],
                    rid, item['flags'], item['validatorHash'], item['resultsHash'], item['proposer'], item['round']))
        events = []
        for event in item['events']:
            if event['type'] == 'consensus_param_updates':
                # Juno can repeat the same parameter response every block.
                # Preserve the initial value and changes, not millions of copies.
                if get_meta(db, 'lastConsensusParameters') == event['updates']:
                    continue
                set_meta(db, 'lastConsensusParameters', event['updates'])
            events.append(event)
        if events:
            db.execute('INSERT INTO events VALUES (?,?)', (height, zlib.compress(canonical(events).encode())))
        old = {r[0] for r in db.execute('SELECT address FROM streaks')}
        current = set(item['roster'])
        for address in old - current:
            db.execute('DELETE FROM streaks WHERE address=?', (address,))
            db.execute('INSERT INTO transitions VALUES (?,?,?)', (height, address, 'exit'))
        for address in current - old:
            db.execute('INSERT INTO streaks VALUES (?,?,?,?)', (address, height, item['time'], int(last is None)))
            db.execute('INSERT INTO transitions VALUES (?,?,?)', (height, address, 'observed' if last is None else 'enter'))
        for address, flag in zip(item['roster'], item['flags']):
            db.execute('''INSERT INTO daily VALUES (?,?,?,?,?,?,?) ON CONFLICT(day,address) DO UPDATE SET
                expected=expected+1,signed=signed+excluded.signed,absent=absent+excluded.absent,
                nil=nil+excluded.nil,proposed=proposed+excluded.proposed''',
                       (item['time'][:10], address, 1, int(flag == 2), int(flag == 1), int(flag == 3),
                        int(address == item['proposer'].hex().upper())))
        set_meta(db, 'cursor', {'height': height, 'time': item['time'], 'hash': item['hash'].hex()})


def first_height(reader, target, low, high):
    target = instant(target)
    a, b = reader.header(low), reader.header(high)
    if instant(a['time']) > target or instant(b['time']) < target:
        raise ValueError('Start time is outside retained canonical block history')
    if instant(a['time']) == target:
        return low
    while high - low > 1:
        ratio = (target - instant(a['time'])).total_seconds() / (instant(b['time']) - instant(a['time'])).total_seconds()
        mid = max(low + 1, min(high - 1, low + int((high - low) * ratio)))
        c = reader.header(mid)
        if instant(c['time']) < target:
            low, a = mid, c
        else:
            high, b = mid, c
    return high


def retain(db, through_time, days=120):
    # Retain exact blocks for the full 90-day window plus a 30-day cushion.
    cutoff = (instant(through_time) - timedelta(days=days)).timestamp()
    with db:
        heights = [r[0] for r in db.execute('SELECT height FROM blocks WHERE epoch<? ORDER BY height LIMIT 5000', (cutoff,))]
        if heights:
            end = heights[-1]
            db.execute('DELETE FROM events WHERE height<=?', (end,))
            db.execute('DELETE FROM blocks WHERE height<=?', (end,))
            db.execute('DELETE FROM transitions WHERE height<=?', (end,))
            db.execute('DELETE FROM snapshots WHERE epoch<?', (cutoff,))
    # No full VACUUM: freed pages are reused, avoiding large rewrites on this VPS.


def report(db, latest=None, error=None, metadata_error=None):
    identity, cursor = get_meta(db, 'identity'), get_meta(db, 'cursor')
    first = db.execute('SELECT height,time FROM blocks ORDER BY height LIMIT 1').fetchone()
    newest_snapshot = db.execute('SELECT height,epoch FROM snapshots ORDER BY height DESC LIMIT 1').fetchone()
    return {'schema': 1, 'checkedAt': stamp(), 'identity': identity, 'through': cursor,
            'retainedFrom': {'height': first[0], 'time': first[1]} if first else None,
            'latestObserved': latest, 'lagBlocks': max(0, latest - cursor['height']) if latest and cursor else None,
            'status': 'blocked' if error else ('catching-up' if latest and (not cursor or cursor['height'] < latest) else 'current'),
            'error': error, 'metadataError': metadata_error,
            'metadataHeight': newest_snapshot[0] if newest_snapshot else None,
            'metadataEpoch': newest_snapshot[1] if newest_snapshot else None,
            'ninetyDayWindowCollected': bool(cursor and first and
                instant(cursor['time']) - instant(first[1]) >= timedelta(days=90)),
            'allocationEligible': None, 'note': 'Collected evidence only; no independently verified eligibility or 90-day uptime claim.'}


def atomic_json(path, value):
    temp = path.with_suffix('.tmp')
    with temp.open('w') as file:
        file.write(canonical(value) + '\n')
        file.flush()
        os.fsync(file.fileno())
    temp.replace(path)


def health(value, now=None):
    now = datetime.now(timezone.utc) if now is None else now
    issues = []
    try:
        if value['schema'] != 1 or value['identity']['chain'] != CHAIN:
            raise ValueError('Wrong history identity')
        for name, date in (('receipt', value['checkedAt']), ('blocks', value['through']['time'])):
            age = (now - instant(date)).total_seconds()
            if age < -60 or age > 300:
                issues.append(f'{name}-stale')
        if value['status'] == 'blocked' or value['error']:
            issues.append('collection-blocked')
        if value['metadataError'] or not isinstance(value['metadataEpoch'], (int, float)):
            issues.append('metadata-unavailable')
        elif not -60 <= now.timestamp() - value['metadataEpoch'] <= 4500:
            issues.append('metadata-stale')
    except (KeyError, TypeError, ValueError):
        issues.append('coverage-unavailable')
    return {'ok': not issues, 'issues': issues, 'scope': 'Collection freshness, not validator eligibility'}


def run(db, reader, start_time, max_blocks=120):
    info = reader.rpc('status')['sync_info']
    safe = integer(info['latest_block_height'], 4) - 2
    if info['catching_up'] is not False or abs((datetime.now(timezone.utc) - instant(info['latest_block_time'])).total_seconds()) > 180:
        raise ValueError('RPC head is stale or syncing; retain cursor')
    identity = get_meta(db, 'identity')
    if identity:
        if (identity['startTime'], identity['rpc'], identity['rest'], identity['chain']) != (
                start_time, reader.rpc_base, reader.rest_base, CHAIN):
            raise ValueError('Start time/source/chain differs from saved history')
    else:
        first = first_height(reader, start_time, max(2, integer(info['earliest_block_height'], 1)), safe)
        initialize(db, start_time, first, reader.rpc_base, reader.rest_base)
        identity = get_meta(db, 'identity')
    last = get_meta(db, 'cursor')
    if last and last['height'] > safe:
        raise ValueError('RPC head behind saved cursor')
    if last:
        anchor = reader.rpc('commit', height=last['height'])
        if anchor.get('canonical') is not True or digest(anchor['signed_header']['commit']['block_id']['hash']).hex() != last['hash']:
            raise ValueError('Saved checkpoint no longer agrees with RPC')
    next_height = last['height'] + 1 if last else identity['firstHeight']
    # Take current state before catch-up work can consume the runtime budget.
    metadata_error = None
    sample = db.execute('SELECT epoch FROM snapshots ORDER BY height DESC LIMIT 1').fetchone()
    if not sample or time.time() - sample[0] >= 3600:
        try:
            header = reader.header(safe)
            data = reader.metadata(safe)
            raw = canonical(data).encode()
            with db:
                db.execute('INSERT OR IGNORE INTO snapshots VALUES (?,?,?,?)',
                           (safe, instant(header['time']).timestamp(), zlib.compress(raw), hashlib.sha256(raw).hexdigest()))
        except Exception as exc:
            metadata_error = f'{type(exc).__name__}: {exc}'
    error = None
    # Small batches bound memory and queued work. Persist each height atomically;
    # any missing height halts advancement even when later fetches succeed.
    with ThreadPoolExecutor(max_workers=2) as pool:
        end = min(safe + 1, next_height + max_blocks)
        while next_height < end and time.monotonic() < reader.deadline - 3:
            heights = list(range(next_height, min(end, next_height + 6)))
            futures = [pool.submit(reader.blocks, heights[i:i + 3]) for i in range(0, len(heights), 3)]
            for future in futures:
                try:
                    for value in future.result():
                        append(db, value)
                        next_height += 1
                except BudgetExhausted:
                    end = next_height
                    break
                except Exception as exc:
                    error = f'{type(exc).__name__}: {exc}'
                    break
            if error:
                break
    cursor = get_meta(db, 'cursor')
    if cursor:
        retain(db, cursor['time'])
    return report(db, safe, error, metadata_error)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--state-dir', type=Path, required=True)
    p.add_argument('--start-time', help='UTC coverage start, immutable after initialization')
    p.add_argument('--check', action='store_true', help='Read local freshness without network or writes')
    p.add_argument('--rpc', default=RPC)
    p.add_argument('--rest', default=REST)
    p.add_argument('--seconds', type=int, default=90)
    p.add_argument('--max-blocks', type=int, default=120)
    args = p.parse_args()
    if args.check:
        try:
            result = health(json.loads((args.state_dir / 'status.json').read_text()))
        except (OSError, ValueError):
            result = {'ok': False, 'issues': ['status-unavailable']}
        print(canonical(result))
        raise SystemExit(0 if result['ok'] else 1)
    if not args.start_time:
        p.error('--start-time is required for collection')
    instant(args.start_time)
    if not 15 <= args.seconds <= 300 or not 1 <= args.max_blocks <= 1000:
        p.error('Use 15..300 seconds and 1..1000 blocks')
    args.state_dir.mkdir(parents=True, exist_ok=True)
    os.umask(0o077)
    with (args.state_dir / 'collector.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('Validator history already running; no state changed')
        if shutil.disk_usage(args.state_dir).free < 512 * 1024**2:
            raise SystemExit('Less than 512 MiB free; history retained, collection stopped')
        db = connect(args.state_dir / 'history.sqlite3')
        try:
            try:
                result = run(db, Reader(args.rpc, args.rest, args.seconds), args.start_time, args.max_blocks)
            except Exception as exc:
                result = report(db, error=f'{type(exc).__name__}: {exc}')
            atomic_json(args.state_dir / 'status.json', result)
            print(canonical(result))
            db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
        finally:
            db.close()
        raise SystemExit(1 if result['status'] == 'blocked' or result['metadataError'] else 0)


if __name__ == '__main__':
    main()
