"""Read the shared WYND reserves at one confirmed Juno block. Display data only."""
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import re
from urllib.parse import quote
from urllib.request import Request, urlopen

from treasury_history import block, instant


def pinned(base, path, height):
    req = Request(base + path, headers={'x-cosmos-block-height': str(height), 'Accept': 'application/json'})
    with urlopen(req, timeout=5) as response:
        if response.headers.get('x-cosmos-block-height') != str(height):
            raise ValueError('Unconfirmed WYND query height')
        return json.load(response)


def read_pool(base, height, spec, asset_infos, read=pinned):
    name, lp, pair, stake = spec
    path = '/cosmwasm/wasm/v1/contract/' + pair
    def smart(query):
        encoded = quote(base64.b64encode(json.dumps({query: {}}).encode()).decode(), safe='')
        return read(base, path + '/smart/' + encoded, height)['data']
    code = read(base, path, height)['contract_info']['code_id']
    identity, reserves = smart('pair'), smart('pool')
    expected = [asset_infos[symbol] for symbol in name.split(' / ')]
    infos = [asset['info'] for asset in reserves['assets']]
    if (str(code) != '2289' or identity['contract_addr'] != pair or identity['liquidity_token'] != lp
            or identity['staking_addr'] != stake or identity['pair_type'] != {'xyk': {}}
            or str(identity['fee_config']['total_fee_bps']) != '30'
            or len(infos) != 2 or len(identity['asset_infos']) != 2
            or any(i not in infos or i not in identity['asset_infos'] for i in expected)):
        raise ValueError('WYND pool identity mismatch')
    for raw in [reserves['total_share'], *(a['amount'] for a in reserves['assets'])]:
        if not isinstance(raw, str) or not re.fullmatch(r'[1-9][0-9]{0,38}', raw):
            raise ValueError('Invalid WYND reserve or LP supply')
    return pair, {'code_id': str(code), 'pair': identity, 'reserves': reserves}


def collect(base, height, specs, assets, prices, price_source, price_time, get):
    anchor = block(get, base, height, 'juno-1')
    if not -60 <= (datetime.now(timezone.utc) - instant(anchor['time'])).total_seconds() <= 600:
        raise ValueError('Stale WYND block')
    with ThreadPoolExecutor(max_workers=4) as pool:
        pools = dict(pool.map(lambda s: read_pool(base, height, s, assets), specs))
    if len(pools) != 8 or block(get, base, height, 'juno-1')['hash'] != anchor['hash']:
        raise ValueError('Incomplete or inconsistent WYND snapshot')
    return {'schema_version': 1, 'chain_id': 'juno-1', 'height': height, 'block_hash': anchor['hash'],
            'block_time': anchor['time'], 'source': base, 'pools': pools, 'prices_usd': prices,
            'price_source': price_source, 'price_observed_at': price_time}
