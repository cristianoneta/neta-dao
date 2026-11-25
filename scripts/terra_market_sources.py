"""Pinned Astroport references and bounded, current-only Terra venue inventory."""
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import json
from pathlib import Path
import re
from urllib.parse import urlencode

from market_direct_sources import block, decimal, fallback, iso, smart_path, stamp

CONFIG = json.loads(Path(__file__).with_name('terra_market_sources.json').read_text())


def info(denom):
    return {'token': {'contract_addr': denom}} if denom.startswith('terra1') else {'native_token': {'denom': denom}}


def info_denom(value):
    return value.get('native_token', {}).get('denom') or value.get('token', {}).get('contract_addr')


def simulation_price(result, offer, decimals, quote_decimals):
    if any(not re.fullmatch(r'\d+', str(v)) for v in (result.get('return_amount'), result.get('commission_amount'), offer)):
        raise ValueError('Invalid simulation amounts')
    if int(offer) <= 0 or int(result['return_amount']) <= 0:
        raise ValueError('Empty simulation')
    return (Decimal(result['return_amount']) + Decimal(result['commission_amount'])) / Decimal(offer) * Decimal(10)**(decimals - quote_decimals)


def reference(direct, base, anchor, spec):
    height, pool = anchor['height'], spec['pool']
    pair = direct.http(base + smart_path(pool, {'pair': {}}), height, ttl=300)['data']['data']
    contract = direct.http(base + '/cosmwasm/wasm/v1/contract/' + pool, height, ttl=300)['data']
    registered = direct.http(base + smart_path(CONFIG['factory'], {'pair': {'asset_infos': [info(spec['denom']), info(spec['quote'])]}}), height, ttl=300)['data']['data']
    if (pair.get('contract_addr') != pool or registered.get('contract_addr') != pool or contract.get('address') != pool
            or contract.get('contract_info', {}).get('creator') != CONFIG['factory']
            or int(contract.get('contract_info', {}).get('code_id', 0)) != spec['pairCodeId']
            or sorted(info_denom(a) for a in pair.get('asset_infos', [])) != sorted([spec['denom'], spec['quote']])):
        raise ValueError('Unverified Astroport reference pair')
    url = base + smart_path(pool, {'simulation': {'offer_asset': {'info': info(spec['denom']), 'amount': spec['offerAmount']}}})
    result = direct.http(url, height, ttl=30)['data']['data']
    return {'price': str(simulation_price(result, spec['offerAmount'], spec['decimals'], spec['quoteDecimals'])),
            'offer_amount': spec['offerAmount'], **result, 'source': url}


def observation(direct, slug):
    spec = direct.specs[slug]
    def observe(base):
        anchor = block(direct.http, base, CONFIG['chain'])
        quote = reference(direct, base, anchor, spec)
        usd = direct.quote('usd-coin')
        if spec['quote'] == 'uluna':
            luna = reference(direct, base, anchor, {'denom': 'uluna', 'quote': CONFIG['usdc'], 'pool': CONFIG['lunaPool'],
                             'pairCodeId': 2569, 'decimals': 6, 'quoteDecimals': 6, 'offerAmount': '100000000'})
            usd = {**usd, 'price': str(decimal(usd['price']) * decimal(luna['price'])),
                   'source': 'Astroport LUNA/USDC.inj × CoinGecko USDC', 'pool_quote': luna}
        usd.update(pool_height=anchor['height'], pool_observed_at=anchor['block_time'],
                   assumption='USDC.inj valued at USDC/USD; bridging and pool prices may diverge.')
        at = iso()
        current = {**anchor, 'time': int(stamp(at)), 'observed_at': at, 'provider': base,
                   'price_quote': quote['price'], 'quote_symbol': spec['quoteSymbol'],
                   'price_usd': str(decimal(quote['price']) * decimal(usd['price'])), 'price_juno': None,
                   'total_supply': None, 'liquidity_usd': None, 'reserve_token': None, 'usd_anchor': usd,
                   'simulation': quote, 'price_method': 'Small simulated trade before commission; price impact is not removed. Not an infinitesimal spot price.'}
        return direct.envelope(spec, current, 'Astroport ' + spec['symbol'] + ' / ' + spec['quoteSymbol'])
    return fallback(CONFIG['bases'], observe)


