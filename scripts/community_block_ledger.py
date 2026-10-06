#!/usr/bin/env python3
"""Resumable Juno distribution evidence, starting 2026-10-01 UTC.

Reconstruct allocation from fee-collector transfers LESS emitted validator rewards
(SDK v0.53 allocation.go), including its decimal remainder. Never use pool balance
deltas or the current tax parameter. Every height is read; no sampling/index counts.
"""
import argparse
import asyncio
import atexit
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from decimal import Decimal, localcontext
import hashlib
import gzip
import json
import os
from pathlib import Path
import re
import time
import threading
from urllib.parse import urlencode

START = '2026-10-01T00:00:00Z'
RPC = 'https://juno.rpc.m.stavr.tech'
CHAIN = 'juno-1'
DISTRIBUTION = 'juno1jv65s3grqf6v6jl3dp4t6c9t9rk99cd83d88wr'
FEES = 'juno17xpfvakm2amg962yls6f84z3kell8c5lxtqmvp'
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/treasury/juno-community-blocks.json.gz'
COIN = re.compile(r'^(\d+(?:\.\d{1,18})?)([a-zA-Z][a-zA-Z0-9/:._-]*)$')
_network = None
_network_lock = threading.Lock()


def close_network():
    if _network is not None:
        loop, client = _network
        asyncio.run_coroutine_threadsafe(client.close(), loop).result(timeout=5)
        loop.call_soon_threadsafe(loop.stop)


atexit.register(close_network)


def network():
    """One bounded keep-alive pool; avoid a TLS handshake for every ten blocks."""
    global _network
    with _network_lock:
        if _network is None:
            import aiohttp
            loop = asyncio.new_event_loop()
            threading.Thread(target=loop.run_forever, daemon=True).start()
            async def session():
                return aiohttp.ClientSession(trust_env=True, connector=aiohttp.TCPConnector(limit=8),
                    timeout=aiohttp.ClientTimeout(total=40), headers={'User-Agent':'NETA-Community-Accounting/1'})
            client = asyncio.run_coroutine_threadsafe(session(), loop).result()
            _network = loop, client
    return _network


def stamp(): return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
def instant(s): return datetime.fromisoformat(s.replace('Z', '+00:00'))
def write(path, data):
    tmp = path.with_suffix('.tmp')
    if path.suffix == '.gz':
        tmp.write_bytes(gzip.compress(json.dumps(data,separators=(',',':')).encode(),mtime=0))
    else:
        tmp.write_text(json.dumps(data, indent=2) + '\n')
    tmp.replace(path)


def read_ledger(path=OUT):
    # Recovery of the pre-release plain JSON checkpoint is lossless.
    if not path.exists() and path.suffix == '.gz' and path.with_suffix('').exists():
        path=path.with_suffix('')
    raw=gzip.decompress(path.read_bytes()) if path.suffix == '.gz' else path.read_bytes()
    return json.loads(raw)


def request(url, payload=None):
    for attempt in range(3):
        try:
            loop, client = network()
            async def fetch():
                async with client.request('POST' if payload is not None else 'GET', url,
                                          **({'json':payload} if payload is not None else {})) as r:
                    r.raise_for_status()
                    return await r.json(content_type=None)
            return asyncio.run_coroutine_threadsafe(fetch(), loop).result(timeout=45)
        except Exception:
            if attempt == 2: raise
            time.sleep(attempt + 1)


def rpc(method, **params):
    data = request(RPC + '/' + method + '?' + urlencode({k: json.dumps(str(v)) for k,v in params.items()}))
    if data.get('error'): raise ValueError(str(data['error']))
    return data['result']


def header(height=None):
    data = rpc('block', **({'height': height} if height is not None else {}))
    h = data['block']['header']
    if h['chain_id'] != CHAIN or (height is not None and int(h['height']) != height):
        raise ValueError('Wrong block identity')
    digest = data['block_id']['hash']
    if not re.fullmatch('[A-F0-9]{64}', digest): raise ValueError('Invalid block hash')
    return {'height': int(h['height']), 'timestamp': h['time'], 'hash': digest}


def first_at(target, low, high):
    """Find exact UTC boundary, using interpolation with binary fallback."""
    t = instant(target)
    if not instant(low['timestamp']) < t <= instant(high['timestamp']): raise ValueError('Boundary not bracketed')
    while high['height'] - low['height'] > 1:
        ratio = (t - instant(low['timestamp'])).total_seconds() / (instant(high['timestamp']) - instant(low['timestamp'])).total_seconds()
        guess = max(low['height'] + 1, min(high['height'] - 1, low['height'] + int(ratio * (high['height'] - low['height']))))
        mid = header(guess)
        if instant(mid['timestamp']) < t: low = mid
        else: high = mid
    return high


