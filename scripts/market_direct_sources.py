"""Direct, read-only market adapters. No Markets website dependency or wallet access."""
from __future__ import annotations

import base64
from datetime import datetime, timezone
from decimal import Decimal
import json
from pathlib import Path
import re
import threading
import time
from urllib.parse import quote, urlencode, urlsplit, parse_qs
from urllib.request import Request, urlopen

OSMOSIS = ('https://osmosis-api.polkachu.com', 'https://lcd.osmosis.zone')
JUNO = ('https://juno.api.m.stavr.tech', 'https://juno-api.polkachu.com', 'https://juno-rest.publicnode.com')
GNO_API = 'https://gnoswap.io/api/v1'
GNO_RPC = 'https://rpc.gno.land'
PRICE_API = 'https://prices.osmosis.zone/api/v3/simple/price'
ROOT = Path(__file__).resolve().parents[1]


def iso(at=None):
    return datetime.fromtimestamp(time.time() if at is None else at, timezone.utc).isoformat().replace('+00:00', 'Z')


def stamp(at):
    return float(at) if isinstance(at, (int, float)) else datetime.fromisoformat(at.replace('Z', '+00:00')).timestamp()


def decimal(value, zero=False):
    n = Decimal(str(value))
    if not n.is_finite() or n < 0 or (not zero and n == 0):
        raise ValueError('Invalid decimal')
    return n


def fresh(at, seconds, now=None):
    return -60 <= (time.time() if now is None else now) - stamp(at) <= seconds


def hash_hex(value):
    if re.fullmatch(r'[a-fA-F0-9]{64}', value or ''):
        return value.upper()
    raw = base64.b64decode(value, validate=True)
    if len(raw) != 32:
        raise ValueError('Invalid block hash')
    return raw.hex().upper()


def smart_path(address, value):
    return '/cosmwasm/wasm/v1/contract/' + address + '/smart/' + quote(base64.b64encode(json.dumps(value, separators=(',', ':')).encode()).decode(), safe='')


