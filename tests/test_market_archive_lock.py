"""Real lock contention, bounded failure and collector catch-up without data loss."""
import fcntl
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from market_archive_lock import acquire_archive_lock


def collector_fixture(kind, root, at):
    """Only network adapters are replaced; recording and publication run normally."""
    root = Path(root)
    args = ['fixture', '--state', str(root / 'state'), '--output', str(root / 'out'),
            '--archive', str(root / 'archive'), '--archive-lock', str(root / 'archive.lock'),
            '--config', str(root / 'config.json')]
    wait = lambda handle: acquire_archive_lock(handle, timeout=0.1)
    if kind == 'price':
        import collect_cosmos_markets as collector
        from test_cosmos_markets import raw
        direct = SimpleNamespace(http=SimpleNamespace(requests=0, bytes=0))
        with patch.object(sys, 'argv', args), patch.object(collector, 'DirectSources', return_value=direct), \
                patch.object(collector, 'sample', return_value=raw(at)['current']), \
                patch.object(collector, 'acquire_archive_lock', side_effect=wait):
            collector.main()
    else:
        import collect_pool_pilot as collector
        from test_pool_pilot import KEY, SPEC
        anchor = {'height': 20, 'block_hash': 'B' * 64, 'block_time': collector.iso(at),
                  'first_time': at - 90000, 'first_height': 1, 'time': at, 'source': 'fixture'}
        trade = {'pool': KEY, 'chain': 'osmosis-1', 'txhash': 'A' * 64, 'event_index': 0,
                 'height': 10, 'time': at - 10, 'denom_in': 'ua', 'raw_in': '2000000',
                 'denom_out': 'ub', 'raw_out': '4000000'}
        observation = {'status': 'ok', 'time': at, 'amounts': ['2000000', '4000000'],
                       'liquidity_usd': '40'}
        inventory = {slug: {'status': 'complete'} for slug in collector.ASSETS}
        references = ({'atom': {'price': '10', 'observed_at': collector.iso(at - 60)}},
                      {'osmosis-1:ua': ('atom', 6)})
        args += ['--prices-config', str(root / 'config.json')]
        with patch.object(sys, 'argv', args), \
                patch.object(collector, 'price_references', return_value=references), \
                patch.object(collector, 'definitions', return_value={KEY: SPEC}), \
                patch.object(collector, 'osmosis_inventory', return_value=({}, {KEY: observation}, inventory)), \
                patch.object(collector, 'scan_chain', side_effect=lambda http, chain, *rest:
                             (anchor, [trade] if chain == 'osmosis-1' else [], [])), \
                patch.object(collector, 'acquire_archive_lock', side_effect=wait):
            collector.main()


class ArchiveLockTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.path = self.root / 'archive.lock'
        self.path.write_text('existing lock inode')

    def child(self, code, *args):
        prefix = f'import sys; sys.path[:0] = {[str(ROOT / "scripts"), str(ROOT / "tests")]!r}; '
        return subprocess.Popen([sys.executable, '-B', '-c', prefix + code, *map(str, args)],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    def test_contender_waits_then_acquires_same_inode(self):
        inode = self.path.stat().st_ino
        with self.path.open('r') as owner:
            fcntl.flock(owner, fcntl.LOCK_EX | fcntl.LOCK_NB)
            process = self.child(
                'from market_archive_lock import acquire_archive_lock; '
                'f = open(sys.argv[1]); acquire_archive_lock(f, timeout=2); print("acquired")', self.path)
            try:
                self.assertIn('Waiting up to', process.stderr.readline())
                self.assertIsNone(process.poll())
                fcntl.flock(owner, fcntl.LOCK_UN)
                stdout, stderr = process.communicate(timeout=5)
                self.assertEqual(process.returncode, 0, stderr)
                self.assertEqual(stdout.strip(), 'acquired')
                self.assertIn('Archive lock acquired', stderr)
            finally:
                if process.poll() is None:
                    process.kill()
                    process.communicate()
        self.assertEqual(self.path.stat().st_ino, inode)
        self.assertEqual(self.path.read_text(), 'existing lock inode')

    def test_timeout_preserves_owner_exclusion_and_inode(self):
        inode = self.path.stat().st_ino
        with self.path.open('r') as owner, self.path.open('r') as contender:
            fcntl.flock(owner, fcntl.LOCK_EX | fcntl.LOCK_NB)
            started = time.monotonic()
            with self.assertRaisesRegex(TimeoutError, 'observations retained'):
                acquire_archive_lock(contender, timeout=0.05)
            self.assertLess(time.monotonic() - started, 1)
            with self.assertRaises(BlockingIOError):
                fcntl.flock(contender, fcntl.LOCK_EX | fcntl.LOCK_NB)
        self.assertEqual(self.path.stat().st_ino, inode)

    def test_uncontended_lock_is_exclusive_until_close(self):
        with self.path.open('r') as first, self.path.open('r') as second:
            acquire_archive_lock(first, timeout=0)
            with self.assertRaises(BlockingIOError):
                fcntl.flock(second, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with self.path.open('r') as subsequent:
            acquire_archive_lock(subsequent, timeout=0)

    def test_unrelated_lock_errors_are_not_retried(self):
        with self.path.open('r') as handle, patch('market_archive_lock.fcntl.flock', side_effect=PermissionError):
            with self.assertRaises(PermissionError):
                acquire_archive_lock(handle)

    def test_invalid_wait_is_rejected(self):
        with self.path.open('r') as handle:
            for timeout in (-1, float('nan'), float('inf')):
                with self.assertRaises(ValueError):
                    acquire_archive_lock(handle, timeout)

    def exercise_collector(self, kind):
        at = int(time.time())
        root = self.root
        (root / 'out').mkdir()
        if kind == 'price':
            from test_cosmos_markets import SPEC
            config = {'atom': SPEC}
            publication = root / 'out/atom/current.json'
            database = root / 'state/atom.sqlite3'
            table = 'samples'
        else:
            import collect_pool_pilot as pilot
            from test_pool_pilot import KEY, SPEC
            config = {'assets': {slug: {'denom': 'ua'} for slug in pilot.ASSETS}}
            publication = root / 'out/atom/pools.json'
            database = root / 'state/pools.sqlite3'
            table = 'swaps'
            database.parent.mkdir()
            with pilot.connect(database) as db:
                db.execute('INSERT INTO pools VALUES (?,?,?)', (KEY, at - 90000, json.dumps(SPEC)))
                db.execute('INSERT INTO metrics VALUES (?,?)', (at - 300, json.dumps({'state_bytes': 1})))
            db.close()
        (root / 'config.json').write_text(json.dumps(config))
        publication.parent.mkdir(parents=True)
        publication.write_text('previous accepted publication')
        code = 'from test_market_archive_lock import collector_fixture; collector_fixture(sys.argv[1],sys.argv[2],int(sys.argv[3]))'
        with self.path.open('r') as owner:
            fcntl.flock(owner, fcntl.LOCK_EX | fcntl.LOCK_NB)
            failed = self.child(code, kind, root, at)
            stdout, stderr = failed.communicate(timeout=10)
            self.assertNotEqual(failed.returncode, 0, stdout)
            self.assertIn('Shared archive lock remained busy', stderr)
            self.assertEqual(publication.read_text(), 'previous accepted publication')
            self.assertFalse((root / 'archive').exists())
            with sqlite3.connect(database) as db:
                self.assertEqual(db.execute(f'SELECT count(*) FROM {table}').fetchone()[0], 1)
                if kind == 'pool':
                    self.assertEqual(db.execute('SELECT count(*) FROM exports').fetchone()[0], 0)
        recovered = self.child(code, kind, root, at)
        stdout, stderr = recovered.communicate(timeout=10)
        self.assertEqual(recovered.returncode, 0, stderr)
        self.assertIsInstance(json.loads(publication.read_text()), dict)
        self.assertTrue(list((root / 'archive').rglob('*.gz')))
        with sqlite3.connect(database) as db:
            self.assertEqual(db.execute(f'SELECT count(*) FROM {table}').fetchone()[0], 1)
            if kind == 'pool':
                self.assertGreater(db.execute('SELECT count(*) FROM exports').fetchone()[0], 0)
                report = json.loads((root / 'out/pilot/status.json').read_text())
                self.assertEqual(report['storage']['baseline_after_first_cycle']['time'], at - 300)

    def test_pool_timeout_retains_swaps_and_next_cycle_exports_without_duplicates(self):
        self.exercise_collector('pool')

    def test_price_timeout_retains_observation_and_next_cycle_publishes(self):
        self.exercise_collector('price')


if __name__ == '__main__':
    unittest.main()
