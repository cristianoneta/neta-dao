import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
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

    def test_combined_cli_fails_when_processes_succeed_but_published_data_is_missing(self):
        with tempfile.TemporaryDirectory() as directory:
            for job in status.JOBS:
                status.record(directory, job, 'succeeded', now=int(time.time()))
            result = subprocess.run([sys.executable, str(Path(__file__).resolve().parents[1] / 'scripts/server_job_status.py'),
                                     '--directory', directory, '--snapshot-root', str(Path(directory) / 'missing')],
                                    capture_output=True, text=True, timeout=5)
            value = json.loads(result.stdout)
            self.assertEqual(result.returncode, 1)
            self.assertTrue(value['processes']['ok'])
            self.assertFalse(value['published']['ok'])
            self.assertFalse(value['ok'])


if __name__ == '__main__':
    unittest.main()
