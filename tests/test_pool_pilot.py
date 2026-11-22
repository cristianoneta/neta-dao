import gzip
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import collect_pool_pilot as p

NOW = 1800000000
KEY = 'osmosis-1:1'
SPEC = {'key': KEY, 'chain_id': 'osmosis-1', 'pool': '1', 'venue': 'Osmosis',
        'assets': [{'denom': 'ua', 'symbol': 'A', 'decimals': 6}, {'denom': 'ub', 'symbol': 'B', 'decimals': 6}],
        'targets': {'atom': ['ua']}, 'pool_type': 'Weighted', 'fee_pct': .3, 'url': 'https://app.osmosis.zone/pool/1'}


def swap(index=0, amount='2000000'):
    return {'pool': KEY, 'chain': 'osmosis-1', 'txhash': 'A' * 64, 'event_index': index,
            'height': 10, 'time': NOW-10, 'denom_in': 'ua', 'raw_in': amount, 'denom_out': 'ub', 'raw_out': '4000000'}


def cursor():
    return {'height': 20, 'block_hash': 'B' * 64, 'block_time': p.iso(NOW), 'first_time': NOW-90000,
            'first_height': 1, 'source': 'https://lcd.osmosis.zone', 'time': NOW}


def event(values):
    return {'type': 'token_swapped', 'attributes': [{'key': k, 'value': v} for k, v in values.items()]}


