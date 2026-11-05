"""Delegation treasury receipts executed in SDK EndBlock, without a transaction hash."""
from collections import Counter
from decimal import Decimal, localcontext
import hashlib
import json
import re

from validator_governance import account_bytes
from community_block_ledger import CHAIN, DISTRIBUTION, attributes, coins, header, instant, read_ledger, rpc, validate

KIND = 'staking-finalize-block'


def checksum(proof):
    return hashlib.sha256(json.dumps(proof, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def amounts(text):
    parsed = coins(text)
    if any(value != int(value) or value < 0 for value in parsed.values()):
        raise ValueError('Invalid block payout amount')
    return {denom: str(int(value)) for denom, value in parsed.items() if value}


def is_payment(event, address):
    return (event['type'] == 'transfer' and event.get('mode') == 'EndBlock'
            and event.get('sender') == DISTRIBUTION and event.get('recipient') == address)


def capture(height, recorded, address, chunk):
    anchor = header(height)
    range_end = chunk['end']
    if (anchor if height == range_end['height'] else header(range_end['height'])) != range_end:
        raise ValueError('Block payout range anchor changed')
    result = rpc('block_results', height=height)
    if int(result['height']) != height or not isinstance(result.get('finalize_block_events'), list):
        raise ValueError('Missing finalized block payout evidence')
    transfers, claims = [], []
    for index, event in enumerate(result['finalize_block_events']):
        if event['type'] not in ('transfer', 'withdraw_rewards'):
            continue
        row = {'type': event['type'], **attributes(event)}
        if is_payment(row, address):
            transfers.append({'index': index, **row})
        elif row['type'] == 'withdraw_rewards' and row.get('mode') == 'EndBlock' and row.get('delegator') == address:
            paid = amounts(row['amount'])
            claims.append({'event_index': index, 'transfer_index': index - 1 if paid else None,
                           'validator': row['validator'], 'recipient': address, 'amounts': paid})
    if recorded != transfers:
        raise ValueError('Block payouts differ from the retained distribution ledger')
    return {'anchor': anchor, 'transfers': transfers, 'claims': claims}


def make_event(proof, chain, registry):
    anchor, transfers, claims = proof['anchor'], proof['transfers'], proof['claims']
    address, height = chain['address'], anchor['height']
    if not re.fullmatch('[A-F0-9]{64}', anchor['hash']) or type(height) is not int or height < 1:
        raise ValueError('Invalid payout block identity')
    uid = f'{CHAIN}:block-rewards:{height}'
    payments, all_paid, matched, positions = {}, Counter(), set(), set()
    for transfer in transfers:
        i = transfer['index']
        if type(i) is not int or i < 0 or i in payments or not is_payment(transfer, address):
            raise ValueError('Unexpected or duplicate block transfer')
        payments[i] = amounts(transfer['amount'])
        all_paid.update({d: int(v) for d, v in payments[i].items()})
    withdrawals = []
    for claim in claims:
        idx, prior, paid = claim['event_index'], claim['transfer_index'], claim['amounts']
        account_bytes(claim['validator'], 'junovaloper')
        if type(idx) is not int or idx < 0 or idx in positions or claim['recipient'] != address:
            raise ValueError('Invalid block reward withdrawal')
        positions.add(idx)
        if paid:
            if type(prior) is not int or prior != idx - 1 or prior in matched or payments.get(prior) != paid:
                raise ValueError('Block reward withdrawal does not match its bank transfer')
            matched.add(prior)
        elif prior is not None:
            raise ValueError('Zero withdrawal has a bank transfer')
        withdrawals.append({**claim, 'block_hash': anchor['hash'], 'block_mode': 'EndBlock'})
    movements = []
    with localcontext() as ctx:
        ctx.prec = 100
        for d, value in sorted(all_paid.items()):
            meta = registry.get(d, {})
            amount = str(Decimal(value).scaleb(-meta['decimals'])) if meta.get('decimals') is not None else None
            movements.append({'id': f'{uid}:{len(movements)}', 'direction': 'in', 'asset': meta.get('symbol', d),
                              'amount': amount, 'raw_amount': str(value), 'denom': d, 'counterparty': DISTRIBUTION,
                              'classification': 'unreviewed', 'usd_value': None, 'valuation_status': 'payment-time-price-unavailable'})
    return {'id': uid, 'chain_id': CHAIN, 'chain_name': chain['name'], 'treasury_address': address,
            'height': height, 'timestamp': anchor['timestamp'], 'timestamp_status': 'confirmed', 'tx_hash': None,
            'status': 'confirmed', 'type': 'inflow', 'title': 'Staking rewards claimed' if matched == set(payments) else 'Distribution module transfer',
            'actions': [], 'ibc_packets': 0, 'proposal_id': None, 'proposal_title': None,
            'explorer_url': f'https://atomscan.com/juno/blocks/{height}',
            'account_explorer_url': chain['explorer_account'].format(address=address),
            'evidence': {'kind': KIND, 'proof': proof, 'sha256': checksum(proof)},
            'movements': movements, 'reward_withdrawals': withdrawals}


def collect(chain, registry, existing, receipt_tip):
    from staking_accrual import ADDRESS
    if chain['id'] != CHAIN or chain['address'] != ADDRESS:
        raise ValueError('Foreign staking account')
    blocks = read_ledger()
    validate(blocks)
    ranges = blocks['ranges']
    if not ranges:
        raise ValueError('Distribution block coverage unavailable')
    prior = {}
    for row in existing:
        if row.get('evidence', {}).get('kind') == KIND:
            if row['height'] in prior:
                raise ValueError('Duplicate retained block payout')
            prior[row['height']] = row
    found, seen = [], set()
    through = min(receipt_tip, ranges[-1]['end']['height'])
    for chunk in ranges:
        for item in chunk['module_transfers']:
            height = item['height']
            recorded = [v for v in item['events'] if is_payment(v, ADDRESS)]
            if not recorded or height > through:
                continue
            if height in seen or not chunk['start']['height'] <= height <= chunk['end']['height']:
                raise ValueError('Invalid block payout range')
            seen.add(height)
            old = prior.pop(height, None)
            if old is None:
                proof = capture(height, recorded, ADDRESS, chunk)
            else:
                evidence = old['evidence']
                proof = evidence['proof']
                if (evidence['sha256'] != checksum(proof) or proof['anchor']['height'] != height
                        or proof['transfers'] != recorded or old['treasury_address'] != ADDRESS):
                    raise ValueError('Retained block payout differs from the captured evidence')
            stamp = instant(proof['anchor']['timestamp'])
            if not instant(chunk['start']['timestamp']) <= stamp <= instant(chunk['end']['timestamp']):
                raise ValueError('Block payout time outside the retained range')
            found.append(make_event(proof, chain, registry))
    if prior:
        raise ValueError('Previously captured block payout is missing from distribution coverage')
    return found, ranges[0]['start']['height'], through
