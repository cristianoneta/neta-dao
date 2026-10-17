import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from test_validator_history import history, item

spec = importlib.util.spec_from_file_location('active', Path(__file__).resolve().parents[1] / 'scripts/validator_active_set.py')
active = importlib.util.module_from_spec(spec)
spec.loader.exec_module(active)


class ActiveSetExport(unittest.TestCase):
    def test_export_preserves_partial_bounds_and_never_writes_archive(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'history.sqlite3'
            db = history.connect(path)
            history.initialize(db, '2026-10-14T19:17:50Z', 10, 'https://rpc.example.org', 'https://rest.example.org')
            for h in range(10, 14):
                history.append(db, item(h, when=f'2026-10-14T19:17:{40+h}Z'))
            snap = {'height': 13, 'blockTime': '2026-10-14T19:17:53Z', 'validators': [
                {'active': True, 'consensusAddress': a} for a in item()['roster']]}
            before = db.total_changes
            result = active.active_set_history(path, snap)
            self.assertEqual(len(result['spans']), 1)
            self.assertEqual(result['spans'][0]['firstHeight'], 10)
            self.assertEqual(result['spans'][0]['lastHeight'], 13)
            self.assertNotIn('eligible', result)
            self.assertEqual(db.total_changes, before)
            snap['height'] = 14
            with self.assertRaisesRegex(ValueError, 'does not cover'):
                active.active_set_history(path, snap)
            snap['height'] = 13
            db.execute('DELETE FROM blocks WHERE height=11'); db.commit()
            with self.assertRaisesRegex(ValueError, 'continuity'):
                active.active_set_history(path, snap)
            db.close()

    def test_missing_archive_does_not_create_a_database(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'missing.sqlite3'
            with self.assertRaises(Exception):
                active.active_set_history(path, {})
            self.assertFalse(path.exists())