def supply(direct, slug):
    spec = direct.specs[slug]
    def read(base):
        anchor = block(direct.http, base, spec['supplyChain'])
        path = smart_path(spec['supplyDenom'], {'token_info': {}}) if spec['supplyKind'] == 'cw20' else '/cosmos/bank/v1beta1/supply/by_denom?' + urlencode({'denom': spec['supplyDenom']})
        r = direct.http(base + path, anchor['height'])
        if spec['supplyKind'] == 'cw20':
            token = r['data']['data']
            if token.get('symbol') != spec['symbol'] or token.get('decimals') != spec['decimals']:
                raise ValueError('Wrong CW20 supply identity')
            raw = token.get('total_supply')
        else:
            amount = r['data']['amount']
            if amount.get('denom') != spec['supplyDenom']:
                raise ValueError('Wrong native supply denomination')
            raw = amount.get('amount')
        if not isinstance(raw, str) or not re.fullmatch(r'\d+', raw):
            raise ValueError('Invalid issued supply')
        return {**anchor, 'chain_id': spec['supplyChain'], 'denom': spec['supplyDenom'], 'decimals': spec['decimals'],
                'total_supply': str(decimal(raw) / Decimal(10)**spec['decimals']), 'raw_total_supply': raw,
                'observed_at': anchor['block_time'], 'url': r['source'], 'interval_seconds': spec['supplyInterval'],
                'source': 'CW20 token_info total supply' if spec['supplyKind'] == 'cw20' else 'Native bank total supply',
                'scope': 'Canonical ASTRO on Neutron; legacy Terra CW20 and xASTRO excluded' if slug == 'astro' else 'Native Terra bank total' if slug == 'luna' else 'Terra CW20 total supply'}
    return fallback(CONFIG['bases'] if spec['supplyChain'] == CONFIG['chain'] else [spec['supplyBase']], read)


def inventory(direct):
    def read(method):
        url = 'https://app.astroport.fi/api/trpc/' + method + '?' + urlencode({'input': json.dumps({'json': {'chainId': CONFIG['chain']}}, separators=(',', ':'))})
        return direct.http(url, ttl=60, limit=3_000_000)['data']['result']['data']['json']
    with ThreadPoolExecutor(max_workers=2) as executor:
        pools, token_response = list(executor.map(read, ['pools.getAll', 'tokens.byChain']))
    if not isinstance(pools, list) or not pools or len(pools) > 2000 or token_response.get('chainId') != CONFIG['chain'] or not isinstance(token_response.get('tokens'), dict):
        raise ValueError('Invalid Astroport inventory')
    for pool in pools:
        if pool.get('chainId') != CONFIG['chain'] or not re.fullmatch(r'terra1[a-z0-9]{58}', pool.get('poolAddress', '')):
            raise ValueError('Wrong Astroport pool identity')
        for asset in pool.get('assets', []):
            raw = asset.get('amount')
            if type(raw) is int and raw >= 0:
                asset['amount'] = str(raw)
            elif not isinstance(raw, str) or not re.fullmatch(r'\d+', raw):
                asset['amount'] = None
    return {'schema_version': 1, 'chain_id': CONFIG['chain'], 'observed_at': iso(), 'source_observed_at': None,
            'source': 'https://app.astroport.fi/api/trpc/pools.getAll',
            'method': 'Venue-reported current liquidity and rolling 24h volume; retrieval time only. No independent swap indexing.',
            'data': {'pools': pools, 'tokens': token_response['tokens']}}
