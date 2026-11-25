#!/usr/bin/env python3
"""Five-asset Cosmos pool pilot: direct reserves, incremental indexed swaps, byte accounting."""
from __future__ import annotations

import argparse
import base64
from concurrent.futures import ThreadPoolExecutor, as_completed
from decimal import Decimal
import fcntl
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import stat
import time
from urllib.parse import urlencode

from collect_neta_market import atomic, encoded
from market_archive_lock import acquire_archive_lock
from pool_pilot_history import schema as history_schema, freeze_values, stored_value, publish_histories
from market_direct_sources import HTTP, DirectSources, JUNO, OSMOSIS, block, decimal, fallback, fresh, iso, smart_path, stamp

ASSETS = ('btc', 'eth', 'sol', 'atom', 'juno')
CHAINS = {
    # Some forks count matching events instead of unique transactions. Prefer
    # the public LCD; verify alternate pagination semantics against receipts.
    'osmosis-1': {'providers': ('https://lcd.osmosis.zone', *OSMOSIS), 'selector': 'token_swapped.pool_id EXISTS'},
    'juno-1': {'providers': JUNO, 'selector': 'wasm._contract_address EXISTS'},
    'injective-1': {'providers': ('https://sentry.lcd.injective.network', 'https://injective-api.polkachu.com'), 'selector': "wasm.action='swap'"},
}
EXCLUDED_CODES = {814, 867, 996, 148, 254, 885}
EXCLUDED_POOLS = {'3634', '3644'}
INTERVAL = 300


def connect(path):
    db = sqlite3.connect(path, timeout=5)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA synchronous=FULL')
    db.executescript('''
      CREATE TABLE IF NOT EXISTS pools (id TEXT PRIMARY KEY, first_seen INTEGER, definition TEXT);
      CREATE TABLE IF NOT EXISTS observations (pool TEXT, time INTEGER, payload TEXT, PRIMARY KEY(pool,time));
      CREATE INDEX IF NOT EXISTS observations_time ON observations(time);
      CREATE TABLE IF NOT EXISTS swaps (chain TEXT, txhash TEXT, event_index INTEGER, pool TEXT, time INTEGER, payload TEXT,
        PRIMARY KEY(chain,txhash,event_index));
      CREATE INDEX IF NOT EXISTS swaps_window ON swaps(pool,time);
      CREATE TABLE IF NOT EXISTS problems (pool TEXT, time INTEGER, txhash TEXT, event_index INTEGER, reason TEXT,
        PRIMARY KEY(pool,txhash,event_index));
      CREATE TABLE IF NOT EXISTS cursors (chain TEXT PRIMARY KEY, payload TEXT);
      CREATE TABLE IF NOT EXISTS scans (chain TEXT, time INTEGER, payload TEXT, PRIMARY KEY(chain,time));
      CREATE TABLE IF NOT EXISTS scan_checkpoints (chain TEXT, time INTEGER, height INTEGER, payload TEXT,
        PRIMARY KEY(chain,time,height));
      CREATE TABLE IF NOT EXISTS metrics (time INTEGER PRIMARY KEY, payload TEXT);
      CREATE TABLE IF NOT EXISTS exports (name TEXT PRIMARY KEY, last_row INTEGER);
    ''')
    history_schema(db)
    return db


def denomination(info):
    if isinstance(info, str):
        return info
    for name in ('native', 'token', 'cw20'):
        if isinstance(info.get(name), str):
            return info[name]
    if 'native_token' in info:
        return info['native_token']['denom']
    if isinstance(info.get('token'), dict):
        return info['token']['contract_addr']
    raise ValueError('Unknown token identity')


def integer(value, zero=True):
    if not isinstance(value, str) or not re.fullmatch(r'\d{1,60}', value) or (not zero and int(value) == 0):
        raise ValueError('Invalid raw amount')
    return value


def definitions(config):
    """Reviewed contract identities, with target assets matched by exact denom only."""
    rows = {}
    juno_atom = 'ibc/C4CFF46FD6DE35CA4CF4CE031E643C8FDC9BA4B99AE598E9B0ED98FE3A2319F9'
    for p in config['juno']:
        assets = [{k: a.get(k) for k in ('denom', 'symbol', 'decimals')} for a in p['reserves']]
        targets = {'juno': ['ujuno']}
        if any(a['denom'] == juno_atom for a in assets):
            targets['atom'] = [juno_atom]
        key = 'juno-1:' + p['pool']
        rows[key] = {'key': key, 'chain_id': 'juno-1', 'pool': p['pool'], 'venue': p['venue'], 'assets': assets,
                     'targets': targets, 'pool_type': p['pool_type'], 'fee_pct': p['fee_pct'], 'url': p['url'],
                     'legacy': p['legacy'], 'registered': p['registered'], 'valuation_method': p.get('valuation_method'),
                     'query': 'info' if p['venue'] == 'Junoswap' else 'pool'}
    for p in config['dojo']:
        key = 'injective-1:' + p['address']
        rows[key] = {'key': key, 'chain_id': 'injective-1', 'pool': p['address'], 'venue': 'DojoSwap',
                     'assets': p['assets'], 'targets': {a['slug']: [a['denom']] for a in p['assets'] if a['slug'] in ASSETS},
                     'pool_type': 'AMM', 'fee_pct': None, 'lp': p['lp'], 'query': 'pool',
                     'url': 'https://sentry.lcd.injective.network' + smart_path(p['address'], {'pool': {}})}
    return rows


