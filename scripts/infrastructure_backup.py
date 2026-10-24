#!/usr/bin/env python3
"""Consistent infrastructure exports to an encrypted Restic repository.

No production restore, automatic repository initialization, retention deletion or
application signing. Every successful backup includes a fresh download and check.
"""
import argparse
from contextlib import closing, contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import sqlite3
import stat
import subprocess
import tempfile
import time

from evidence_archive import atomic_json


TAG = 'cosmoot-infrastructure-v1'
# Headroom for SQLite pages, directories, manifests and Restic temporary metadata.
OVERHEAD = 64 * 1024 * 1024
TABLES = {
    'faucet': {'challenges': {'id', 'address', 'message', 'expires', 'used'},
               'claims': {'id', 'address', 'status', 'slot', 'hash', 'bytes', 'confirmed', 'created'}},
    'relay': {'backups': {'scope', 'revision', 'digest', 'blob', 'updated'}},
    'validator': {'meta': {'key', 'value'}, 'blocks': {'height', 'hash', 'flags', 'roster'},
                  'events': {'height', 'payload'}, 'daily': {'day', 'address', 'expected', 'signed'},
                  'streaks': {'address', 'entered_height'}, 'snapshots': {'height', 'payload', 'sha256'},
                  'rosters': {'id', 'addresses'}, 'transitions': {'height', 'address', 'type'}},
}


def checked_path(value, kind=None):
    path = Path(value)
    if not path.is_absolute() or '..' in path.parts:
        raise ValueError('Paths must be absolute and contain no parent traversal')
    if any(p.is_symlink() for p in (path, *path.parents)):
        raise ValueError('Symlinks are not accepted')
    if kind == 'file' and not path.is_file():
        raise ValueError('Required regular file is missing')
    if kind == 'directory' and not path.is_dir():
        raise ValueError('Required directory is missing')
    return path


def private_file(path):
    path = checked_path(path, 'file')
    info = path.stat()
    if info.st_uid != 0 or info.st_mode & 0o077:
        raise ValueError('Configuration and credentials must be root-owned and private')
    return path


@contextmanager
def locked(path, timeout=1260):
    path = checked_path(path, 'file')
    # Existing collector locks are never created, replaced or chmodded here.
    with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), 'rb') as stream:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
            raise ValueError('Lock must be a regular file')
        deadline = time.monotonic() + timeout
        while True:
            try:
                fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise TimeoutError('Collector lock deadline exceeded')
                time.sleep(0.2)
        yield


class Budget:
    def __init__(self, root, maximum, reserve):
        self.root, self.maximum, self.reserve = root, maximum, reserve
        self.used = 0
        self.source_metadata = {}

    def record(self, source, target):
        info = source.stat()
        self.source_metadata[str(target.relative_to(self.root))] = {
            'source': str(source), 'uid': info.st_uid, 'gid': info.st_gid,
            'mode': stat.S_IMODE(info.st_mode)}

    def check(self, extra, written=0):
        if self.used + extra > self.maximum:
            raise ValueError('Export exceeds configured byte limit')
        # Existing staging bytes also need a second, downloaded copy. During SQLite
        # backup some pages of `extra` have already been written.
        if shutil.disk_usage(self.root).free < self.reserve + OVERHEAD + self.used + 2 * extra - written:
            raise ValueError('Export would consume the free-space reserve')


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def copy_file(source, target, budget):
    checked_path(source, 'file')
    with os.fdopen(os.open(source, os.O_RDONLY | os.O_NOFOLLOW), 'rb') as src:
        before = os.fstat(src.fileno())
        if not stat.S_ISREG(before.st_mode):
            raise ValueError('Only regular files are exported')
        budget.check(before.st_size)
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with target.open('xb') as dst:
            os.chmod(target, 0o600)
            remaining = before.st_size
            while remaining:
                chunk = src.read(min(1024 * 1024, remaining))
                if not chunk:
                    raise ValueError('Source changed during export')
                dst.write(chunk)
                remaining -= len(chunk)
            if src.read(1):
                raise ValueError('Source grew during export')
            dst.flush()
            os.fsync(dst.fileno())
        after = os.fstat(src.fileno())
        if (before.st_size, before.st_mtime_ns, before.st_ctime_ns) != (
                after.st_size, after.st_mtime_ns, after.st_ctime_ns):
            raise ValueError('Source changed during export')
        budget.used += before.st_size
        budget.record(source, target)


