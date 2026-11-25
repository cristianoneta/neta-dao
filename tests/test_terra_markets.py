import json
from pathlib import Path
import sys
import time
import unittest
from decimal import Decimal
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import terra_market_sources as terra
from market_direct_sources import DirectSources, iso, smart_path
from collect_cosmos_markets import valid_supply


class TerraMarketTest(unittest.TestCase):
    def test_roar_reference_units_and_registered_pair_identity(self):
        spec = terra.CONFIG['specs']['roar']
        installed = json.loads((Path(__file__).resolve().parents[1] / 'scripts/cosmos_market_sources.json').read_text())
        self.assertEqual(installed['roar'], spec)
        self.assertEqual(terra.CONFIG['denoms']['roar'], [spec['denom']])
        anchor = {'height': 123, 'block_hash': 'A'*64, 'block_time': iso()}
        base = 'https://example.test'
        pair = {'contract_addr': spec['pool'], 'asset_infos': [terra.info(spec['denom']), terra.info('uluna')]}
        registration = {'contract_addr': spec['pool']}
        contract = {'address': spec['pool'], 'contract_info': {'creator': terra.CONFIG['factory'], 'code_id': '3279'}}
        responses = {
            base + smart_path(spec['pool'], {'pair': {}}): {'data': pair},
            base + '/cosmwasm/wasm/v1/contract/' + spec['pool']: contract,
            base + smart_path(terra.CONFIG['factory'], {'pair': {'asset_infos': [terra.info(spec['denom']), terra.info('uluna')]}}): {'data': registration},
            base + smart_path(spec['pool'], {'simulation': {'offer_asset': {'info': terra.info(spec['denom']), 'amount': '1000000000000'}}}):
                {'data': {'return_amount': '1000000', 'commission_amount': '200', 'spread_amount': '300'}},
        }
        def http(url, height, **kwargs):
            self.assertEqual(height, 123)
            return {'data': responses[url]}
        direct = DirectSources({'roar': spec}, http=http)
        self.assertEqual(terra.reference(direct, base, anchor, spec)['price'], '0.0000010002')
        registration['contract_addr'] = 'unregistered'
        with self.assertRaisesRegex(ValueError, 'Unverified Astroport'):
            terra.reference(direct, base, anchor, spec)
        registration['contract_addr'] = spec['pool']
        contract['contract_info']['code_id'] = '2569'
        with self.assertRaisesRegex(ValueError, 'Unverified Astroport'):
            terra.reference(direct, base, anchor, spec)

    def test_roar_cw20_supply_rejects_wrong_symbol_and_decimals(self):
        spec = terra.CONFIG['specs']['roar']
        token = {'symbol': 'ROAR', 'decimals': 6, 'total_supply': '1000000000000000000'}
        anchor = {'height': 123, 'block_hash': 'A'*64, 'block_time': iso()}
        def http(url, height):
            self.assertIn(smart_path(spec['denom'], {'token_info': {}}), url)
            self.assertEqual(height, 123)
            return {'data': {'data': token}, 'source': url}
        direct = DirectSources({'roar': spec}, http=http)
        with patch.object(terra, 'block', return_value=anchor):
            value = terra.supply(direct, 'roar')
            self.assertEqual(value['total_supply'], '1000000000000')
            self.assertTrue(valid_supply(value, spec, time.time()))
            token['decimals'] = 18
            with self.assertRaises(RuntimeError):
                terra.supply(direct, 'roar')
            token.update(decimals=6, symbol='OTHER')
            with self.assertRaises(RuntimeError):
                terra.supply(direct, 'roar')

    def test_simulation_gross_reference_does_not_add_spread(self):
        value = terra.simulation_price({'return_amount': '1006794', 'commission_amount': '503', 'spread_amount': '9000'}, '1000000', 6, 6)
        self.assertEqual(value, Decimal('1.007297'))
        with self.assertRaises(ValueError):
            terra.simulation_price({'return_amount': '0', 'commission_amount': '503'}, '1000000', 6, 6)

    def test_canonical_supply_checks_chain_raw_amount_and_hourly_expiry(self):
        spec = terra.CONFIG['specs']['solid']
        now = time.time()
        value = {'denom': spec['denom'], 'total_supply': '50233.842019', 'raw_total_supply': '50233842019',
                 'decimals': 6, 'chain_id': 'phoenix-1', 'height': 123, 'block_hash': 'A'*64,
                 'block_time': iso(now-30), 'observed_at': iso(now-30)}
        self.assertTrue(valid_supply(value, spec, now))
        self.assertFalse(valid_supply({**value, 'chain_id': 'neutron-1'}, spec, now))
        self.assertFalse(valid_supply({**value, 'raw_total_supply': '90000000000'}, spec, now))
        self.assertFalse(valid_supply(value, spec, now+3601))

    def test_venue_snapshot_keeps_large_reserves_as_strings_and_no_source_time(self):
        pool = {'chainId': 'phoenix-1', 'poolAddress': terra.CONFIG['specs']['capa']['pool'],
                'assets': [{'amount': 12345678901234567890123}]}
        def http(url, **kwargs):
            data = [pool] if 'pools.getAll' in url else {'chainId': 'phoenix-1', 'tokens': {'one': {}}}
            return {'data': {'result': {'data': {'json': data}}}}
        value = terra.inventory(DirectSources({}, http=http))
        self.assertEqual(value['data']['pools'][0]['assets'][0]['amount'], '12345678901234567890123')
        self.assertIsNone(value['source_observed_at'])
        pool['chainId'] = 'other-chain'
        with self.assertRaises(ValueError):
            terra.inventory(DirectSources({}, http=http))

    def test_terra_dispatch_does_not_use_osmosis_spot_or_old_astro_price_id(self):
        adapter = DirectSources(terra.CONFIG['specs'])
        with patch.object(terra, 'observation', return_value={'current': 'verified'}) as observe:
            self.assertEqual(adapter.observation('astro'), {'current': 'verified'})
            observe.assert_called_once_with(adapter, 'astro')
        self.assertNotIn('priceId', terra.CONFIG['specs']['astro'])


if __name__ == '__main__':
    unittest.main()