class PoolPilotTest(unittest.TestCase):
    def setUp(self):
        self.db = p.connect(':memory:')
        self.db.execute('INSERT INTO pools VALUES (?,?,?)', (KEY, NOW-90000, json.dumps(SPEC)))
        self.db.commit()
        self.refs = ({'atom': {'price': '10', 'observed_at': p.iso(NOW)}}, {'osmosis-1:ua': ('atom', 6)})

    def tearDown(self):
        self.db.close()

    def test_each_execution_once_and_not_both_legs(self):
        p.record_scan(self.db, 'osmosis-1', cursor(), [swap(), swap(1)], [])
        p.record_scan(self.db, 'osmosis-1', cursor(), [swap(), swap(1)], [])
        v = p.volume(self.db, SPEC, cursor(), self.refs, NOW)
        self.assertEqual((v['status'], v['swaps'], v['usd']), ('complete', 2, 40))

    def test_changed_swap_rolls_back_coverage(self):
        p.record_scan(self.db, 'osmosis-1', cursor(), [swap()], [])
        with self.assertRaises(ValueError):
            p.record_scan(self.db, 'osmosis-1', {**cursor(), 'height': 21}, [swap(amount='3000000')], [])
        saved = json.loads(self.db.execute('SELECT payload FROM cursors').fetchone()[0])
        self.assertEqual(saved['height'], 20)

    def test_new_pool_reports_observed_volume_before_full_day(self):
        self.db.execute('UPDATE pools SET first_seen=?', (NOW-3600,))
        p.record_scan(self.db, 'osmosis-1', cursor(), [swap()], [])
        v = p.volume(self.db, SPEC, cursor(), self.refs, NOW)
        self.assertEqual(v['status'], 'building')
        self.assertEqual((v['usd'], v['swaps']), (20, 1))
        self.assertEqual(v['coverage_seconds'], 3600)

    def test_building_window_counts_only_continuously_observed_period(self):
        self.db.execute('UPDATE pools SET first_seen=?', (NOW-3600,))
        before = {**swap(1), 'time': NOW-3601}
        after = {**swap(2), 'time': NOW+1}
        p.record_scan(self.db, 'osmosis-1', cursor(), [before, swap(), after], [])
        v = p.volume(self.db, SPEC, cursor(), self.refs, NOW)
        self.assertEqual((v['usd'], v['swaps']), (20, 1))
        self.db.execute('DELETE FROM swaps')
        self.assertEqual(p.volume(self.db, SPEC, cursor(), self.refs, NOW)['usd'], 0)
        self.db.execute('UPDATE pools SET first_seen=?', (NOW+1,))
        self.assertIsNone(p.volume(self.db, SPEC, cursor(), self.refs, NOW)['usd'])

    def test_building_window_keeps_decode_and_valuation_failures_unavailable(self):
        self.db.execute('UPDATE pools SET first_seen=?', (NOW-3600,))
        p.record_scan(self.db, 'osmosis-1', cursor(), [swap()], [])
        self.assertIsNone(p.volume(self.db, SPEC, cursor(), ({}, {}), NOW)['usd'])
        self.db.execute('INSERT INTO problems VALUES (?,?,?,?,?)', (KEY, NOW-20, 'C'*64, 0, 'undecodable'))
        v = p.volume(self.db, SPEC, cursor(), self.refs, NOW)
        self.assertEqual(v['status'], 'incomplete')
        self.assertIsNone(v['usd'])

    def test_building_becomes_rolling_day_without_reset(self):
        first = NOW-3600
        self.db.execute('UPDATE pools SET first_seen=?', (first,))
        p.record_scan(self.db, 'osmosis-1', cursor(), [swap()], [])
        end = first+86400
        at_day = {**cursor(), 'block_time': p.iso(end)}
        v = p.volume(self.db, SPEC, at_day, self.refs, end)
        self.assertEqual((v['status'], v['usd']), ('complete', 20))
        later = NOW+86400
        v = p.volume(self.db, SPEC, {**cursor(), 'block_time': p.iso(later)}, self.refs, later)
        self.assertEqual((v['status'], v['usd']), ('complete', 0))

    def test_empty_complete_window_is_zero(self):
        v = p.volume(self.db, SPEC, cursor(), ({}, {}), NOW)
        self.assertEqual((v['status'], v['swaps'], v['usd']), ('complete', 0, 0))
        self.assertIsNone(p.volume(self.db, SPEC, None, self.refs, NOW)['usd'])

    def test_missing_valuation_is_not_zero(self):
        p.record_scan(self.db, 'osmosis-1', cursor(), [swap()], [])
        v = p.volume(self.db, SPEC, cursor(), ({}, {}), NOW)
        self.assertEqual(v['status'], 'complete')
        self.assertEqual(v['swaps'], 1)
        self.assertIsNone(v['usd'])

    def test_stale_and_ambiguous_index_are_unavailable(self):
        self.assertEqual(p.volume(self.db, SPEC, cursor(), self.refs, NOW+901)['status'], 'stale')
        problem = {'pool': KEY, 'time': NOW-30, 'txhash': 'C'*64, 'event_index': 1, 'reason': 'ambiguous'}
        p.record_scan(self.db, 'osmosis-1', cursor(), [], [problem])
        self.assertEqual(p.volume(self.db, SPEC, cursor(), self.refs, NOW)['status'], 'incomplete')

    def test_parse_matching_hops_only_and_failed_transactions(self):
        events = [event({'pool_id': '1', 'tokens_in': '2000000ua', 'tokens_out': '4000000ub'}),
                  event({'pool_id': '2', 'tokens_in': '4000000ub', 'tokens_out': '1uc'})]
        tx = {'code': 0, 'height': '10', 'timestamp': p.iso(NOW), 'txhash': 'A'*64, 'events': events}
        trades, errors = p.parse_swaps(tx, {}, 'osmosis-1', {KEY: SPEC})
        self.assertEqual(len(trades), 1)
        self.assertEqual(errors, [])
        self.assertEqual(p.parse_swaps({**tx, 'code': 5}, {}, 'osmosis-1', {KEY: SPEC}), ([], []))
        events[0]['attributes'].append({'key': 'pool_id', 'value': '1'})
        trades, errors = p.parse_swaps(tx, {}, 'osmosis-1', {KEY: SPEC})
        self.assertEqual(len(errors), 1)
        self.assertEqual(trades, [])

    def test_legacy_denom_requires_execution_evidence(self):
        address = 'juno1example'
        spec = {**SPEC, 'key': 'juno-1:'+address, 'chain_id': 'juno-1', 'pool': address}
        e = event({'_contract_address': address, 'native_sold': '2000000', 'token_bought': '4000000', 'msg_index': '0'})
        e['type'] = 'wasm'
        tx = {'code': 0, 'height': '10', 'timestamp': p.iso(NOW), 'txhash': 'A'*64, 'events': [e]}
        body = {'body': {'messages': [{'contract': address, 'funds': [{'denom': 'ua', 'amount': '2000000'}]}]}}
        trades, errors = p.parse_swaps(tx, body, 'juno-1', {spec['key']: spec})
        self.assertEqual(trades[0]['denom_in'], 'ua')
        self.assertEqual(trades[0]['denom_out'], 'ub')
        self.assertEqual(errors, [])
        self.assertEqual(len(p.parse_swaps(tx, {}, 'juno-1', {spec['key']: spec})[1]), 1)

    def test_scan_refuses_truncation_and_missing_control_receipt(self):
        anchor = {'height': 100, 'block_hash': 'A'*64, 'block_time': p.iso(NOW)}
        def block_mock(http, base, chain, height='latest', refresh=False):
            return {**anchor, 'height': 130 if height == 'latest' else int(height)}
        def truncated(url):
            return {'data': {'total': '1', 'txs': [], 'tx_responses': []}}
        def omitted(url):
            if 'ORDER_BY_DESC' in url:
                return {'data': {'tx_responses': [{'height': '100', 'txhash': 'B'*64, 'events': [{'type': 'token_swapped'}]}]}}
            return {'data': {'total': '0', 'txs': [], 'tx_responses': []}}
        with patch.object(p, 'block', side_effect=block_mock), patch.object(p, 'fresh', return_value=True):
            for http in (truncated, omitted):
                with self.assertRaises(RuntimeError):
                    p.scan_chain(http, 'osmosis-1', {KEY: SPEC}, None)

    def test_event_pagination_requires_adjacent_duplicate_position_evidence(self):
        anchor = {'height': 100, 'block_hash': 'A'*64, 'block_time': p.iso(NOW)}
        tx = {'code': 0, 'height': '100', 'timestamp': p.iso(NOW), 'txhash': 'B'*64, 'events': [event({'pool_id':'1','tokens_in':'1ua','tokens_out':'2ub'}),event({'pool_id':'1','tokens_in':'2ub','tokens_out':'1ua'})]}
        honest = True
        def block_mock(http, base, chain, height='latest', refresh=False):
            return {**anchor, 'height': 130 if height == 'latest' else int(height)}
        def http(url):
            receipt = tx
            if not honest and 'page=2&limit=1&' in url:
                receipt = {**tx, 'txhash':'C'*64}
            return {'data': {'total':'2','txs':[{}],'tx_responses':[receipt]}}
        with patch.object(p,'block',side_effect=block_mock),patch.object(p,'fresh',return_value=True):
            c, trades, problems = p.scan_chain(http,'osmosis-1',{KEY:SPEC},None)
            self.assertEqual(c['count_semantics'],'matching-events-verified')
            self.assertEqual((c['transactions'],len(trades),len(problems)),(1,2,0))
            honest = False
            with self.assertRaises(RuntimeError):
                p.scan_chain(http,'osmosis-1',{KEY:SPEC},None)

    def test_archive_catches_up_after_unexported_cycles(self):
        with self.db:
            for at in (NOW-300, NOW):
                self.db.execute('INSERT INTO observations VALUES (?,?,?)', (KEY, at, json.dumps({'time': at, 'amounts': ['1','2']})))
        p.record_scan(self.db, 'osmosis-1', cursor(), [swap()], [])
        with tempfile.TemporaryDirectory() as root:
            p.save_chunk(self.db, root, {KEY: SPEC}, NOW)
            files = list(Path(root).glob('*/*.json.gz'))
            saved = json.loads(gzip.decompress(files[0].read_bytes()))
            self.assertEqual(len(saved['observations']), 2)
            self.assertEqual(len(saved['swaps']), 1)
            p.save_chunk(self.db, root, {KEY: SPEC}, NOW+300)
            second = json.loads(gzip.decompress(sorted(Path(root).glob('*/*.json.gz'))[-1].read_bytes()))
            self.assertEqual(second['observations'], [])
            self.assertEqual(second['swaps'], [])
            self.assertEqual(len(list(Path(root).glob('registry-*.json.gz'))), 1)

    def test_shared_pool_projects_to_two_assets_without_extra_record(self):
        spec = {**SPEC, 'targets': {'atom': ['ua'], 'juno': ['ub']}}
        obs = {KEY: {'status': 'ok', 'time': NOW, 'amounts': ['2000000','4000000'], 'liquidity_usd': '40'}}
        config = {'assets': {'atom': {'denom': 'ua'}, 'juno': {'denom': 'ub'}}}
        views = p.views({KEY: spec}, obs, {}, config, NOW)
        self.assertEqual(views['atom'][0]['reserve_token'], 2)
        self.assertEqual(views['juno'][0]['reserve_token'], 4)
        self.assertEqual(views['atom'][0]['id'], views['juno'][0]['id'])
        stale = p.views({KEY: spec}, obs, {}, config, NOW+901)
        self.assertIsNone(stale['atom'][0]['liquidity_usd'])


if __name__ == '__main__':
    unittest.main()