def osmosis_pool_balances(pool):
    """Pool identity is independent of SQS's filtered bank-balance list.

    GAMM models contain actual reserves; CL models identify both tokens but do
    not provide their amounts. An omitted CL amount stays unknown, never zero.
    Additional bank deposits are not constituent trading assets.
    """
    def coins(values):
        if not isinstance(values, list):
            raise ValueError('Invalid routing balances')
        result = {}
        for coin in values:
            denom = coin['denom']
            if not isinstance(denom, str) or not denom or denom in result:
                raise ValueError('Duplicate or invalid routing denomination')
            result[denom] = integer(coin['amount'])
        return result

    balances = coins(pool['balances'])
    model, kind = pool['chain_model'], pool['type']
    if type(kind) is not int or kind not in (0, 1, 2, 3):
        raise ValueError('Unknown routing pool type')
    if kind == 0:
        values = model.get('pool_assets')
        if not isinstance(values, list):
            raise ValueError('Missing weighted pool assets')
        amounts = coins([a['token'] for a in values])
    elif kind == 1:
        amounts = coins(model.get('pool_liquidity'))
    elif kind == 2:
        denoms = [model.get('token0'), model.get('token1')]
        if any(not isinstance(d, str) or not d for d in denoms) or denoms[0] == denoms[1]:
            raise ValueError('Invalid concentrated pool identity')
        amounts = {d: balances.get(d) for d in denoms}
    else:
        # Preserve the existing scope for funded non-redemption CosmWasm pools.
        # Their bank balance list alone cannot authorize a stored identity change.
        amounts = balances
    if len(amounts) < 2:
        raise ValueError('Incomplete routing pool identity')
    return dict(sorted(amounts.items())), kind != 3


def validate_pool_update(old, new):
    """Permit only a proven completion of an earlier truncated native model.

    Stored observations and first_seen retain their original meaning. Never
    accept removed/renamed assets or move a pool's history to another identity.
    """
    if any(old.get(k) != new.get(k) for k in ('key', 'chain_id', 'pool')):
        raise ValueError('Stored pool identity changed')
    before = {a['denom'] for a in old['assets']}
    after = {a['denom'] for a in new['assets']}
    if before == after:
        return
    if (new['chain_id'] != 'osmosis-1' or not before < after or
            new.get('identity_source') != 'osmosis-chain-model' or
            set(new.get('identity_denoms', [])) != after or
            new.get('pool_type') not in ('Weighted', 'Stable', 'Concentrated')):
        raise ValueError('Stored pool identity changed')


def osmosis_inventory(http, config):
    found, snapshots, statuses = {}, {}, {}
    for slug, s in config['assets'].items():
        wanted = set(s['poolDenoms'])
        try:
            cursor, seen, rejected = 0, set(), []
            for _ in range(12):
                url = 'https://sqs.osmosis.zone/pools?' + urlencode({'filter[denom]': ','.join(sorted(wanted)),
                       'sort': '-totalFiatValueLocked', 'page[size]': 1000, 'page[cursor]': cursor})
                r = http(url)
                data = r['data']
                if not isinstance(data.get('data'), list) or 'next_cursor' not in data.get('meta', {}):
                    raise ValueError('Incomplete routing inventory')
                for p in data['data']:
                    c = p['chain_model']
                    pid = str(c.get('id', c.get('pool_id', '')))
                    if not re.fullmatch(r'[0-9]+', pid) or pid in seen:
                        raise ValueError('Duplicate or invalid pool identity')
                    seen.add(pid)
                    if pid in EXCLUDED_POOLS or pid in s.get('excludeBackingPoolIds', []) or int(c.get('code_id', 0)) in EXCLUDED_CODES:
                        continue
                    try:
                        amounts, model_identity = osmosis_pool_balances(p)
                    except (ValueError, KeyError, TypeError) as error:
                        rejected.append({'pool': pid, 'reason': type(error).__name__})
                        continue
                    selected = sorted(set(amounts) & wanted)
                    if not selected:
                        rejected.append({'pool': pid, 'reason': 'Wrong pool filter result'})
                        continue
                    assets = []
                    for denom in amounts:
                        m = config['metadata'].get(denom, {})
                        assets.append({'denom': denom, 'symbol': m.get('symbol', denom[:12] + '…'),
                                       'decimals': m.get('decimals', s['decimals'] if denom == s['denom'] else None)})
                    key = 'osmosis-1:' + pid
                    spec = found.setdefault(key, {'key': key, 'chain_id': 'osmosis-1', 'pool': pid, 'venue': 'Osmosis',
                           'assets': assets, 'targets': {}, 'pool_type': {0: 'Weighted', 1: 'Stable', 2: 'Concentrated'}.get(p['type'], 'Contract'),
                           'fee_pct': float(decimal(p.get('spread_factor', c.get('pool_params', {}).get('swap_fee', '0')), True) * 100),
                           'url': 'https://app.osmosis.zone/pool/' + pid,
                           'identity_source': 'osmosis-chain-model' if model_identity else 'routing-balances',
                           'identity_denoms': list(amounts)})
                    if {a['denom'] for a in spec['assets']} != {a['denom'] for a in assets}:
                        raise ValueError('Conflicting pool identity')
                    spec['targets'][slug] = selected
                    liquidity = None if p.get('liquidity_cap_error') else str(decimal(p['liquidity_cap'], True))
                    snapshots[key] = {'time': int(stamp(r['observed_at'])), 'height': None, 'state_query': 'routing-indexer-latest',
                                      'amounts': [amounts[a['denom']] for a in spec['assets']], 'liquidity_usd': liquidity,
                                      'valuation': 'Osmosis SQS reported USD liquidity', 'source': 'https://sqs.osmosis.zone/pools', 'status': 'ok'}
                next_cursor = int(data['meta']['next_cursor'])
                if next_cursor == -1:
                    statuses[slug] = {'status': 'partial' if rejected else 'complete', 'source_pool_count': len(seen)}
                    if rejected:
                        statuses[slug].update(rejected_pool_count=len(rejected), rejected_pools=rejected[:20])
                    break
                if next_cursor == cursor or next_cursor < 0:
                    raise ValueError('Invalid inventory cursor')
                cursor = next_cursor
            else:
                raise ValueError('Inventory page limit')
        except Exception as error:
            statuses[slug] = {'status': 'unavailable', 'reason': type(error).__name__}
    return found, snapshots, statuses


