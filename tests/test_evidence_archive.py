import base64
import gzip
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import evidence_archive as archive
import public_observation_archive as observations
spec = importlib.util.spec_from_file_location('verify_archive', Path(archive.__file__).with_name('verify-evidence-archive.py'))
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class ArchiveTests(unittest.TestCase):
    def test_restart_reuses_identical_bundle_and_corruption_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as root:
            first = archive.store(root, 'test', {'height': 123, 'value': 'original'})
            self.assertEqual(first, archive.store(root, 'test', {'height': 123, 'value': 'original'}))
            path = Path(root) / first['path']
            self.assertEqual(archive.read_bundle(path)['payload']['height'], 123)
            path.write_bytes(gzip.compress(b'{"different":true}'))
            with self.assertRaises(ValueError):
                archive.store(root, 'test', {'height': 123, 'value': 'original'})
            self.assertEqual(gzip.decompress(path.read_bytes()), b'{"different":true}')

    def test_unsafe_paths_and_directory_symlinks_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root)
            (path / 'real').mkdir()
            (path / 'link').symlink_to(path / 'real', target_is_directory=True)
            with self.assertRaises(ValueError):
                archive.store(path / 'link', 'test', {})
            with self.assertRaises(ValueError):
                archive.store(path, '../private', {})

    def test_failed_fsync_never_reports_archived(self):
        with tempfile.TemporaryDirectory() as root, patch.object(archive.os, 'fsync', side_effect=OSError('disk')):
            with self.assertRaises(OSError):
                archive.store(root, 'test', {'height': 1})
            self.assertEqual(list(Path(root).rglob('*.json.gz')), [])

    def test_low_disk_keeps_original_and_creates_no_bundle(self):
        with tempfile.TemporaryDirectory() as root, patch.object(archive.shutil, 'disk_usage', return_value=SimpleNamespace(free=archive.MIN_FREE)):
            with self.assertRaises(OSError):
                archive.store(root, 'test', {'height': 1})
            self.assertEqual(list(Path(root).rglob('*.json.gz')), [])

    def test_daily_archive_retains_original_observation_and_signed_price_bytes(self):
        with tempfile.TemporaryDirectory() as root:
            repo, out = Path(root) / 'repo', Path(root) / 'archive'
            planner = repo / 'data/daos/juno-delegation-planner.json'
            price = repo / 'data/nns/price.json'
            planner.parent.mkdir(parents=True)
            price.parent.mkdir(parents=True)
            original = b'{"blockTime":"2026-10-24T06:00:00Z","height":1}\n'
            planner.write_bytes(original)
            signed = b'{"snapshot":{"observed_at":1792800000},"signature":"unchanged"}\n'
            price.write_bytes(signed)
            observations.capture(repo, out, 'main')
            planner.write_text('{"blockTime":"2026-10-24T08:00:00Z","height":2}')
            observations.capture(repo, out, 'main')
            self.assertEqual(len(list((out / 'public-observation').glob('*.gz'))), 1)
            self.assertEqual(len(list((out / 'signed-price').glob('*.gz'))), 1)
            value = archive.read_bundle(next((out / 'public-observation').glob('*.gz')))
            self.assertEqual(base64.b64decode(value['payload']['rawBase64']), original)
            value = archive.read_bundle(next((out / 'signed-price').glob('*.gz')))
            self.assertEqual(base64.b64decode(value['payload']['rawBase64']), signed)
            planner.write_text('{"blockTime":"2026-10-26T08:00:00Z","height":3}')
            observations.capture(repo, out, 'main')
            self.assertFalse((out / 'daily-catalog/2026-10-25').exists())
            self.assertEqual(len(list((out / 'public-observation').glob('*.gz'))), 2)
            checked = verifier.verify(out)
            self.assertEqual(checked['bundles'], {'public-observation': 2, 'signed-price': 1})
            index = out / 'daily-catalog/2026-10-24/planner.json'
            index.rename(index.with_name('juno.json'))
            with self.assertRaisesRegex(ValueError, 'identity'):
                verifier.verify(out)
            index.with_name('juno.json').rename(index)
            value = next((out / 'public-observation').glob('*.gz'))
            value.write_bytes(b'broken')
            # An existing catalog must not hide lost evidence on subsequent runs.
            planner.write_bytes(original)
            first = json.loads((out / 'daily-catalog/2026-10-24/planner.json').read_text())
            (out / first['path']).write_bytes(b'broken')
            with self.assertRaises((ValueError, OSError, EOFError)):
                verifier.verify(out)
            with self.assertRaises((ValueError, OSError, EOFError)):
                observations.capture(repo, out, 'main')


if __name__ == '__main__':
    unittest.main()
