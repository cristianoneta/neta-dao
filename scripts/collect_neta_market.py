#!/usr/bin/env python3
"""Read-only minute observations for NETA. No wallets, signing or Treasury writes."""
from __future__ import annotations

import argparse
import base64
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import fcntl
import gzip
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import time
from urllib.parse import quote
from urllib.request import Request, urlopen

from treasury_history import block, instant
from wynd_market import read_pool

NETA = 'juno168ctmpyppk90d34p3jjy658zf5a5l3w8wk35wht6ccqj4mr0yv8s4j5awr'
PAIR = 'juno1h6x5jlvn6jhpnu63ufe4sgv4utyk8hsfl5rqnrpg2cvp6ccuq4lqwqnzra'
SPEC = ('JUNO / NETA', 'juno1uu3cewmpynvgsdu3lfqv2rh2n5nwtrguahkw64wjk99eg8r6fsss0e757x', PAIR,
        'juno1tlhf68k8aksl30mdf5yngudk6z8w4qqzvvauzr92w3gwm7er9p9qxvudu7')
ASSETS = {'JUNO': {'native': 'ujuno'}, 'NETA': {'token': NETA}}
PROVIDERS = ('https://juno-api.polkachu.com', 'https://juno.api.m.stavr.tech', 'https://juno-rest.publicnode.com')
ROOT = Path(__file__).resolve().parents[1]


def positive(value):
    number = Decimal(str(value))
    if not number.is_finite() or number <= 0:
        raise ValueError('Invalid positive decimal')
    return number


def atomic(path, content):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.market-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(name, 0o644)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def encoded(value):
    return json.dumps(value, separators=(',', ':'), allow_nan=False).encode()


class Reader:
    def __init__(self):
        self.requests = self.bytes = 0
        self.deadline = time.monotonic() + 38

    def __call__(self, url, timeout=5, height=None):
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Market collection time budget exceeded')
        headers = {'User-Agent': 'NETA-DAO-Treasury/1.0', 'Accept': 'application/json'}
        if height is not None:
            headers['x-cosmos-block-height'] = str(height)
        self.requests += 1
        with urlopen(Request(url, headers=headers), timeout=min(timeout, 5, remaining)) as response:
            if height is not None and response.headers.get('x-cosmos-block-height') != str(height):
                raise ValueError('Unconfirmed market query height')
            body = response.read(2_000_001)
            if len(body) > 2_000_000:
                raise ValueError('Oversized market response')
            self.bytes += len(body)
            return json.loads(body)


def usd_anchor(treasury, now):
    """Reuse the existing quote; its own timestamp never becomes a new observation."""
    market = treasury.get('wynd_market') or {}
    try:
        observed = market['price_observed_at']
        age = now - instant(observed).timestamp()
        if not -60 <= age <= 1800:
            return None
        value = positive(market['prices_usd']['ujuno'])
        if market.get('chain_id') != 'juno-1' or not market.get('price_source'):
            return None
        return {'price': str(value), 'observed_at': observed, 'source': market['price_source']}
    except (KeyError, ValueError, TypeError, InvalidOperation):
        return None


def sample(base, reader, treasury, now=None):
    now = time.time() if now is None else now
    anchor = block(reader, base, 'latest', 'juno-1')
    height = int(anchor['height'])
    if not -30 <= now - instant(anchor['time']).timestamp() <= 120:
        raise ValueError('Stale Juno block')
    def pinned(provider, path, at):
        return reader(provider + path, height=at)
    _, pool = read_pool(base, height, SPEC, ASSETS, read=pinned)
    query = quote(base64.b64encode(b'{"token_info":{}}').decode(), safe='')
    info = pinned(base, '/cosmwasm/wasm/v1/contract/' + NETA + '/smart/' + query, height)['data']
    if info.get('symbol') != 'NETA' or info.get('decimals') != 6:
        raise ValueError('NETA token identity mismatch')
    supply = positive(info['total_supply']) / Decimal(10**6)
    if block(reader, base, height, 'juno-1')['hash'] != anchor['hash']:
        raise ValueError('Market block changed during collection')
    reserves = pool['reserves']['assets']
    juno = positive(next(a['amount'] for a in reserves if a['info'] == ASSETS['JUNO'])) / Decimal(10**6)
    neta = positive(next(a['amount'] for a in reserves if a['info'] == ASSETS['NETA'])) / Decimal(10**6)
    ratio = juno / neta
    usd = usd_anchor(treasury, now)
    return {'time': int(now), 'observed_at': datetime.fromtimestamp(now, timezone.utc).isoformat().replace('+00:00', 'Z'),
            'height': height, 'block_hash': anchor['hash'], 'block_time': anchor['time'], 'provider': base,
            'price_juno': str(ratio), 'price_usd': str(ratio * Decimal(usd['price'])) if usd else None,
            'liquidity_usd': str(2 * juno * Decimal(usd['price'])) if usd else None,
            'reserve_juno': str(juno), 'reserve_neta': str(neta), 'total_supply': str(supply), 'usd_anchor': usd}