def price_references(config, output, direct):
    values, denoms = {}, {}
    for slug in ('btc', 'eth', 'sol', 'atom', 'juno', 'osmo', 'inj', 'neta'):
        try:
            c = json.loads((Path(output) / slug / 'current.json').read_text())['current']
            at = c.get('price_observed_at') or c.get('block_time')
            if not fresh(at, 300) or (c.get('usd_anchor') and not fresh(c['usd_anchor']['observed_at'], 1800)):
                continue
            values[slug] = {'price': str(decimal(c['price_usd'])), 'observed_at': at,
                            'usd_observed_at': (c.get('usd_anchor') or {}).get('observed_at', at), 'source': c.get('source_label', 'Archived market reference')}
        except (OSError, KeyError, ValueError, TypeError, ArithmeticError):
            pass
    for slug, s in config['assets'].items():
        for d in s['poolDenoms']:
            denoms['osmosis-1:' + d] = (slug, config['metadata'].get(d, {}).get('decimals', s.get('poolDecimals', s['decimals'])))
    denoms.update({'osmosis-1:uosmo': ('osmo', 6), 'juno-1:ujuno': ('juno', 6),
                   'juno-1:ibc/C4CFF46FD6DE35CA4CF4CE031E643C8FDC9BA4B99AE598E9B0ED98FE3A2319F9': ('atom', 6),
                   'juno-1:ibc/ED07A3391A112B175915CD8FAF43A2DA8E4790EDE12566649D0C2F97716B8518': ('osmo', 6),
                   'juno-1:juno168ctmpyppk90d34p3jjy658zf5a5l3w8wk35wht6ccqj4mr0yv8s4j5awr': ('neta', 6)})
    for p in config['dojo']:
        for a in p['assets']:
            denoms['injective-1:' + a['denom']] = (a['slug'], a['decimals'])
    for slug, asset_id in (('usdc', 'usd-coin'), ('usdt', 'tether')):
        try:
            values[slug] = direct.quote(asset_id)
        except Exception:
            pass
    denoms['juno-1:ibc/EAC38D55372F38F1AFD68DF7FE9EF762DCF69F26520643CF3F9D292A738D8034'] = ('usdc', 6)
    for d in ('factory/osmo147h5x9pcj7lm0cttlaefx6sqq5vdfnmwfcqxkmjd7exqm9gc7grqhr75m0/alloyed/allUSDC',
              'ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4'):
        denoms['osmosis-1:' + d] = ('usdc', 6)
    return values, denoms


def value_of(chain, denom, raw, references):
    values, denoms = references
    mapped = denoms.get(chain + ':' + denom)
    if not mapped or mapped[0] not in values:
        return None
    slug, decimals = mapped
    return decimal(raw, True) / Decimal(10)**decimals * decimal(values[slug]['price'])


def contract_snapshot(http, spec, references):
    def read(base):
        anchor = block(http, base, spec['chain_id'])
        url = base + smart_path(spec['pool'], {spec['query']: {}})
        r = http(url, anchor['height'])
        p = r['data']['data']
        if spec['venue'] == 'Junoswap':
            balances = {denomination(p['token1_denom']): integer(p['token1_reserve']),
                        denomination(p['token2_denom']): integer(p['token2_reserve'])}
        else:
            balances = {denomination(a['info']): integer(a['amount']) for a in p['assets']}
        if set(balances) != {a['denom'] for a in spec['assets']} or len(balances) != len(spec['assets']):
            raise ValueError('Pool token identity changed')
        amounts = [balances[a['denom']] for a in spec['assets']]
        vals = [value_of(spec['chain_id'], a['denom'], amount, references) for a, amount in zip(spec['assets'], amounts)]
        method = 'Sum of reserves at dated token references; wrapped assets may diverge'
        liquidity = sum(vals, Decimal(0)) if all(v is not None for v in vals) else None
        if all(int(v) == 0 for v in amounts):
            liquidity = Decimal(0)
        if liquidity is None and spec.get('pool_type') in ('xyk', 'legacy xyk') and 'ujuno' in balances:
            j = value_of('juno-1', 'ujuno', balances['ujuno'], references)
            if j is not None and j > 0:
                liquidity, method = 2 * j, 'JUNO reserve × 2; implied XYK valuation, not executable depth'
        return {'time': int(stamp(r['observed_at'])), 'height': r['height'], 'state_query': 'pinned-height',
                'block_hash': anchor['block_hash'], 'block_time': anchor['block_time'], 'amounts': amounts,
                'liquidity_usd': str(liquidity) if liquidity is not None else None, 'valuation': method,
                'source': base, 'status': 'ok'}
    try:
        return fallback(CHAINS[spec['chain_id']]['providers'], read)
    except Exception as error:
        return {'time': int(time.time()), 'status': 'unavailable', 'amounts': None, 'liquidity_usd': None, 'reason': type(error).__name__}


