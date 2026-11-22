#!/usr/bin/env python3
"""Archive direct chain and external-price observations. No website or wallet dependency."""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import fcntl
import gzip
import json
from pathlib import Path
import re
import sys
import time
from urllib.request import Request, urlopen
from collect_neta_market import atomic, database, encoded, record as record_pool, rows
from market_direct_sources import DirectSources

CONFIG = Path(__file__).with_name('cosmos_market_sources.json')
_DIRECT = None


def stamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()


def positive(value):
    try:
        n = Decimal(str(value))
        return n.is_finite() and n > 0
    except Exception:
        return False


def read(path):
    global _DIRECT
    if _DIRECT is None:
        _DIRECT = DirectSources(json.loads(CONFIG.read_text()))
    return _DIRECT.read(path)


def validate(raw, spec, now):
    if raw.get('schema_version') != 1 or raw.get('chain_id') != spec['chain'] or raw.get('token') != spec['denom'] or str(raw.get('pool')) != spec['pool']:
        raise ValueError('Market identity mismatch')
    c = raw['current']
    if spec.get('referenceKind') == 'external-reference':
        source = c.get('price_source') or {}
        if (c.get('reference_kind') != 'external-reference' or source.get('provider') != 'coingecko'
                or source.get('asset_id') != spec['priceId'] or source.get('currency') != 'usd'
                or c.get('price_observed_at') != source.get('observed_at')
                or not -60 <= now - stamp(source['observed_at']) <= 1800
                or not -60 <= now - stamp(c['observed_at']) <= 180
                or c.get('time') != int(stamp(c['observed_at']))
                or not positive(c.get('price_usd')) or c.get('price_quote') != c['price_usd']
                or c.get('quote_symbol') != 'USD'
                or any(c.get(k) is not None for k in ('height', 'block_hash', 'block_time', 'liquidity_usd', 'reserve_token', 'usd_anchor'))):
            raise ValueError('Invalid external price evidence')
        return dict(c)
    if not isinstance(c.get('height'), int) or c['height'] <= 0 or not re.fullmatch('[a-fA-F0-9]{64}', c.get('block_hash', '')):
        raise ValueError('Invalid block evidence')
    if not -60 <= now - stamp(c['block_time']) <= 180 or not -60 <= now - stamp(c['observed_at']) <= 180:
        raise ValueError('Stale pool observation')
    if c['time'] != int(stamp(c['observed_at'])) or not positive(c.get('price_quote')):
        raise ValueError('Invalid price observation')
    usd = c.get('usd_anchor')
    if c.get('price_usd') is not None:
        if not usd or not -60 <= now - stamp(usd['observed_at']) <= 1800 or not positive(usd.get('price')) or not positive(c['price_usd']):
            raise ValueError('Invalid USD reference')
        expected = Decimal(str(c['price_quote'])) * Decimal(str(usd['price']))
        if abs(Decimal(str(c['price_usd'])) / expected - 1) > Decimal('0.000000001'):
            raise ValueError('USD conversion mismatch')
    return dict(c)


def valid_supply(value, spec, now):
    if not isinstance(value, dict):
        return False
    interval = spec.get('supplyInterval') or (300 if spec.get('alloyContract') else 604800)
    try:
        if (value['denom'] != spec.get('supplyDenom', spec['denom']) or not positive(value['total_supply'])
                or not -60 <= now - stamp(value['observed_at']) <= interval):
            return False
        if spec.get('supplyKind') == 'solana':
            return (value.get('chain_id') == spec['chain'] and value.get('genesis_hash') == spec['genesisHash']
                    and type(value.get('slot')) is int and value['slot'] > 0 and value.get('height') is None
                    and re.fullmatch(r'[0-9]+', value.get('total_supply_raw', '')) is not None
                    and abs(Decimal(str(value['total_supply'])) / (Decimal(value['total_supply_raw']) / Decimal(10)**spec['decimals']) - 1) < Decimal('0.000000001')
                    and -60 <= stamp(value['observed_at']) - stamp(value['block_time']) <= 180)
        if spec.get('supplyKind') == 'erc20':
            issued, burned, total = (Decimal(value[k]) for k in ('issued_supply_raw', 'burned_supply_raw', 'total_supply_raw'))
            return (value.get('chain_id') == 'ethereum' and type(value.get('height')) is int and value['height'] > 0
                    and re.fullmatch('[a-fA-F0-9]{64}', value.get('block_hash', '')) is not None
                    and issued > 0 and 0 <= burned < issued and issued - burned == total
                    and value.get('burn_address') == spec.get('burnAddress') and (spec.get('burnAddress') or burned == 0)
                    and abs(Decimal(str(value['total_supply'])) / (total / Decimal(10)**spec['decimals']) - 1) < Decimal('0.000000001')
                    and -60 <= stamp(value['observed_at']) - stamp(value['block_time']) <= 1800)
        return (type(value.get('height')) is int and value['height'] > 0
                or spec['chain'] == 'gnoland-1' and value.get('state_query') == 'latest-state-unpinned')
    except (KeyError, ValueError, TypeError, InvalidOperation, ZeroDivisionError):
        return False


