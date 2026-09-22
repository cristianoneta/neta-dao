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


if __name__ == "__main__":
    unittest.main()