def copy_tree(source, target, budget):
    checked_path(source, 'directory')
    before = source.stat()
    budget.record(source, target)
    target.mkdir(parents=True, mode=0o700)
    for child in sorted(source.iterdir()):
        checked_path(child)
        if child.is_dir():
            copy_tree(child, target / child.name, budget)
        elif child.is_file():
            copy_file(child, target / child.name, budget)
        else:
            raise ValueError('Special files are not exported')
    after = source.stat()
    if (before.st_ino, before.st_mtime_ns, before.st_ctime_ns) != (after.st_ino, after.st_mtime_ns, after.st_ctime_ns):
        raise ValueError('Source directory changed during export')


def validate_database(path, kind):
    checked_path(path, 'file')
    with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)) as db:
        if db.execute('PRAGMA quick_check').fetchall() != [('ok',)]:
            raise ValueError('SQLite integrity check failed')
        found = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not set(TABLES[kind]).issubset(found):
            raise ValueError('Database does not match the expected service')
        for table, columns in TABLES[kind].items():
            if not columns.issubset({row[1] for row in db.execute('PRAGMA table_info(' + table + ')')}):
                raise ValueError('Database is missing required columns')


def export_database(source, target, kind, budget, timeout=120):
    checked_path(source, 'file')
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    # Exclusive creation before SQLite opens the destination; never overwrite.
    with target.open('xb'):
        os.chmod(target, 0o600)
    deadline = time.monotonic() + timeout
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True, timeout=1)) as src:
        page_size = src.execute('PRAGMA page_size').fetchone()[0]

        def progress(status, remaining, total):
            if time.monotonic() > deadline:
                raise TimeoutError('SQLite export deadline exceeded')
            # Recheck growth against both the cap and the second-copy reserve.
            budget.check(total * page_size, written=target.stat().st_size)

        budget.check(src.execute('PRAGMA page_count').fetchone()[0] * page_size)
        with closing(sqlite3.connect(target)) as dst:
            src.backup(dst, pages=256, progress=progress, sleep=0.05)
            dst.execute('PRAGMA journal_mode=DELETE')
    validate_database(target, kind)
    budget.check(target.stat().st_size, written=target.stat().st_size)
    budget.used += target.stat().st_size
    budget.record(source, target)


def validate_config(config):
    required = {'schema', 'work', 'restic', 'host', 'faucet', 'relay',
                'collector_data', 'collector_state', 'validator_state',
                'recovery_files', 'max_bytes', 'reserve_bytes'}
    if set(config) != required or config['schema'] != 1:
        raise ValueError('Unexpected configuration fields or schema')
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,64}', config['host']):
        raise ValueError('Invalid stable backup host label')
    for field in ('max_bytes', 'reserve_bytes'):
        if type(config[field]) is not int or config[field] < 1024 * 1024:
            raise ValueError('Invalid byte budget')
    sources = []
    for name in ('faucet', 'relay', 'collector_data', 'collector_state', 'validator_state'):
        sources.append(checked_path(config[name], 'file' if name in ('faucet', 'relay') else 'directory'))
    if not isinstance(config['recovery_files'], dict) or not config['recovery_files']:
        raise ValueError('A nonempty operator-reviewed recovery file inventory is required')
    for label, value in config['recovery_files'].items():
        if not re.fullmatch(r'[a-zA-Z0-9_.-]{1,80}', label) or label in ('.', '..'):
            raise ValueError('Invalid recovery file label')
        source = checked_path(value, 'file')
        if source.suffix in ('.sqlite', '.sqlite3', '.db') or source.name.endswith(('-wal', '-shm', '-journal')):
            raise ValueError('Recovery files must not bypass the SQLite online export')
        sources.append(source)
    work = checked_path(config['work'])
    for source in sources:
        if source == work or source in work.parents or work in source.parents:
            raise ValueError('Source and work directories must not overlap')
    return config