def parse_swaps(tx, tx_body, chain, registry):
    if int(tx['code']) != 0:
        return [], []
    if not isinstance(tx.get('events'), list):
        raise ValueError('Missing transaction events')
    trades, problems = [], []
    for index, event in enumerate(tx['events']):
        if event.get('type') not in ('wasm', 'token_swapped'):
            continue
        attrs = event['attributes']
        a = {x['key']: x['value'] for x in attrs}
        pool = a.get('pool_id') if event['type'] == 'token_swapped' else a.get('_contract_address')
        key = chain + ':' + str(pool)
        spec = registry.get(key)
        if not spec:
            continue
        is_swap = event['type'] == 'token_swapped' or a.get('action') == 'swap' or any(k in a for k in ('native_sold', 'token_sold'))
        if not is_swap:
            continue
        try:
            if len(a) != len(attrs):
                raise ValueError('Ambiguous event attributes')
            if event['type'] == 'token_swapped':
                inn = re.fullmatch(r'(\d+)([^0-9].*)', a['tokens_in'])
                out = re.fullmatch(r'(\d+)([^0-9].*)', a['tokens_out'])
                raw_in, denom_in = inn.groups()
                raw_out, denom_out = out.groups()
            elif a.get('action') == 'swap':
                denom_in, denom_out = a['offer_asset'], a['ask_asset']
                raw_in, raw_out = a['offer_amount'], a['return_amount']
            else:
                # Legacy events omit the denoms. Only accept an unambiguous direct
                # execution whose attached funds and amount identify the input.
                message = tx_body['body']['messages'][int(a['msg_index'])]
                funds = message.get('funds', [])
                sold, bought = ('native_sold', 'token_bought') if 'native_sold' in a else ('token_sold', 'native_bought')
                if message.get('contract') != pool or len(funds) != 1 or sold not in a or bought not in a:
                    raise ValueError('Legacy swap direction unavailable')
                if str(funds[0]['amount']) != a[sold]:
                    raise ValueError('Legacy swap amount differs')
                denom_in, raw_in, raw_out = funds[0]['denom'], a[sold], a[bought]
                other = [v['denom'] for v in spec['assets'] if v['denom'] != denom_in]
                if len(other) != 1:
                    raise ValueError('Ambiguous legacy direction')
                denom_out = other[0]
            expected = {v['denom'] for v in spec['assets']}
            if denom_in == denom_out or not {denom_in, denom_out} <= expected:
                raise ValueError('Swap token identity differs')
            trades.append({'pool': key, 'chain': chain, 'txhash': tx['txhash'].upper(), 'event_index': index,
                           'height': int(tx['height']), 'time': int(stamp(tx['timestamp'])), 'denom_in': denom_in,
                           'raw_in': integer(raw_in, False), 'denom_out': denom_out, 'raw_out': integer(raw_out, False)})
        except (KeyError, IndexError, ValueError, AttributeError, TypeError):
            problems.append({'pool': key, 'time': int(stamp(tx['timestamp'])), 'txhash': tx['txhash'].upper(),
                             'event_index': index, 'reason': 'Unparsed or ambiguous matching swap'})
    return trades, problems


def _scan_index_range(http, chain, registry, base, start_height, end, first_height, first_time, expected=None):
    """Validate one complete, anchored range before making any state durable."""
    start = block(http, base, chain, start_height)
    selector = CHAINS[chain]['selector']
    query = selector + f" AND tx.height>={start_height} AND tx.height<={end['height']}"
    seen, receipt_hashes, match_counts, trades, problems = set(), {}, {}, [], []
    def selector_matches(tx):
        kind, name, value = ('token_swapped', 'pool_id', None) if chain == 'osmosis-1' else ('wasm', '_contract_address', None) if chain == 'juno-1' else ('wasm', 'action', 'swap')
        return sum(1 for e in tx.get('events', []) if e.get('type') == kind for a in e.get('attributes', [])
                   if a.get('key') == name and (value is None or a.get('value') == value))
    for page in range(1, 13):
        url = base + '/cosmos/tx/v1beta1/txs?' + urlencode({'query': query, 'page': page, 'limit': 50, 'order_by': 'ORDER_BY_ASC'})
        d = http(url)['data']
        total, batch, bodies = int(d['total']), d.get('tx_responses'), d.get('txs')
        if total < 0 or (expected is not None and total != expected) or not isinstance(batch, list) or not isinstance(bodies, list) or len(batch) != len(bodies):
            raise ValueError('Inconsistent transaction index')
        expected = total
        for tx, tx_body in zip(batch, bodies):
            digest, height, at = tx['txhash'].upper(), int(tx['height']), stamp(tx['timestamp'])
            if (not re.fullmatch(r'[A-F0-9]{64}', digest) or not start_height <= height <= end['height']
                    or not stamp(start['block_time']) - 1 <= at <= stamp(end['block_time'])):
                raise ValueError('Invalid indexed receipt')
            receipt_hash = hashlib.sha256(encoded([tx, tx_body])).hexdigest()
            if digest in seen:
                if receipt_hashes[digest] != receipt_hash:
                    raise ValueError('Conflicting repeated transaction receipt')
                continue
            matched = selector_matches(tx)
            if not matched:
                raise ValueError('Receipt does not match its selector')
            seen.add(digest)
            receipt_hashes[digest], match_counts[digest] = receipt_hash, matched
            t, p = parse_swaps(tx, tx_body, chain, registry)
            trades.extend(t)
            problems.extend(p)
        if page * 50 >= total:
            break
        if not batch or len(seen) > total:
            raise ValueError('Truncated transaction index')
    else:
        raise ValueError('Transaction page limit; cursor retained')
    count_semantics = 'transactions'
    if len(seen) != expected:
        # Some chain forks paginate matching event entries and deduplicate
        # transactions AFTER pagination. Prove this behavior on two adjacent
        # positions before accepting an event count as the coverage total.
        if sum(match_counts.values()) != expected:
            raise ValueError('Truncated transaction index')
        offset = 0
        for digest, matched in match_counts.items():
            if matched > 1:
                for position in (offset + 1, offset + 2):
                    check = http(base + '/cosmos/tx/v1beta1/txs?' + urlencode({'query': query, 'page': position, 'limit': 1, 'order_by': 'ORDER_BY_ASC'}))['data']
                    entries = check.get('tx_responses', [])
                    if int(check.get('total', -1)) != expected or len(entries) != 1 or entries[0].get('txhash', '').upper() != digest:
                        raise ValueError('Unconfirmed event-index pagination semantics')
                count_semantics = 'matching-events-verified'
                break
            offset += matched
        else:
            raise ValueError('Transaction count mismatch')
    control_range = f" AND tx.height>={max(1, end['height']-2000)}" if chain == 'osmosis-1' else ''
    control = http(base + '/cosmos/tx/v1beta1/txs?' + urlencode({'query': selector + control_range + f" AND tx.height<={end['height']}",
                   'page': 1, 'limit': 1, 'order_by': 'ORDER_BY_DESC'}))['data'].get('tx_responses', [])
    if len(control) != 1 or not any(e.get('type') == ('token_swapped' if chain == 'osmosis-1' else 'wasm') for e in control[0].get('events', [])):
        raise ValueError('Index selector control unavailable')
    if int(control[0]['height']) >= start_height and control[0]['txhash'].upper() not in seen:
        raise ValueError('Index omitted control receipt')
    if block(http, base, chain, end['height'], refresh=True)['block_hash'] != end['block_hash']:
        raise ValueError('Index anchor changed')
    cursor = {**end, 'first_height': first_height, 'first_time': first_time, 'source': base, 'coverage': 'provider-index',
              'from_height': start_height, 'transactions': len(seen), 'index_total': expected, 'count_semantics': count_semantics,
              'time': int(time.time()), 'selector': selector}
    return cursor, trades, problems


