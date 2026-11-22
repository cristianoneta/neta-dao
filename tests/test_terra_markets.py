import json
from pathlib import Path
import sys
import time
import unittest
from decimal import Decimal
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import terra_market_sources as terra
from market_direct_sources import DirectSources, iso
from collect_cosmos_markets import valid_supply


class TerraMarketTest(unittest.TestCase):
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