def stage(config, snapshot):
    budget = Budget(snapshot, config['max_bytes'], config['reserve_bytes'])
    for kind in ('faucet', 'relay'):
        export_database(Path(config[kind]), snapshot / 'databases' / (kind + '.sqlite'), kind, budget)
    collector = Path(config['collector_state'])
    with locked(collector / 'collector.lock'):
        copy_tree(Path(config['collector_data']), snapshot / 'collector-data', budget)
        copy_tree(collector / 'archive', snapshot / 'collector-archive', budget)
    validator = Path(config['validator_state'])
    with locked(validator / 'collector.lock'):
        export_database(validator / 'history.sqlite3', snapshot / 'databases/validator.sqlite',
                        'validator', budget)
        archive = validator / 'archive'
        checked_path(archive)
        validator_archive = archive.exists()
        if validator_archive:
            copy_tree(archive, snapshot / 'validator-archive', budget)
    for label, source in config['recovery_files'].items():
        copy_file(Path(source), snapshot / 'recovery-files' / label, budget)
    files = {str(path.relative_to(snapshot)): {'bytes': path.stat().st_size, 'sha256': digest(path)}
             for path in sorted(snapshot.rglob('*')) if path.is_file()}
    manifest = {'schema': 1, 'created_at': int(time.time()), 'files': files,
                'validator_archive_present': validator_archive,
                'source_metadata': budget.source_metadata,
                'recovery_file_labels': sorted(config['recovery_files']),
                'consistency': 'Each SQLite database separately; collector and validator locks separately.'}
    budget.check(len(json.dumps(manifest, indent=2, sort_keys=True).encode()) + 1)
    atomic_json(snapshot / 'manifest.json', manifest)
    return manifest


def verify_restore(snapshot, expected):
    checked_path(snapshot, 'directory')
    actual = json.loads(checked_path(snapshot / 'manifest.json', 'file').read_text())
    if actual != expected:
        raise ValueError('Restored manifest differs from the captured export')
    files = {}
    for path in snapshot.rglob('*'):
        checked_path(path)
        if path.is_file() and path != snapshot / 'manifest.json':
            files[str(path.relative_to(snapshot))] = {'bytes': path.stat().st_size, 'sha256': digest(path)}
        elif not path.is_dir() and path != snapshot / 'manifest.json':
            raise ValueError('Unexpected restored file type')
    if files != expected['files']:
        raise ValueError('Restored file set or hashes differ')
    for kind in TABLES:
        validate_database(snapshot / 'databases' / (kind + '.sqlite'), kind)


def credential_environment(directory):
    values = {}
    for name in ('repository', 'password', 'access-key', 'secret-key'):
        path = private_file(directory / name)
        value = path.read_text().strip()
        if not value or '\n' in value or '\r' in value:
            raise ValueError('Missing or multiline credential')
        values[name] = value
    # HTTPS only; dedicated R2 bucket/prefix. No URL credentials, query or shell.
    if not re.fullmatch(r's3:https://[a-f0-9]{32}(?:\.(?:eu|us|fedramp))?'
                        r'\.r2\.cloudflarestorage\.com/[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]'
                        r'(?:/[a-zA-Z0-9_-]+)*', values['repository']):
        raise ValueError('Expected a private R2 S3 repository URL')
    if len(values['password']) < 32:
        raise ValueError('Use an independently saved random repository password of at least 32 characters')
    # Do not inherit password commands, endpoint overrides or general AWS config.
    return {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8',
            'RESTIC_REPOSITORY_FILE': str(directory / 'repository'),
            'RESTIC_PASSWORD_FILE': str(directory / 'password'),
            'AWS_ACCESS_KEY_ID': values['access-key'],
            'AWS_SECRET_ACCESS_KEY': values['secret-key'], 'AWS_DEFAULT_REGION': 'auto',
            'AWS_EC2_METADATA_DISABLED': 'true'}


