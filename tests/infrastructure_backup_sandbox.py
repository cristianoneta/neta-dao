#!/usr/bin/env python3
"""Required root/systemd integration using only synthetic databases.

Run explicitly in CI; never skip a missing manager, capability or namespace.
The inside process inherits the shipped service's hardening verbatim, with only
its synthetic paths, limits and invocation substituted by the outer harness.
"""
from contextlib import closing
import errno
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
from unittest.mock import patch
import uuid


def inside(root):
    sys.path.insert(0, str(root / 'code'))
    import infrastructure_backup as backup
    work = root / 'work'
    # Prove the regression is exercised: same backing filesystem, different mount.
    with tempfile.NamedTemporaryFile() as src:
        assert Path(src.name).stat().st_dev == work.stat().st_dev
        try:
            os.link(src.name, work / 'must-not-link')
        except OSError as error:
            assert error.errno == errno.EXDEV, error
        else:
            raise AssertionError('PrivateTmp/ReadWritePaths did not isolate mounts')
    for uid in (65534, 65533, 0):
        source = root / ('source-' + str(uid)) / 'live.sqlite'
        original = backup.digest(source)
        try:
            source.open('r+b').close()
        except OSError as error:
            assert error.errno == errno.EROFS, error
        else:
            raise AssertionError('Live database bind must remain read-only')
        budget = backup.Budget(work, 10**7, 0)
        target = work / ('export-' + str(uid) + '.sqlite')
        backup.export_database(source, target, 'relay', budget)
        assert backup.digest(source) == original
        assert budget.used == target.stat().st_size
        assert target.stat().st_uid == 0 and target.stat().st_mode & 0o777 == 0o600
        with closing(sqlite3.connect(target)) as db:
            assert db.execute('SELECT revision FROM backups').fetchone() == (1,)
        for suffix in ('-wal', '-shm'):
            info = Path(str(source) + suffix).stat()
            assert info.st_uid == uid and info.st_gid == uid
            assert info.st_mode & 0o777 == 0o600
        # Exclusive publication and dangling symlinks cannot replace old exports.
        with target.open('rb') as f:
            saved = f.read()
        try:
            backup.export_database(source, target, 'relay', backup.Budget(work, 10**7, 0))
        except FileExistsError:
            pass
        else:
            raise AssertionError('Existing export replaced')
        assert target.read_bytes() == saved
        if uid == 0:
            continue
        for case in ('budget', 'timeout', 'permission'):
            failed_target = work / (case + str(uid))
            budget = backup.Budget(work, 1 if case == 'budget' else 10**7, 0)
            real_copy = backup.sqlite_copy
            def injected(*args):
                if case == 'timeout':
                    time.sleep(10)
                if case == 'permission':
                    raise PermissionError(errno.EACCES, 'synthetic-private-message', '/private/path')
                return real_copy(*args)
            expected = {'budget': ValueError, 'timeout': TimeoutError, 'permission': PermissionError}[case]
            started = time.monotonic()
            with patch.object(backup, 'sqlite_copy', side_effect=injected):
                try:
                    backup.export_database(source, failed_target, 'relay', budget,
                                           timeout=0.2 if case == 'timeout' else 5)
                except expected as error:
                    details = backup.error_details(error)
                    assert 'private' not in str(details)
                    if case == 'permission':
                        assert details['errno'] == errno.EACCES
                else:
                    raise AssertionError('Injected failure accepted: ' + case)
            assert time.monotonic() - started < 4
            assert not failed_target.exists()
            assert not list(Path('/tmp').glob('cosmoot-sqlite-export-*'))
            try:
                os.waitpid(-1, os.WNOHANG)
            except ChildProcessError:
                pass
            else:
                raise AssertionError('Worker was not reaped')
        print('PASS: sandbox export, sidecar ownership and failure cleanup for UID', uid, flush=True)
    print('PASS: separate-mount reproduction and read-only source binds', flush=True)


def main():
    if len(sys.argv) == 3 and sys.argv[1] == '--inside':
        return inside(Path(sys.argv[2]))
    assert os.geteuid() == 0, 'Run with sudo on a real systemd host'
    repo = Path(__file__).resolve().parents[1]
    name = 'cosmoot-backup-ci-' + uuid.uuid4().hex
    with tempfile.TemporaryDirectory(prefix=name + '-', dir='/run') as tmp:
        root = Path(tmp)
        root.chmod(0o711)
        (root / 'work').mkdir(mode=0o700)
        (root / 'code').mkdir(mode=0o755)
        for filename in ('infrastructure_backup.py', 'evidence_archive.py'):
            shutil.copyfile(repo / 'scripts' / filename, root / 'code' / filename)
        shutil.copyfile(__file__, root / 'probe.py')
        sources = []
        for uid in (65534, 65533, 0):
            directory = root / ('source-' + str(uid))
            directory.mkdir(mode=0o700)
            source = directory / 'live.sqlite'
            with closing(sqlite3.connect(source)) as db:
                db.execute('PRAGMA journal_mode=WAL')
                db.executescript('CREATE TABLE backups(scope,revision,digest,blob,updated);'
                                 "INSERT INTO backups VALUES('synthetic',1,'hash','encrypted',1);")
            source.chmod(0o600)
            os.chown(source, uid, uid)
            os.chown(directory, uid, uid)
            sources.append(source)
        # Use all shipped hardening, including future additions. Exclude only
        # actual deployment paths/credentials and replace execution-specific fields.
        overridden = {'WorkingDirectory', 'ExecStart', 'LoadCredential', 'StateDirectory',
                      'StateDirectoryMode', 'ReadWritePaths', 'BindReadOnlyPaths',
                      'TimeoutStartSec', 'TimeoutStopSec'}
        properties = []
        service = False
        for line in (repo / 'deploy/cosmoot/systemd/cosmoot-infrastructure-backup@.service').read_text().splitlines():
            if line.startswith('['):
                service = line == '[Service]'
            if service and '=' in line and not line.startswith('#') and line.split('=', 1)[0] not in overridden:
                properties += ['-p', line]
        properties += ['-p', 'ReadWritePaths=' + ' '.join(str(p.parent) for p in sources) + ' ' + str(root / 'work')]
        for source in sources:
            properties += ['-p', 'BindReadOnlyPaths=' + str(source)]
        command = ['systemd-run', '--wait', '--pipe', '--collect', '--unit=' + name,
                   '-p', 'RuntimeMaxSec=60s', '-p', 'TimeoutStartSec=60s', '-p', 'TimeoutStopSec=5s',
                   *properties, '/usr/bin/python3', '-I', str(root / 'probe.py'), '--inside', str(root)]
        try:
            subprocess.run(command, check=True, timeout=75)
        finally:
            subprocess.run(['systemctl', 'stop', name + '.service'], capture_output=True, timeout=10)
        for source in sources:
            uid = source.stat().st_uid
            result = subprocess.run(['/usr/bin/python3', '-I', '-c', '''import sqlite3,sys
from pathlib import Path
with sqlite3.connect(sys.argv[1]) as db:
    db.execute('UPDATE backups SET revision=2')
if int(sys.argv[3]):
    try:
        list(Path(sys.argv[2]).iterdir())
    except PermissionError:
        pass
    else:
        raise AssertionError('Root staging became accessible')
''', str(source), str(root / 'work'), str(uid)], user=uid, group=uid, extra_groups=[],
                capture_output=True, text=True, timeout=10)
            assert result.returncode == 0, result.stderr
        print('PASS: all source owners can write after sandbox exits; staging remains private')


if __name__ == '__main__':
    main()
