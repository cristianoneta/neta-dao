#!/usr/bin/env python3
"""Read-only NETA pool snapshots and rolling 24-hour indexed swap volume."""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal
import fcntl
import gzip
import json
from pathlib import Path
import re
import sqlite3
import sys
import time
from urllib.parse import urlencode

from collect_neta_market import NETA, PAIR, PROVIDERS, Reader, ROOT, atomic, encoded, positive, sample
from treasury_history import block, instant

OSMO_NETA = 'ibc/297C64CC42B5A8D8F82FE2EBE208A6FE8F94B86037FA28C4529A23701C228F7A'
JUNO_OSMO = 'ibc/ED07A3391A112B175915CD8FAF43A2DA8E4790EDE12566649D0C2F97716B8518'
OSMO_ADDRESS = 'osmo1yn7z42al3mafmztjayjduz42a8at3whyd279fkdsyumzar83x8mqvpw83x'
POOLS = (
    {'id': 'wynd-juno-neta', 'chain_id': 'juno-1', 'venue': 'WYND', 'pair': 'NETA / JUNO',
     'pool': PAIR, 'quote': 'JUNO', 'denom': 'ujuno', 'neta': NETA,
     'query': "wasm._contract_address='" + PAIR + "'", 'providers': PROVIDERS, 'step': 50000},
    {'id': 'osmosis-631', 'chain_id': 'osmosis-1', 'venue': 'Osmosis', 'pair': 'NETA / OSMO',
     'pool': '631', 'quote': 'OSMO', 'denom': 'uosmo', 'neta': OSMO_NETA,
     'query': "token_swapped.pool_id='631'",
     'providers': ('https://lcd.osmosis.zone', 'https://osmosis-api.polkachu.com', 'https://osmosis-rest.publicnode.com'), 'step': 150000},
)


def iso(seconds):
    return datetime.fromtimestamp(seconds, timezone.utc).isoformat().replace('+00:00', 'Z')


def quote_usd(treasury, denom, now):
    m = treasury.get('wynd_market') or {}
    try:
        at = m['price_observed_at']
        if m['chain_id'] != 'juno-1' or not -60 <= now - instant(at).timestamp() <= 1800:
            return None
        return {'price': str(positive(m['prices_usd'][denom])), 'observed_at': at, 'source': m['price_source']}
    except (KeyError, ValueError, TypeError, ArithmeticError):
        return None


def osmosis_snapshot(base, reader, treasury, now):
    tip = block(reader, base, 'latest', 'osmosis-1')
    height = int(tip['height'])
    if not -30 <= now - instant(tip['time']).timestamp() <= 120:
        raise ValueError('Stale Osmosis block')
    # Osmosis LCDs omit a response-height confirmation. Read latest state and
    # disclose the bracketing blocks instead of claiming an exact state height.
    p = reader(base + '/osmosis/gamm/v1beta1/pools/631')['pool']
    trace = reader(base + '/ibc/apps/transfer/v1/denom_traces/' + OSMO_NETA[4:])['denom_trace']
    if trace != {'path': 'transfer/channel-169', 'base_denom': 'cw20:' + NETA}:
        raise ValueError('Unexpected Osmosis NETA denomination trace')
    if (p.get('@type') != '/osmosis.gamm.v1beta1.Pool' or p['id'] != '631' or
            p['address'] != OSMO_ADDRESS or len(p['pool_assets']) != 2 or
            p['pool_params'].get('smooth_weight_change_params') is not None):
        raise ValueError('Unexpected Osmosis pool identity')
    assets = {a['token']['denom']: a for a in p['pool_assets']}
    if set(assets) != {OSMO_NETA, 'uosmo'}:
        raise ValueError('Unexpected Osmosis pool assets')
    n, q = assets[OSMO_NETA], assets['uosmo']
    wn, wq = positive(n['weight']), positive(q['weight'])
    if wn + wq != positive(p['total_weight']):
        raise ValueError('Inconsistent pool weights')
    neta, osmo = positive(n['token']['amount']) / 10**6, positive(q['token']['amount']) / 10**6
    price = osmo / neta * wn / wq
    usd = quote_usd(treasury, JUNO_OSMO, now)
    fee = positive(p['pool_params']['swap_fee'])
    if fee >= 1:
        raise ValueError('Invalid pool fee')
    after = block(reader, base, 'latest', 'osmosis-1')
    if int(after['height']) < height or block(reader, base, height, 'osmosis-1')['hash'] != tip['hash']:
        raise ValueError('Osmosis observation block changed')
    return {'height': height, 'block_hash': tip['hash'], 'block_time': tip['time'], 'observed_at': iso(now),
            'provider': base, 'state_height': None, 'state_query': 'latest-between-blocks',
            'state_height_range': [height, int(after['height'])],
            'reserve_neta': str(neta), 'reserve_quote': str(osmo), 'price_quote': str(price),
            'liquidity_usd': str((neta * price + osmo) * Decimal(usd['price'])) if usd else None,
            'usd_anchor': usd, 'fee_pct': str(fee * 100), 'weights': [str(wn / (wn + wq)), str(wq / (wn + wq))]}


