"""Daily claim-adjusted reward accrual. Opening holdings are never revenue."""
from collections import defaultdict
from decimal import Decimal, localcontext, ROUND_DOWN
from datetime import datetime, timedelta, timezone
import json
import time
from pathlib import Path
from community_block_ledger import attributes, coins, header, first_at, instant, stamp, write, DISTRIBUTION

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/treasury/juno-delegation-accrual.json'
PRICES = ROOT / 'data/treasury/juno-delegation-prices.json'
ADDRESS = 'juno1nmezpepv3lx45mndyctz2lzqxa6d9xzd2xumkxf7a6r4nxt0y95qypm6c0'
START = '2026-10-01T00:00:00Z'


def withdrawals(events, address):
    """SDK events include both explicit claims and automatic staking withdrawals."""
    result = []
    for i, event in enumerate(events):
        a = attributes(event)
        if event['type'] != 'withdraw_rewards' or a.get('delegator') != address:
            continue
        if not a.get('validator', '').startswith('junovaloper1'):
            raise ValueError('Invalid reward validator')
        amounts = coins(a.get('amount', ''))
        if any(v != int(v) or v < 0 for v in amounts.values()):
            raise ValueError('Invalid claimed reward')
        transfers = [attributes(e) for e in events[:i] if e['type'] == 'transfer'
                     and attributes(e).get('sender') == DISTRIBUTION
                     and attributes(e).get('msg_index') == a.get('msg_index')]
        transfer = transfers[-1] if transfers else None
        paid = {d:v for d,v in amounts.items() if v}
        recipient = address if not paid else transfer.get('recipient') if transfer and coins(transfer.get('amount', '')) == paid else None
        result.append({'event_index': i, 'validator': a['validator'],
                       'recipient': recipient,
                       'amounts': {d:str(int(v)) for d,v in amounts.items() if v}})
    return result


def totals(values):
    result = {}
    for row in values:
        if row['denom'] in result or not str(row['amount']).isdigit():
            raise ValueError('Invalid reward snapshot')
        result[row['denom']] = str(int(row['amount']))
    return result


def sample(snapshot):
    if snapshot.get('chain_id') != 'juno-1' or snapshot.get('treasury_address') != ADDRESS:
        raise ValueError('Reward snapshot identity mismatch')
    if snapshot.get('staking'):
        if not snapshot.get('balance_height_pinned') or snapshot['staking']['withdraw_address'] != ADDRESS:
            raise ValueError('Reward ownership/height unavailable')
        rewards = totals(snapshot['staking']['rewards'])
    else:
        # Existing collector-owned history truncates each validator to withdrawable units.
        rewards = {}
        for a in snapshot['assets']:
            if a['key'].startswith('juno:native:') and a['key'].endswith(':rewards'):
                denom = a['key'][12:-8]
                if denom in rewards or not a.get('raw_amount', '').isdigit():
                    raise ValueError('Invalid archived rewards')
                rewards[denom] = a['raw_amount']
        if not rewards: raise ValueError('Archived snapshot lacks reward positions')
    anchor = header(snapshot['height'])
    if anchor['timestamp'] != snapshot['generated_at']:
        raise ValueError('Reward snapshot timestamp mismatch')
    return {**anchor, 'rewards': rewards, 'source': snapshot.get('balance_source', 'collector-owned-height-pinned-history'),
            'method': 'withdrawable-rewards-truncated-per-validator'}


def claim_rows(events, opening, closing):
    rows, seen = [], set()
    for event in events['events']:
        if event.get('evidence', {}).get('kind') == 'staking-accrual': continue
        if event.get('status') != 'confirmed' or not opening['height'] < event['height'] <= closing['height']: continue
        for r in event.get('reward_withdrawals', []):
            uid = event['id'] + ':reward:' + str(r['event_index'])
            if uid in seen: raise ValueError('Duplicate reward withdrawal')
            seen.add(uid)
            rows.append({**r, 'id': uid, 'tx_hash': event['tx_hash'], 'height': event['height']})
    return rows


