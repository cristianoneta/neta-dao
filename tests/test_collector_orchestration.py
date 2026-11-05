"""Execute orchestration against isolated child scripts, never public services."""
import importlib.util
from contextlib import redirect_stdout
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))


class CollectorOrchestration(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / 'scripts').mkdir()
        (self.root / 'data/treasury').mkdir(parents=True)
        (self.root / 'data/daos').mkdir()
        for filename in ('update_main_dao.py', 'update_members.py', 'evidence_archive.py'):
            shutil.copyfile(ROOT / 'scripts' / filename, self.root / 'scripts' / filename)
        self.prior = b'{"prior":"verified evidence"}\n'

    def run_collector(self, filename, **environment):
        return subprocess.run([sys.executable, str(self.root / 'scripts' / filename)],
                              cwd=self.root, env={**os.environ, **environment},
                              capture_output=True, text=True, timeout=10)

    def main_fixture(self):
        children = {
            'balances': ('update_treasury.py', 'neta-main.json'),
            'events': ('update_treasury_events.py', 'neta-main-events.json'),
            'accounting': ('update_treasury_accounting.py', 'neta-main-accounting.json'),
        }
        for task, (script, output) in children.items():
            initial = {'status': 'PARTIAL', 'refresh_status': 'completed', 'evidence': ['retained']}
            (self.root / 'data/treasury' / output).write_text(json.dumps(initial))
            (self.root / 'scripts' / script).write_text(f'''
import json, os
from pathlib import Path
def reconcile_movements(events, accounting):
    if os.environ.get('FAIL_RECONCILIATION') == '1':
        raise ValueError('Contradictory recorded movements')
    return {{'status': 'PARTIAL', 'matched_receipts': 1}}
if __name__ == '__main__':
    if os.environ.get('FAIL_TASK') == {task!r}:
        raise SystemExit(7)
    unavailable = os.environ.get('UNAVAILABLE_TASK') == {task!r}
    data = {{'status': 'UNAVAILABLE' if unavailable else 'PARTIAL',
             'refresh_status': 'unavailable' if unavailable else 'completed',
             'evidence': ['retained', 'new']}}
    path = Path(__file__).resolve().parents[1] / 'data/treasury' / {output!r}
    path.write_text(json.dumps(data))
''')

    def test_main_child_failure_exits_nonzero_after_publishing_all_statuses(self):
        self.main_fixture()
        for failed in ('balances', 'events', 'accounting'):
            with self.subTest(failed=failed):
                result = self.run_collector('update_main_dao.py', FAIL_TASK=failed)
                status = json.loads((self.root / 'data/daos/neta-status.json').read_text())
                self.assertEqual(status[failed]['status'], 'unavailable')
                self.assertEqual({name for name in ('balances', 'events', 'accounting')
                                  if status[name]['status'] == 'completed'},
                                 {'balances', 'events', 'accounting'} - {failed})
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_unavailable_published_evidence_and_reconciliation_fail_the_main_job(self):
        self.main_fixture()
        for task in ('events', 'accounting'):
            with self.subTest(unavailable=task):
                result = self.run_collector('update_main_dao.py', UNAVAILABLE_TASK=task)
                status = json.loads((self.root / 'data/daos/neta-status.json').read_text())
                self.assertEqual(status[task]['status'], 'unavailable')
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        result = self.run_collector('update_main_dao.py', FAIL_RECONCILIATION='1')
        status = json.loads((self.root / 'data/daos/neta-status.json').read_text())
        self.assertEqual(status['reconciliation']['status'], 'unavailable')
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_main_success_keeps_partial_accounting_distinct_from_failed_collection(self):
        self.main_fixture()
        result = self.run_collector('update_main_dao.py')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        status = json.loads((self.root / 'data/daos/neta-status.json').read_text())
        self.assertTrue(all(status[name]['status'] == 'completed'
                            for name in ('balances', 'events', 'accounting')))
        accounting = json.loads((self.root / 'data/treasury/neta-main-accounting.json').read_text())
        self.assertEqual(accounting['evidence'], ['retained', 'new'])
        self.assertEqual(accounting['movement_review']['status'], 'PARTIAL')

    def members_fixture(self):
        (self.root / 'data/dao-directory.json').write_text(json.dumps({'daos': [
            {'id': 'first', 'membershipSource': {'adapter': 'fixture'}},
            {'id': 'second', 'membershipSource': {'adapter': 'fixture'}},
            {'id': 'not-configured'},
        ]}))
        for name in ('first', 'second'):
            (self.root / 'data/daos' / (name + '.json')).write_bytes(self.prior)
        (self.root / 'scripts/update_dao_directory.py').write_text('''
import os, sys
from pathlib import Path
name = sys.argv[sys.argv.index('--dao') + 1]
if name == os.environ.get('FAIL_DAO'):
    raise SystemExit(9)
(Path(__file__).resolve().parents[1] / 'data/daos' / (name + '.json')).write_text('{"new":true}')
''')

    def test_members_failure_keeps_good_refreshes_and_failed_adapters_prior_evidence(self):
        self.members_fixture()
        result = self.run_collector('update_members.py', FAIL_DAO='second')
        status = json.loads((self.root / 'data/daos/membership-status.json').read_text())
        self.assertEqual(status['daos']['first']['status'], 'completed')
        self.assertEqual(status['daos']['second']['status'], 'unavailable')
        self.assertNotIn('not-configured', status['daos'])
        self.assertEqual(json.loads((self.root / 'data/daos/first.json').read_text()), {'new': True})
        self.assertEqual((self.root / 'data/daos/second.json').read_bytes(), self.prior)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_members_success_ignores_unconfigured_adapters(self):
        self.members_fixture()
        result = self.run_collector('update_members.py')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        status = json.loads((self.root / 'data/daos/membership-status.json').read_text())
        self.assertEqual(set(status['daos']), {'first', 'second'})
        self.assertTrue(all(row['status'] == 'completed' for row in status['daos'].values()))

    def test_timeout_is_a_failed_required_child_not_a_success(self):
        for filename, argument in [('update_main_dao.py', ('events', ('fixture.py', [], 1))),
                                   ('update_members.py', {'id': 'fixture'})]:
            with self.subTest(filename=filename):
                spec = importlib.util.spec_from_file_location('orchestrator_fixture', ROOT / 'scripts' / filename)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                with patch.object(module.subprocess, 'run', side_effect=subprocess.TimeoutExpired('fixture', 1)):
                    _, status = module.run(argument)
                self.assertEqual(status['status'], 'unavailable')

    def test_delegation_receipt_failure_is_not_masked_by_an_existing_daily_checkpoint(self):
        import staking_accrual
        import update_delegation_treasury as delegation
        from treasury_history import ACCOUNTING_START

        dao = next(row for row in json.loads((ROOT / 'data/dao-directory.json').read_text())['daos']
                   if row['id'] == 'juno-delegation')
        config = dao['accountingSource']
        (self.root / 'data/dao-directory.json').write_text(json.dumps({'daos': [dao]}))
        out = self.root / 'data/treasury'
        events_path = out / dao['events']
        feed = {'scope': config['scope'], 'treasuries': config['treasuries'], 'status': 'PARTIAL',
                'generated_at': datetime.now(timezone.utc).isoformat(), 'events': [],
                'sources': [{**account, 'adapter': 'cosmos-rest-receipts',
                             'accounting_start': ACCOUNTING_START, 'last_scanned_height': 500,
                             'anchor_hash': 'A' * 64} for account in config['treasuries']]}
        opening = {'height': 100, 'timestamp': '2026-10-06T13:00:00Z',
                   'hash': 'A' * 64, 'rewards': {'ujuno': '100'}}
        closing = {**opening, 'height': 200, 'timestamp': '2026-10-06T15:00:00Z',
                   'rewards': {'ujuno': '110'}}
        accrued = {'schema_version': 1, 'chain_id': 'juno-1', 'treasury_address': dao['core'],
                   'opening': opening, 'intervals': [staking_accrual.interval(opening, closing, [])]}
        archive = out / 'accrual.json'
        archive.write_text(json.dumps(accrued))
        archive_bytes = archive.read_bytes()
        snapshot = {'chain_id': 'juno-1', 'treasury_address': dao['core'], 'height': 300,
                    'generated_at': '2026-10-06T20:00:00Z'}
        actual_collect = staking_accrual.collect

        for receipt_failure in (False, True):
            with self.subTest(receipt_failure=receipt_failure):
                events_path.write_text(json.dumps(feed))
                with patch.object(delegation, 'ROOT', self.root), patch.object(delegation, 'OUT', out), \
                     patch.object(delegation, 'PROVIDERS', ['fixture']), \
                     patch.object(delegation, 'build_snapshot', return_value=snapshot), \
                     patch.object(delegation, 'write_snapshot', side_effect=lambda *args: \
                                  (out / 'holdings.json').write_text(json.dumps(args[0]))), \
                     patch.object(delegation, 'collect_events', return_value={**feed},
                                  side_effect=OSError('Receipt provider unavailable') if receipt_failure else None), \
                     patch.object(staking_accrual, 'collect', side_effect=lambda dao, snapshot, events:
                                  actual_collect(dao, snapshot, events, archive)), \
                     patch.object(staking_accrual, 'closing_sample', side_effect=AssertionError('Unexpected query')), \
                     patch('community_statement.prices_for', return_value={}), redirect_stdout(io.StringIO()):
                    if receipt_failure:
                        with self.assertRaisesRegex(RuntimeError, 'receipt refresh incomplete'):
                            delegation.run()
                    else:
                        delegation.run()
                ledger = json.loads((out / config['file']).read_text())
                published_events = json.loads(events_path.read_text())
                self.assertEqual(ledger['refresh_status'], 'unavailable' if receipt_failure else 'completed')
                self.assertEqual(published_events['status'], 'UNAVAILABLE' if receipt_failure else 'PARTIAL')
                self.assertEqual(ledger['accrual_refresh_status'], 'completed')
                self.assertEqual(archive.read_bytes(), archive_bytes)
                self.assertEqual(json.loads((out / 'holdings.json').read_text()), snapshot)
                self.assertEqual(len(ledger['entries']), 1)


if __name__ == '__main__':
    unittest.main()