def swap_events(tx, spec):
    """One quote leg per pool execution; ignore failures and unrelated route hops."""
    if int(tx['code']) != 0:
        return []
    if not isinstance(tx.get('events'), list):
        raise ValueError('Execution events unavailable')
    result = []
    for index, event in enumerate(tx['events']):
        if event['type'] not in ('wasm', 'token_swapped'):
            continue
        attrs = event['attributes']
        a = {v['key']: v['value'] for v in attrs}
        if event['type'] == 'wasm':
            if spec['venue'] != 'WYND' or a.get('_contract_address') != spec['pool'] or a.get('action') != 'swap':
                continue
            incoming, outgoing = a['offer_asset'], a['ask_asset']
            offered, returned = a['offer_amount'], a['return_amount']
        else:
            if spec['venue'] != 'Osmosis' or a.get('pool_id') != spec['pool']:
                continue
            ins = re.fullmatch(r'([0-9]+)([^0-9].*)', a['tokens_in'])
            outs = re.fullmatch(r'([0-9]+)([^0-9].*)', a['tokens_out'])
            if not ins or not outs:
                raise ValueError('Invalid swap coins')
            offered, incoming = ins.groups()
            returned, outgoing = outs.groups()
        if len(a) != len(attrs) or {incoming, outgoing} != {spec['denom'], spec['neta']}:
            raise ValueError('Ambiguous swap event')
        if not re.fullmatch(r'[1-9][0-9]{0,38}', offered) or not re.fullmatch(r'[1-9][0-9]{0,38}', returned):
            raise ValueError('Invalid swap amount')
        result.append({'txhash': tx['txhash'].upper(), 'event_index': index, 'height': int(tx['height']),
                       'time': int(instant(tx['timestamp']).timestamp()),
                       'quote_amount': str(Decimal(offered if incoming == spec['denom'] else returned) / 10**6),
                       'neta_amount': str(Decimal(offered if incoming == spec['neta'] else returned) / 10**6)})
    return result


