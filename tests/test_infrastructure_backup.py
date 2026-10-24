"""Synthetic infrastructure data only; real Restic integration is mandatory in CI."""
from contextlib import closing
import json
import os
from pathlib import Path
import shutil
import signal
import sqlite3
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import infrastructure_backup as backup
import validator_history

RESTIC = os.environ.get('RESTIC_BINARY')


class Fixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.work = self.root / 'work'
        self.work.mkdir(mode=0o700)
        for name in ('data', 'collector/archive', 'validator', 'secrets'):
            (self.root / name).mkdir(parents=True)
        for name in ('collector', 'validator'):
            (self.root / name / 'collector.lock').touch()
        self.config = dict(schema=1, work=str(self.work), restic=RESTIC or '/bin/false',
            host='synthetic-host', faucet=str(self.root / 'faucet.sqlite'),
            relay=str(self.root / 'relay.sqlite'), collector_data=str(self.root / 'data'),
            collector_state=str(self.root / 'collector'), validator_state=str(self.root / 'validator'),
            recovery_files={'application.env': str(self.root / 'secrets/application.env')},
            max_bytes=16*1024*1024, reserve_bytes=1024*1024)
        (self.root / 'secrets/application.env').write_text('SYNTHETIC=only\n')
        (self.root / 'data/manifest.json').write_text('{"nested":"must be verified"}')
        (self.root / 'collector/archive/evidence.bin').write_bytes(bytes(range(256)))
        self.sources = {}
        for name, sql in {
            'faucet': '''CREATE TABLE challenges(id TEXT PRIMARY KEY,address TEXT,message TEXT,expires INTEGER,used INTEGER);
                CREATE TABLE claims(id TEXT PRIMARY KEY,address TEXT,status TEXT,slot INTEGER UNIQUE,hash TEXT,bytes TEXT,confirmed INTEGER,created INTEGER);
                INSERT INTO claims VALUES('unknown','synthetic','unknown',1,NULL,'signed-but-unknown',NULL,1);
                INSERT INTO claims VALUES('pending','synthetic','pending',2,NULL,'pending-journal',NULL,2);''',
            'relay': '''CREATE TABLE backups(scope TEXT PRIMARY KEY,revision INTEGER,digest TEXT,blob TEXT,updated INTEGER);
                INSERT INTO backups VALUES('synthetic',3,'digest','encrypted-envelope',1);'''
        }.items():
            db = sqlite3.connect(self.config[name])
            self.addCleanup(db.close)
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('PRAGMA wal_autocheckpoint=0')
            db.executescript(sql)
            db.commit()
            self.sources[name] = db  # Keep WAL open throughout the export.
        db = validator_history.connect(self.root / 'validator/history.sqlite3')
        self.addCleanup(db.close)
        db.execute("INSERT INTO meta VALUES ('identity', '{\"start\":\"original\"}')")
        db.commit()
        self.sources['validator'] = db

    def stage(self):
        snapshot = self.work / 'snapshot'
        snapshot.mkdir(mode=0o700)
        return snapshot, backup.stage(self.config, snapshot)

    def run_backup(self, restic):
        with backup.attempt(self.work, 'backup'):
            return backup.backup(self.config, restic)


