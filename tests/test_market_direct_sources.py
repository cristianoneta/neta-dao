import json
from pathlib import Path
import sys
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from urllib.error import HTTPError
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import market_direct_sources as d
from collect_cosmos_markets import validate, valid_supply, record, database

CONFIG = json.loads((Path(__file__).resolve().parents[1] / 'scripts/cosmos_market_sources.json').read_text())


class DirectSourceTest(unittest.TestCase):
    def test_direct_quote_preserves_real_price_time_and_source(self):
        now = int(time.time())
        calls = []
        def http(url, **kwargs):
            calls.append(url)
            return {'source': url, 'data': {'usd-coin': {'usd': 0.999647, 'last_updated_at': now-70}}}
        adapter = d.DirectSources(CONFIG, http=http)
        quote = adapter.quote('usd-coin')
        self.assertEqual(quote['price'], '0.999647')
        self.assertEqual(d.stamp(quote['observed_at']), now-70)
        self.assertEqual(quote['source'], 'CoinGecko')
        self.assertTrue(quote['url'].startswith('https://api.coingecko.com/'))
        self.assertIn('include_last_updated_at=true', calls[0])

    def test_parallel_quotes_share_successful_batch_and_failed_primary(self):
        now = int(time.time())
        calls = []
        def http(url, **kwargs):
            calls.append(url)
            if url.startswith(d.PRICE_API):
                raise HTTPError(url, 403, 'Forbidden', {}, None)
            return {'source': url, 'data': {'usd-coin': {'usd': 0.998, 'last_updated_at': now-50}}}
        adapter = d.DirectSources(CONFIG, http=http)
        with ThreadPoolExecutor(max_workers=8) as workers:
            results = list(workers.map(adapter.quote, ['usd-coin']*16))
        self.assertEqual(len(calls), 2)
        self.assertTrue(all(q['price'] == '0.998' and q['source'] == 'CoinGecko via Osmosis' for q in results))
        self.assertTrue(all(d.stamp(q['observed_at']) == now-50 for q in results))

    def test_failed_provider_cache_expires_and_all_failures_keep_http_status(self):
        calls = []
        def http(url, **kwargs):
            calls.append(url)
            raise HTTPError(url, 429 if url.startswith(d.PRICE_API) else 403, 'Rejected', {}, None)
        adapter = d.DirectSources(CONFIG, http=http)
        with patch.object(d.time, 'monotonic', return_value=100):
            for _ in range(3):
                with self.assertRaisesRegex(RuntimeError, 'api.coingecko.com: HTTP 429.*prices.osmosis.zone: HTTP 403'):
                    adapter.quote('usd-coin')
        self.assertEqual(len(calls), 2)
        with patch.object(d.time, 'monotonic', return_value=161), self.assertRaises(RuntimeError):
            adapter.quote('usd-coin')
        self.assertEqual(len(calls), 4)

    def test_invalid_or_stale_primary_uses_only_valid_dated_fallback(self):
        now = int(time.time())
        for bad in ({'usd': 1, 'last_updated_at': now-1801}, {'usd': 1, 'last_updated_at': now+61},
                    {'usd': 0, 'last_updated_at': now}, {'usd': 'NaN', 'last_updated_at': now}, None):
            with self.subTest(bad=bad):
                def http(url, **kwargs):
                    q = bad if url.startswith(d.PRICE_API) else {'usd': 0.9991, 'last_updated_at': now-30}
                    return {'source': url, 'data': {'usd-coin': q} if q is not None else {}}
                result = d.DirectSources(CONFIG, http=http).quote('usd-coin')
                self.assertEqual(result['price'], '0.9991')
                self.assertEqual(d.stamp(result['observed_at']), now-30)
                self.assertEqual(result['source'], 'CoinGecko via Osmosis')

    def test_no_fixed_dollar_or_retrieval_time_when_all_prices_are_stale(self):
        now = int(time.time())
        def http(url, **kwargs):
            return {'source': url, 'observed_at': d.iso(now), 'data': {'usd-coin': {'usd': 1, 'last_updated_at': now-1801}}}
        with self.assertRaisesRegex(RuntimeError, 'Stale USD reference'):
            d.DirectSources(CONFIG, http=http).quote('usd-coin')

    def test_external_references_keep_provider_time_without_blocks(self):
        now = int(time.time())
        adapter = d.DirectSources(CONFIG)
        with patch.object(adapter, 'quote', return_value={'price': '8.63', 'observed_at': d.iso(now-70), 'url': d.PRICE_API}):
            raw = adapter.observation('link')
        current = validate(raw, CONFIG['link'], time.time())
        self.assertIsNone(current['height'])
        self.assertEqual(d.stamp(current['price_observed_at']), now-70)
        self.assertEqual(current['price_usd'], '8.63')
        raw['current']['height'] = 1
        with self.assertRaises(ValueError):
            validate(raw, CONFIG['link'], time.time())

    def test_migration_accepts_equivalent_numeric_representation(self):
        now = int(time.time())
        adapter = d.DirectSources(CONFIG)
        with patch.object(adapter, 'quote', return_value={'price': '8.63', 'observed_at': d.iso(now-70), 'url': d.PRICE_API}):
            current = adapter.observation('link')['current']
        with database(':memory:') as db:
            record(db, {**current, 'time': now-60, 'price_usd': 8.63})
            record(db, {**current, 'time': now, 'price_usd': '8.6300'})
            with self.assertRaises(ValueError):
                record(db, {**current, 'time': now+60, 'price_usd': '8.64'})
            self.assertEqual(db.execute('SELECT count(*) FROM samples').fetchone()[0], 2)

    def test_direct_dispatch_rejects_unknown_paths_and_assets(self):
        adapter = d.DirectSources(CONFIG)
        with self.assertRaises(ValueError):
            adapter.read('/api/observations?asset=unknown')
        with self.assertRaises(ValueError):
            adapter.read('/arbitrary?asset=btc')

    def test_pool_identity_and_decimal_conversion(self):
        spec = CONFIG['btc']
        pool = {'@type': '/osmosis.concentratedliquidity.v1beta1.Pool', 'id': spec['pool'], 'token0': spec['denom'], 'token1': spec['quote']}
        def http(url, height=None):
            self.assertEqual(height, 100)
            return {'data': {'spot_price': '600'} if '/prices?' in url else {'pool': pool}}
        adapter = d.DirectSources(CONFIG, http=http)
        self.assertEqual(adapter.osmo_ratio('https://example.test', spec, 100), d.Decimal(60000))
        pool['token1'] = 'wrong'
        with self.assertRaises(ValueError):
            adapter.osmo_ratio('https://example.test', spec, 100)

    def test_erc20_exact_burn_arithmetic_and_finalized_block(self):
        now = int(time.time())
        spec = CONFIG['uni']
        class Rpc:
            def rpc(self, url, method, params=None):
                if method == 'eth_chainId': return '0x1'
                if method == 'eth_getBlockByNumber':
                    assert params == ['finalized', False]
                    return {'number': '0x12345', 'hash': '0x'+'A'*64, 'timestamp': hex(now-60)}
                assert params[1] == '0x12345'
                data = params[0]['data']
                return hex(18 if data == '0x313ce567' else 1000*10**18 if data == '0x18160ddd' else 100*10**18)
        supply = d.DirectSources(CONFIG, http=Rpc()).supply('uni')
        self.assertEqual(supply['total_supply_raw'], str(900*10**18))
        self.assertEqual(supply['burned_supply_raw'], str(100*10**18))
        self.assertTrue(valid_supply(supply, spec, time.time()))

    def test_wrong_chain_or_stale_block_rejected(self):
        def response(chain, at):
            return {'data': {'block_id': {'hash': 'A'*64}, 'block': {'header': {'chain_id': chain, 'height': '100', 'time': d.iso(at)}}}}
        now = time.time()
        for chain, at in [('wrong', now), ('juno-1', now-200)]:
            with self.assertRaises(ValueError):
                d.block(lambda *args, **kwargs: response(chain, at), 'https://example.test', 'juno-1')

    def test_gno_oracle_classification_and_timestamp(self):
        now = int(time.time())
        grade = 'ORACLE'
        def http(url, **kwargs):
            if url.endswith('/status'):
                data = {'result': {'node_info': {'network': 'gnoland-1'}, 'sync_info': {'catching_up': False,
                    'latest_block_time': d.iso(now), 'latest_block_hash': 'A'*64, 'latest_block_height': '100'}}}
            elif url.endswith('/prices'):
                data = {'data': [{'path': 'ugnot', 'priceGradeType': grade}]}
            else:
                data = {'data': {'currentPrice': '0.05', 'prices1d': [{'time': d.iso(now-60)}]}}
            return {'data': data, 'observed_at': d.iso(now), 'source': url}
        adapter = d.DirectSources(CONFIG, http=http)
        self.assertEqual(validate(adapter.gno('gnot'), CONFIG['gnot'], now)['price_usd'], '0.05')
        grade = 'UNKNOWN'
        with self.assertRaises(ValueError):
            adapter.gno('gnot')


if __name__ == '__main__':
    unittest.main()
