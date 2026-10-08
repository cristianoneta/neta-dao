import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

scripts = Path(__file__).resolve().parents[1] / 'scripts'
sys.path.insert(0, str(scripts))
spec = importlib.util.spec_from_file_location('host_report', scripts / 'collector-host-report.py')
report = importlib.util.module_from_spec(spec)
spec.loader.exec_module(report)
sys.path.pop(0)


class ReadOnlyHostInventory(unittest.TestCase):
    def test_only_explicit_unit_state_properties_are_returned(self):
        result = SimpleNamespace(returncode=0, stdout='\n\n'.join(
            'Id='+unit+'\nLoadState=loaded\nActiveState=inactive\nSubState=dead\nEnvironment=PRIVATE'
            for unit in report.TIMERS + report.SERVICES))
        with patch.object(report.subprocess, 'run', return_value=result) as run:
            value = report.units()
        args, kwargs = run.call_args
        self.assertEqual(args[0][:3], ['systemctl', 'show', '--no-pager'])
        self.assertEqual(args[0][4:], report.TIMERS + report.SERVICES)
        self.assertEqual(kwargs['timeout'], 15)
        self.assertNotIn('Environment', str(value))
        self.assertNotIn('PRIVATE', str(value))
        self.assertEqual(value['units'][0]['ActiveState'], 'inactive')

    def test_empty_or_incomplete_success_output_is_not_an_inventory(self):
        for output in ('', 'Id=cosmoot-main.timer\nActiveState=active\n', 'unrecognized systemctl output'):
            with patch.object(report.subprocess, 'run', return_value=SimpleNamespace(returncode=0, stdout=output)):
                self.assertEqual(report.units(), {'available': False, 'reason': 'systemd-response-incomplete'})

    def test_unavailable_systemd_does_not_crash_or_echo_error_output(self):
        for error in [FileNotFoundError(), subprocess.TimeoutExpired('systemctl', 15, output='PRIVATE')]:
            with self.subTest(error=type(error)), patch.object(report.subprocess, 'run', side_effect=error):
                value = report.units()
                self.assertFalse(value['available'])
                self.assertNotIn('PRIVATE', str(value))

    def test_missing_host_components_are_reported_without_creating_them(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(report, 'units', return_value={'available': False}):
            root = Path(tmp)
            value = report.report(root/'repo', root/'state', root/'snapshots')
            self.assertFalse(value['processes']['ok'])
            self.assertFalse(value['published']['ok'])
            self.assertEqual(list(root.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