def scan_chain(http, chain, registry, previous):
    spec = CHAINS[chain]
    def scan(base):
        tip = block(http, base, chain)
        end = block(http, base, chain, max(1, tip['height'] - 30))
        if not fresh(end['block_time'], 600):
            raise ValueError('Stale index anchor')
        if previous:
            if end['height'] < previous['height'] or block(http, base, chain, previous['height'])['block_hash'] != previous['block_hash']:
                raise ValueError('Index anchor regressed or changed')
            start_height = max(previous['height'] - 100, previous['first_height'])
            first_height, first_time = previous['first_height'], previous['first_time']
        else:
            start_height = end['height']
            first_height, first_time = end['height'], int(stamp(end['block_time']))
        return _scan_index_range(http, chain, registry, base, start_height, end, first_height, first_time)
    return fallback(spec['providers'], scan)


def _osmosis_fallback(read):
    """Keep actionable public-source errors without publishing response bodies."""
    safe_errors = {
        'Stale chain block', 'Wrong chain block', 'Invalid block hash',
        'Stale index anchor', 'Index anchor regressed or changed',
        'Inconsistent transaction index', 'Invalid indexed receipt',
        'Conflicting repeated transaction receipt', 'Receipt does not match its selector',
        'Truncated transaction index', 'Transaction page limit; cursor retained',
        'Unconfirmed event-index pagination semantics', 'Transaction count mismatch',
        'Index selector control unavailable', 'Index omitted control receipt',
        'Index anchor changed', 'Unexpected source redirect', 'Oversized source response',
        'Source request budget exhausted',
    }
    errors = []
    for base in dict.fromkeys(CHAINS['osmosis-1']['providers']):
        try:
            return read(base)
        except Exception as error:
            message = str(error)
            if message not in safe_errors and not re.fullmatch(
                    r'Osmosis block \d+ has \d+ index results; limit is 600', message):
                code = getattr(error, 'code', None)
                message = ('HTTP ' + str(code) if isinstance(code, int) and 100 <= code <= 599
                           else 'Provider request or response rejected')
            errors.append(base + ': ' + type(error).__name__ + ': ' + message[:200])
    raise RuntimeError('Osmosis providers unavailable: ' + '; '.join(errors))


def scan_osmosis_chunks(http, registry, previous):
    """Yield verified contiguous checkpoints; callers must commit before next()."""
    chain = 'osmosis-1'
    selector = CHAINS[chain]['selector']

    def anchor(base):
        # A fresh live head is still required. Only the catch-up range endpoints
        # may be historical; freshness of those cannot gate recovery.
        tip = block(http, base, chain)
        if not fresh(tip['block_time'], 120):
            raise ValueError('Stale chain block')
        target = block(http, base, chain, max(1, tip['height'] - 30))
        if not fresh(target['block_time'], 600):
            raise ValueError('Stale index anchor')
        if previous and (target['height'] < previous['height'] or
                         block(http, base, chain, previous['height'])['block_hash'] != previous['block_hash']):
            raise ValueError('Index anchor regressed or changed')
        return target

    target = _osmosis_fallback(anchor)
    first_height = previous['first_height'] if previous else target['height']
    first_time = previous['first_time'] if previous else int(stamp(target['block_time']))

    def chunk(start_height, last_height, prior):
        def read(base):
            if prior and block(http, base, chain, prior['height'], refresh=True)['block_hash'] != prior['block_hash']:
                raise ValueError('Index anchor regressed or changed')
            # Bound both the height span and result pages. A busy range is split
            # before downloading full receipts, retaining its exact lower bound.
            end_height = min(last_height, start_height + 1999)
            while True:
                query = selector + f" AND tx.height>={start_height} AND tx.height<={end_height}"
                count = http(base + '/cosmos/tx/v1beta1/txs?' + urlencode(
                    {'query': query, 'page': 1, 'limit': 1, 'order_by': 'ORDER_BY_ASC'}))['data']
                total, receipts, bodies = int(count['total']), count.get('tx_responses'), count.get('txs')
                if (total < 0 or not isinstance(receipts, list) or not isinstance(bodies, list)
                        or len(receipts) != len(bodies) or len(receipts) != min(total, 1)):
                    raise ValueError('Inconsistent transaction index')
                if total <= 600:
                    break
                if end_height == start_height:
                    raise ValueError(f'Osmosis block {start_height} has {total} index results; limit is 600')
                end_height = start_height + (end_height - start_height) // 2
            end = block(http, base, chain, end_height)
            if end_height == target['height'] and end['block_hash'] != target['block_hash']:
                raise ValueError('Index anchor changed')
            cursor, trades, problems = _scan_index_range(
                http, chain, registry, base, start_height, end, first_height, first_time, expected=total)
            cursor.update(target_height=target['height'], target_block_time=target['block_time'],
                          catching_up=end_height < target['height'])
            return cursor, trades, problems
        return _osmosis_fallback(read)

    current = previous
    if previous:
        # Recheck the existing overlap once, before moving forward. Split overlap
        # chunks never regress the durable cursor, and a failed overlap publishes
        # none of its partial results. Forward chunks do not add another overlap.
        start_height = max(previous['height'] - 100, first_height)
        overlap_trades, overlap_problems = [], []
        while start_height <= previous['height']:
            checkpoint, trades, problems = chunk(start_height, previous['height'], current)
            overlap_trades.extend(trades)
            overlap_problems.extend(problems)
            start_height = checkpoint['height'] + 1
        current = checkpoint
        yield current, overlap_trades, overlap_problems
        start_height = current['height'] + 1
    else:
        # New installations keep their existing tracking-start boundary.
        start_height = first_height

    while start_height <= target['height']:
        current, trades, problems = chunk(start_height, target['height'], current)
        yield current, trades, problems
        start_height = current['height'] + 1


