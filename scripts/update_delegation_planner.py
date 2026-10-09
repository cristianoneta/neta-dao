#!/usr/bin/env python3
"""Bounded read-only inputs for the Juno allocation planner. No signing or proposals."""
import argparse
import base64
from datetime import datetime, timezone
from decimal import Decimal, ROUND_CEILING
import hashlib
import json
from pathlib import Path
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PROGRAMME = 'juno1nmezpepv3lx45mndyctz2lzqxa6d9xzd2xumkxf7a6r4nxt0y95qypm6c0'
PROVIDERS = ('https://juno.api.m.stavr.tech', 'https://juno-api.polkachu.com', 'https://juno-rest.publicnode.com')


class Reader:
    def __init__(self, base, deadline):
        self.base, self.deadline = base, deadline

    def get(self, path, height=None):
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Collection deadline exceeded')
        headers = {'Accept': 'application/json', 'User-Agent': 'Cosmoot-Delegation-Planner/1.0'}
        if height is not None:
            headers['x-cosmos-block-height'] = str(height)
        with urllib.request.urlopen(urllib.request.Request(self.base + path, headers=headers), timeout=min(12, remaining)) as response:
            if height is not None and response.headers.get('x-cosmos-block-height') != str(height):
                raise ValueError('Provider did not confirm the requested height')
            body = response.read(8 * 1024 * 1024 + 1)
            if len(body) > 8 * 1024 * 1024:
                raise ValueError('Oversized response')
            return json.loads(body)

    def pages(self, path, field, height):
        rows, seen, key = [], set(), ''
        for _ in range(20):
            query = urllib.parse.urlencode({'pagination.limit': '200', 'pagination.key': key})
            response = self.get(path + '?' + query, height)
            page = response[field]
            if not isinstance(page, list):
                raise ValueError('Invalid paginated response')
            rows.extend(page)
            key = response.get('pagination', {}).get('next_key') or ''
            if not key:
                return rows
            if key in seen:
                raise ValueError('Repeated pagination key')
            seen.add(key)
        raise ValueError('Pagination bound exceeded')

    def smart(self, address, message, height):
        query = urllib.parse.quote(base64.b64encode(json.dumps(message).encode()).decode(), safe='')
        return self.get(f'/cosmwasm/wasm/v1/contract/{address}/smart/{query}', height)['data']


def consensus_address(key):
    # Cosmos staking and the Tendermint REST response use different key wrappers.
    value = key.get('key') or key.get('value')
    kind = key.get('@type') or key.get('type')
    if kind not in ('/cosmos.crypto.ed25519.PubKey', 'tendermint/PubKeyEd25519'):
        raise ValueError('Unsupported consensus public key')
    decoded = base64.b64decode(value, validate=True)
    if len(decoded) != 32:
        raise ValueError('Invalid consensus key length')
    return hashlib.sha256(decoded).digest()[:20].hex().upper()


def uint(value):
    if not isinstance(value, str) or not value.isascii() or not value.isdigit() or len(value) > 30:
        raise ValueError('Invalid integer amount')
    return int(value)


def assemble(validators, consensus, delegations, address):
    active = {consensus_address(v['pub_key']) for v in consensus}
    if not active or len(active) != len(consensus):
        raise ValueError('Invalid consensus validator set')
    positions = {}
    for row in delegations:
        d, coin = row['delegation'], row['balance']
        validator = d['validator_address']
        if d['delegator_address'] != address or coin['denom'] != 'ujuno' or validator in positions:
            raise ValueError('Invalid delegation identity')
        positions[validator] = uint(coin['amount'])
    rows, seen, seen_keys = [], set(), set()
    for v in validators:
        operator = v['operator_address']
        key = consensus_address(v['consensus_pubkey'])
        tokens, current = uint(v['tokens']), positions.get(operator, 0)
        commission = Decimal(v['commission']['commission_rates']['rate'])
        if operator in seen or key in seen_keys or current > tokens or not commission.is_finite() or not 0 <= commission <= 1 or not isinstance(v['jailed'], bool):
            raise ValueError('Invalid validator accounting')
        seen.add(operator)
        seen_keys.add(key)
        rows.append({'address': operator, 'consensusAddress': key,
                     'name': str(v['description']['moniker'])[:200], 'active': key in active,
                     'jailed': v['jailed'], 'tokensRaw': str(tokens), 'currentRaw': str(current),
                     # Round upward: a commission just above the limit must fail it.
                     'commissionBps': int((commission * 10000).to_integral_value(rounding=ROUND_CEILING))})
    if not active <= seen_keys or not set(positions) <= seen:
        raise ValueError('Missing active validator or existing delegation')
    return sorted(rows, key=lambda v: v['address']), len(active)