def interval(opening, closing, claims):
    if closing['height'] <= opening['height'] or instant(closing['timestamp']) <= instant(opening['timestamp']):
        raise ValueError('Non-increasing reward interval')
    period_start = opening.get('boundary_at', opening['timestamp'])
    if period_start[:10] != closing['timestamp'][:10]:
        raise ValueError('Reward interval crosses a UTC day; missing boundary must be recovered')
    claimed = defaultdict(int)
    for row in claims:
        if not opening['height'] < row['height'] <= closing['height']: raise ValueError('Claim outside reward interval')
        for d,v in row['amounts'].items():
            if not v.isdigit(): raise ValueError('Invalid claimed amount')
            claimed[d] += int(v)
    amounts = {}
    for d in set(opening['rewards']) | set(closing['rewards']) | set(claimed):
        value = int(closing['rewards'].get(d, 0)) - int(opening['rewards'].get(d, 0)) + claimed[d]
        if value < 0: raise ValueError('Unexplained reward decrease; verify missing claims or adjustment')
        if value: amounts[d] = str(value)
    return {'id': f"juno-1:staking:{opening['height']}-{closing['height']}",
            'start': opening, 'end': closing, 'day': period_start[:10], 'claims': claims, 'amounts': amounts,
            'method': 'closing-withdrawable-minus-opening-plus-claims', 'collected_at': stamp()}


def closing_sample(dao, base, opening, target):
    from update_delegation_treasury import staking_positions
    from staking_reward_rpc import historical_rewards, RPC
    first = first_at(target, opening, header())
    anchor = header(first['height'] - 1)
    response = historical_rewards(dao['core'], anchor['height'])
    rewards = staking_positions([], [], response, ADDRESS)['rewards']
    return {**anchor, 'boundary_at': target, 'rewards': totals(rewards), 'source': RPC, 'method': 'withdrawable-rewards-truncated-per-validator'}


def validate(data):
    if data.get('schema_version') != 1 or data.get('chain_id') != 'juno-1' or data.get('treasury_address') != ADDRESS:
        raise ValueError('Reward archive identity mismatch')
    previous = data['opening']
    for row in data['intervals']:
        if row['start'] != previous or interval(row['start'], row['end'], row['claims'])['amounts'] != row['amounts']:
            raise ValueError('Reward archive gap or changed arithmetic')
        previous = row['end']
    return previous


def next_boundary(opening):
    return (instant(opening.get('boundary_at', opening['timestamp'])).date() + timedelta(days=1)).isoformat() + 'T00:00:00Z'


def collect(dao, snapshot, events, path=OUT, *, max_intervals=3, max_seconds=90):
    if type(max_intervals) is not int or not 1 <= max_intervals <= 7 or not 0 < max_seconds <= 120:
        raise ValueError('Invalid reward catch-up budget')
    if dao['core'] != ADDRESS or snapshot.get('chain_id') != 'juno-1' or snapshot.get('treasury_address') != ADDRESS:
        raise ValueError('Reward snapshot identity mismatch')
    latest = instant(snapshot['generated_at'])
    deadline = time.monotonic() + max_seconds
    today = datetime.now(timezone.utc).date().isoformat()
    created = not path.exists()
    if path.exists():
        data = json.loads(path.read_text()); opening = validate(data)
        for row in data['intervals']:
            if claim_rows(events, row['start'], row['end']) != row['claims']:
                raise ValueError('Recorded reward claims changed; retained accrual requires reconciliation')
    else:
        history = json.loads((ROOT / 'data/treasury/juno-delegation-history.json').read_text())
        candidates = [r for r in history['snapshots'] if START <= r['generated_at'] < snapshot['generated_at']]
        archived = min(candidates, key=lambda r:r['height']) if candidates else snapshot
        opening = sample({**archived, 'chain_id': 'juno-1', 'treasury_address': ADDRESS})
        data = {'schema_version':1, 'chain_id':'juno-1', 'treasury_address':ADDRESS,
                'accounting_start':START, 'opening':opening, 'intervals':[]}
    for _ in range(max_intervals):
        target = next_boundary(opening)
        if instant(target) >= latest:
            # Preserve the original first, intraday checkpoint without booking
            # an opening balance as income. Later runs close UTC days only.
            if not created or data['intervals'] or snapshot['height'] <= opening['height']:
                break
            closing = sample(snapshot)
        else:
            if time.monotonic() >= deadline:
                break
            closing = closing_sample(dao, snapshot['balance_source'], opening, target)
        sources = events.get('sources', [])
        if events.get('status') != 'PARTIAL' or len(sources) != 1 or sources[0].get('last_scanned_height', 0) < closing['height']:
            raise ValueError('Receipt scan does not cover the reward sample')
        data['intervals'].append(interval(opening, closing, claim_rows(events, opening, closing)))
        opening = closing
        data.update(last_sample_day=today, last_success_at=stamp(),
                    catchup_pending=instant(next_boundary(opening)) < latest)
        # Commit each verified day. A later provider failure cannot erase it;
        # the following timer run resumes from this exact checkpoint.
        validate(data); write(path, data)
    if created and not path.exists():
        data.update(last_sample_day=today, last_success_at=stamp(), catchup_pending=instant(next_boundary(opening)) < latest)
        validate(data); write(path, data)
    data['catchup_pending'] = instant(next_boundary(opening)) < latest
    return data