def record_scan(db, chain, cursor, trades, problems):
    """A failed scan never advances coverage; duplicate swap identities stay stable."""
    with db:
        for t in trades:
            key = (chain, t['txhash'], t['event_index'])
            payload = encoded(t).decode()
            prior = db.execute('SELECT payload FROM swaps WHERE chain=? AND txhash=? AND event_index=?', key).fetchone()
            if prior and prior[0] != payload:
                raise ValueError('Previously recorded swap changed')
            db.execute('INSERT OR IGNORE INTO swaps VALUES (?,?,?,?,?,?)', (*key, t['pool'], t['time'], payload))
        for p in problems:
            db.execute('INSERT OR IGNORE INTO problems VALUES (?,?,?,?,?)', (p['pool'], p['time'], p['txhash'], p['event_index'], p['reason']))
        db.execute('INSERT INTO cursors VALUES (?,?) ON CONFLICT(chain) DO UPDATE SET payload=excluded.payload', (chain, encoded(cursor).decode()))
        db.execute('INSERT OR IGNORE INTO scans VALUES (?,?,?)', (chain, cursor['time'], encoded(cursor).decode()))
        if chain == 'osmosis-1':
            db.execute('INSERT OR IGNORE INTO scan_checkpoints VALUES (?,?,?,?)',
                       (chain, cursor['time'], cursor['height'], encoded(cursor).decode()))


def volume(db, spec, cursor, references, now):
    unavailable = {'status': 'unavailable', 'usd': None, 'quote_amount': None, 'swaps': None, 'window_start': None, 'window_end': None}
    if not cursor:
        return unavailable
    end = int(stamp(cursor['block_time']))
    start = end - 86400
    first = db.execute('SELECT first_seen FROM pools WHERE id=?', (spec['key'],)).fetchone()
    covered_from = max(cursor['first_time'], first[0] if first else end)
    common = {**unavailable, 'window_start': start, 'window_end': end, 'covered_from': covered_from,
              'coverage_seconds': max(0, min(86400, end - covered_from)), 'source': cursor['source'], 'coverage': 'provider-index',
              'last_swap_at': db.execute('SELECT MAX(time) FROM swaps WHERE pool=? AND time<=?', (spec['key'], end)).fetchone()[0],
              'usd_valuation': 'One executed leg at a prior recorded USD reference, frozen per trade; not an exact execution USD price'}
    if cursor.get('catching_up') or not fresh(end, 900, now):
        return {**common, 'status': 'stale'}
    observed_start = max(start, covered_from)
    if observed_start >= end:
        return {**common, 'status': 'building'}
    if db.execute('SELECT 1 FROM problems WHERE pool=? AND time>? AND time<=? LIMIT 1', (spec['key'], observed_start, end)).fetchone():
        return {**common, 'status': 'incomplete', 'reason': 'Matching swap could not be decoded completely'}
    count, amount, valued, last_trade = 0, Decimal(0), 0, None
    for (raw,) in db.execute('SELECT payload FROM swaps WHERE pool=? AND time>? AND time<=?', (spec['key'], observed_start, end)):
        t = json.loads(raw)
        valuation = stored_value(db, t)
        value = Decimal(valuation['usd']) if valuation.get('usd') is not None else None
        last_trade = max(last_trade or 0, t['time'])
        count += 1
        if value is not None:
            amount += value
            valued += 1
    return {**common, 'status': 'building' if covered_from > start else 'complete', 'swaps': count, 'valued_swaps': valued,
            'usd': float(amount) if valued == count else None, 'usd_known': float(amount) if valued > 0 or count == 0 else None, 'unvalued_swaps': count - valued, 'valuation_complete': valued == count, 'last_swap_at': common['last_swap_at'], 'usd_basis': 'prior-recorded-reference'}


