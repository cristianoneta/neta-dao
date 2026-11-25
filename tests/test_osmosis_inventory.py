import copy
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import collect_pool_pilot as p

NOW = 1800000000
CONFIG = {'assets': {'btc': {'denom': 'ubtc', 'decimals': 8, 'poolDenoms': ['ubtc']}},
          'metadata': {'ubtc': {'symbol': 'BTC', 'decimals': 8}, 'uusdc': {'symbol': 'USDC', 'decimals': 6}}}


def coin(denom, amount):
    return {'denom': denom, 'amount': str(amount)}


def weighted(pid=3723):
    return {'chain_model': {'id': pid, 'pool_assets': [
        {'token': coin('ubtc', 476), 'weight': '1'},
        {'token': coin('uusdc', 675203), 'weight': '1'}]},
        'balances': [coin('uusdc', 675203)], 'type': 0,
        'spread_factor': '0.003', 'liquidity_cap': '1', 'liquidity_cap_error': ''}


def concentrated(pid=2270, balances=None):
    return {'chain_model': {'id': pid, 'token0': 'ubtc', 'token1': 'uusdc'},
            'balances': [] if balances is None else balances, 'type': 2,
            'spread_factor': '0.002', 'liquidity_cap': '0', 'liquidity_cap_error': ''}


def inventory(rows, config=None):
    return p.osmosis_inventory(lambda url: {'observed_at': NOW, 'data': {
        'data': rows, 'meta': {'next_cursor': -1}}}, config or CONFIG)