def volume(reader, base, spec, snapshot, now):
    # A small lag lets the provider's transaction index catch up with consensus.
    end = block(reader, base, snapshot['height'] - 20, spec['chain_id'])
    end_at = instant(end['time']).timestamp()
    if not 0 <= now - end_at <= 600:
        raise ValueError('Swap index anchor is stale')
    start_at = end_at - 86400
    floor = None
    for scale in (1, 2, 4):
        floor = block(reader, base, max(1, int(end['height']) - spec['step'] * scale), spec['chain_id'])
        if instant(floor['time']).timestamp() <= start_at:
            break
    else:
        raise ValueError('Cannot establish 24-hour scan boundary')
    query = spec['query'] + f" AND tx.height>={floor['height']} AND tx.height<={end['height']}"
    seen, trades, expected = set(), [], None
    for page in range(1, 21):
        data = reader(base + '/cosmos/tx/v1beta1/txs?' + urlencode({
            'query': query, 'page': page, 'limit': 100, 'order_by': 'ORDER_BY_ASC'}))
        total = int(data['total'])
        batch = data.get('tx_responses')
        if total < 0 or (expected is not None and expected != total) or not isinstance(batch, list):
            raise ValueError('Unstable swap index')
        expected = total
        if not batch and len(seen) != total:
            raise ValueError('Truncated swap index')
        for tx in batch:
            digest = tx['txhash'].upper()
            at = instant(tx['timestamp']).timestamp()
            if (not re.fullmatch(r'[A-F0-9]{64}', digest) or digest in seen or
                    not int(floor['height']) <= int(tx['height']) <= int(end['height']) or
                    not instant(floor['time']).timestamp() - 1 <= at <= end_at):
                raise ValueError('Invalid swap receipt')
            seen.add(digest)
            parsed = swap_events(tx, spec)
            if start_at < at <= end_at:
                trades.extend(parsed)
        if len(seen) > total:
            raise ValueError('Invalid swap count')
        if len(seen) == total:
            break
    else:
        raise ValueError('Swap pagination limit reached')
    # A known matching receipt verifies that this provider indexes the selector.
    control = reader(base + '/cosmos/tx/v1beta1/txs?' + urlencode({
        'query': spec['query'] + f" AND tx.height<={end['height']}", 'page': 1, 'limit': 1, 'order_by': 'ORDER_BY_DESC'}))
    controls = control.get('tx_responses') or []
    if len(controls) != 1 or not swap_events(controls[0], spec):
        raise ValueError('Pool swap index control unavailable')
    control_at = instant(controls[0]['timestamp']).timestamp()
    if start_at < control_at <= end_at and controls[0]['txhash'].upper() not in seen:
        raise ValueError('Swap index omitted a known receipt')
    if block(reader, base, int(end['height']), spec['chain_id'])['hash'] != end['hash']:
        raise ValueError('Volume anchor changed')
    amount = sum((Decimal(t['quote_amount']) for t in trades), Decimal(0))
    usd = snapshot.get('usd_anchor')
    return {'status': 'complete', 'window_start': iso(start_at), 'window_end': end['time'],
            'observed_at': iso(now), 'height': int(end['height']), 'block_hash': end['hash'],
            'quote_amount': str(amount), 'quote_symbol': spec['quote'], 'swaps': len(trades),
            'usd': str(amount * Decimal(usd['price'])) if usd else None,
            'usd_valuation': 'quote-leg-at-current-usd-reference', 'usd_anchor': usd,
            'coverage': 'provider-index', 'source': base}, trades


def collect_pool(spec, treasury, now):
    reader = Reader()
    reader.deadline = time.monotonic() + 75
    errors = []
    partial = None
    for base in spec['providers']:
        now = int(time.time())
        try:
            if spec['venue'] == 'WYND':
                s = sample(base, reader, treasury, now)
                snapshot = {**s, 'reserve_quote': s['reserve_juno'], 'price_quote': s['price_juno'],
                            'fee_pct': '0.30', 'weights': ['0.5', '0.5']}
            else:
                snapshot = osmosis_snapshot(base, reader, treasury, now)
            try:
                measured, trades = volume(reader, base, spec, snapshot, now)
            except Exception as error:
                measured, trades = {'status': 'unavailable', 'reason': str(error), 'quote_symbol': spec['quote']}, []
            result = {k: spec[k] for k in ('id', 'chain_id', 'venue', 'pair', 'pool', 'quote')} | {
                'status': 'ok', 'observation': snapshot, 'volume_24h': measured}, trades
            if measured['status'] == 'complete':
                return result
            partial = result
        except Exception as error:
            errors.append(type(error).__name__ + ': ' + str(error))
    if partial:
        return partial
    return {k: spec[k] for k in ('id', 'chain_id', 'venue', 'pair', 'pool', 'quote')} | {
        'status': 'unavailable', 'observation': None, 'volume_24h': {'status': 'unavailable'},
        'reason': ' | '.join(errors)}, []