def views(registry, observations, volumes, config, now):
    result = {slug: [] for slug in ASSETS}
    for key, spec in registry.items():
        o = observations.get(key) or {}
        valid = o.get('status') == 'ok' and fresh(o['time'], 900, now)
        amounts = o.get('amounts') if valid else None
        for slug, denoms in spec['targets'].items():
            target = [i for i, a in enumerate(spec['assets']) if a['denom'] in denoms]
            other = [a for a in spec['assets'] if a['denom'] not in denoms]
            reserve = None
            if amounts is not None and all(amounts[i] is not None and isinstance(spec['assets'][i].get('decimals'), int) for i in target):
                reserve = float(sum((Decimal(amounts[i]) / Decimal(10)**spec['assets'][i]['decimals'] for i in target), Decimal(0)))
            canonical = config['assets'][slug].get('poolDenom', config['assets'][slug]['denom'])
            canonical_ids = [i for i in target if spec['assets'][i]['denom'] == canonical]
            supply_reserve = float(sum((Decimal(amounts[i]) / Decimal(10)**spec['assets'][i]['decimals'] for i in canonical_ids), Decimal(0))) if amounts is not None and all(amounts[i] is not None and isinstance(spec['assets'][i].get('decimals'), int) for i in canonical_ids) else None
            quote_symbol = ' + '.join(a['symbol'] for a in other)
            result[slug].append({'id': key, 'chain_id': spec['chain_id'], 'pool': spec['pool'], 'venue': spec['venue'],
                'pair': ' + '.join(spec['assets'][i]['symbol'] for i in target) + (' / ' + quote_symbol if other else ''), 'quote': quote_symbol,
                'observed_at': o.get('time'), 'stale': not valid, 'reserve_token': reserve, 'reserve_supply_token': supply_reserve,
                'liquidity_usd': float(o['liquidity_usd']) if valid and o.get('liquidity_usd') is not None else None,
                'fee_pct': spec['fee_pct'], 'pool_type': spec['pool_type'], 'url': spec['url'], 'legacy': spec.get('legacy', False),
                'registered': spec.get('registered', True), 'volume_24h': volumes.get(key, {'status': 'unavailable', 'usd': None, 'quote_amount': None}),
                'height': o.get('height'), 'state_query': o.get('state_query'), 'source': o.get('source'), 'valuation_method': o.get('valuation'),
                'assets': [{**a, 'raw_amount': amounts[i] if amounts else None} for i, a in enumerate(spec['assets'])],
                'tracking': 'five-asset-pilot'})
    for rows in result.values():
        rows.sort(key=lambda p: p['liquidity_usd'] if p['liquidity_usd'] is not None else -1, reverse=True)
    return result


def tree_bytes(path):
    return sum(p.stat().st_size for p in Path(path).rglob('*') if p.is_file() and not p.is_symlink()) if Path(path).exists() else 0


def publish_json(path, payload, *, root):
    """Make only the public subtree traversable, including existing parent dirs.

    The service keeps UMask=0077 for private state and archives. mkdir(parents=True)
    applies that mask to intermediate directories, so chmod on the final pool
    directory alone does not make a nested history readable by the edge.
    """
    path, root = Path(path).absolute(), Path(root).absolute()
    relative = path.relative_to(root)
    if '..' in relative.parts or not relative.parts:
        raise ValueError('Publication must remain inside its public output root')
    if any(p.is_symlink() for p in (root, *root.parents)) or not root.is_dir():
        raise ValueError('Invalid public output root')
    folder = root
    for component in relative.parts[:-1]:
        folder /= component
        folder.mkdir(mode=0o755, exist_ok=True)
        info = folder.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid():
            raise ValueError('Unexpected public output directory: '+str(folder))
        folder.chmod(0o755)
    atomic(path, encoded(payload))


