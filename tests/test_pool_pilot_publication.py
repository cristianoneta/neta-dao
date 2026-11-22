"""Public history remains readable under the production service's private umask."""
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from collect_pool_pilot import publish_json


class PublicPoolPublicationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.root = self.base / 'public'
        self.root.mkdir(mode=0o755)
        self.target = self.root / 'pilot/history' / ('a' * 64) / '1d.json'

    def tearDown(self):
        self.temp.cleanup()

    def publish_private_umask(self):
        prior = os.umask(0o077)
        try:
            publish_json(self.target, {'pool': 'osmosis-1:1'}, root=self.root)
        finally:
            os.umask(prior)

    def assert_public(self):
        for folder in (self.root / 'pilot', self.root / 'pilot/history', self.target.parent):
            self.assertEqual(stat.S_IMODE(folder.stat().st_mode), 0o755)
        self.assertEqual(stat.S_IMODE(self.target.stat().st_mode), 0o644)
        self.assertEqual(json.loads(self.target.read_text())['pool'], 'osmosis-1:1')

    def test_new_nested_history_readable_under_service_umask(self):
        self.publish_private_umask()
        self.assert_public()

    def test_repairs_retained_v4_directory_without_opening_private_state(self):
        private = self.base / 'state'
        private.mkdir(mode=0o700)
        secret = private / 'history.sqlite3'
        secret.write_bytes(b'private-state-fixture')
        secret.chmod(0o600)
        history = self.root / 'pilot/history'
        history.mkdir(parents=True)
        history.chmod(0o700)
        self.publish_private_umask()
        self.publish_private_umask()
        self.assert_public()
        self.assertEqual(stat.S_IMODE(private.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(secret.stat().st_mode), 0o600)
        self.assertEqual(secret.read_bytes(), b'private-state-fixture')

    def test_rejects_symlink_in_public_subtree(self):
        private = self.base / 'state'
        private.mkdir(mode=0o700)
        (self.root / 'pilot').mkdir()
        (self.root / 'pilot/history').symlink_to(private, target_is_directory=True)
        with self.assertRaises(ValueError):
            self.publish_private_umask()
        self.assertEqual(stat.S_IMODE(private.stat().st_mode), 0o700)
        self.assertEqual(list(private.iterdir()), [])

    def test_rejects_symlink_root_and_escaping_path(self):
        alias = self.base / 'alias'
        alias.symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(ValueError):
            publish_json(alias / 'pilot/status.json', {}, root=alias)
        with self.assertRaises(ValueError):
            publish_json(self.base / 'outside.json', {}, root=self.root)
        with self.assertRaises(ValueError):
            publish_json(self.root / '../outside.json', {}, root=self.root)
        self.assertFalse((self.base / 'outside.json').exists())


if __name__ == '__main__':
    unittest.main()