def save(db, pool, trades, now):
    db.execute('CREATE TABLE IF NOT EXISTS swaps (pool TEXT, txhash TEXT, event_index INTEGER, time INTEGER, payload TEXT, PRIMARY KEY(pool,txhash,event_index))')
    db.execute('CREATE INDEX IF NOT EXISTS swaps_time ON swaps(time)')
    db.execute('CREATE TABLE IF NOT EXISTS scans (pool TEXT, time INTEGER, payload TEXT, PRIMARY KEY(pool,time))')
    with db:
        for t in trades:
            key = (pool['id'], t['txhash'], t['event_index'])
            body = encoded(t).decode()
            prior = db.execute('SELECT payload FROM swaps WHERE pool=? AND txhash=? AND event_index=?', key).fetchone()
            if prior and prior[0] != body:
                raise ValueError('Previously recorded swap changed')
            db.execute('INSERT OR IGNORE INTO swaps VALUES (?,?,?,?,?)', (*key, t['time'], body))
        db.execute('INSERT OR IGNORE INTO scans VALUES (?,?,?)', (pool['id'], now, encoded(pool).decode()))


def publish(db, pools, output, archive, now):
    payload = {'schema_version': 1, 'generated_at': iso(now), 'interval_seconds': 300, 'pools': pools}
    for offset in (0, 86400):
        start = now // 86400 * 86400 - offset
        scans = [json.loads(r[0]) for r in db.execute('SELECT payload FROM scans WHERE time>=? AND time<? ORDER BY time,pool', (start, start + 86400))]
        swaps = [{'pool': r[0], **json.loads(r[1])} for r in db.execute('SELECT pool,payload FROM swaps WHERE time>=? AND time<? ORDER BY time,pool,txhash,event_index', (start, start + 86400))]
        if scans or swaps:
            atomic(Path(archive) / (iso(start)[:10] + '.json.gz'), gzip.compress(encoded({'schema_version': 1, 'scans': scans, 'swaps': swaps}), mtime=0))
    atomic(output, encoded(payload))
    return payload


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--treasury', default=str(ROOT / 'data/treasury/current.json'))
    p.add_argument('--state', default='/var/lib/cosmoot-marketdata')
    p.add_argument('--output', default='/srv/cosmoot/public-snapshots/markets/data/markets/neta/pools.json')
    p.add_argument('--archive', default='/var/lib/cosmoot-collect/archive/market-data/neta-pools')
    p.add_argument('--archive-lock', default='/var/lib/cosmoot-collect/collector.lock')
    p.add_argument('--probe', action='store_true')
    args = p.parse_args()
    treasury = json.loads(Path(args.treasury).read_text())
    now = int(time.time())
    with ThreadPoolExecutor(max_workers=2) as workers:
        results = list(workers.map(lambda spec: collect_pool(spec, treasury, now), POOLS))
    pools = [item[0] for item in results]
    if args.probe:
        print(json.dumps({'pools': pools}))
        return
    state = Path(args.state)
    state.mkdir(parents=True, exist_ok=True)
    with (state / 'pools.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with sqlite3.connect(state / 'pools.sqlite3', timeout=3) as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('PRAGMA synchronous=FULL')
            for pool, trades in results:
                save(db, pool, trades, now)
            with open(args.archive_lock, 'r') as archive_lock:
                fcntl.flock(archive_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                publish(db, pools, args.output, args.archive, now)
    print(json.dumps({'pools': [{'id': p['id'], 'status': p['status'], 'volume': p['volume_24h']['status']} for p in pools]}))
    if any(p['status'] != 'ok' or p['volume_24h']['status'] != 'complete' for p in pools):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