def database(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=3)
    if db.execute('PRAGMA user_version').fetchone()[0] not in (0, 1):
        db.close()
        raise ValueError('Unsupported market database version')
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA synchronous=FULL')
    db.execute('CREATE TABLE IF NOT EXISTS samples (minute INTEGER PRIMARY KEY, time INTEGER NOT NULL, payload TEXT NOT NULL)')
    db.execute('CREATE TABLE IF NOT EXISTS legacy (time INTEGER PRIMARY KEY, payload TEXT NOT NULL)')
    db.execute('CREATE TABLE IF NOT EXISTS aggregates (resolution INTEGER NOT NULL, bucket INTEGER NOT NULL, time INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(resolution,bucket))')
    if not db.execute('SELECT 1 FROM aggregates LIMIT 1').fetchone():
        for interval in (900, 86400):
            db.execute('INSERT OR IGNORE INTO aggregates SELECT ?, time / ?, time, payload FROM samples WHERE minute IN (SELECT MAX(minute) FROM samples GROUP BY minute / ?)',
                       (interval, interval, interval // 60))
        db.commit()
    db.execute('PRAGMA user_version=1')
    return db


def record(db, observation):
    """First complete observation per minute wins; retries never rewrite history."""
    previous = db.execute('SELECT payload FROM samples ORDER BY minute DESC LIMIT 1').fetchone()
    if previous:
        old = json.loads(previous[0])
        if observation['height'] < old['height'] or (observation['height'] == old['height'] and
                observation.get('block_hash') != old.get('block_hash')):
            raise ValueError('Market block regressed or conflicted')
    with db:
        result = db.execute('INSERT OR IGNORE INTO samples VALUES (?,?,?)',
                            (observation['time'] // 60, observation['time'], encoded(observation).decode()))
        if result.rowcount:
            for interval in (900, 86400):
                db.execute('INSERT INTO aggregates VALUES (?,?,?,?) ON CONFLICT(resolution,bucket) DO UPDATE SET time=excluded.time,payload=excluded.payload WHERE excluded.time>aggregates.time',
                           (interval, observation['time'] // interval, observation['time'], encoded(observation).decode()))
    return result.rowcount == 1


def import_legacy(db, history):
    if history.get('chain_id') != 'juno-1':
        raise ValueError('Wrong historical chain')
    # Do not freeze a still-changing current UTC day as a historical close.
    today = datetime.now(timezone.utc).date()
    with db:
        for row in history.get('snapshots', []):
            try:
                date = instant(row['generated_at'])
                if date.date() >= today:
                    continue
                asset = next(a for a in row['assets'] if a.get('key') == 'cw20:' + NETA)
                usd = positive(asset['usd_price'])
                juno_asset = next((a for a in row['assets'] if a.get('symbol') == 'JUNO' and a.get('key') == 'juno:native:ujuno'), None)
                juno = str(usd / positive(juno_asset['usd_price'])) if juno_asset and juno_asset.get('usd_price') else None
                value = {'time': int(date.timestamp()), 'price_usd': str(usd), 'price_juno': juno,
                         'source': 'historical-treasury-reference', 'height': row.get('height')}
                db.execute('INSERT OR IGNORE INTO legacy VALUES (?,?)', (value['time'], encoded(value).decode()))
            except (KeyError, ValueError, TypeError, StopIteration, InvalidOperation):
                continue


def rows(db, start=0):
    return [json.loads(r[0]) for r in db.execute('SELECT payload FROM samples WHERE minute>=? AND time>=? ORDER BY minute', (start // 60, start))]


def series(db, interval, start, now):
    if interval >= 900:
        # Incremental aggregates avoid loading a growing minute archive for
        # every publication. Long views read hundreds of daily rows, not years
        # of individual samples. These are reference prices, never trade OHLC.
        observations = [json.loads(r[0]) for r in db.execute('SELECT payload FROM aggregates WHERE resolution=? AND bucket>=? AND time>=? ORDER BY bucket',
                        (interval, start // interval, start))]
    else:
        observations = rows(db, start)
    result = [{'time': o['time'], 'usd': o['price_usd'], 'juno': o['price_juno'], 'total_supply': o.get('total_supply'), 'kind': 'pool-observation'} for o in observations]
    if interval >= 86400:
        first_day = observations[0]['time'] // 86400 if observations else now // 86400 + 1
        old = [json.loads(r[0]) for r in db.execute('SELECT payload FROM legacy WHERE time>=? ORDER BY time', (start,))]
        result = [{'time': o['time'], 'usd': o['price_usd'], 'juno': o['price_juno'], 'kind': 'treasury-daily'}
                  for o in old if o['time'] // 86400 < first_day] + result
    return {'schema_version': 1, 'generated_at': now, 'resolution_seconds': interval,
            'method': 'observed-reference-prices', 'points': result}


def publish(db, destination, archive, now=None):
    now = int(time.time()) if now is None else now
    current = json.loads(db.execute('SELECT payload FROM samples ORDER BY minute DESC LIMIT 1').fetchone()[0])
    first = db.execute('SELECT time FROM samples ORDER BY minute LIMIT 1').fetchone()[0]
    previous = db.execute('SELECT payload FROM samples WHERE minute>=? AND minute<=? AND time<=? ORDER BY minute DESC LIMIT 1',
                          ((current['time'] - 86700) // 60, (current['time'] - 86400) // 60, current['time'] - 86400)).fetchone()
    change = None
    if previous:
        old = json.loads(previous[0])
        if old['price_usd'] and current['price_usd']:
            change = str((Decimal(current['price_usd']) / Decimal(old['price_usd']) - 1) * 100)
    payload = {'schema_version': 1, 'chain_id': 'juno-1', 'mode': 'minute', 'interval_seconds': 60,
               'generated_at': datetime.fromtimestamp(now, timezone.utc).isoformat().replace('+00:00', 'Z'),
               'token': NETA, 'pool': PAIR, 'first_minute_at': first, 'current': current, 'change_24h_pct': change}
    destination, archive = Path(destination), Path(archive)
    atomic(destination / 'current.json', encoded(payload))
    for name, interval, days in [('1d', 60, 1), ('7d', 900, 7), ('1m', 86400, 31), ('3m', 86400, 93), ('all', 86400, 0)]:
        value = series(db, interval, now - days * 86400 if days else 0, now)
        atomic(destination / (name + '.json'), encoded(value))
    # Existing encrypted infrastructure backups include collector-archive. Export
    # only observed records; retain SQLite and every daily export indefinitely.
    for offset in (0, 86400):
        start = current['time'] // 86400 * 86400 - offset
        day = datetime.fromtimestamp(start, timezone.utc).strftime('%Y-%m-%d')
        observed = [row for row in rows(db, start) if row['time'] < start + 86400]
        if observed:
            export = {'schema_version': 1, 'chain_id': 'juno-1', 'day': day, 'observations': observed}
            atomic(archive / (day + '.json.gz'), gzip.compress(encoded(export), mtime=0))
    legacy = [json.loads(r[0]) for r in db.execute('SELECT payload FROM legacy ORDER BY time')]
    atomic(archive / 'treasury-daily.json.gz', gzip.compress(encoded({'schema_version': 1, 'observations': legacy}), mtime=0))
    return payload


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--state', default='/var/lib/cosmoot-marketdata')
    p.add_argument('--output', default='/srv/cosmoot/public-snapshots/markets/data/markets/neta')
    p.add_argument('--archive', default='/var/lib/cosmoot-collect/archive/market-data/neta')
    p.add_argument('--treasury', default=str(ROOT / 'data/treasury/current.json'))
    p.add_argument('--history', default=str(ROOT / 'data/treasury/neta-main-history.json'))
    p.add_argument('--archive-lock', default='/var/lib/cosmoot-collect/collector.lock')
    p.add_argument('--probe', action='store_true', help='Read-only live validation; no files or database writes')
    args = p.parse_args()
    treasury = json.loads(Path(args.treasury).read_text())
    reader = Reader()
    errors = []
    preferred = (treasury.get('wynd_market') or {}).get('source')
    candidates = ([preferred] if preferred in PROVIDERS else []) + [x for x in PROVIDERS if x != preferred]
    for base in candidates:
        try:
            observation = sample(base, reader, treasury)
            break
        except Exception as error:
            errors.append(type(error).__name__ + ': ' + str(error))
    else:
        raise RuntimeError('No accepted market observation: ' + ' | '.join(errors))
    if args.probe:
        print(json.dumps({'probe': observation, 'requests': reader.requests, 'response_bytes': reader.bytes}))
        return
    state = Path(args.state)
    state.mkdir(parents=True, exist_ok=True)
    with (state / 'collector.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with database(state / 'neta.sqlite3') as db:
            import_legacy(db, json.loads(Path(args.history).read_text()))
            inserted = record(db, observation)
            # Coordinate archive exports with the existing encrypted backup.
            # A busy backup leaves the DB intact; the next minute retries export.
            with open(args.archive_lock, 'r') as archive_lock:
                fcntl.flock(archive_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                published = publish(db, args.output, args.archive)
    print(json.dumps({'ok': True, 'inserted': inserted, 'height': published['current']['height'],
                      'usd_available': bool(observation['usd_anchor']), 'requests': reader.requests, 'response_bytes': reader.bytes}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'ok': False, 'error': str(error)}), file=sys.stderr)
        raise SystemExit(1)
