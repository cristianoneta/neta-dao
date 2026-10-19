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
            self.assertEqual(result['schema'], 2)
            self.assertEqual(result['collectionStart'], {'height': 10, 'time': '2026-10-14T19:17:50Z'})
            participation = result['participation']
            self.assertEqual((participation['firstHeight'], participation['lastHeight']), (10, 13))
            self.assertEqual(participation['endTime'], snap['blockTime'])
            for row, flag in zip(participation['validators'], item()['flags']):
                self.assertEqual(row['expected'], 4)
                self.assertEqual([row['absent'], row['signed'], row['nil']],
                                 [4 if flag == v else 0 for v in (1, 2, 3)])
            checkpoint = active.archive_checkpoint(path, 12, '2026-10-14T19:17:53Z')
            self.assertEqual(checkpoint['height'], 12)
            self.assertEqual(checkpoint['hash'], item(12)['hash'].hex().upper())
            with self.assertRaisesRegex(ValueError, 'recent'):
                active.archive_checkpoint(path, 20, '2026-10-14T20:18:00Z')
            self.assertNotIn('eligible', result)
            self.assertEqual(db.total_changes, before)
            db.close()
            archive_bytes = path.read_bytes()
            self.assertEqual(active.active_set_history(path, snap), result)
            self.assertEqual(path.read_bytes(), archive_bytes)
            db = history.connect(path)
            snap['height'] = 14
            with self.assertRaisesRegex(ValueError, 'does not cover'):
                active.active_set_history(path, snap)
            snap['height'] = 13
            db.execute('DELETE FROM blocks WHERE height=11'); db.commit()
            with self.assertRaisesRegex(ValueError, 'continuity'):
                active.active_set_history(path, snap)
            db.close()

    def test_missing_prefix_cannot_restart_the_collecting_period(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'history.sqlite3'
            db = history.connect(path)
            history.initialize(db, '2026-10-14T19:17:50Z', 10, 'https://rpc.example.org', 'https://rest.example.org')
            for h in range(10, 14):
                history.append(db, item(h, when=f'2026-10-14T19:17:{40+h}Z'))
            db.execute('DELETE FROM blocks WHERE height=10'); db.commit()
            snap = {'height': 13, 'blockTime': '2026-10-14T19:17:53Z', 'validators': [
                {'active': True, 'consensusAddress': a} for a in item()['roster']]}
            with self.assertRaisesRegex(ValueError, 'collection origin'):
                active.active_set_history(path, snap)
            db.close()

    def test_missing_archive_does_not_create_a_database(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'missing.sqlite3'
            with self.assertRaises(Exception):
                active.active_set_history(path, {})
            self.assertFalse(path.exists())

    def test_rolling_boundary_uses_exact_blocks_not_daily_totals_or_future_blocks(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'history.sqlite3'
            db = history.connect(path)
            history.initialize(db, '2026-01-01T00:00:00Z', 10, history.RPC, history.REST)
            for h, stamp, flags in [
                (10, '2026-01-01T00:00:00Z', (2, 2, 1, 3)),
                (11, '2026-01-01T00:00:01Z', (2, 2, 2, 1)),
                (12, '2026-04-01T00:00:00Z', (2, 2, 3, 2)),
                (13, '2026-04-01T00:00:01Z', (2, 2, 1, 1))
            ]:
                history.append(db, item(h, when=stamp, flags=flags))
            snap = {'height': 12, 'blockTime': '2026-04-01T00:00:00Z', 'validators': [
                {'active': True, 'consensusAddress': a} for a in item()['roster']]}
            result = active.active_set_history(path, snap)
            self.assertEqual(result['spans'][0]['firstHeight'], 10)  # membership anchor
            p = result['participation']
            self.assertEqual((p['firstHeight'], p['lastHeight']), (11, 12))
            self.assertEqual(p['startTime'], '2026-01-01T00:00:01Z')
            self.assertEqual(sum(v['expected'] for v in p['validators']), 8)
            self.assertEqual(sum(v['signed'] for v in p['validators']), 6)
            self.assertEqual(sum(v['absent'] for v in p['validators']), 1)
            self.assertEqual(sum(v['nil'] for v in p['validators']), 1)
            db.close()

    def test_roster_transitions_keep_commit_columns_and_expected_slots_aligned(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'history.sqlite3'
            db = history.connect(path)
            history.initialize(db, '2026-10-14T19:17:50Z', 10, history.RPC, history.REST)
            old = item(10)
            new = item(11, when='2026-10-14T19:17:51Z', keys=(1, 2, 5, 6))
            history.append(db, old)
            history.append(db, new)
            snap = {'height': 11, 'blockTime': new['time'], 'validators': [
                {'active': True, 'consensusAddress': a} for a in new['roster']]}
            result = active.active_set_history(path, snap)
            self.assertEqual(len(result['spans']), 2)
            expected = {}
            for block in [old, new]:
                for a, flag in zip(block['roster'], block['flags']):
                    row = expected.setdefault(a, {'address': a, 'expected': 0, 'signed': 0, 'absent': 0, 'nil': 0})
                    row['expected'] += 1
                    row[{1: 'absent', 2: 'signed', 3: 'nil'}[flag]] += 1
            self.assertEqual(result['participation']['validators'], [expected[a] for a in sorted(expected)])
            for flags in [b'\x02', b'\x02\x02\x00\x03']:
                db.execute('UPDATE blocks SET flags=? WHERE height=11', (flags,)); db.commit()
                with self.assertRaisesRegex(ValueError, 'commit flags'):
                    active.active_set_history(path, snap)
            db.close()

    def test_count_batches_preserve_every_slot(self):
        from datetime import datetime, timedelta, timezone
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'history.sqlite3'
            db = history.connect(path)
            history.initialize(db, '2026-10-14T19:17:50Z', 10, history.RPC, history.REST)
            for h in range(10, 4107):
                stamp = (datetime(2026, 10, 14, 19, 17, 50, tzinfo=timezone.utc) + timedelta(seconds=h-10)).isoformat().replace('+00:00', 'Z')
                history.append(db, item(h, when=stamp))
            snap = {'height': 4106, 'blockTime': stamp, 'validators': [
                {'active': True, 'consensusAddress': a} for a in item()['roster']]}
            rows = active.active_set_history(path, snap)['participation']['validators']
            self.assertEqual([v['expected'] for v in rows], [4097] * 4)
            self.assertEqual(sum(v['signed'] for v in rows), 8194)
            db.close()