class OsmosisInventoryTest(unittest.TestCase):
    def test_weighted_missing_small_balance_keeps_exact_model_amount(self):
        pools, snapshots, status = inventory([weighted(), weighted(3724)])
        self.assertEqual(status['btc']['status'], 'complete')
        self.assertEqual(len(pools), 2)
        self.assertEqual(pools['osmosis-1:3723']['targets'], {'btc': ['ubtc']})
        self.assertEqual(snapshots['osmosis-1:3723']['amounts'], ['476', '675203'])

    def test_native_model_reserves_exclude_bank_donations_and_keep_big_integers(self):
        row = weighted();row['chain_model']['pool_assets'][0]['token']['amount'] = '900719925474099312345678'
        row['balances'] += [coin('ubtc', 99), coin('donation', 50)]
        values, verified = p.osmosis_pool_balances(row)
        self.assertEqual(values, {'ubtc': '900719925474099312345678', 'uusdc': '675203'})
        self.assertTrue(verified)

    def test_stable_uses_all_declared_liquidity(self):
        row = weighted();row['type'] = 1
        row['chain_model'] = {'id': 1, 'pool_liquidity': [coin('ubtc', 1), coin('uusdc', 900)]}
        self.assertEqual(p.osmosis_pool_balances(row)[0], {'ubtc': '1', 'uusdc': '900'})

    def test_empty_concentrated_pool_has_identity_but_unknown_reserves(self):
        pools, snapshots, status = inventory([concentrated(), weighted()])
        key = 'osmosis-1:2270'
        self.assertEqual(status['btc']['status'], 'complete')
        self.assertEqual(pools[key]['targets'], {'btc': ['ubtc']})
        self.assertEqual(snapshots[key]['amounts'], [None, None])
        rows = p.views(pools, snapshots, {}, CONFIG, NOW)['btc']
        row = next(r for r in rows if r['pool'] == '2270')
        self.assertIsNone(row['reserve_token']);self.assertIsNone(row['reserve_supply_token'])
        self.assertEqual(row['liquidity_usd'], 0);self.assertFalse(row['stale'])
        self.assertIsNone(row['assets'][0]['raw_amount'])

    def test_one_sided_cl_does_not_invent_the_missing_side(self):
        values, _ = p.osmosis_pool_balances(concentrated(balances=[coin('uusdc', 2000000)]))
        self.assertIsNone(values['ubtc']);self.assertEqual(values['uusdc'], '2000000')

    def test_explicit_cl_zero_is_retained(self):
        pools, snapshots, _ = inventory([concentrated(balances=[coin('ubtc', 0), coin('uusdc', 0)])])
        row = p.views(pools, snapshots, {}, CONFIG, NOW)['btc'][0]
        self.assertEqual(row['reserve_token'], 0)

    def test_unvalued_reported_liquidity_stays_unknown(self):
        row = weighted();row['liquidity_cap_error'] = 'missing token reference'
        pools, snapshots, _ = inventory([row])
        result = p.views(pools, snapshots, {}, CONFIG, NOW)['btc'][0]
        self.assertIsNone(result['liquidity_usd']);self.assertIsNotNone(result['reserve_token'])

    def test_wrong_filter_row_is_reported_but_does_not_hide_later_pools(self):
        invalid = concentrated(4);invalid['chain_model']['token0'] = 'wrong'
        pools, _, status = inventory([invalid, weighted()])
        self.assertEqual(list(pools), ['osmosis-1:3723'])
        self.assertEqual(status['btc']['status'], 'partial')
        self.assertEqual(status['btc']['rejected_pool_count'], 1)
        self.assertEqual(status['btc']['rejected_pools'][0]['pool'], '4')

    def test_malformed_amount_rejects_only_its_pool(self):
        row = weighted(1);row['chain_model']['pool_assets'][0]['token']['amount'] = '-1'
        pools, _, status = inventory([row, weighted()])
        self.assertEqual(len(pools), 1);self.assertEqual(status['btc']['status'], 'partial')

    def test_duplicate_model_and_balance_denoms_fail_closed(self):
        for target in ['balances', 'model']:
            row = weighted()
            if target == 'balances':row['balances'] *= 2
            else:row['chain_model']['pool_assets'] *= 2
            with self.assertRaises(ValueError):p.osmosis_pool_balances(row)

    def test_type_and_required_model_fields_are_validated(self):
        rows = [weighted(), weighted(), concentrated(), weighted()]
        rows[0]['type'] = 9;rows[1]['type'] = True
        rows[2]['chain_model']['token1'] = 'ubtc';rows[3]['chain_model'].pop('pool_assets')
        for row in rows:
            with self.assertRaises(ValueError):p.osmosis_pool_balances(row)

    def test_empty_unknown_contract_identity_is_not_assumed(self):
        row = concentrated();row['type'] = 3
        with self.assertRaises(ValueError):p.osmosis_pool_balances(row)

    def test_verified_target_not_a_similar_ticker_or_bank_donation(self):
        row = weighted();row['chain_model']['pool_assets'][0]['token']['denom'] = 'another/ubtc'
        row['balances'].append(coin('ubtc', 5))
        pools, _, status = inventory([row])
        self.assertEqual(pools, {});self.assertEqual(status['btc']['status'], 'partial')

    def test_alloy_backing_exclusions_remain(self):
        row = weighted();row['chain_model']['code_id'] = 996
        pools, _, status = inventory([row, weighted(3634), weighted(3644), weighted(8)])
        self.assertEqual(list(pools), ['osmosis-1:8']);self.assertEqual(status['btc']['status'], 'complete')

    def test_pagination_reaches_a_later_valid_pool_after_a_bad_row(self):
        calls = []
        def http(url):
            calls.append(url)
            bad = concentrated();bad['chain_model']['token0'] = 'wrong'
            return {'observed_at': NOW, 'data': {'data': [bad] if len(calls) == 1 else [weighted()],
                    'meta': {'next_cursor': 1 if len(calls) == 1 else -1}}}
        pools, _, status = p.osmosis_inventory(http, CONFIG)
        self.assertEqual(len(calls), 2);self.assertEqual(len(pools), 1)
        self.assertEqual(status['btc']['source_pool_count'], 2);self.assertEqual(status['btc']['status'], 'partial')

    def test_missing_cursor_and_duplicate_pool_do_not_claim_complete_inventory(self):
        for data in [{'data': [weighted()], 'meta': {}}, {'data': [weighted(), weighted()], 'meta': {'next_cursor': -1}}]:
            _, _, status = p.osmosis_inventory(lambda url: {'data': data, 'observed_at': NOW}, CONFIG)
            self.assertEqual(status['btc']['status'], 'unavailable')

    def test_shared_pool_is_one_identity_with_separate_targets(self):
        config = copy.deepcopy(CONFIG);config['assets']['atom'] = {'denom': 'uusdc', 'decimals': 6, 'poolDenoms': ['uusdc']}
        pools, snapshots, status = inventory([weighted()], config)
        self.assertEqual(len(pools), 1);self.assertEqual(len(snapshots), 1)
        self.assertEqual(pools['osmosis-1:3723']['targets'], {'btc': ['ubtc'], 'atom': ['uusdc']})
        self.assertTrue(all(s['status'] == 'complete' for s in status.values()))

    def test_only_model_proven_asset_completion_can_extend_a_stored_identity(self):
        new = inventory([weighted()])[0]['osmosis-1:3723']
        old = {**new, 'assets': new['assets'][1:]}
        p.validate_pool_update(old, new)
        p.validate_pool_update(new, new)
        for changed in [{**new, 'identity_source': 'routing-balances'}, {**new, 'identity_denoms': []},
                        {**new, 'chain_id': 'juno-1'}, {**new, 'pool': 'another'},
                        {**new, 'assets': new['assets'][:1]}, {**new, 'pool_type': 'Contract'}]:
            with self.assertRaises(ValueError):p.validate_pool_update(old, changed)

    def test_ordinary_full_pool_and_reordered_model_have_identical_identity(self):
        row = weighted();row['balances'] = [coin('ubtc', 476), coin('uusdc', 675203)]
        before = inventory([row])
        row['chain_model']['pool_assets'].reverse();row['balances'].reverse()
        after = inventory([row])
        self.assertEqual(before, after)


if __name__ == '__main__':
    unittest.main()
