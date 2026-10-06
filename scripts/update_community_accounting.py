#!/usr/bin/env python3
"""Native Juno Community Pool receipt and governance adapter (read-only).

The distribution account also holds validator rewards. Its ordinary bank transfers
are NOT a Community Pool ledger. Block allocations/drip remain an explicit gap.
"""
import json
from pathlib import Path
from urllib.parse import urlencode

from treasury_history import ACCOUNTING_START, block, instant, scan
from update_treasury_events import request_json, now, movements, denom_registry

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/treasury/juno-community-events.json'
RESTS = ('https://juno.api.m.stavr.tech', 'https://juno-api.polkachu.com')
ADDRESS = 'juno1jv65s3grqf6v6jl3dp4t6c9t9rk99cd83d88wr'
SCOPE = 'juno-community-pool'
FUND = '/cosmos.distribution.v1beta1.MsgFundCommunityPool'
SPEND = '/cosmos.distribution.v1beta1.MsgCommunityPoolSpend'
CHAIN = {'id': 'juno-1', 'address': ADDRESS, 'creation_height': 1,
         'query_pairs': [('message.action', FUND)]}
GAPS = ['Block-level Community Pool accruals, rounding, burns and drip/module payouts are not yet reconstructed. Full income, expenses and result remain unavailable.']


def funding_event(receipt, provider):
    if int(receipt['code']) != 0 or instant(receipt['timestamp']) < instant(ACCOUNTING_START):
        return None
    messages = receipt['tx']['body']['messages']
    # Only match top-level funding messages against exact transfer evidence, not
    # arbitrary sends to the distribution account or nested authz calls.
    expected = []
    for index, message in enumerate(messages):
        if message.get('@type') != FUND:
            continue
        for coin in message['amount']:
            if not str(coin['amount']).isdigit() or int(coin['amount']) <= 0:
                raise ValueError('Invalid Community Pool funding amount')
            expected.append((message['depositor'], coin['denom'], coin['amount'], index))
    if not expected:
        raise ValueError('Unsupported nested Community Pool funding receipt')
    raw_moves = movements(receipt.get('events', []), denom_registry(), ADDRESS)
    result, used = [], set()
    for sender, denom, amount, message_index in expected:
        matches = [i for i, m in enumerate(raw_moves) if i not in used and
                   (m['direction'], m['counterparty'], m['denom'], m['raw_amount']) == ('in', sender, denom, amount)]
        if len(matches) != 1:
            raise ValueError('Ambiguous or missing funding transfer')
        index = matches[0]; used.add(index)
        result.append({**raw_moves[index], 'message_index': message_index,
                       'classification': 'funding', 'usd_value': None})
    digest = receipt['txhash'].upper()
    event_id = 'juno-1:' + digest
    for index, movement in enumerate(result):
        movement['id'] = f'{event_id}:{index}'
    return {'id': event_id, 'chain_id': 'juno-1', 'chain_name': 'Juno',
            'treasury_address': ADDRESS, 'height': int(receipt['height']),
            'timestamp': receipt['timestamp'], 'timestamp_status': 'confirmed',
            'tx_hash': digest, 'status': 'confirmed', 'type': 'inflow',
            'title': 'Community Pool funding received', 'movements': result,
            'proposal_id': None, 'evidence': {'kind': 'provider-receipt', 'provider': provider},
            'explorer_url': 'https://atomscan.com/juno/transactions/' + digest}


def proposal_spends(proposal):
    found = []
    for index, msg in enumerate(proposal.get('messages', [])):
        if msg.get('@type') == SPEND:
            found.append({'action_index': index, 'recipient': msg['recipient'], 'amount': msg['amount']})
        elif msg.get('@type') == '/cosmos.gov.v1.MsgExecLegacyContent':
            content = msg.get('content', {})
            if content.get('@type') == '/cosmos.distribution.v1beta1.CommunityPoolSpendProposal':
                found.append({'action_index': index, 'recipient': content['recipient'], 'amount': content['amount']})
    return found


