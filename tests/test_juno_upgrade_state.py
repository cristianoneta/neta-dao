from concurrent.futures import ThreadPoolExecutor
import copy
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import juno_upgrade_state as storage


def add(identifier):
    def mutation(state):
        state['events'][identifier] = {'id': identifier, 'chainId': 'juno-1', 'status': 'voting'}
        return state
    return mutation


class StateTests(unittest.TestCase):
    def test_restart_reads_saved_state_and_concurrent_proposals_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            with ThreadPoolExecutor(max_workers=2) as pool:
                list(pool.map(lambda identifier: storage.transact(directory, add(identifier)), ['a', 'b']))
            restored = storage.transact(directory, lambda state: state)
            self.assertEqual(set(restored['events']), {'a', 'b'})
            self.assertEqual((Path(directory) / 'events.json').stat().st_mode & 0o777, 0o600)

    def test_failed_publication_retains_prior_checkpoint(self):
        with tempfile.TemporaryDirectory() as directory:
            storage.transact(directory, add('a'))
            path = Path(directory) / 'events.json'; before = path.read_bytes()
            with patch.object(storage.os, 'replace', side_effect=OSError('synthetic disk failure')):
                with self.assertRaises(OSError): storage.transact(directory, add('b'))
            self.assertEqual(path.read_bytes(), before)
            self.assertFalse(list(Path(directory).glob('.events-*')))

    def test_late_worker_cannot_overwrite_closed_archive_or_remove_events(self):
        with tempfile.TemporaryDirectory() as directory:
            prior = storage.transact(directory, add('a'))
            def close(state):
                state['events']['a'].update(status='closed', reason='five-hour-limit')
                return state
            closed = storage.transact(directory, close)
            with self.assertRaisesRegex(ValueError, 'immutable'):
                storage.transact(directory, lambda state: prior)
            with self.assertRaisesRegex(ValueError, 'remove'):
                storage.transact(directory, lambda state: {'schema': 1, 'chainId': 'juno-1', 'events': {}})
            self.assertEqual(storage.transact(directory, lambda state: state), closed)

    def test_active_anchor_and_watermark_cannot_change(self):
        with tempfile.TemporaryDirectory() as directory:
            def active(state):
                state = add('a')(state)
                state['events']['a'].update(status='observing', halt={'height': 9}, deadline='fixed',
                                            validators=['baseline'], upgradeHeight=9, plan={'height': 10}, scannedThrough=10)
                return state
            original = storage.transact(directory, active)
            for key, value in [('deadline', 'later'), ('plan', {'height': 11}), ('scannedThrough', 9), ('status', 'scheduled')]:
                changed = copy.deepcopy(original); changed['events']['a'][key] = value
                with self.assertRaises(ValueError): storage.transact(directory, lambda state: changed)
            self.assertEqual(storage.transact(directory, lambda state: state), original)

    def test_corrupt_or_symlink_checkpoint_is_never_silently_replaced(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'events.json'
            path.write_text('corrupt'); path.chmod(0o600)
            with self.assertRaises(ValueError): storage.transact(directory, add('a'))
            self.assertEqual(path.read_text(), 'corrupt')
            path.unlink(); path.symlink_to(Path(directory) / 'missing')
            with self.assertRaises(ValueError): storage.transact(directory, add('a'))
            self.assertTrue(path.is_symlink())


if __name__ == '__main__': unittest.main()