@unittest.skipUnless(os.geteuid() == 0, 'Source-owner regression requires root')
class SourceOwnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.uid = self.gid = 65534
        try:
            os.chown(self.root, self.uid, self.gid)
        except OSError:
            if os.environ.get('COSMOOT_REQUIRE_OWNER_TESTS'):
                raise
            self.skipTest('A second mapped UID/GID is unavailable in this namespace')
        self.work = self.root / 'private-stage'
        self.work.mkdir(mode=0o700)
        self.source = self.root / 'live.sqlite'
        with closing(sqlite3.connect(self.source)) as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('CREATE TABLE backups(scope TEXT, revision INTEGER, digest TEXT, blob TEXT, updated INTEGER)')
            db.execute("INSERT INTO backups VALUES('synthetic',1,'hash','encrypted',1)")
            db.commit()
        os.chown(self.source, self.uid, self.gid)
        os.chmod(self.source, 0o600)
        self.target = self.work / 'export.sqlite'
        self.budget = backup.Budget(self.work, 10**7, 0)

    def owner_python(self, code):
        return subprocess.run([sys.executable, '-I', '-c', code, str(self.source), str(self.work)],
            user=self.uid, group=self.gid, extra_groups=[], capture_output=True, text=True, timeout=10)

    def test_quiescent_wal_export_preserves_owner_and_subsequent_writer(self):
        self.assertFalse(Path(str(self.source) + '-wal').exists())
        original = backup.digest(self.source)
        backup.export_database(self.source, self.target, 'relay', self.budget)
        self.assertEqual(backup.digest(self.source), original)
        for suffix in ('-wal', '-shm'):
            info = Path(str(self.source) + suffix).stat()
            self.assertEqual((info.st_uid, info.st_gid), (self.uid, self.gid))
            self.assertEqual(info.st_mode & 0o777, 0o600)
        self.assertEqual(self.target.stat().st_uid, 0)
        self.assertEqual(self.target.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.budget.used, self.target.stat().st_size)
        result = self.owner_python('''import sqlite3,sys
from pathlib import Path
db=sqlite3.connect(sys.argv[1]); db.execute('PRAGMA journal_mode=WAL')
db.execute('UPDATE backups SET revision=2'); db.commit(); db.close()
try:
    list(Path(sys.argv[2]).iterdir())
except PermissionError:
    pass
else:
    raise AssertionError('Backup staging became accessible')
''')
        self.assertEqual(result.returncode, 0, result.stderr)
        with closing(sqlite3.connect(self.target)) as db:
            self.assertEqual(db.execute('SELECT revision FROM backups').fetchone(), (1,))
        self.assertEqual(list(self.work.glob('.sqlite-export-*')), [])

    def test_existing_uncheckpointed_wal_is_exported(self):
        # Keep the writer open so revision 3 exists only in WAL during export.
        with closing(sqlite3.connect(self.source)) as db:
            db.execute('PRAGMA wal_autocheckpoint=0')
            db.execute('UPDATE backups SET revision=3')
            db.commit()
            for suffix in ('-wal', '-shm'):
                os.chown(str(self.source) + suffix, self.uid, self.gid)
                os.chmod(str(self.source) + suffix, 0o600)
            backup.export_database(self.source, self.target, 'relay', self.budget)
            with closing(sqlite3.connect(self.target)) as restored:
                self.assertEqual(restored.execute('SELECT revision FROM backups').fetchone(), (3,))
            self.assertEqual(db.execute('SELECT revision FROM backups').fetchone(), (3,))

    def test_worker_budget_failure_leaves_no_export_and_writer_still_works(self):
        with self.assertRaises(ValueError):
            backup.export_database(self.source, self.target, 'relay', backup.Budget(self.work, 1, 0))
        self.assertFalse(self.target.exists())
        self.assertEqual(list(self.work.iterdir()), [])
        result = self.owner_python("import sqlite3,sys; db=sqlite3.connect(sys.argv[1]); "
                                   "db.execute('UPDATE backups SET revision=4'); db.commit()")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_worker_timeout_is_reaped_without_export(self):
        with patch.object(backup, 'sqlite_copy', side_effect=lambda *args: time.sleep(10)):
            started = time.monotonic()
            with self.assertRaises(TimeoutError):
                backup.export_database(self.source, self.target, 'relay', self.budget, timeout=0.1)
            self.assertLess(time.monotonic() - started, 3)
        self.assertEqual(list(self.work.iterdir()), [])

    def test_existing_target_is_never_overwritten(self):
        self.target.write_bytes(b'keep-existing-export')
        with self.assertRaises(FileExistsError):
            backup.export_database(self.source, self.target, 'relay', self.budget)
        self.assertEqual(self.target.read_bytes(), b'keep-existing-export')


