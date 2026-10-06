"""Bounded REST receipt index for configured Treasury accounts since 2026-10-01.

This establishes provider-index coverage, never complete accounting or a light-client proof.
"""
import base64
import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.parse import urlencode

ACCOUNTING_START = '2026-10-01T00:00:00Z'
QUERY_KEYS = ('wasm._contract_address', 'transfer.sender', 'transfer.recipient',
              'coin_spent.spender', 'coin_received.receiver', 'wasm.sender', 'wasm.to', 'wasm.from')


def instant(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('Missing timestamp timezone')
    return result


def block(get, base, height, chain_id):
    data = get(f'{base}/cosmos/base/tendermint/v1beta1/blocks/{height}', timeout=10)
    header = (data.get('block') or data.get('sdk_block'))['header']
    if header['chain_id'] != chain_id or (height != 'latest' and int(header['height']) != int(height)):
        raise ValueError('Block identity mismatch')
    value = data['block_id']['hash']
    digest = value.upper() if re.fullmatch(r'[a-fA-F0-9]{64}', value) else base64.b64decode(value, validate=True).hex().upper()
    if len(digest) != 64:
        raise ValueError('Invalid block hash')
    instant(header['time'])
    return {**header, 'hash': digest}


def boundary(get, base, chain, tip, previous):
    """Find a verified scan floor before the cutoff; filter receipts by exact time.

    A coarse recent floor avoids ~20 archive queries per initial chain setup.
    It is not presented as the first October block. No older history is backfilled.
    """
    cutoff = instant(ACCOUNTING_START)
    cached = (previous or {}).get('accounting_boundary')
    if cached and cached.get('start_at') == ACCOUNTING_START:
        floor = block(get, base, cached['height'], chain['id'])
        if floor['hash'] != cached['hash'] or instant(floor['time']) > cutoff:
            raise ValueError('Accounting scan floor changed')
        return cached
    high = int(tip['height'])
    if instant(tip['time']) < cutoff:
        raise ValueError('Tip predates accounting start')
    step = 200_000
    for _ in range(16):
        low = max(1, high - step)
        floor = block(get, base, low, chain['id'])
        if instant(floor['time']) <= cutoff:
            return {'start_at': ACCOUNTING_START, 'height': low, 'hash': floor['hash'],
                    'timestamp': floor['time'], 'kind': 'scan-floor-before-start'}
        if low == 1:
            raise ValueError('Chain starts after accounting cutoff; needs explicit scope review')
        high, step = low, step * 2
    raise ValueError('Accounting floor lookup limit reached')


def search(get, base, key, address, start, end):
    found, expected = {}, None
    query = f"{key}='{address}' AND tx.height>={start} AND tx.height<={end}"
    for page in range(1, 101):
        data = get(base + '/cosmos/tx/v1beta1/txs?' + urlencode({
            'query': query, 'page': page, 'limit': 100, 'order_by': 'ORDER_BY_ASC'}), timeout=10)
        total = int(data['total'])
        if total < 0 or (expected is not None and total != expected):
            raise ValueError('Index total changed')
        expected = total
        batch = data.get('tx_responses') or []
        if not batch and len(found) != total:
            raise ValueError('Truncated receipt index')
        for tx in batch:
            digest = tx['txhash'].upper()
            if not re.fullmatch(r'[A-F0-9]{64}', digest) or digest in found or not start <= int(tx['height']) <= end:
                raise ValueError('Duplicate or out-of-range receipt')
            instant(tx['timestamp'])
            found[digest] = tx
        if len(found) == total:
            return found
        if len(found) > total:
            raise ValueError('Invalid receipt total')
    raise ValueError('Receipt page limit reached')


def scan(get, base, chain, prior_rows, source=None, full_replay=False):
    tip = block(get, base, 'latest', chain['id'])
    age = (datetime.now(timezone.utc) - instant(tip['time'])).total_seconds()
    if not -60 <= age <= 600:
        raise ValueError('Stale chain tip')
    cutoff = boundary(get, base, chain, tip, source)
    end = int(tip['height']) - 20
    start = max(cutoff['height'], chain['creation_height'])
    old_end = (source or {}).get('last_scanned_height')
    if old_end and old_end > end:
        raise ValueError('Provider behind previous watermark')
    # Daily full replay catches index delays beyond the ordinary 100-block overlap.
    replay_day = datetime.now(timezone.utc).date().isoformat()
    incremental = False
    if source and source.get('adapter') == 'cosmos-rest-receipts' and old_end and not full_replay and source.get('last_full_replay_day') == replay_day:
        if block(get, base, old_end, chain['id'])['hash'] != source['anchor_hash']:
            raise ValueError('Stored scan anchor changed')
        start, incremental = max(start, old_end - 100), True
    anchor = block(get, base, end, chain['id'])['hash']
    found = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(lambda key: search(get, base, key, chain['address'], start, end), QUERY_KEYS):
            for digest, tx in result.items():
                if digest in found and found[digest] != tx:
                    raise ValueError('Queries disagree on receipt')
                found[digest] = tx
    missing = {row['tx_hash'] for row in [*prior_rows, *chain.get('known_receipts', [])] if start <= int(row['height']) <= end
               and (not row.get('timestamp') or instant(row['timestamp']) >= instant(ACCOUNTING_START))} - set(found)
    if missing:
        raise ValueError('Index lost recorded transactions')
    if block(get, base, end, chain['id'])['hash'] != anchor:
        raise ValueError('Scan anchor changed')
    return found, {'adapter': 'cosmos-rest-receipts', 'chain_id': chain['id'], 'address': chain['address'],
        'source': base, 'accounting_start': ACCOUNTING_START, 'accounting_boundary': cutoff,
        'scan_start_height': start, 'last_scanned_height': end, 'anchor_hash': anchor,
        'incremental': incremental, 'range_capable': True, 'indexed_transactions': len(found),
        'historical_missing_transactions': 0, 'historical_missing_tx_hashes': [],
        'last_full_replay_day': source['last_full_replay_day'] if incremental else replay_day,
        'query_keys': list(QUERY_KEYS), 'coverage': 'provider-index-only'}