def project(dao, feed, ledger, data, quotes):
    latest = validate(data)
    entries, generated = [], []
    for row in data['intervals']:
        movements = []
        for d, raw in sorted(row['amounts'].items()):
            q = quotes.get(row.get('day', row['start']['timestamp'][:10]) + ':' + d)
            decimals = q['decimals'] if q else 6 if d == 'ujuno' else None
            with localcontext() as ctx:
                ctx.prec = 80
                amount = format(Decimal(raw) / 10**decimals, 'f') if decimals is not None else None
                usd = format((Decimal(amount)*Decimal(q['usd_price'])).quantize(Decimal('0.000000000000000001'), rounding=ROUND_DOWN), 'f') if q else None
            uid = row['id'] + ':' + str(len(movements))
            r = {'id':uid,'receipt_id':uid,'chain_id':'juno-1','treasury_address':ADDRESS,'tx_hash':None,
                 'timestamp':row['end']['timestamp'],'height':row['end']['height'],'message_index':len(movements),
                 'denom':d,'asset':q['symbol'] if q else 'JUNO' if d=='ujuno' else d,'decimals':decimals,
                 'amount':amount,'raw_amount':raw,'direction':'in','counterparty':DISTRIBUTION,
                 'classification':'staking_rewards','category':'staking_rewards','usd_value':usd,'valuation':q,
                 'evidence':{'kind':'staking-accrual','method':row['method'],'start':row['start'],'end':row['end'],'claims':row['claims']}}
            movements.append(r); entries.append(r)
        if movements:
            generated.append({'id':row['id'],'chain_id':'juno-1','chain_name':'Juno','treasury_address':ADDRESS,
                              'timestamp':row['end']['timestamp'],'height':row['end']['height'],'tx_hash':None,
                              'status':'confirmed','type':'inflow','title':'Staking rewards · '+row['end']['timestamp'][:10],
                              'movements':movements,'evidence':{'kind':'staking-accrual','start':row['start'],'end':row['end']},
                              'explorer_url':'https://atomscan.com/juno/blocks/'+str(row['end']['height'])})
    gaps = [f"Daily staking accrual starts {data['opening']['timestamp']}; earlier October rewards are unavailable, not zero. Opening claimable rewards are excluded from income. Claims only settle accrued rewards. Slashing and other unclassified movements remain outside recorded totals."]
    coverage = {'method':'daily-claim-adjusted-rewards','from_time':data['opening']['timestamp'],
                'through_time':latest['timestamp'],'through_height':latest['height'],
                'last_success_at':data.get('last_success_at'),'intervals':len(data['intervals']),
                'status':'CURRENT' if (datetime.now(timezone.utc)-instant(latest['timestamp'])).total_seconds()<172800 else 'STALE'}
    feed = {**feed,'events':[e for e in feed['events'] if e.get('evidence',{}).get('kind')!='staking-accrual']+generated,
            'accrual_coverage':coverage,'coverage_gaps':gaps}
    feed['events'].sort(key=lambda e:(e['timestamp'],e['id']), reverse=True)
    ledger = {**ledger,'schema_version':4,'entries':ledger['entries']+entries,'accrual_coverage':coverage,
              'coverage_gaps':gaps,'valuation_policy':'Daily reward accrual in withdrawable units, adjusted for claims; historical daily-opening USD references.'}
    return feed, ledger