class Restic:
    def __init__(self, binary, env, diagnostics=None):
        self.binary, self.env = str(binary), env
        self.diagnostics = diagnostics

    def run(self, *args, cwd=None):
        # No inherited environment, shell, password prompt or unbounded captured log.
        with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
            child = subprocess.Popen([self.binary, '--no-cache', *args], cwd=cwd,
                                     env=self.env, stdin=subprocess.DEVNULL, stdout=out, stderr=err)
            try:
                code = child.wait(timeout=1800)
            except BaseException:
                child.kill()
                child.wait()
                raise
            out.seek(0)
            err.seek(0)
            stdout, stderr = out.read(8 * 1024 * 1024 + 1), err.read(65536)
            if code or len(stdout) > 8 * 1024 * 1024:
                if self.diagnostics is not None:
                    atomic_json(self.diagnostics, {'command': args[0], 'exit_code': code,
                        'at': int(time.time()), 'stdout': stdout[:65536].decode(errors='replace'),
                        'stderr': stderr.decode(errors='replace')})
                # Provider errors can contain credentials/locations: only private diagnostics.
                raise RuntimeError('Restic command failed (exit %d); no acceptance recorded' % code)
            return stdout.decode()


def disjoint(first, second):
    return first != second and first not in second.parents and second not in first.parents


def validate_credential_separation(config, directory):
    directory = checked_path(directory, 'directory')
    paths = [Path(config[name]) for name in
             ('work', 'faucet', 'relay', 'collector_data', 'collector_state', 'validator_state')]
    paths.extend(Path(v) for v in config['recovery_files'].values())
    if any(not disjoint(path, directory) for path in paths):
        raise ValueError('Credentials must be separate from sources and staging')
    # Catch alternate hard-link names too. Repository password must not exist only
    # inside its own encrypted backup (independent custody is an operator gate).
    for value in config['recovery_files'].values():
        if any(os.path.samefile(value, directory / name) for name in
               ('repository', 'password', 'access-key', 'secret-key')):
            raise ValueError('Recovery inventory includes repository credentials')


@contextmanager
def attempt(work, command):
    started = int(time.time())
    status = {'schema': 1, 'command': command, 'started_at': started, 'state': 'running'}
    atomic_json(work / 'last-attempt.json', status)
    try:
        yield
    except BaseException as error:
        atomic_json(work / 'last-attempt.json', {**status, 'state': 'failed',
            'finished_at': int(time.time()), 'error_type': type(error).__name__})
        raise
    else:
        atomic_json(work / 'last-attempt.json', {**status, 'state': 'succeeded',
            'finished_at': int(time.time())})


def interrupted(signum, frame):
    raise InterruptedError('Backup interrupted')