def coins(text):
    result = {}
    if not text: return result
    for item in text.split(','):
        m = COIN.fullmatch(item)
        if not m or m[2] in result: raise ValueError('Malformed/duplicate coins')
        result[m[2]] = Decimal(m[1])
    return result


def attributes(event):
    values = {}
    for a in event.get('attributes', []):
        if a['key'] in values: raise ValueError('Duplicate event attribute')
        values[a['key']] = a['value']
    return values


def relevant_transaction_events(events):
    # Keep pool-account transfers and their protocol context, not unrelated
    # contracts' logs. The range checksum still commits to the full RPC results.
    return [e for e in events if e['type'] in ('message', 'withdraw_rewards', 'withdraw_commission')
            or (e['type'] == 'transfer' and DISTRIBUTION in
                (attributes(e).get('sender'), attributes(e).get('recipient')))]


def compact(data):
    for row in data['ranges']:
        for item in row['transaction_evidence']:
            for tx in item['transactions']:
                tx['events'] = relevant_transaction_events(tx['events'])


def add(total, values, sign=1):
    for denom, amount in values.items(): total[denom] = total.get(denom, Decimal(0)) + sign * amount


def allocation(result, height):
    if int(result['height']) != height or not isinstance(result.get('finalize_block_events'), list):
        raise ValueError('Missing/mismatched block results')
    with localcontext() as context:
        context.prec = 80
        incoming, rewards, validators, transfers = {}, {}, set(), 0
        exceptional = []
        for index, event in enumerate(result['finalize_block_events']):
            a = attributes(event)
            if event['type'] == 'transfer' and a.get('sender') == FEES and a.get('recipient') == DISTRIBUTION and a.get('mode') == 'BeginBlock':
                transfers += 1; add(incoming, coins(a['amount']))
            elif event['type'] == 'rewards' and a.get('mode') == 'BeginBlock':
                if a.get('validator') in validators or not a.get('validator', '').startswith('junovaloper1'):
                    raise ValueError('Invalid/duplicate distribution validator')
                validators.add(a['validator']); add(rewards, coins(a['amount']))
            elif event['type'] == 'transfer' and DISTRIBUTION in (a.get('sender'), a.get('recipient')):
                exceptional.append({'index': index, 'type': event['type'], **a})
        if transfers != 1 or not validators: raise ValueError('Unsupported distribution allocation shape')
        result_amount = dict(incoming); add(result_amount, rewards, -1)
        if any(v < 0 for v in result_amount.values()): raise ValueError('Rewards exceed distributed fees')
        # Transaction transfers are NOT pool expenses: the account also holds
        # validator rewards. Keep exact evidence for subsequent classification.
        tx_evidence = []
        for index, tx in enumerate(result.get('txs_results') or []):
            if int(tx.get('code', -1)) != 0: continue
            events = tx.get('events') or []
            if any(e['type'] == 'transfer' and DISTRIBUTION in (attributes(e).get('sender'), attributes(e).get('recipient')) for e in events):
                tx_evidence.append({'tx_index': index, 'events': relevant_transaction_events(events)})
        return {k:format(v,'f') for k,v in result_amount.items() if v}, exceptional, tx_evidence


def batch(heights):
    payload = [{'jsonrpc':'2.0', 'id':h, 'method':'block_results', 'params':{'height':str(h)}} for h in heights]
    data = request(RPC, payload)
    if not isinstance(data, list) or len(data) != len(heights): raise ValueError('Truncated RPC batch')
    by_id = {r['id']:r for r in data}
    if len(by_id) != len(data) or set(by_id) != set(heights): raise ValueError('Duplicate/foreign RPC response')
    out = []
    for h in heights:
        row = by_id[h]
        if row.get('error'): raise ValueError(str(row['error']))
        amounts, extra, transactions = allocation(row['result'], h)
        digest = hashlib.sha256(json.dumps(row['result'],sort_keys=True,separators=(',',':')).encode()).hexdigest()
        out.append((h, amounts, extra, transactions, digest))
    return out


