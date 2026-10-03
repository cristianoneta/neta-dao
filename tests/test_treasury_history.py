import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location(
    "treasury", Path(__file__).parents[1] / "scripts" / "update_treasury.py"
)
treasury = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(treasury)


def snapshot(stamp, total="1"):
    return {
        "generated_at": stamp,
        "height": 1,
        "status": "COMPLETE",
        "total_usd": total,
        "assets": [],
    }


class TreasuryHistoryTests(unittest.TestCase):
    def test_non_daily_run_preserves_existing_same_day_snapshot(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(treasury, "OUT", Path(directory)):
            history = Path(directory) / "history.json"
            history.write_text(json.dumps({"schema_version": 1, "snapshots": [snapshot("2026-09-22T19:05:00Z")]}))
            with patch.dict(os.environ, {"TREASURY_DAILY_SNAPSHOT": "0"}):
                treasury.write_snapshot(snapshot("2026-09-22T20:05:00Z", "2"))
            rows = json.loads(history.read_text())["snapshots"]
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["total_usd"], "1")

    def test_daily_run_replaces_same_day_snapshot(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(treasury, "OUT", Path(directory)):
            history = Path(directory) / "history.json"
            history.write_text(json.dumps({"schema_version": 1, "snapshots": [snapshot("2026-09-22T19:05:00Z")]}))
            with patch.dict(os.environ, {"TREASURY_DAILY_SNAPSHOT": "1"}):
                treasury.write_snapshot(snapshot("2026-09-22T20:05:00Z", "2"))
            rows = json.loads(history.read_text())["snapshots"]
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["total_usd"], "2")

class TreasuryIdentityTests(unittest.TestCase):
    def test_unregistered_ibc_tickers_cannot_borrow_real_asset_prices(self):
        for base in ('uusdc', 'fakeusdc', 'uatom', 'uaxldai'):
            with self.subTest(base=base), patch.object(treasury, 'rest', return_value=({'denom_trace': {'path': 'transfer/channel-999', 'base_denom': base}}, 'mock')):
                meta = treasury.native_metadata('ibc/' + 'A' * 64)
                self.assertNotIn('coingecko', meta)
                assets = treasury.native_assets([{'denom': 'ibc/' + 'A' * 64, 'amount': '1000000000'}], {'usd-coin': {'usd': treasury.Decimal(1)}, 'cosmos': {'usd': treasury.Decimal(10)}}, [])
                self.assertIsNone(assets[0]['usd_value'])

    def test_exact_reviewed_denom_retains_market_identity(self):
        denom = 'ibc/EAC38D55372F38F1AFD68DF7FE9EF762DCF69F26520643CF3F9D292A738D8034'
        with patch.object(treasury, 'rest', side_effect=AssertionError('registry identity should not need a trace')):
            self.assertEqual(treasury.native_metadata(denom)['coingecko'], 'usd-coin')


class TreasuryPartialValuationTests(unittest.TestCase):
    def test_unpriced_lp_underlying_marks_snapshot_partial(self):
        item = {'type': 'lp', 'symbol': 'JUNO / UNKNOWN LP', 'usd_value': '10',
                'underlyings': [{'symbol': 'JUNO', 'usd_value': '10'}, {'symbol': 'UNKNOWN', 'usd_value': None}]}
        result = treasury.snapshot_result('2026-10-02T20:00:00Z', 1, 'mock', 'mock', [item], [], 'dao')
        self.assertEqual(result['status'], 'PARTIAL')
        self.assertEqual(result['total_usd'], '10')
        self.assertIn('UNKNOWN', result['warnings'][0])


if __name__ == "__main__":
    unittest.main()