def native_solana_supply(spec, rpc=None):
    """Weekly native supply read with finalized-slot and genesis evidence."""
    if spec.get('supplyKind') != 'solana' or spec.get('supplyBase') != 'https://api.mainnet-beta.solana.com':
        raise ValueError('Unverified Solana source')
    if rpc is None:
        def rpc(method, params):
            data = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}).encode()
            req = Request(spec['supplyBase'], data=data, headers={'Content-Type': 'application/json', 'User-Agent': 'NETA-DAO-Treasury/1.0'})
            with urlopen(req, timeout=18) as response:
                body = response.read(200001)
            if len(body) > 200000:
                raise ValueError('Oversized supply response')
            value = json.loads(body)
            if value.get('jsonrpc') != '2.0' or value.get('id') != 1 or value.get('error'):
                raise ValueError('Invalid native supply RPC')
            return value['result']
    genesis = rpc('getGenesisHash', [])
    supply = rpc('getSupply', [{'commitment': 'finalized', 'excludeNonCirculatingAccountsList': True}])
    slot, total = supply['context']['slot'], supply['value']['total']
    if type(total) is not int or type(slot) is not int or total <= 0 or slot <= 0 or genesis != spec['genesisHash']:
        raise ValueError('Invalid native Solana identity')
    block_time = rpc('getBlockTime', [slot])
    value = {'denom': spec['denom'], 'chain_id': spec['chain'], 'genesis_hash': genesis, 'slot': slot,
             'total_supply_raw': str(total), 'total_supply': str(Decimal(total) / Decimal(10)**spec['decimals']),
             'observed_at': datetime.now(timezone.utc).isoformat(),
             'block_time': datetime.fromtimestamp(block_time, timezone.utc).isoformat(),
             'source': 'Solana getSupply · finalized', 'url': spec['supplyBase'], 'interval_seconds': 604800,
             'scope': 'Native SOL total; includes non-circulating supply'}
    if not valid_supply(value, spec, time.time()):
        raise ValueError('Invalid native Solana supply evidence')
    return value


def sample(slug, spec, previous=None, now=None, fetch=read):
    raw = fetch('/api/observations?asset=' + slug)
    now = time.time() if now is None else now
    current = validate(raw, spec, now)
    supply = previous
    if not valid_supply(supply, spec, now):
        try:
            supply = fetch('/api/supply?asset=' + slug)
        except Exception:
            supply = None
    if not valid_supply(supply, spec, now) and spec.get('supplyKind') == 'solana':
        try:
            supply = native_solana_supply(spec)
        except Exception:
            supply = None
    if not valid_supply(supply, spec, now):
        supply = None
    current['total_supply'] = supply['total_supply'] if supply else None
    current['supply_observation'] = supply
    current['supply_basis'] = ('dated-reference' if spec.get('alloyContract') or spec.get('supplyInterval') else 'weekly-reference') if supply else 'unavailable'
    current['supply_reference_at'] = supply['observed_at'] if supply else None
    current['source_label'] = raw.get('source_label')
    return current


