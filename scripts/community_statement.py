"""Project immutable block allocations into Treasury events and the shared statement.

USD is an indicative historical daily opening reference, NOT an execution rate.
Unpriced denominations stay visible and never silently count as USD zero.
"""
from decimal import Decimal, localcontext, ROUND_DOWN
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from community_block_ledger import START, CHAIN, DISTRIBUTION, FEES, ROOT, OUT, validate, instant, stamp, request, write, read_ledger

PRICES = ROOT / 'data/treasury/juno-community-prices.json'
GAPS = ['Community Tax is reconstructed from every scanned block. Other module income (including staking-withdrawal rounding and validator-removal remainders), payment classification and full balance reconciliation remain incomplete. Total expenses and operating result are unavailable.']


def prices_for(ranges, path=PRICES):
    data = json.loads(path.read_text()) if path.exists() else {'schema_version':1,'method':'historical-daily-opening-reference','quotes':{}}
    if data.get('schema_version') != 1 or data.get('method') != 'historical-daily-opening-reference': raise ValueError('Price cache identity mismatch')
    # Reuse reviewed Juno denoms, excluding other chains' prefixed entries.
    from update_treasury import token_registry
    assets = {k.removeprefix('juno:'):v for k,v in token_registry().items()
              if ':' not in k or k.startswith('juno:')}
    assets['ujuno'] = {'symbol':'JUNO','decimals':6,'coingecko':'juno-network'}
    missing={}
    for row in ranges:
        day=row.get('day', row['start']['timestamp'][:10])
        for denom in row['amounts']:
            asset=assets.get(denom,{})
            if asset.get('coingecko') and f'{day}:{denom}' not in data['quotes']:
                missing.setdefault(asset['coingecko'],[]).append((day,denom,asset))
    for coin, needed in missing.items():
        first=min(instant(day+'T00:00:00Z') for day,_,_ in needed)
        last=max(instant(day+'T00:00:00Z') for day,_,_ in needed)
        url='https://api.coingecko.com/api/v3/coins/'+coin+'/market_chart/range?'+urlencode({'vs_currency':'usd','from':int((first-timedelta(hours=2)).timestamp()),'to':int((last+timedelta(hours=2)).timestamp())})
        try:
            response=request(url)
            points=response['prices']
            if not isinstance(points,list):raise ValueError('Missing historical prices')
            for day,denom,asset in needed:
                target=int(instant(day+'T00:00:00Z').timestamp()*1000)
                candidates=[p for p in points if 0 <= target-int(p[0]) <= 3600000]
                if not candidates: continue
                point=max(candidates,key=lambda p:int(p[0])); price=Decimal(str(point[1]))
                if not price.is_finite() or price<=0:raise ValueError('Invalid historical price')
                data['quotes'][f'{day}:{denom}']={'usd_price':format(price,'f'),'timestamp_ms':int(point[0]),'day':day,
                    'denom':denom,'coin_id':coin,'decimals':asset['decimals'],'symbol':asset['symbol'],
                    'source':url,'method':data['method'],'fetched_at':stamp()}
        except Exception as error:
            print(f'Historical price unavailable for {coin}: {type(error).__name__}: {error}',flush=True)
    write(path,data)
    return data['quotes']


