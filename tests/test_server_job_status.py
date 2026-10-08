import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('status', Path(__file__).resolve().parents[1] / 'scripts/server_job_status.py')
status = importlib.util.module_from_spec(spec)
spec.loader.exec_module(status)


class CollectorStatus(unittest.TestCase):
    def test_failure_does_not_refresh_last_success_and_abandoned_run_is_detected(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertFalse(status.check(directory, now=10000)['ok'])
            for job in status.JOBS:
                status.record(directory, job, 'running', now=10000)
                status.record(directory, job, 'succeeded', now=10001)
            self.assertTrue(status.check(directory, now=10002)['ok'])
            result = status.record(directory, 'main', 'failed', now=10003)
            self.assertEqual(result['lastSuccessfulRun'], 10001)
            self.assertFalse(status.check(directory, now=10004)['ok'])
            status.record(directory, 'main', 'running', now=10005)
            self.assertIn('run-stalled', status.check(directory, now=11326)['jobs'][1]['issues'])
            self.assertFalse(status.check(directory, now=20000)['ok'])

    def test_corrupt_or_future_receipts_cannot_report_healthy(self):
        with tempfile.TemporaryDirectory() as directory:
            for job in status.JOBS:
                status.record(directory, job, 'succeeded', now=10000)
            self.assertFalse(status.check(directory, now=1)['ok'])
            (Path(directory) / 'main.json').write_text('[]')
            self.assertFalse(status.check(directory, now=10001)['ok'])


if __name__ == '__main__':
    unittest.main()
