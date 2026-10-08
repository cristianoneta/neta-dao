import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('publisher', Path(__file__).resolve().parents[1] / 'scripts/publish-server-snapshots.py')
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class ServerSnapshots(unittest.TestCase):
    def test_publication_is_atomic_and_excludes_private_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            repo, out = root / 'repo', root / 'public'
            source = repo / 'data/nns/price.json'
            source.parent.mkdir(parents=True)
            source.write_text('{"observed_at":1}')
            (source.parent / 'private.sqlite').write_text('private')
            paths = ['data/nns/price.json']
            self.assertTrue(publisher.publish(repo, out, paths))
            first = (out / 'current').readlink()
            self.assertFalse((out / 'current/data/nns/private.sqlite').exists())
            self.assertFalse(publisher.publish(repo, out, paths))
            source.write_text('invalid JSON')
            with self.assertRaises(json.JSONDecodeError):
                publisher.publish(repo, out, paths)
            self.assertEqual(first, (out / 'current').readlink())
            self.assertEqual(json.loads((out / 'current/data/nns/price.json').read_text()), {'observed_at': 1})
            source.write_text('{"observed_at":2}')
            self.assertTrue(publisher.publish(repo, out, paths))
            self.assertNotEqual(first, (out / 'current').readlink())

    def test_path_escape_and_symlinks_never_publish(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'repo/data/nns/price.json'
            source.parent.mkdir(parents=True)
            private = root / 'secret.json'
            private.write_text('{"private":true}')
            source.symlink_to(private)
            for paths in [['data/nns/price.json'], ['../../secret.json'], ['data/nns/secret.pem']]:
                with self.assertRaises(ValueError):
                    publisher.publish(root / 'repo', root / 'out', paths)
                self.assertFalse((root / 'out/current').exists())


if __name__ == '__main__':
    unittest.main()