def project(blocks, quotes):
    validate(blocks)
    events, entries = [], []
    for chunk in blocks['ranges']:
        movements=[]
        for denom,raw in sorted(chunk['amounts'].items()):
            with localcontext() as ctx:
                ctx.prec=80
                quantity=Decimal(raw)
                if not quantity.is_finite() or quantity<=0:raise ValueError('Invalid block allocation')
                quote=quotes.get(chunk['start']['timestamp'][:10]+':'+denom)
                # ujuno identity/precision is protocol-defined even if its price is unavailable.
                decimals=quote['decimals'] if quote else 6 if denom=='ujuno' else None
                amount=format(quantity/(Decimal(10)**decimals),'f') if decimals is not None else None
                usd=format((Decimal(amount)*Decimal(quote['usd_price'])).quantize(Decimal('0.000000000000000001'),rounding=ROUND_DOWN),'f') if quote else None
            index=len(movements);uid=chunk['id']+':'+str(index)
            row={'id':uid,'chain_id':CHAIN,'treasury_address':DISTRIBUTION,'tx_hash':None,
                 'timestamp':chunk['end']['timestamp'],'height':chunk['end']['height'],'message_index':index,
                 'denom':denom,'asset':quote['symbol'] if quote else 'JUNO' if denom=='ujuno' else denom,
                 'amount':amount,'decimals':decimals,'direction':'in','raw_amount':raw,'counterparty':FEES,
                 'classification':'community_tax','category':'community_tax','usd_value':usd,'receipt_id':uid,
                 'valuation':quote,'evidence':{'kind':'block-distribution','source':chunk['source'],
                     'start':chunk['start'],'end':chunk['end'],'blocks':chunk['blocks'],
                     'results_sha256':chunk['results_sha256'],'method':chunk['method']}}
            entries.append(row);movements.append(row)
        events.append({'id':chunk['id'],'chain_id':CHAIN,'chain_name':'Juno','treasury_address':DISTRIBUTION,
                       'height':chunk['end']['height'],'timestamp':chunk['end']['timestamp'],
                       'timestamp_status':'confirmed','tx_hash':None,'status':'confirmed','type':'inflow',
                       'title':'Community Tax · '+chunk['start']['timestamp'][:10], 'movements':movements,
                       'evidence':{'kind':'block-distribution','start':chunk['start'],'end':chunk['end'],'blocks':chunk['blocks']},
                       'explorer_url':'https://atomscan.com/juno/blocks/'+str(chunk['end']['height']),
                       'proposal_id':None})
    return events,entries


def build(dao, feed, base):
    if not OUT.exists() and not OUT.with_suffix('').exists(): return feed,base
    blocks=read_ledger(OUT); validate(blocks)
    from community_cash_review import review
    cash_review = review(blocks)
    prices=prices_for(blocks['ranges'])
    block_events,entries=project(blocks,prices)
    through=blocks['ranges'][-1]['end']['timestamp'] if blocks['ranges'] else None
    coverage={'source':'https://juno.rpc.m.stavr.tech','accounting_start':START,
              'from_height':blocks['ranges'][0]['start']['height'] if blocks['ranges'] else None,
              'through_height':blocks.get('last_scanned_height'),'through_time':through,
              'target_height':blocks.get('target_height'),'status':blocks.get('status'),
              'blocks':sum(r['blocks'] for r in blocks['ranges']),
              'ranges':len(blocks['ranges']),
              'module_transfer_blocks':sum(bool(r['module_transfers']) for r in blocks['ranges']),
              'transaction_blocks':sum(len(r['transaction_evidence']) for r in blocks['ranges'])}
    gaps=list(GAPS)
    if cash_review['status'] == 'reviewed':
        gaps = ['Recorded totals include tax allocations and reviewed transactions. No unmatched distribution outflows were found. Zero other income means no other recorded income; unmeasured withdrawal dust and validator-removal remainders are excluded. Full module balance reconciliation remains incomplete.']
    refreshed=instant(blocks['last_success_at']) if blocks.get('last_success_at') else None
    if not refreshed or not -60 <= (datetime.now(timezone.utc)-refreshed).total_seconds() <= 7200:
        coverage['status']='STALE'
        gaps.insert(0,'Block collection is stale; retained historical allocations are shown through the stated height only.')
    if blocks.get('status')!='CURRENT':gaps.insert(0,'Historical block backfill is in progress; only the explicit scanned interval is included.')
    if any(e['usd_value'] is None for e in entries):gaps.append('Some block allocations lack a reviewed historical USD quote; they remain unpriced.')
    from update_community_accounting import GAPS as obsolete_gaps
    warnings=[w for w in feed.get('warnings',[]) if w not in obsolete_gaps]
    feed={**feed,'events':[e for e in feed['events'] if e.get('evidence',{}).get('kind')!='block-distribution']+block_events,
          'block_coverage':coverage,'coverage_gaps':gaps,
          'warnings':list(dict.fromkeys([*warnings,*gaps]))}
    feed['events'].sort(key=lambda e:(e['timestamp'],e['id']),reverse=True)
    base={**base,'schema_version':3,'entries':base['entries']+entries,'block_coverage':coverage,
          'recorded_cash_review':cash_review,
          'coverage_gaps':gaps,'valuation_policy':'Historical daily opening USD reference, fixed per UTC day. Indicative conversion; not an executed payment rate.',
          'block_last_success_at':blocks.get('last_success_at'),'warnings':feed['warnings']}
    return feed,base