class HTTP:
    """Bounded reads; concurrent identical requests share a short-lived result."""
    def __init__(self, timeout=8, deadline=None):
        self.timeout = timeout
        self.deadline = deadline
        self.cache, self.locks = {}, {}
        self.guard = threading.Lock()
        self.requests = self.bytes = 0

    def __call__(self, url, height=None, body=None, ttl=0, limit=8_000_000, refresh=False):
        key = (url, height, json.dumps(body, sort_keys=True) if body is not None else None)
        with self.guard:
            lock = self.locks.setdefault(key, threading.Lock())
        with lock:
            hit = self.cache.get(key)
            if not refresh and hit and hit[0] > time.monotonic():
                return hit[1]
            remaining = self.timeout if self.deadline is None else min(self.timeout, self.deadline - time.monotonic())
            if remaining <= 0:
                raise TimeoutError('Source request budget exhausted')
            headers = {'User-Agent': 'NETA-DAO-Treasury/1.0', 'Accept': 'application/json'}
            if height is not None:
                headers['x-cosmos-block-height'] = str(height)
            if body is not None:
                headers['Content-Type'] = 'application/json'
            req = Request(url, data=json.dumps(body).encode() if body is not None else None, headers=headers)
            with self.guard:
                self.requests += 1
            with urlopen(req, timeout=remaining) as response:
                if urlsplit(response.geturl()).scheme != 'https' or urlsplit(response.geturl()).netloc != urlsplit(url).netloc:
                    raise ValueError('Unexpected source redirect')
                received = int(response.headers.get('x-cosmos-block-height') or response.headers.get('grpc-metadata-x-cosmos-block-height') or 0)
                if height is not None and received != height:
                    raise ValueError('Unconfirmed query height')
                data = response.read(limit + 1)
                if len(data) > limit:
                    raise ValueError('Oversized source response')
            with self.guard:
                self.bytes += len(data)
            result = {'data': json.loads(data), 'height': received or None, 'observed_at': iso(), 'source': url}
            if ttl:
                self.cache[key] = (time.monotonic() + ttl, result)
            return result

    def rpc(self, url, method, params=None):
        r = self(url, body={'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params or []}, limit=200_000)['data']
        if r.get('jsonrpc') != '2.0' or r.get('id') != 1 or r.get('error') or 'result' not in r:
            raise ValueError('Invalid RPC response')
        return r['result']


def block(http, base, chain, height='latest', refresh=False):
    r = http(base + '/cosmos/base/tendermint/v1beta1/blocks/' + str(height), ttl=8 if height == 'latest' else 300, refresh=refresh)
    d = r['data']
    b = d.get('block') or d.get('sdk_block') or {}
    h = b.get('header') or {}
    if h.get('chain_id') != chain or int(h.get('height', 0)) <= 0 or (height != 'latest' and int(h['height']) != int(height)):
        raise ValueError('Wrong chain block')
    if height == 'latest' and not fresh(h['time'], 120):
        raise ValueError('Stale chain block')
    return {'height': int(h['height']), 'block_hash': hash_hex(d['block_id']['hash']), 'block_time': h['time']}


def fallback(bases, read):
    errors = []
    for base in dict.fromkeys(bases):
        try:
            return read(base)
        except Exception as error:
            errors.append(type(error).__name__)
    raise RuntimeError('Direct providers unavailable: ' + ','.join(errors))


class DirectSources:
    def __init__(self, specs, treasury=None, http=None):
        self.specs = specs
        self.http = http or HTTP()
        self.treasury = Path(treasury or ROOT / 'data/treasury/current.json')

    def read(self, path):
        p = urlsplit(path)
        values = parse_qs(p.query)
        if set(values) != {'asset'} or len(values['asset']) != 1 or values['asset'][0] not in self.specs:
            raise ValueError('Unsupported market asset')
        slug = values['asset'][0]
        if p.path == '/api/observations':
            return self.observation(slug)
        if p.path == '/api/supply':
            return self.supply(slug)
        raise ValueError('Unsupported direct market request')

    def prices(self):
        ids = sorted({'usd-coin', 'tether'} | {s['priceId'] for s in self.specs.values() if s.get('referenceKind') == 'external-reference'})
        return self.http(PRICE_API + '?' + urlencode({'ids': ','.join(ids), 'vs_currencies': 'usd', 'include_last_updated_at': 'true'}), ttl=30)

    def quote(self, asset_id):
        r = self.prices()
        q = r['data'][asset_id]
        if not fresh(q['last_updated_at'], 1800):
            raise ValueError('Stale USD reference')
        return {'price': str(decimal(q['usd'])), 'observed_at': iso(q['last_updated_at']), 'source': 'CoinGecko via Osmosis', 'url': r['source']}

    def observation(self, slug):
        s = self.specs[slug]
        if s.get('referenceKind') == 'astroport-reference':
            from terra_market_sources import observation
            return observation(self, slug)
        if s.get('referenceKind') == 'external-reference':
            q = self.quote(s['priceId'])
            at = iso()
            current = {'time': int(stamp(at)), 'observed_at': at, 'price_observed_at': q['observed_at'], 'reference_kind': 'external-reference',
                       'height': None, 'block_hash': None, 'block_time': None, 'provider': q['url'], 'price_quote': q['price'],
                       'quote_symbol': 'USD', 'price_usd': q['price'], 'price_juno': None, 'liquidity_usd': None, 'reserve_token': None,
                       'total_supply': None, 'usd_anchor': None, 'price_source': {'provider': 'coingecko', 'asset_id': s['priceId'],
                       'currency': 'usd', 'observed_at': q['observed_at'], 'url': q['url']}}
            return self.envelope(s, current, 'CoinGecko USD reference · external')
        if slug in ('gnot', 'gns'):
            return self.gno(slug)
        def observe(base):
            anchor = block(self.http, base, s['chain'])
            h = anchor['height']
            reserve = liquidity = None
            if slug == 'juno':
                pair = self.http(base + smart_path(s['pool'], {'pair': {}}), h)['data']['data']
                info = self.http(base + '/cosmwasm/wasm/v1/contract/' + s['pool'], h)['data']
                p = self.http(base + smart_path(s['pool'], {'pool': {}}), h)['data']['data']
                quote_denom = 'ibc/EAC38D55372F38F1AFD68DF7FE9EF762DCF69F26520643CF3F9D292A738D8034'
                if (pair.get('contract_addr') != s['pool'] or str(info.get('contract_info', {}).get('code_id')) != '2289'
                        or pair.get('liquidity_token') != 'juno1jn6t0dsxryht8ljxulavxrfd22l87dvac8e9a99a7tuj29ysxksqffhf5k'
                        or pair.get('staking_addr') != 'juno1pawjm34dunptcs8wt2m5tgcyexyzc02pdl9xl52jvcqlpwcgus5sen5yrk'
                        or pair.get('pair_type') != {'xyk': {}}):
                    raise ValueError('Wrong JUNO reference pair')
                assets = {a['info'].get('native'): decimal(a['amount']) for a in p['assets']}
                if len(p['assets']) != 2 or set(assets) != {'ujuno', quote_denom}:
                    raise ValueError('Wrong JUNO reserves')
                ratio, reserve = assets[quote_denom] / assets['ujuno'], assets['ujuno'] / 10**6
                treasury = json.loads(self.treasury.read_text())['wynd_market']
                if treasury.get('chain_id') != 'juno-1' or not fresh(treasury['price_observed_at'], 1800):
                    raise ValueError('Stale Treasury USD reference')
                usd = {'price': str(decimal(treasury['prices_usd'][quote_denom])), 'observed_at': treasury['price_observed_at'],
                       'source': treasury['price_source'] + ' axlUSDC'}
                liquidity = 2 * assets[quote_denom] / 10**6 * decimal(usd['price'])
                label, quote_symbol = 'WYND JUNO / axlUSDC', 'axlUSDC'
            else:
                ratio = self.osmo_ratio(base, s, h)
                usd = self.quote('usd-coin')
                if s.get('quotePool'):
                    atom_ratio = self.osmo_ratio(base, self.specs['atom'], h)
                    usd = {**usd, 'price': str(decimal(usd['price']) * atom_ratio), 'pool_height': h,
                           'pool_observed_at': anchor['block_time'], 'source': 'Osmosis ATOM/allUSDC #3505 × CoinGecko USDC'}
                usd['assumption'] = 'Stablecoin wrappers valued at USDC/USD; bridge variants may diverge.'
                label, quote_symbol = 'Osmosis ' + s['symbol'] + ' / ' + s['quoteSymbol'], s['quoteSymbol']
            at = iso()
            current = {**anchor, 'time': int(stamp(at)), 'observed_at': at, 'provider': base,
                       'price_quote': str(ratio), 'price_usd': str(ratio * decimal(usd['price'])), 'quote_symbol': quote_symbol,
                       'price_juno': None, 'total_supply': None, 'usd_anchor': usd,
                       'liquidity_usd': str(liquidity) if liquidity is not None else None,
                       'reserve_token': str(reserve) if reserve is not None else None}
            return self.envelope(s, current, label)
        return fallback(JUNO if slug == 'juno' else OSMOSIS, observe)

    def osmo_ratio(self, base, s, height):
        p = self.http(base + '/osmosis/poolmanager/v1beta1/pools/' + s['pool'], height)['data']['pool']
        if p.get('@type') == '/osmosis.gamm.v1beta1.Pool':
            denoms = [a['token']['denom'] for a in p['pool_assets']]
        elif p.get('@type') == '/osmosis.concentratedliquidity.v1beta1.Pool':
            denoms = [p['token0'], p['token1']]
        else:
            raise ValueError('Wrong Osmosis pool type')
        if str(p.get('id')) != s['pool'] or len(denoms) != 2 or set(denoms) != {s['denom'], s['quote']}:
            raise ValueError('Wrong Osmosis pair')
        url = base + '/osmosis/poolmanager/v2/pools/' + s['pool'] + '/prices?' + urlencode({'base_asset_denom': s['denom'], 'quote_asset_denom': s['quote']})
        return decimal(self.http(url, height)['data']['spot_price']) * Decimal(10)**(s['decimals'] - s['quoteDecimals'])

    @staticmethod
    def envelope(s, current, label):
        return {'schema_version': 1, 'chain_id': s['chain'], 'token': s['denom'], 'pool': s['pool'], 'mode': 'instant',
                'interval_seconds': 60, 'source_label': label, 'change_24h_pct': None, 'current': current}

    def gno(self, slug):
        s = self.specs[slug]
        url = GNO_API + '/tokens/' + quote(s['denom'], safe='') + '/details'
        r = self.http(url)
        status = self.http(GNO_RPC + '/status', ttl=8)['data']['result']
        grades = self.http(GNO_API + '/tokens/prices', ttl=60)['data']['data']
        sync, d = status['sync_info'], r['data']['data']
        if (status['node_info']['network'] != 'gnoland-1' or sync.get('catching_up') is not False
                or next((g.get('priceGradeType') for g in grades if g.get('path') == s['denom']), None) != 'ORACLE'
                or not fresh(sync['latest_block_time'], 120)):
            raise ValueError('Wrong or stale Gno reference')
        point = d['prices1d'][-1]
        if not fresh(point['time'], 1800):
            raise ValueError('Stale GnoSwap price')
        price, at = str(decimal(d['currentPrice'])), r['observed_at']
        current = {'time': int(stamp(at)), 'observed_at': at, 'height': int(sync['latest_block_height']),
                   'block_hash': hash_hex(sync['latest_block_hash']), 'block_time': sync['latest_block_time'],
                   'price_usd': price, 'price_quote': price, 'quote_symbol': 'USD', 'price_juno': None,
                   'total_supply': None, 'provider': GNO_API, 'reference_kind': 'provider-reference',
                   'usd_anchor': {'price': 1, 'observed_at': point['time'], 'source': 'GnoSwap ORACLE · USD denomination', 'url': url},
                   'price_observed_at': point['time']}
        return self.envelope(s, current, 'GnoSwap · ' + s['symbol'] + ' oracle USD reference')

    def supply(self, slug):
        s = self.specs[slug]
        if s.get('referenceKind') == 'astroport-reference':
            from terra_market_sources import supply
            return supply(self, slug)
        if s.get('supplyKind') == 'solana':
            from collect_cosmos_markets import native_solana_supply
            return native_solana_supply(s, rpc=lambda method, params: self.http.rpc(s['supplyBase'], method, params))
        if s.get('supplyKind') == 'erc20':
            return self.erc20(s)
        if slug in ('gnot', 'gns'):
            path = 'bank/supply/ugnot' if slug == 'gnot' else 'vm/qeval'
            data = '0x' if slug == 'gnot' else '0x' + b'gno.land/r/gnoswap/gns.TotalSupply()'.hex()
            url = GNO_RPC + '/abci_query?' + urlencode({'path': json.dumps(path), 'data': data, 'prove': 'false'})
            r = self.http(url)
            b = r['data']['result']['response']['ResponseBase']
            if b.get('Error') or not b.get('Data'):
                raise ValueError('Gno supply unavailable')
            text = base64.b64decode(b['Data'], validate=True).decode()
            raw = json.loads(text) if slug == 'gnot' else re.fullmatch(r'\((\d+) int64\)', text.strip()).group(1)
            if not isinstance(raw, str) or not re.fullmatch(r'\d+', raw):
                raise ValueError('Invalid Gno supply')
            return {'denom': s['denom'], 'total_supply': str(decimal(raw) / 10**6), 'height': None,
                    'state_query': 'latest-state-unpinned', 'observed_at': r['observed_at'], 'url': url,
                    'source': 'Gno.land bank total supply' if slug == 'gnot' else 'GnoSwap GRC-20 TotalSupply()',
                    'interval_seconds': s.get('supplyInterval', 604800)}
        chain = s.get('supplyChain') or {'atom': 'cosmoshub-4', 'atone': 'atomone-1', 'photon': 'atomone-1'}.get(slug, s['chain'])
        bases = ([s['supplyBase']] if s.get('supplyBase') else []) + (list(JUNO) if chain == 'juno-1' else list(OSMOSIS) if chain == 'osmosis-1' else [])
        def read(base):
            anchor = block(self.http, base, chain)
            denom = s.get('supplyDenom', s['denom'])
            url = base + '/cosmos/bank/v1beta1/supply/by_denom?' + urlencode({'denom': denom})
            r = self.http(url, anchor['height'])
            value = r['data']['amount']
            if value.get('denom') != denom or not re.fullmatch(r'\d+', value.get('amount', '')):
                raise ValueError('Invalid bank supply')
            return {**anchor, 'chain_id': chain, 'denom': denom, 'total_supply': str(decimal(value['amount']) / Decimal(10)**s['decimals']),
                    'observed_at': r['observed_at'], 'source': 'Bank total supply', 'url': url,
                    'interval_seconds': 300 if s.get('alloyContract') else 604800, 'scope': 'Osmosis alloy only' if s.get('alloyContract') else 'Native chain total'}
        return fallback(bases, read)

    def erc20(self, s):
        rpc = lambda method, params=None: self.http.rpc(s['supplyBase'], method, params)
        if rpc('eth_chainId') != '0x1':
            raise ValueError('Wrong Ethereum chain')
        b = rpc('eth_getBlockByNumber', ['finalized', False])
        if not fresh(int(b['timestamp'], 16), 1800) or not re.fullmatch(r'0x[0-9a-fA-F]{64}', b['hash']):
            raise ValueError('Invalid finalized Ethereum block')
        call = lambda data: int(rpc('eth_call', [{'to': s['denom'], 'data': data}, b['number']]), 16)
        if call('0x313ce567') != s['decimals']:
            raise ValueError('Wrong token decimals')
        issued = call('0x18160ddd')
        burned = call('0x70a08231' + s['burnAddress'][2:].lower().zfill(64)) if s.get('burnAddress') else 0
        if not 0 <= burned < issued:
            raise ValueError('Invalid issued/burned supply')
        scale = Decimal(10)**s['decimals']
        return {'denom': s['denom'], 'total_supply': str((issued - burned) / scale), 'issued_supply': str(issued / scale),
                'burned_supply': str(burned / scale), 'total_supply_raw': str(issued - burned), 'issued_supply_raw': str(issued),
                'burned_supply_raw': str(burned), 'observed_at': iso(), 'height': int(b['number'], 16), 'block_hash': b['hash'][2:],
                'block_time': iso(int(b['timestamp'], 16)), 'chain_id': 'ethereum', 'source': 'ERC20 totalSupply minus documented burn address' if burned else 'ERC20 totalSupply',
                'url': s['supplyBase'], 'burn_address': s.get('burnAddress'), 'interval_seconds': s.get('supplyInterval', 604800),
                'scope': s.get('supplyScope') or ('Issued supply excluding burn address; not circulating supply' if s.get('burnAddress') else 'Native contract total; not circulating supply')}
