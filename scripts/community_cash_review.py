"""Audit recorded distribution outflows without confusing reward claims with Pool spend."""
from collections import defaultdict
from decimal import Decimal, localcontext
from community_block_ledger import attributes, coins, DISTRIBUTION, validate


def review(blocks):
    validate(blocks)
    unresolved, transactions = [], 0
    with localcontext() as ctx:
        ctx.prec = 80
        for chunk in blocks['ranges']:
            for item in chunk['module_transfers']:
                unresolved.append({'height': item['height'], 'reason': 'unclassified module transfer'})
            for item in chunk['transaction_evidence']:
                for tx in item['transactions']:
                    transactions += 1
                    outgoing, withdrawals = defaultdict(Decimal), defaultdict(Decimal)
                    for event in tx['events']:
                        a = attributes(event)
                        if event['type'] == 'transfer' and a.get('sender') == DISTRIBUTION:
                            target = outgoing
                        elif event['type'] in ('withdraw_rewards', 'withdraw_commission'):
                            target = withdrawals
                        else:
                            continue
                        # Message boundaries prevent unrelated claims masking a spend.
                        for denom, amount in coins(a.get('amount', '')).items():
                            target[(a.get('msg_index'), denom)] += amount
                    if {k:v for k,v in outgoing.items() if v} != {k:v for k,v in withdrawals.items() if v}:
                        unresolved.append({'height': item['height'], 'tx_index': tx['tx_index'], 'reason': 'unmatched distribution outflow'})
    return {'method': 'distribution-outflows-less-reward-withdrawals',
            'from_height': blocks['ranges'][0]['start']['height'] if blocks['ranges'] else None,
            'through_height': blocks.get('last_scanned_height'), 'transactions_checked': transactions,
            'unresolved': unresolved, 'status': 'reviewed' if not unresolved and blocks['ranges'] else 'incomplete',
            'scope': 'Recorded activity only; unmeasured withdrawal dust and validator-removal remainders are excluded.'}