def governance(get, base):
    """Page all proposal records; include only post-cutoff execution candidates.

    IDs do not order voting end times. Never stop early on an old proposal or
    equate proposal passage/voting end with a priced payment receipt.
    """
    result, seen_ids, keys, key = [], set(), set(), None
    for _ in range(100):
        params = {'pagination.limit': 100, 'pagination.reverse': 'true', 'proposal_status': 3}
        if key: params['pagination.key'] = key
        try:
            data = get(base + '/cosmos/gov/v1/proposals?' + urlencode(params), timeout=15)
        except Exception as error:
            if not seen_ids: raise
            return result, {'checked': len(seen_ids), 'status': 'PARTIAL',
                            'warning': f'Older governance page unavailable ({type(error).__name__}); recent observed proposals retained, catalogue coverage incomplete.'}
        if not isinstance(data.get('proposals'), list):
            raise ValueError('Missing governance collection')
        for proposal in data['proposals']:
            pid = str(proposal['id'])
            if pid in seen_ids: raise ValueError('Duplicate governance page')
            seen_ids.add(pid)
            spends = proposal_spends(proposal)
            if not spends or proposal.get('status') != 'PROPOSAL_STATUS_PASSED': continue
            if instant(proposal['voting_end_time']) < instant(ACCOUNTING_START): continue
            result.append({'proposal_id': pid, 'title': proposal.get('title', ''),
                           'voting_end_time': proposal['voting_end_time'], 'actions': spends,
                           'status': 'execution-receipt-required', 'provider': base,
                           'url': 'https://atomscan.com/juno/proposals/' + pid})
        next_key = data.get('pagination', {}).get('next_key')
        if not next_key: return result, {'checked': len(seen_ids), 'status': 'provider-index-only'}
        if not data['proposals'] or next_key in keys: raise ValueError('Truncated governance pagination')
        keys.add(next_key); key = next_key
    raise ValueError('Governance pagination limit')


def collect(previous=None, get=request_json):
    previous = previous or {}
    expected = [{'chain_id': 'juno-1', 'address': ADDRESS}]
    if previous and (previous.get('scope') != SCOPE or previous.get('treasuries') != expected):
        raise ValueError('Community Pool source identity mismatch')
    errors = []
    for base in RESTS:
        try:
            account = get(base + '/cosmos/auth/v1beta1/module_accounts/distribution', timeout=15)['account']
            if account.get('name') != 'distribution' or account['base_account']['address'] != ADDRESS:
                raise ValueError('Distribution module identity mismatch')
            prior = previous.get('events', [])
            source = next(iter(previous.get('sources', [])), None)
            found, coverage = scan(get, base, CHAIN, prior, source)
            candidates, governance_scan = governance(get, base)
            rows = {r['tx_hash']: r for r in prior}
            for tx in found.values():
                row = funding_event(tx, base)
                if row is None: continue
                old = rows.get(row['tx_hash'])
                if old and any(old[k] != row[k] for k in ('timestamp', 'height', 'movements')):
                    raise ValueError('Recorded Community Pool funding changed')
                rows[row['tx_hash']] = row
            old_candidates = {p['proposal_id']: p for p in previous.get('execution_candidates', [])}
            observed_candidates = {p['proposal_id']: p for p in candidates}
            if governance_scan['status'] != 'PARTIAL' and set(old_candidates) - set(observed_candidates):
                raise ValueError('Governance index lost a recorded spending proposal')
            candidates = list({**old_candidates, **observed_candidates}.values())
            gaps = GAPS + ([governance_scan['warning']] if governance_scan.get('warning') else [])
            stamp = now()
            return {'schema_version': 2, 'scope': SCOPE, 'treasuries': expected,
                    'accounting_start': ACCOUNTING_START, 'status': 'PARTIAL',
                    'generated_at': stamp, 'checked_at': stamp, 'last_success_at': stamp,
                    'sources': [coverage], 'events': sorted(rows.values(), key=lambda r: (r['timestamp'], r['id']), reverse=True),
                    'execution_candidates': candidates, 'governance_scan': governance_scan,
                    'governance_proposals_checked': governance_scan['checked'],
                    'coverage_gaps': gaps, 'warnings': gaps + ([f'{len(candidates)} passed spending proposals await exact execution receipts and payment-time prices.'] if candidates else [])}
        except Exception as error:
            errors.append(f'{base}: {type(error).__name__}: {error}')
    return {**previous, 'schema_version': 2, 'scope': SCOPE, 'treasuries': expected,
            'accounting_start': ACCOUNTING_START, 'status': 'UNAVAILABLE', 'checked_at': now(),
            'events': previous.get('events', []), 'sources': previous.get('sources', []),
            'coverage_gaps': GAPS, 'warnings': ['Community Pool refresh failed; previous evidence retained.', *errors]}


def atomic(path, data):
    temporary = path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(data, indent=2) + '\n'); temporary.replace(path)


if __name__ == '__main__':
    data = collect(json.loads(OUT.read_text()) if OUT.exists() else None)
    atomic(OUT, data)
    print(json.dumps({'status': data['status'], 'funding_receipts': len(data['events']),
                      'execution_candidates': len(data.get('execution_candidates', []))}))