def record(db, observation):
    if observation.get('reference_kind') != 'external-reference':
        return record_pool(db, observation)
    # External observations have provider timestamps, never synthetic block heights.
    previous = db.execute('SELECT payload FROM samples ORDER BY minute DESC LIMIT 1').fetchone()
    if previous:
        old = json.loads(previous[0])
        source, prior = observation['price_source'], old['price_source']
        at, before = stamp(source['observed_at']), stamp(prior['observed_at'])
        if (observation['time'] < old['time'] or at < before
                or any(source[k] != prior[k] for k in ('provider', 'asset_id', 'currency'))
                or at == before and Decimal(str(observation['price_usd'])) != Decimal(str(old['price_usd']))):
            raise ValueError('External price evidence regressed or conflicted')
    with db:
        result = db.execute('INSERT OR IGNORE INTO samples VALUES (?,?,?)',
                            (observation['time'] // 60, observation['time'], encoded(observation).decode()))
        if result.rowcount:
            for interval in (900, 86400):
                db.execute('INSERT INTO aggregates VALUES (?,?,?,?) ON CONFLICT(resolution,bucket) DO UPDATE SET time=excluded.time,payload=excluded.payload WHERE excluded.time>aggregates.time',
                           (interval, observation['time'] // interval, observation['time'], encoded(observation).decode()))
    return result.rowcount == 1


def publish(db, spec, destination, archive, now):
    destination.mkdir(parents=True, exist_ok=True, mode=0o755)
    destination.chmod(0o755)
    current = json.loads(db.execute('SELECT payload FROM samples ORDER BY minute DESC LIMIT 1').fetchone()[0])
    identity = {'schema_version': 1, 'chain_id': spec['chain'], 'token': spec['denom'], 'pool': spec['pool']}
    previous = db.execute('SELECT payload FROM samples WHERE time BETWEEN ? AND ? ORDER BY time DESC LIMIT 1',
                          (current['time'] - 86700, current['time'] - 86400)).fetchone()
    change = None
    if previous:
        old = json.loads(previous[0])
        if positive(old.get('price_usd')) and positive(current.get('price_usd')):
            change = str((Decimal(str(current['price_usd'])) / Decimal(str(old['price_usd'])) - 1) * 100)
    payload = dict(identity, mode='minute', interval_seconds=60, current=current, generated_at=now,
                   source_label=current.get('source_label'), change_24h_pct=change)
    atomic(destination / 'current.json', encoded(payload))
    for name, interval, days in [('1d', 60, 1), ('7d', 900, 7), ('1m', 86400, 31), ('3m', 86400, 93), ('all', 86400, 0)]:
        start = now - days * 86400 if days else 0
        samples = rows(db, start) if interval == 60 else [json.loads(r[0]) for r in db.execute(
            'SELECT payload FROM aggregates WHERE resolution=? AND time>=? ORDER BY bucket', (interval, start))]
        points = [{'time': o['time'], 'usd': o.get('price_usd'), 'juno': None, 'kind': spec.get('referenceKind', 'pool-observation'),
                   'total_supply': o.get('total_supply'), 'supply_basis': o.get('supply_basis'),
                   'supply_reference_at': o.get('supply_reference_at')} for o in samples]
        atomic(destination / (name + '.json'), encoded(dict(identity, generated_at=now, resolution_seconds=interval, points=points)))
    for offset in (0, 86400):
        start = current['time'] // 86400 * 86400 - offset
        samples = [o for o in rows(db, start) if o['time'] < start + 86400]
        if samples:
            day = datetime.fromtimestamp(start, timezone.utc).strftime('%Y-%m-%d')
            atomic(archive / (day + '.json.gz'), gzip.compress(encoded(dict(identity, day=day, observations=samples)), mtime=0))
    return payload


def main():
    global _DIRECT
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--state', default='/var/lib/cosmoot-marketdata/cosmos')
    p.add_argument('--output', default='/srv/cosmoot/public-snapshots/markets/data/markets')
    p.add_argument('--archive', default='/var/lib/cosmoot-collect/archive/market-data')
    p.add_argument('--archive-lock', default='/var/lib/cosmoot-collect/collector.lock')
    p.add_argument('--config', default=str(CONFIG))
    p.add_argument('--treasury', default=str(Path(__file__).resolve().parents[1] / 'data/treasury/current.json'))
    p.add_argument('--probe', action='store_true')
    args = p.parse_args()
    specs = json.loads(Path(args.config).read_text())
    _DIRECT = DirectSources(specs, treasury=args.treasury)
    now = int(time.time())
    state, output, archive = map(Path, (args.state, args.output, args.archive))
    if not args.probe:
        state.mkdir(parents=True, exist_ok=True)
        lock = (state / 'collector.lock').open('a')
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    previous = {}
    for slug in specs:
        path = output / slug / 'current.json'
        if path.exists():
            try:
                previous[slug] = json.loads(path.read_text())['current'].get('supply_observation')
            except (KeyError, ValueError):
                pass
    observed, errors = {}, {}
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(sample, slug, spec, previous.get(slug)): slug for slug, spec in specs.items()}
        for future in as_completed(futures):
            slug = futures[future]
            try:
                observed[slug] = future.result()
            except Exception as error:
                errors[slug] = str(error)
    if not args.probe:
        now = int(time.time())
        # Commit each successful chain independently; never discard another asset's progress.
        for slug, current in observed.items():
            with database(state / (slug + '.sqlite3')) as db:
                record(db, current)
        with open(args.archive_lock, 'r') as backup_lock:
            fcntl.flock(backup_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            for slug in observed:
                with database(state / (slug + '.sqlite3')) as db:
                    publish(db, specs[slug], output / slug, archive / slug, now)
    result = {'ok': not errors, 'probe': args.probe, 'source_mode': 'direct', 'requests': _DIRECT.http.requests, 'response_bytes': _DIRECT.http.bytes, 'observations': {slug: {'height': o.get('height'), 'reference_kind': o.get('reference_kind', 'chain-reference'), 'time': o['time'],
              'price_usd': o.get('price_usd'), 'supply_at': (o.get('supply_observation') or {}).get('observed_at')} for slug, o in observed.items()}, 'errors': errors}
    print(json.dumps(result))
    if errors:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