class ExportTests(Fixture):
    def test_error_details_do_not_include_exception_values_or_paths(self):
        error = PermissionError(13, 'private-secret', '/private/source')
        error._backup_details = {'operation': 'sqlite_copy', 'errno': 13,
                                 'path': '/private/source', 'message': 'private-secret'}
        self.assertEqual(backup.error_details(error), {'operation': 'sqlite_copy', 'errno': 13})
        error._backup_details = {'operation': '/private/source', 'errno': 'private-secret'}
        self.assertEqual(backup.error_details(error), {'operation': 'unknown', 'errno': None})

    def test_copy_budget_counts_destination_once_and_preserves_existing_bytes(self):
        source = self.work / 'temporary-export'
        source.write_bytes(b'synthetic export')
        target = self.work / 'published-export'
        budget = backup.Budget(self.work, 10**7, 0)
        budget.used = 100
        backup.copy_file(source, target, budget)
        self.assertEqual(budget.used, 100 + source.stat().st_size)
        self.assertEqual(target.read_bytes(), source.read_bytes())
        with self.assertRaises(FileExistsError):
            backup.copy_file(source, target, budget)
        self.assertEqual(budget.used, 100 + source.stat().st_size)

    @unittest.skipUnless(os.geteuid() == 0, 'Worker changes identity through root')
    def test_worker_path_with_current_owner(self):
        try:
            os.setgroups(os.getgroups())
        except PermissionError:
            if os.environ.get('COSMOOT_REQUIRE_OWNER_TESTS'):
                raise
            self.skipTest('Namespace forbids changing supplementary groups')
        source = Path(self.config['relay'])
        target = self.work / 'worker.sqlite'
        backup.export_as_owner(source, target, backup.Budget(self.work, 10**7, 0), 10, source.stat())
        backup.validate_database(target, 'relay')
        self.assertEqual(list(self.work.glob('.sqlite-export-*')), [])

    def test_live_wal_and_all_journals_survive_without_source_mutation(self):
        originals = {kind: list(db.iterdump()) for kind, db in self.sources.items()}
        self.assertTrue(Path(self.config['faucet'] + '-wal').stat().st_size > 0)
        snapshot, manifest = self.stage()
        backup.verify_restore(snapshot, manifest)
        for kind, db in self.sources.items():
            self.assertEqual(list(db.iterdump()), originals[kind])
            with closing(sqlite3.connect(snapshot / 'databases' / (kind + '.sqlite'))) as restored:
                self.assertEqual(list(restored.iterdump()), originals[kind])
        self.assertFalse(manifest['validator_archive_present'])
        self.assertIn('collector-data/manifest.json', manifest['files'])
        self.assertEqual(manifest['source_metadata']['databases/faucet.sqlite']['source'], self.config['faucet'])
        self.assertEqual(manifest['source_metadata']['collector-data']['mode'], (self.root / 'data').stat().st_mode & 0o7777)

    def test_optional_validator_archive_is_preserved(self):
        archive = self.root / 'validator/archive'
        archive.mkdir()
        (archive / 'old.bin').write_bytes(b'exact-old-evidence')
        snapshot, manifest = self.stage()
        self.assertTrue(manifest['validator_archive_present'])
        self.assertEqual((snapshot / 'validator-archive/old.bin').read_bytes(), b'exact-old-evidence')

    def test_nested_manifest_tampering_missing_and_extra_files_rejected(self):
        snapshot, manifest = self.stage()
        path = snapshot / 'collector-data/manifest.json'
        original = path.read_bytes()
        path.write_text('tampered')
        with self.assertRaises(ValueError):
            backup.verify_restore(snapshot, manifest)
        path.unlink()
        with self.assertRaises(ValueError):
            backup.verify_restore(snapshot, manifest)
        path.write_bytes(original)
        (snapshot / 'extra').write_text('not exported')
        with self.assertRaises(ValueError):
            backup.verify_restore(snapshot, manifest)

    def test_symlink_manifest_and_special_restore_entries_rejected(self):
        snapshot, manifest = self.stage()
        original = snapshot / 'manifest.json'
        original.rename(snapshot / 'other')
        original.symlink_to(snapshot / 'other')
        with self.assertRaises(ValueError):
            backup.verify_restore(snapshot, manifest)
        original.unlink()
        (snapshot / 'other').rename(original)
        os.mkfifo(snapshot / 'fifo')
        with self.assertRaises(ValueError):
            backup.verify_restore(snapshot, manifest)

    def test_missing_source_never_created_wrong_schema_and_corruption_rejected(self):
        target = self.work / 'db.sqlite'
        budget = backup.Budget(self.work, 10**7, 0)
        missing = self.root / 'missing.sqlite'
        with self.assertRaises(ValueError):
            backup.export_database(missing, target, 'faucet', budget)
        self.assertFalse(missing.exists())
        self.assertFalse(target.exists())
        with self.assertRaises(ValueError):
            backup.validate_database(Path(self.config['relay']), 'faucet')
        broken = self.root / 'broken.sqlite'
        broken.write_bytes(b'not sqlite')
        with self.assertRaises(sqlite3.DatabaseError):
            backup.validate_database(broken, 'relay')

    def test_export_timeout_and_size_limit(self):
        for timeout, limit, error in [(-1, 10**7, TimeoutError), (120, 1, ValueError)]:
            with self.subTest(timeout=timeout), self.assertRaises(error):
                backup.export_database(Path(self.config['faucet']), self.work / str(timeout),
                    'faucet', backup.Budget(self.work, limit, 0), timeout=timeout)

    def test_budget_reserves_downloaded_copy_and_detects_growth(self):
        budget = backup.Budget(self.work, 1000, 100)
        budget.used = 100
        with patch.object(backup.shutil, 'disk_usage', return_value=SimpleNamespace(free=backup.OVERHEAD+599)):
            with self.assertRaises(ValueError):
                budget.check(200)  # 100 reserve + 100 staged + 2*200
            budget.check(200, written=100)
        with self.assertRaises(ValueError):
            budget.check(901, written=901)

    def test_low_space_does_not_accept_or_alter_sources(self):
        with patch.object(backup.shutil, 'disk_usage', return_value=SimpleNamespace(free=0)):
            with self.assertRaises(ValueError):
                self.stage()
        self.assertEqual(self.sources['faucet'].execute('SELECT count(*) FROM claims').fetchone()[0], 2)

    def test_symlink_and_special_sources_rejected(self):
        data = self.root / 'data'
        link = data / 'link'
        link.symlink_to(self.root / 'secrets/application.env')
        with self.assertRaises(ValueError):
            self.stage()
        link.unlink()
        shutil.rmtree(self.work / 'snapshot')
        os.mkfifo(data / 'fifo')
        with self.assertRaises(ValueError):
            self.stage()

    def test_source_mutation_during_copy_rejected(self):
        source = self.root / 'secrets/application.env'
        original = backup.os.fsync
        def mutate(fd):
            source.write_text('changed during read')
            original(fd)
        with patch.object(backup.os, 'fsync', side_effect=mutate), self.assertRaises(ValueError):
            backup.copy_file(source, self.work / 'copy', backup.Budget(self.work, 10**7, 0))

    def test_overlaps_missing_recovery_and_sqlite_copy_rejected(self):
        backup.validate_config(self.config)
        for change in ({'work': str(self.root)}, {'work': str(self.root / 'data/stage')},
                       {'recovery_files': {}}, {'recovery_files': {'db.sqlite': self.config['faucet']}}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                backup.validate_config({**self.config, **change})

    def test_lock_timeout_and_parallel_backup_lock(self):
        lock = self.root / 'collector/collector.lock'
        with backup.locked(lock, timeout=0):
            with self.assertRaises(TimeoutError):
                with backup.locked(lock, timeout=0):
                    self.fail('second lock acquired')

    def test_failure_status_and_interruption_do_not_replace_last_success(self):
        receipt = self.work / 'last-success.json'
        receipt.write_text('prior receipt')
        for error in (ValueError('private details'), InterruptedError('signal')):
            with self.assertRaises(type(error)), backup.attempt(self.work, 'backup'):
                raise error
            self.assertEqual(receipt.read_text(), 'prior receipt')
            state = json.loads((self.work / 'last-attempt.json').read_text())
            self.assertEqual(state['state'], 'failed')
            self.assertNotIn('private details', json.dumps(state))

    def test_credentials_cannot_be_exported_directly_or_by_hard_link(self):
        creds = self.root / 'credentials'
        creds.mkdir(mode=0o700)
        for name in ('repository', 'password', 'access-key', 'secret-key'):
            (creds / name).write_text('synthetic')
        backup.validate_credential_separation(self.config, creds)
        with self.assertRaises(ValueError):
            backup.validate_credential_separation({**self.config, 'work': str(creds / 'work')}, creds)
        alternate = self.root / 'secret-alias'
        os.link(creds / 'password', alternate)
        with self.assertRaises(ValueError):
            backup.validate_credential_separation({**self.config, 'recovery_files': {'alias': str(alternate)}}, creds)

    def test_required_column_validation_and_existing_export_are_not_overwritten(self):
        wrong = self.root / 'wrong.sqlite'
        with closing(sqlite3.connect(wrong)) as db:
            db.execute('CREATE TABLE backups(unrelated TEXT)')
        with self.assertRaises(ValueError):
            backup.validate_database(wrong, 'relay')
        target = self.work / 'existing'
        target.write_text('preserve existing destination')
        with self.assertRaises(FileExistsError):
            backup.export_database(Path(self.config['relay']), target, 'relay', backup.Budget(self.work, 10**7, 0))
        self.assertEqual(target.read_text(), 'preserve existing destination')

    def test_running_wal_snapshot_excludes_uncommitted_rows(self):
        db = self.sources['faucet']
        db.execute("INSERT INTO claims VALUES('uncommitted','synthetic','pending',3,NULL,'not-committed',NULL,3)")
        snapshot, manifest = self.stage()
        with closing(sqlite3.connect(snapshot / 'databases/faucet.sqlite')) as restored:
            self.assertEqual(restored.execute('SELECT count(*) FROM claims').fetchone()[0], 2)
        self.assertEqual(db.execute('SELECT count(*) FROM claims').fetchone()[0], 3)
        db.rollback()
        backup.verify_restore(snapshot, manifest)

    def test_credential_env_has_no_inherited_overrides(self):
        creds = self.root / 'credentials'
        creds.mkdir(mode=0o700)
        values = dict(repository='s3:https://' + 'a'*32 + '.eu.r2.cloudflarestorage.com/synthetic-bucket',
                      password='x'*48, **{'access-key': 'synthetic-id', 'secret-key': 'synthetic-secret'})
        for key, value in values.items():
            (creds / key).write_text(value)
            (creds / key).chmod(0o600)
        # Ownership is checked separately; CI can run the normal unit suite unprivileged.
        with patch.object(backup, 'private_file', side_effect=lambda p: backup.checked_path(p, 'file')):
            with patch.dict(os.environ, {'RESTIC_PASSWORD_COMMAND': 'evil', 'AWS_ENDPOINT_URL': 'evil'}):
                env = backup.credential_environment(creds)
            self.assertNotIn('RESTIC_PASSWORD_COMMAND', env)
            self.assertNotIn('AWS_ENDPOINT_URL', env)
            self.assertNotIn('RESTIC_PASSWORD', env)
            for url in ('/local/repo', 's3:http://host/bucket', values['repository'] + '?secret=bad'):
                (creds / 'repository').write_text(url)
                with self.assertRaises(ValueError):
                    backup.credential_environment(creds)

    def test_private_file_permissions_and_owner(self):
        path = self.root / 'private'
        path.write_text('synthetic')
        path.chmod(0o644)
        with self.assertRaises(ValueError):
            backup.private_file(path)
        path.chmod(0o600)
        if os.getuid() == 0:
            self.assertEqual(backup.private_file(path), path)
        else:
            with self.assertRaises(ValueError):
                backup.private_file(path)


@unittest.skipUnless(os.getuid() == 0, 'Root-only CLI boundary; required integration job uses sudo')
class CliTests(Fixture):
    def command(self, program):
        binary = self.root / 'fake-restic'
        binary.write_text('#!/usr/bin/python3\n' + program)
        binary.chmod(0o700)
        config = self.root / 'config.json'
        config.write_text(json.dumps({**self.config, 'restic': str(binary)}))
        config.chmod(0o600)
        creds = self.root / 'credentials'
        creds.mkdir(mode=0o700)
        values = {'repository': 's3:https://' + 'a'*32 + '.eu.r2.cloudflarestorage.com/synthetic-bucket',
                  'password': 'synthetic-password-'*3, 'access-key': 'synthetic', 'secret-key': 'synthetic'}
        for name, value in values.items():
            (creds / name).write_text(value)
            (creds / name).chmod(0o600)
        return [sys.executable, backup.__file__, 'backup', '--config', str(config)], {
            'PATH': '/usr/bin:/bin', 'CREDENTIALS_DIRECTORY': str(creds)}

    def test_cli_failure_keeps_private_diagnostics_out_of_output(self):
        command, env = self.command("import sys\nprint('synthetic-sensitive-detail', file=sys.stderr)\nsys.exit(42)\n")
        result = subprocess.run(command, env=env, capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 1)
        self.assertNotIn('synthetic-sensitive-detail', result.stdout + result.stderr)
        self.assertEqual(json.loads((self.work / 'last-attempt.json').read_text())['state'], 'failed')
        private = self.work / 'last-restic-error.json'
        self.assertIn('synthetic-sensitive-detail', private.read_text())
        self.assertEqual(private.stat().st_mode & 0o777, 0o600)
        self.assertFalse((self.work / 'last-success.json').exists())

    def test_sigterm_kills_child_and_records_failed_attempt(self):
        marker = self.work / 'child.pid'
        command, env = self.command("import os, time\nfrom pathlib import Path\nPath(" + repr(str(marker)) + ").write_text(str(os.getpid()))\ntime.sleep(60)\n")
        process = subprocess.Popen(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            deadline = time.monotonic() + 5
            while not marker.exists() and time.monotonic() < deadline:
                time.sleep(0.02)
            self.assertTrue(marker.exists())
            child_pid = int(marker.read_text())
            process.send_signal(signal.SIGTERM)
            stdout, stderr = process.communicate(timeout=5)
            self.assertEqual(process.returncode, 1)
            self.assertIn('InterruptedError', stdout)
            self.assertEqual(stderr, '')
            with self.assertRaises(ProcessLookupError):
                os.kill(child_pid, 0)
            self.assertEqual(json.loads((self.work / 'last-attempt.json').read_text())['state'], 'failed')
            self.assertFalse((self.work / 'last-success.json').exists())
        finally:
            if process.poll() is None:
                process.kill()
                process.communicate()


@unittest.skipUnless(RESTIC, 'Set RESTIC_BINARY for real repository integration (required CI job)')
class ResticTests(Fixture):
    def setUp(self):
        super().setUp()
        self.repository = self.root / 'repository'
        self.restic = backup.Restic(RESTIC, {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8',
            'RESTIC_REPOSITORY': str(self.repository), 'RESTIC_PASSWORD': 'synthetic-test-password-only'},
            self.work / 'last-restic-error.json')
        self.restic.run('init', '--repository-version', '2')

    def test_actual_encrypted_roundtrip_repeated_backups_and_retention_preview(self):
        first = self.run_backup(self.restic)
        self.assertEqual(len(first['snapshot_id']), 64)
        self.assertFalse((self.work / 'snapshot').exists())
        self.assertEqual(list(self.work.glob('restore-*')), [])
        self.sources['faucet'].execute("INSERT INTO claims VALUES('new','synthetic','pending',3,NULL,'new-pending',NULL,3)")
        self.sources['faucet'].commit()
        second = self.run_backup(self.restic)
        self.assertNotEqual(first['snapshot_id'], second['snapshot_id'])
        snapshots = self.restic.run('snapshots', '--json')
        self.restic.run('forget', '--dry-run', '--host', self.config['host'], '--tag', backup.TAG,
            '--group-by', 'host,tags', '--keep-last', '1', '--keep-daily', '7', '--keep-weekly', '4')
        self.assertEqual(self.restic.run('snapshots', '--json'), snapshots)
        self.restic.run('check', '--read-data')
        self.assertFalse(any(b'signed-but-unknown' in p.read_bytes() for p in self.repository.rglob('*') if p.is_file()))

    def test_wrong_password_and_missing_repository_do_not_initialize_or_accept(self):
        self.run_backup(self.restic)
        prior = (self.work / 'last-success.json').read_bytes()
        for env in ({'RESTIC_PASSWORD': 'wrong'}, {'RESTIC_REPOSITORY': str(self.root / 'missing-repo')}):
            failing = backup.Restic(RESTIC, {**self.restic.env, **env})
            with self.assertRaises(RuntimeError):
                self.run_backup(failing)
            self.assertEqual((self.work / 'last-success.json').read_bytes(), prior)
            self.assertEqual(json.loads((self.work / 'last-attempt.json').read_text())['state'], 'failed')
        self.assertFalse((self.root / 'missing-repo').exists())

    def test_actual_exit_three_cannot_accept_partial_snapshot(self):
        original = self.restic.run
        def partial(*args, **kwargs):
            if args[0] == 'backup':
                args = (*args, 'missing-required-source')
            return original(*args, **kwargs)
        with patch.object(self.restic, 'run', side_effect=partial), self.assertRaisesRegex(RuntimeError, 'exit 3'):
            self.run_backup(self.restic)
        self.assertFalse((self.work / 'last-success.json').exists())
        self.assertFalse((self.work / 'snapshot').exists())
        self.assertTrue(json.loads(original('snapshots', '--json')))  # Partial snapshot really exists.

    def test_failed_restore_and_tampering_never_replace_prior_receipt(self):
        self.run_backup(self.restic)
        prior = (self.work / 'last-success.json').read_bytes()
        original = self.restic.run
        for failure in ('missing-id', 'tampered'):
            def broken(*args, **kwargs):
                if args[0] == 'restore' and failure == 'missing-id':
                    args = ('restore', '0'*64, *args[2:])
                result = original(*args, **kwargs)
                if args[0] == 'restore' and failure == 'tampered':
                    target = Path(args[args.index('--target')+1])
                    (target / 'snapshot/collector-data/manifest.json').write_text('tampered')
                return result
            with patch.object(self.restic, 'run', side_effect=broken), self.assertRaises((RuntimeError, ValueError)):
                self.run_backup(self.restic)
            self.assertEqual((self.work / 'last-success.json').read_bytes(), prior)
            self.assertFalse((self.work / 'snapshot').exists())

    def test_leftover_plaintext_is_preserved_and_blocks_retry(self):
        leftover = self.work / 'snapshot'
        leftover.mkdir()
        (leftover / 'preserve').write_text('inspect me')
        with self.assertRaises(ValueError):
            self.run_backup(self.restic)
        self.assertEqual((leftover / 'preserve').read_text(), 'inspect me')
        self.assertFalse((self.work / 'last-success.json').exists())

    def test_leftover_restore_and_insufficient_download_space_cannot_accept(self):
        leftover = self.work / 'restore-abandoned'
        leftover.mkdir()
        (leftover / 'preserve').write_text('plaintext')
        with self.assertRaises(ValueError):
            self.run_backup(self.restic)
        self.assertEqual((leftover / 'preserve').read_text(), 'plaintext')
        shutil.rmtree(leftover)
        original = self.restic.run
        def consume_space(*args, **kwargs):
            result = original(*args, **kwargs)
            if args[0] == 'check':
                self.disk_patch = patch.object(backup.shutil, 'disk_usage', return_value=SimpleNamespace(free=0))
                self.disk_patch.start()
                self.addCleanup(self.disk_patch.stop)
            return result
        with patch.object(self.restic, 'run', side_effect=consume_space), self.assertRaises(ValueError):
            self.run_backup(self.restic)
        self.assertFalse((self.work / 'last-success.json').exists())
        self.assertFalse((self.work / 'snapshot').exists())

    def test_ambiguous_receipt_is_not_accepted(self):
        original = self.restic.run
        def duplicate_summary(*args, **kwargs):
            result = original(*args, **kwargs)
            return result + result if args[0] == 'backup' else result
        with patch.object(self.restic, 'run', side_effect=duplicate_summary), self.assertRaises(ValueError):
            self.run_backup(self.restic)
        self.assertFalse((self.work / 'last-success.json').exists())

    def test_corrupt_remote_pack_fails_download_and_full_check(self):
        self.run_backup(self.restic)
        prior = (self.work / 'last-success.json').read_bytes()
        # Corrupt a referenced, unchanged source blob, not an arbitrary pack:
        # old tree/manifest blobs need not be read by the next snapshot.
        wanted = backup.hashlib.sha256(bytes(range(256))).hexdigest()
        matches = []
        for index_id in self.restic.run('list', 'index').splitlines():
            index = json.loads(self.restic.run('cat', 'index', index_id))
            for entry in index['packs']:
                for blob in entry['blobs']:
                    if blob['id'] == wanted:
                        matches.append((entry['id'], blob['offset'], blob['length']))
        self.assertEqual(len(matches), 1)
        pack_id, offset, length = matches[0]
        pack = self.repository / 'data' / pack_id[:2] / pack_id
        data = bytearray(pack.read_bytes())
        data[offset + length//2] ^= 0xff
        pack.chmod(0o600)
        pack.write_bytes(data)
        with self.assertRaises(RuntimeError):
            self.restic.run('check', '--read-data')
        with self.assertRaises(RuntimeError):
            self.run_backup(self.restic)
        self.assertEqual((self.work / 'last-success.json').read_bytes(), prior)


if __name__ == '__main__':
    unittest.main()
