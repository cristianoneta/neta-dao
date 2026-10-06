#!/usr/bin/env python3
"""Read-only, height-pinned Juno Delegation Programme holdings and receipt review."""
import json
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

from update_dao_directory import get, smart, paginated, PROVIDERS
from update_treasury import native_assets, prices, snapshot_result, write_snapshot, now, ASSETS
from update_treasury_events import collect as collect_events, CHAINS, QUERIES
from update_community_accounting import atomic
from update_generic_accounting import build as accounting_review

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/treasury'
GAPS = ['Daily reward accrual is separate from claims. Unclassified movements and slashing remain outside recorded totals.']


def staking_positions(delegations, unbondings, rewards, address):
    """Delegation balances already include redelegating stake; never add it again."""
    totals = {'delegated': defaultdict(int), 'unbonding': defaultdict(int), 'rewards': defaultdict(int)}
    seen = set()
    for row in delegations:
        d, coin = row['delegation'], row['balance']
        if d['delegator_address'] != address or d['validator_address'] in seen or coin['denom'] != 'ujuno':
            raise ValueError('Delegation identity mismatch')
        seen.add(d['validator_address'])
        if not str(coin['amount']).isdigit(): raise ValueError('Invalid delegation amount')
        totals['delegated']['ujuno'] += int(coin['amount'])
    seen = set()
    for row in unbondings:
        if row['delegator_address'] != address or row['validator_address'] in seen:
            raise ValueError('Unbonding identity mismatch')
        seen.add(row['validator_address'])
        for entry in row['entries']:
            if not str(entry['balance']).isdigit(): raise ValueError('Invalid unbonding balance')
            totals['unbonding']['ujuno'] += int(entry['balance'])
    seen = set(); exact = defaultdict(Decimal)
    for row in rewards['rewards']:
        if row['validator_address'] in seen: raise ValueError('Duplicate validator rewards')
        seen.add(row['validator_address']); denoms = set()
        for coin in row['reward']:
            value = Decimal(coin['amount'])
            if not value.is_finite() or value < 0 or coin['denom'] in denoms: raise ValueError('Invalid reward amount')
            denoms.add(coin['denom']); exact[coin['denom']] += value
            # Each validator withdrawal truncates separately to bank units.
            totals['rewards'][coin['denom']] += int(value)
    reported = {c['denom']: Decimal(c['amount']) for c in rewards['total']}
    if len(reported) != len(rewards['total']) or dict(exact) != reported:
        raise ValueError('Reward totals do not reconcile')
    return {kind: [{'denom': d, 'amount': str(v)} for d, v in coins.items() if v] for kind, coins in totals.items()}


def token_list(base, address, height):
    result = []; cursor = None
    for _ in range(100):
        q = {'limit': 100}
        if cursor: q['start_after'] = cursor
        rows = smart(base, address, {'cw20_token_list': q}, height)
        if not isinstance(rows, list): raise ValueError('Invalid CW20 list')
        if not rows: return result
        if set(rows) & set(result) or len(set(rows)) != len(rows): raise ValueError('Duplicate CW20 list page')
        result.extend(rows); cursor = rows[-1]
    raise ValueError('CW20 list pagination limit')