def backup(config, restic):
    work = checked_path(config['work'], 'directory')
    snapshot = work / 'snapshot'
    if snapshot.exists() or snapshot.is_symlink() or any(work.glob('restore-*')):
        raise ValueError('Prior staging directory exists; inspect privately before retrying')
    # Access/password failures do not initialize an empty replacement repository.
    repository = json.loads(restic.run('cat', 'config'))
    started = int(time.time())
    snapshot.mkdir(mode=0o700)
    try:
        manifest = stage(config, snapshot)
        output = restic.run('backup', '--json', '--host', config['host'], '--tag', TAG,
                            'snapshot', cwd=work)
        summaries = [row for line in output.splitlines() if line.strip()
                     for row in [json.loads(line)] if row.get('message_type') == 'summary']
        if len(summaries) != 1 or not re.fullmatch(r'[a-f0-9]{8,64}', summaries[0].get('snapshot_id', '')):
            raise ValueError('Backup did not return an unambiguous snapshot receipt')
        snapshots = json.loads(restic.run('snapshots', '--json', summaries[0]['snapshot_id']))
        if len(snapshots) != 1 or snapshots[0]['hostname'] != config['host'] or TAG not in snapshots[0]['tags']:
            raise ValueError('Snapshot identity differs')
        snapshot_id = snapshots[0]['id']
        if not re.fullmatch(r'[a-f0-9]{64}', snapshot_id) or not snapshot_id.startswith(summaries[0]['snapshot_id']):
            raise ValueError('Invalid full snapshot identity')
        restic.run('check')
        payload_bytes = sum(p.stat().st_size for p in snapshot.rglob('*') if p.is_file())
        if shutil.disk_usage(work).free < config['reserve_bytes'] + OVERHEAD + payload_bytes:
            raise ValueError('Insufficient free space for a complete downloaded restore')
        # No cache; the exact new snapshot must be downloaded from the repository.
        with tempfile.TemporaryDirectory(prefix='restore-', dir=work) as directory:
            target = Path(directory)
            restic.run('restore', snapshot_id, '--target', str(target), '--verify')
            verify_restore(target / 'snapshot', manifest)
        # Staging is only ours; cleanup failure must not produce an acceptance.
        shutil.rmtree(snapshot)
        receipt = {'schema': 1, 'ok': True, 'repository_id': repository['id'],
                   'snapshot_id': snapshot_id, 'started_at': started, 'verified_at': int(time.time()),
                   'file_count': len(manifest['files']),
                   'bytes': sum(f['bytes'] for f in manifest['files'].values()),
                   'recovery_file_labels': manifest['recovery_file_labels'],
                   'scope': 'Encrypted repository download and SQLite/hash checks on this machine; '
                            'not off-server application recovery or a browser restore.'}
        atomic_json(work / 'last-success.json', receipt)
        return receipt
    finally:
        if snapshot.exists():
            shutil.rmtree(snapshot)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('init', 'backup', 'check', 'retention-preview'))
    parser.add_argument('--config', required=True, type=Path)
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise ValueError('Run through the reviewed root-owned service')
    os.umask(0o077)
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    config = json.loads(private_file(args.config).read_text())
    work = checked_path(config['work'], 'directory')
    if work.stat().st_uid != 0 or work.stat().st_mode & 0o077:
        raise ValueError('Work directory must be root-owned and private')
    lock = work / 'backup.lock'
    checked_path(lock)
    fd = os.open(lock, os.O_CREAT | os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600)
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise ValueError('Backup lock must be a regular file')
    finally:
        os.close(fd)
    private_file(lock)
    with locked(lock, timeout=0), attempt(work, args.command):
        validate_config(config)
        binary = checked_path(config['restic'], 'file')
        if binary.stat().st_uid != 0 or binary.stat().st_mode & 0o022:
            raise ValueError('Restic must be root-owned and not writable by others')
        directory = Path(os.environ['CREDENTIALS_DIRECTORY'])
        env = credential_environment(directory)
        validate_credential_separation(config, directory)
        restic = Restic(binary, env, work / 'last-restic-error.json')
        if args.command == 'init':
            restic.run('init', '--repository-version', '2')
        elif args.command == 'backup':
            backup(config, restic)
        elif args.command == 'check':
            restic.run('check', '--read-data')
        else:
            preview = restic.run('forget', '--dry-run', '--json', '--host', config['host'],
                                 '--tag', TAG, '--group-by', 'host,tags',
                                 '--keep-last', '1', '--keep-daily', '7', '--keep-weekly', '4')
            atomic_json(work / 'retention-preview.json', json.loads(preview))
    print(json.dumps({'ok': True, 'command': args.command,
                      'scope': 'Infrastructure repository operation only; private receipts stay local.'}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'ok': False, 'error_type': type(error).__name__,
                          'scope': 'No new acceptance; inspect configuration and service state privately.'}))
        raise SystemExit(1)
