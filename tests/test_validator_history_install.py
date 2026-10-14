import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('installer', ROOT / 'scripts/install-validator-history.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallTests(unittest.TestCase):
    def test_manifest_matches_reviewed_sources(self):
        for path, digest in installer.FILES.items():
            self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), digest)

    def test_installs_only_new_files_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            a, b = Path(directory) / 'a', Path(directory) / 'b'
            payloads = {a: b'a', b: b'b'}
            self.assertEqual(installer.install(payloads), [a, b])
            self.assertEqual(installer.install(payloads), [])
            self.assertEqual(a.read_bytes(), b'a')

    def test_conflict_or_symlink_prevents_all_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            a, b, target = (Path(directory) / p for p in ('a', 'b', 'target'))
            b.write_bytes(b'other')
            with self.assertRaises(ValueError):
                installer.install({a: b'a', b: b'b'})
            self.assertFalse(a.exists())
            self.assertEqual(b.read_bytes(), b'other')
            b.unlink()
            target.write_bytes(b'b')
            b.symlink_to(target)
            with self.assertRaises(ValueError):
                installer.install({a: b'a', b: b'b'})
            self.assertFalse(a.exists())
            self.assertEqual(target.read_bytes(), b'b')

    def test_partial_creation_failure_removes_only_new_files(self):
        with tempfile.TemporaryDirectory() as directory:
            a, b, retained = (Path(directory) / p for p in ('a', 'b', 'retained'))
            retained.write_bytes(b'old')
            original = installer.os.open

            def fail(path, *args, **kwargs):
                if path == b:
                    raise OSError('test failure')
                return original(path, *args, **kwargs)

            with patch.object(installer.os, 'open', side_effect=fail), self.assertRaises(OSError):
                installer.install({retained: b'old', a: b'a', b: b'b'})
            self.assertFalse(a.exists())
            self.assertEqual(retained.read_bytes(), b'old')


if __name__ == '__main__':
    unittest.main()