def build_snapshot(dao, base):
    header = get(base, '/cosmos/base/tendermint/v1beta1/blocks/latest')['block']['header']
    if header['chain_id'] != dao['network']: raise ValueError('Wrong chain')
    height = int(header['height']) - 20
    stamp = get(base, f'/cosmos/base/tendermint/v1beta1/blocks/{height}')['block']['header']['time']
    address = dao['core']
    config = smart(base, address, {'config': {}}, height)
    info = get(base, '/cosmwasm/wasm/v1/contract/' + address, height)['contract_info']
    if config['name'] != dao['onChainName'] or str(info['code_id']) != str(dao['coreCodeId']):
        raise ValueError('Delegation DAO identity changed')
    if smart(base, address, {'voting_module': {}}, height) != dao['votingModule']:
        raise ValueError('Voting module changed')
    modules = smart(base, address, {'proposal_modules': {}}, height)
    if not any(m['address'] == dao['proposalModule'] and m['status'] == 'enabled' for m in modules):
        raise ValueError('Proposal module changed')
    coins = paginated(base, '/cosmos/bank/v1beta1/balances/' + address, 'balances', height)
    if len({c['denom'] for c in coins}) != len(coins): raise ValueError('Duplicate bank asset')
    delegations = paginated(base, '/cosmos/staking/v1beta1/delegations/' + address, 'delegation_responses', height)
    unbondings = paginated(base, '/cosmos/staking/v1beta1/delegators/' + address + '/unbonding_delegations', 'unbonding_responses', height)
    rewards = get(base, '/cosmos/distribution/v1beta1/delegators/' + address + '/rewards', height)
    withdraw = get(base, '/cosmos/distribution/v1beta1/delegators/' + address + '/withdraw_address', height)['withdraw_address']
    positions = staking_positions(delegations, unbondings, rewards, address)
    price_ids = ['juno-network', *[meta['coingecko'] for meta in ASSETS.values() if meta.get('coingecko')]]
    try: market, price_source = prices(price_ids)
    except Exception: market, price_source = {}, 'Unavailable'
    warnings = []
    assets = native_assets(coins, market, warnings, custody_address=address, providers=(base,))
    for asset in assets: asset['position'] = 'Available'
    for kind, label in [('delegated', 'Delegated'), ('unbonding', 'Unbonding'), ('rewards', 'Claimable rewards')]:
        if kind == 'rewards' and withdraw != address:
            warnings.append('Rewards withdraw to a different address and are excluded from this treasury.'); continue
        rows = native_assets(positions[kind], market, warnings, custody_address=address, providers=(base,))
        for row in rows: row.update(key=row['key'] + ':' + kind, position=label)
        assets.extend(rows)
    tokens = token_list(base, address, height)
    for token in tokens:
        raw = smart(base, token, {'balance': {'address': address}}, height)['balance']
        if not str(raw).isdigit(): raise ValueError('Invalid CW20 balance')
        if not int(raw): continue
        meta = smart(base, token, {'token_info': {}}, height)
        decimals = int(meta['decimals'])
        if not 0 <= decimals <= 18: raise ValueError('Invalid CW20 decimals')
        assets.append({'type': 'token', 'key': 'cw20:' + token, 'symbol': meta['symbol'],
                       'amount': str(Decimal(raw) / 10 ** decimals), 'raw_amount': raw, 'decimals': decimals,
                       'source_chain': 'juno', 'custody_address': address, 'position': 'Available',
                       'usd_price': None, 'usd_value': None, 'change_24h': None})
    warnings.append('Coverage: bank assets, native delegations/unbonding/rewards and DAO-listed CW20s. Unlisted contracts, NFTs and other DeFi positions are not automatically discovered.')
    result = snapshot_result(stamp, height, base, price_source, assets, warnings, 'dao-core-staking', address)
    result.update(dao_id=dao['id'], on_chain_name=config['name'], checked_at=now(),
                  treasury_accounts=[{'chain_id': dao['network'], 'address': address, 'control': 'dao-core', 'balance_source': base}],
                  staking={'delegated_raw': sum(int(c['amount']) for c in positions['delegated']),
                           'unbonding_raw': sum(int(c['amount']) for c in positions['unbonding']),
                           'rewards': positions['rewards'], 'withdraw_address': withdraw,
                           'validator_count': sum(int(d['balance']['amount']) > 0 for d in delegations)},
                  cw20_tokens_checked=tokens, balance_height_pinned=True,
                  valuation_policy='Available, delegated, unbonding and claimable positions counted once. Daily reward income is recorded separately; claims are not a second revenue.')
    if withdraw != address: result['status'] = 'PARTIAL'
    return result


def run():
    dao = next(d for d in json.loads((ROOT / 'data/dao-directory.json').read_text())['daos'] if d['id'] == 'juno-delegation')
    errors = []; snapshot = None
    for base in PROVIDERS:
        try: snapshot = build_snapshot(dao, base); break
        except Exception as error: errors.append(f'{base}: {type(error).__name__}: {error}')
    if snapshot is None: raise RuntimeError('Delegation treasury unavailable; previous snapshot retained. ' + ' | '.join(errors))
    write_snapshot(snapshot, 'juno-delegation', 'juno-delegation-history')
    path = OUT / dao['events']; previous = json.loads(path.read_text()) if path.exists() else {}
    chain = {**CHAINS[0], 'address': dao['core'], 'creation_height': dao['creationHeight'],
             'queries': (*QUERIES, 'wasm.from', 'wasm.contract_address'), 'cw20_tokens': {}, 'staking_rewards': True,
             'query_pairs': [(key, dao['core']) for key in (*QUERIES, 'wasm.from', 'withdraw_rewards.delegator')]}
    try:
        events = collect_events((chain,), path, dao['proposalModule'], dao['accountingSource']['scope'])
        events['last_success_at'] = events['generated_at']
    except Exception as error:
        events = {**previous, 'schema_version': 2, 'scope': dao['accountingSource']['scope'],
                  'treasuries': dao['accountingSource']['treasuries'], 'status': 'UNAVAILABLE',
                  'checked_at': now(), 'events': previous.get('events', []), 'sources': previous.get('sources', []),
                  'warnings': ['Receipt refresh unavailable; previous evidence retained.', str(error)]}
    events['coverage_gaps'] = GAPS
    atomic(path, events)
    ledger_path = OUT / dao['accountingSource']['file']
    prior = json.loads(ledger_path.read_text()) if ledger_path.exists() else None
    bank_feed = {**events, 'events': [e for e in events['events'] if e.get('evidence', {}).get('kind') != 'staking-accrual']}
    bank_prior = {**prior, 'entries': [e for e in prior['entries'] if e.get('evidence', {}).get('kind') != 'staking-accrual']} if prior else None
    ledger = accounting_review(dao, bank_feed, bank_prior)
    from staking_accrual import collect as accrue, project, OUT as archive, PRICES
    from community_statement import prices_for
    try:
        accrued = accrue(dao, snapshot, bank_feed)
    except Exception as error:
        accrued = json.loads(archive.read_text()) if archive.exists() else None
        ledger['warnings'].append('Daily staking refresh failed; prior evidence retained: ' + str(error))
    if accrued:
        events, ledger = project(dao, bank_feed, ledger, accrued, prices_for(accrued['intervals'], PRICES))
        atomic(path, events)
    atomic(ledger_path, ledger)
    print(json.dumps({'snapshot': snapshot, 'events_status': events['status'], 'events': len(events['events']),
                      'accounting_status': ledger['refresh_status']}))


if __name__ == '__main__': run()