def save_chunk(db, archive, registry, now):
    # Immutable cycle files avoid re-uploading a rewritten whole-day gzip at every backup.
    raw = json.dumps(registry, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
    revision = hashlib.sha256(raw).hexdigest()
    definition = Path(archive) / ('registry-' + revision + '.json.gz')
    if not definition.exists():
        atomic(definition, gzip.compress(raw, compresslevel=3, mtime=0))
    body = {'schema_version': 1, 'time': now, 'registry': revision}
    checkpoints = {}
    for table in ('observations', 'swaps', 'problems', 'scans', 'scan_checkpoints', 'trade_values', 'usd_references'):
        previous = db.execute('SELECT last_row FROM exports WHERE name=?', (table,)).fetchone()
        after = previous[0] if previous else 0
        cursor = db.execute('SELECT rowid,* FROM ' + table + ' WHERE rowid>? ORDER BY rowid', (after,))
        names = [c[0] for c in cursor.description]
        data = [dict(zip(names, row)) for row in cursor]
        for row in data:
            if 'payload' in row:
                row['payload'] = json.loads(row['payload'])
        body[table] = data
        checkpoints[table] = data[-1]['rowid'] if data else after
    target = Path(archive) / iso(now)[:10] / (iso(now)[11:19].replace(':', '') + '.json.gz')
    content = gzip.compress(encoded(body), compresslevel=3, mtime=0)
    if target.exists() and target.read_bytes() != content:
        raise ValueError('Archive cycle already exists with different data')
    atomic(target, content)
    with db:
        for table, last in checkpoints.items():
            db.execute('INSERT INTO exports VALUES (?,?) ON CONFLICT(name) DO UPDATE SET last_row=excluded.last_row', (table, last))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--config', default=str(Path(__file__).with_name('pool_pilot_sources.json')))
    p.add_argument('--prices-config', default=str(Path(__file__).with_name('cosmos_market_sources.json')))
    p.add_argument('--state', default='/var/lib/cosmoot-marketdata/pool-pilot')
    p.add_argument('--output', default='/srv/cosmoot/public-snapshots/markets/data/markets')
    p.add_argument('--archive', default='/var/lib/cosmoot-collect/archive/market-data/pool-pilot')
    p.add_argument('--archive-lock', default='/var/lib/cosmoot-collect/collector.lock')
    p.add_argument('--probe', action='store_true')
    args = p.parse_args()
    config = json.loads(Path(args.config).read_text())
    if set(config['assets']) != set(ASSETS):
        raise ValueError('Pilot scope must remain BTC, ETH, SOL, ATOM and JUNO')
    state = Path(args.state)
    if args.probe:
        db = connect(':memory:')
    else:
        state.mkdir(parents=True, exist_ok=True)
        lock = (state / 'collector.lock').open('a')
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        db = connect(state / 'pools.sqlite3')
    started = time.monotonic()
    http = HTTP(timeout=8, deadline=started + 135)
    direct = DirectSources(json.loads(Path(args.prices_config).read_text()), http=http)
    refs = price_references(config, args.output, direct)
    registry = definitions(config)
    osmo, observations, inventory = osmosis_inventory(http, config)
    registry.update(osmo)
    with ThreadPoolExecutor(max_workers=8) as workers:
        futures = {workers.submit(contract_snapshot, http, spec, refs): key for key, spec in registry.items() if spec['chain_id'] != 'osmosis-1'}
        for f in as_completed(futures):
            observations[futures[f]] = f.result()
    # Preserve known pools when an inventory is unavailable; do not silently turn a
    # partial response into a smaller, supposedly complete tracked universe.
    for key, _, raw in db.execute('SELECT * FROM pools'):
        old = json.loads(raw)
        if key not in registry:
            registry[key] = old
        else:
            registry[key]['targets'] = {**old['targets'], **registry[key]['targets']}
    now = int(time.time())
    with db:
        for key, spec in registry.items():
            old = db.execute('SELECT definition FROM pools WHERE id=?', (key,)).fetchone()
            if old:
                validate_pool_update(json.loads(old[0]), spec)
            db.execute('INSERT INTO pools VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET definition=excluded.definition', (key, now, encoded(spec).decode()))
            if key in observations:
                db.execute('INSERT OR IGNORE INTO observations VALUES (?,?,?)', (key, now, encoded(observations[key]).decode()))
    errors = {}
    previous = {chain: json.loads(raw) for chain, raw in db.execute('SELECT * FROM cursors')}
    index_http = HTTP(timeout=18, deadline=started + 230)
    def checkpoint(chain, result):
        cursor, new_trades, new_problems = result
        record_scan(db, chain, cursor, new_trades, new_problems)

    with ThreadPoolExecutor(max_workers=2) as workers:
        futures = {workers.submit(scan_chain, index_http, chain, registry, previous.get(chain)): chain
                   for chain in CHAINS if chain != 'osmosis-1'}
        # SQLite stays on its creating thread. Each successful Osmosis chunk is
        # committed before another network chunk starts, so a later timeout cannot
        # discard progress or cause the next timer run to repeat the whole backlog.
        try:
            for result in scan_osmosis_chunks(index_http, registry, previous.get('osmosis-1')):
                checkpoint('osmosis-1', result)
        except Exception as error:
            errors['osmosis-1'] = type(error).__name__ + ': ' + str(error)
        for f in as_completed(futures):
            chain = futures[f]
            try:
                checkpoint(chain, f.result())
            except Exception as error:
                errors[chain] = type(error).__name__ + ': ' + str(error)
    cursors = {chain: json.loads(raw) for chain, raw in db.execute('SELECT * FROM cursors')}
    now = int(time.time())
    freeze_values(db, refs, state.parent, now)
    volumes = {key: volume(db, spec, cursors.get(spec['chain_id']), refs, now) for key, spec in registry.items()}
    output = views(registry, observations, volumes, config, now)
    report = {'schema_version': 1, 'generated_at': iso(now), 'assets': list(ASSETS), 'interval_seconds': INTERVAL,
              'pool_count': len(registry), 'observed_pools': sum(o.get('status') == 'ok' for o in observations.values()),
              'asset_pool_counts': {slug: len(rows) for slug, rows in output.items()}, 'inventory': inventory,
              'index_coverage': cursors, 'index_errors': errors, 'requests': http.requests + index_http.requests,
              'response_bytes': http.bytes + index_http.bytes, 'runtime_seconds': round(time.monotonic() - started, 2),
              'recorded_swaps': db.execute('SELECT count(*) FROM swaps').fetchone()[0],
              'scope': 'Verified Osmosis routing representations, registered JUNO pools and selected DojoSwap pools; no unlisted legacy contracts, native Ethereum/Solana venues or orderbooks.'}
    if not args.probe:
        with open(args.archive_lock, 'r') as archive_lock:
            acquire_archive_lock(archive_lock)
            save_chunk(db, args.archive, registry, now)
            publish_histories(db, registry, cursors, args.output, now,
                              lambda path, payload: publish_json(path, payload, root=args.output))
            for slug, rows in output.items():
                partial = inventory.get(slug, {}).get('status') != 'complete' or any(r['stale'] for r in rows)
                payload = {'schema_version': 1, 'asset': slug, 'mode': 'pilot', 'scope': 'cosmos', 'status': 'available', 'observed_at': iso(now),
                           'interval_seconds': INTERVAL, 'partial': partial, 'coverage': report['scope'], 'pools': rows}
                publish_json(Path(args.output) / slug / 'pools.json', payload, root=args.output)
        db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
        sizes = {'state_bytes': tree_bytes(state), 'archive_bytes': tree_bytes(args.archive),
                 'public_bytes': sum((Path(args.output) / slug / 'pools.json').stat().st_size for slug in ASSETS),
                 'derived_history_bytes': tree_bytes(Path(args.output)/'pilot/history')}
        first = db.execute('SELECT time,payload FROM metrics ORDER BY time LIMIT 1').fetchone()
        baseline = {'time': first[0], **json.loads(first[1])} if first else {'time': now, **sizes}
        report['storage'] = {'current': {'time': now, **sizes}, 'baseline_after_first_cycle': baseline,
                             'growth_since_first_cycle': {k: sizes[k] - baseline.get(k, 0) for k in sizes},
                             'elapsed_seconds': now - baseline['time'], 'note': 'File sizes, not R2 billed storage. The first cycle includes initial inventory/index setup.'}
        with db:
            db.execute('INSERT OR IGNORE INTO metrics VALUES (?,?)', (now, encoded(sizes).decode()))
        publish_json(Path(args.output) / 'pilot/status.json', report, root=args.output)
    else:
        report['probe'] = True
        report['sample_volume_states'] = sorted({v['status'] for v in volumes.values()})
    print(json.dumps(report, separators=(',', ':')))
    db.close()
    if any(inventory.get(s, {}).get('status') != 'complete' for s in ASSETS) or errors:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