def collect(reader, dao):
    latest = reader.get('/cosmos/base/tendermint/v1beta1/blocks/latest')['block']['header']
    if latest['chain_id'] != 'juno-1' or dao['core'] != PROGRAMME:
        raise ValueError('Unexpected chain or programme')
    height = int(latest['height']) - 20
    header = reader.get(f'/cosmos/base/tendermint/v1beta1/blocks/{height}')['block']['header']
    if int(header['height']) != height or header['chain_id'] != 'juno-1':
        raise ValueError('Wrong snapshot block')
    address = dao['core']
    config = reader.smart(address, {'config': {}}, height)
    info = reader.get('/cosmwasm/wasm/v1/contract/' + address, height)['contract_info']
    voting = reader.smart(address, {'voting_module': {}}, height)
    modules = reader.smart(address, {'proposal_modules': {}}, height)
    if config['name'] != dao['onChainName'] or str(info['code_id']) != str(dao['coreCodeId']) or voting != dao['votingModule'] or not any(m['address'] == dao['proposalModule'] and m['status'] == 'enabled' for m in modules):
        raise ValueError('Programme authority identity changed')
    vals = reader.pages('/cosmos/staking/v1beta1/validators', 'validators', height)
    cons = reader.pages(f'/cosmos/base/tendermint/v1beta1/validatorsets/{height}', 'validators', height)
    delegated = reader.pages('/cosmos/staking/v1beta1/delegations/' + address, 'delegation_responses', height)
    rows, active = assemble(vals, cons, delegated, address)
    coins = reader.pages('/cosmos/bank/v1beta1/spendable_balances/' + address, 'balances', height)
    if len({c['denom'] for c in coins}) != len(coins):
        raise ValueError('Duplicate spendable balance')
    liquid = next((uint(c['amount']) for c in coins if c['denom'] == 'ujuno'), 0)
    redelegations = reader.pages('/cosmos/staking/v1beta1/delegators/' + address + '/redelegations', 'redelegation_responses', height)
    return {'schema': 1, 'chainId': 'juno-1', 'programme': address, 'height': height,
            'blockTime': header['time'], 'collectedAt': datetime.now(timezone.utc).isoformat(),
            'source': reader.base, 'activeCount': active, 'liquidRaw': str(liquid),
            'validators': rows, 'redelegations': redelegations,
            'authority': {'coreCodeId': str(info['code_id']), 'votingModule': voting,
                          'proposalModule': dao['proposalModule'], 'executionVerified': False}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'data/daos/juno-delegation-planner.json')
    args = parser.parse_args()
    dao = next(d for d in json.loads((ROOT / 'data/dao-directory.json').read_text())['daos'] if d['id'] == 'juno-delegation')
    deadline, errors = time.monotonic() + 150, []
    for provider in PROVIDERS:
        try:
            result = collect(Reader(provider, deadline), dao)
            args.output.parent.mkdir(parents=True, exist_ok=True)
            temp = args.output.with_suffix('.tmp')
            temp.write_text(json.dumps(result, indent=2) + '\n')
            temp.replace(args.output)
            print(f'Planner snapshot: height {result["height"]}, {result["activeCount"]} active validators.')
            return
        except Exception as error:
            errors.append(f'{provider}: {type(error).__name__}: {error}')
    raise SystemExit('No snapshot replaced. ' + '; '.join(errors))


if __name__ == '__main__':
    main()
