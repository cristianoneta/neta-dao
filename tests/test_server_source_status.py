import importlib.util
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('source_status', Path(__file__).resolve().parents[1] / 'scripts/server_source_status.py')
status = importlib.util.module_from_spec(spec)
spec.loader.exec_module(status)
NOW = 1791489000


class PublishedFreshness(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        stamp = datetime.fromtimestamp(NOW, timezone.utc).isoformat()
        for name, job in status.SOURCES.items():
            self.put(name, dict(schema_version=1, chain_id='juno-1', generated_at=stamp,
                                status='PARTIAL', members_complete=True))
        self.put('data/daos/neta-status.json', dict(checked_at=stamp, **{
            name: {'status': 'completed'} for name in ('balances', 'events', 'accounting')}))
        self.put('data/daos/membership-status.json', {'checked_at': stamp, 'daos': {
            name: {'status': 'completed'} for name in ('neta', 'neta-operations', 'juno')}})
        self.price(NOW, NOW + 86400)

    def put(self, name, value):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value))

    def edit(self, name, **changes):
        value = json.loads((self.root / name).read_text())
        self.put(name, dict(value, **changes))

    def price(self, observed, expires):
        self.put('data/nns/price.json', {'schema_version': 1, 'chain_id': 'juno-1',
                 'snapshot': {'observed_at': observed, 'expires_at': expires}})

    def issues(self, name):
        return next(x['issues'] for x in status.check(self.root, now=NOW)['sources'] if x['path'] == name)

    def test_fresh_partial_valuation_is_explicit_not_stale(self):
        result = status.check(self.root, now=NOW)
        self.assertTrue(result['ok'])
        self.assertIn('partial-valuation', result['sources'][0]['warnings'])

    def test_fresh_check_time_cannot_hide_retained_old_data(self):
        self.edit('data/daos/neta.json', generated_at=datetime.fromtimestamp(NOW-3901, timezone.utc).isoformat())
        self.assertIn('stale-observation', self.issues('data/daos/neta.json'))

    def test_successful_process_cannot_hide_failed_child_refresh(self):
        self.edit('data/daos/neta-status.json', events={'status': 'unavailable'})
        self.assertIn('refresh-unavailable:events', self.issues('data/daos/neta-status.json'))
        self.edit('data/daos/membership-status.json', daos={})
        self.assertIn('refresh-unavailable:juno', self.issues('data/daos/membership-status.json'))

    def test_missing_timezone_future_and_malformed_data_fail_closed(self):
        name = 'data/treasury/current.json'
        for stamp in ('2026-10-08T19:00:00', None, False, 'invalid', '9999-99-99T00:00:00Z'):
            with self.subTest(stamp=stamp):
                self.edit(name, generated_at=stamp)
                self.assertIn('snapshot-unavailable', self.issues(name))
        self.edit(name, generated_at=datetime.fromtimestamp(NOW+61, timezone.utc).isoformat())
        self.assertIn('future-observation', self.issues(name))
        self.put(name, [])
        self.assertIn('snapshot-unavailable', self.issues(name))

    def test_price_expiry_and_cadence_are_independent(self):
        self.price(NOW-3901, NOW-3901+86400)
        self.assertEqual(self.issues('data/nns/price.json'), ['stale-observation'])
        self.price(NOW-86400, NOW)
        self.assertIn('price-expired', self.issues('data/nns/price.json'))
        self.price(NOW, NOW+86401)
        self.assertIn('invalid-price-validity', self.issues('data/nns/price.json'))

    def test_boolean_or_future_price_timestamp_is_invalid(self):
        self.price(True, NOW+86400)
        self.assertIn('invalid-observation', self.issues('data/nns/price.json'))
        self.price(NOW+61, NOW+61+86400)
        self.assertIn('future-observation', self.issues('data/nns/price.json'))

    def test_membership_coverage_and_source_identity_are_checked(self):
        self.edit('data/daos/neta.json', members_complete=False, chain_id='other')
        self.assertIn('membership-incomplete', self.issues('data/daos/neta.json'))
        self.assertIn('invalid-source-identity', self.issues('data/daos/neta.json'))

    def test_missing_files_and_symlinks_are_rejected_without_touching_data(self):
        path = self.root / 'data/treasury/current.json'
        before = path.read_bytes()
        path.unlink()
        self.assertIn('snapshot-unavailable', self.issues('data/treasury/current.json'))
        target = self.root / 'other.json'
        target.write_bytes(before)
        path.symlink_to(target)
        self.assertIn('snapshot-unavailable', self.issues('data/treasury/current.json'))
        self.assertEqual(target.read_bytes(), before)

    def test_generation_symlink_is_supported_but_nested_symlink_is_rejected(self):
        link = self.root / 'current'
        link.symlink_to(self.root, target_is_directory=True)
        self.assertTrue(status.check(link, now=NOW)['ok'])
        directory = self.root / 'data/daos'
        directory.rename(self.root / 'daos-real')
        directory.symlink_to(self.root / 'daos-real', target_is_directory=True)
        self.assertIn('snapshot-unavailable', self.issues('data/daos/neta.json'))

    def test_stale_check_result_is_unhealthy_even_with_fresh_source_data(self):
        self.edit('data/daos/neta-status.json', checked_at=datetime.fromtimestamp(NOW-3901, timezone.utc).isoformat())
        self.assertIn('stale-observation', self.issues('data/daos/neta-status.json'))

    def test_oversized_or_special_files_fail_without_blocking(self):
        with patch.object(status, 'MAX_BYTES', 2):
            self.assertIn('snapshot-unavailable', self.issues('data/treasury/current.json'))
        path = self.root / 'data/treasury/current.json'
        path.unlink()
        os.mkfifo(path)
        self.assertIn('snapshot-unavailable', self.issues('data/treasury/current.json'))


if __name__ == '__main__':
    unittest.main()