def collect_chunk(start, end, pool):
    opening, closing = header(start), header(end)
    # Boundary splitting ensures the block-time interval belongs to one UTC day.
    if opening['timestamp'][:10] != closing['timestamp'][:10]: raise ValueError('Chunk crosses UTC date')
    totals, exceptional, txs, digest, count = {}, [], [], hashlib.sha256(), 0
    with localcontext() as context:
        context.prec = 80
        for rows in pool.map(batch, [list(range(h,min(h+10,end+1))) for h in range(start,end+1,10)]):
            for h, amounts, extras, transactions, checksum in rows:
                if h != start + count: raise ValueError('Non-contiguous block range')
                count += 1; add(totals,{k:Decimal(v) for k,v in amounts.items()})
                digest.update(f'{h}:{checksum}\n'.encode())
                if extras: exceptional.append({'height':h,'events':extras})
                if transactions: txs.append({'height':h,'transactions':transactions})
    if count != end-start+1 or header(end) != closing: raise ValueError('Block range changed')
    return {'id':f'{CHAIN}:distribution:{start}-{end}', 'start':opening,'end':closing,
            'blocks':count,'amounts':{k:format(v,'f') for k,v in totals.items()},
            'results_sha256':digest.hexdigest(), 'module_transfers':exceptional,'transaction_evidence':txs,
            'source':RPC,'method':'fee-collector-transfers-minus-validator-rewards','collected_at':stamp()}


def validate(data):
    if data.get('schema_version') != 1 or data.get('chain_id') != CHAIN or data.get('accounting_start') != START or data.get('distribution') != DISTRIBUTION:
        raise ValueError('Block ledger identity mismatch')
    end = None
    for row in data['ranges']:
        a,b = row['start']['height'],row['end']['height']
        if row['id'] != f'{CHAIN}:distribution:{a}-{b}' or row['blocks'] != b-a+1 or (end is not None and a != end+1):
            raise ValueError('Missing or duplicate block range')
        if instant(row['start']['timestamp']) < instant(START): raise ValueError('Pre-cutoff block')
        end = b


def run(path=OUT, seconds=180, workers=6):
    started = time.monotonic()
    exists=path.exists() or (path.suffix == '.gz' and path.with_suffix('').exists())
    data = read_ledger(path) if exists else {'schema_version':1,'chain_id':CHAIN,'accounting_start':START,'distribution':DISTRIBUTION,'ranges':[],'boundaries':{}}
    validate(data)
    compact(data)
    if data['ranges']: write(path, data)
    tip = header()
    if not -60 <= (datetime.now(timezone.utc)-instant(tip['timestamp'])).total_seconds() <= 600: raise ValueError('Stale RPC tip')
    target = tip['height']-20
    if data['ranges']:
        last = data['ranges'][-1]['end']
        if header(last['height']) != last: raise ValueError('Stored block anchor changed')
        start = last['height']+1
    else:
        floor = header(max(1,tip['height']-250000))
        while instant(floor['timestamp']) >= instant(START): floor=header(max(1,floor['height']-250000))
        first = first_at(START, floor,tip)
        data['boundaries'][START[:10]]=first; start=first['height']
    with ThreadPoolExecutor(max_workers=workers) as pool:
        while start <= target and time.monotonic()-started < seconds:
            opening=header(start); day=instant(opening['timestamp']).date()
            tomorrow=datetime.combine(day+timedelta(days=1),datetime.min.time(),timezone.utc).isoformat().replace('+00:00','Z')
            if instant(tip['timestamp']) >= instant(tomorrow):
                if tomorrow[:10] not in data['boundaries']:
                    data['boundaries'][tomorrow[:10]]=first_at(tomorrow,opening,tip)
                day_end=data['boundaries'][tomorrow[:10]]['height']-1
            else: day_end=target
            end=min(start+999,day_end,target)
            row=collect_chunk(start,end,pool)
            data['ranges'].append(row)
            data.update(checked_at=stamp(),last_success_at=stamp(),target_height=target,
                        last_scanned_height=end,status='CURRENT' if end==target else 'BACKFILL')
            validate(data);write(path,data)
            print(json.dumps({'through':row['end']['timestamp'],'height':end,'target':target,'ranges':len(data['ranges']),'seconds':round(time.monotonic()-started)}),flush=True)
            start=end+1
    return data


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--seconds',type=int,default=180);p.add_argument('--workers',type=int,default=6);p.add_argument('--output',type=Path,default=OUT);a=p.parse_args()
    run(a.output,a.seconds,a.workers)
