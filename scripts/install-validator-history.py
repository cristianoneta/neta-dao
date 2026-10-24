#!/usr/bin/env python3
"""Install the reviewed validator collector/helpers and two systemd units.

Run as root with an exact source commit. Existing differing files are never
overwritten. --activate explicitly enables the timer and starts a bounded run.
"""
import argparse
import fcntl
import hashlib
import os
from pathlib import Path
import pwd
import re
import shutil
import stat
import subprocess
import tempfile
from urllib.request import urlopen

FILES = {
    'scripts/validator_history.py': '7ad9c754e55f0c03e765a7352dca9fddc310a6a62c91b5360f51b1238935f77a',
    'scripts/validator_archive.py': '727e467d119a746d38f8f7f47e5942daafea89479f1a2dba566b68cb6abbafb7',
    'scripts/evidence_archive.py': 'd78df42887eddbea22e7b127032cf64196b50b9fb6a9afaeaa6c20c0c3ea3684',
    'scripts/block_results_cache.py': 'ab8986cd26cf5cfc0277d81741aa2d4f327a2af2bbc70b88675a078333c35b03',
    'deploy/cosmoot/systemd/cosmoot-validator-history.service': '8974a309b850dbf7983dec191da57cac9eabaaa88b95268189316afa382fb8a9',
    'deploy/cosmoot/systemd/cosmoot-validator-history.timer': '4587b0ac55cdcfb50e131b3351cc7a8a6a627f82aea154d55596bed30852e586',
}
REPO = Path('/srv/cosmoot/collectors/repo')
UNITS = Path('/etc/systemd/system')


def secure_parent(path):
    for parent in (path.parent, *path.parent.parents):
        s = parent.lstat()
        if not stat.S_ISDIR(s.st_mode) or s.st_uid != 0 or s.st_mode & 0o022:
            raise ValueError(f'Expected root-owned, non-writable directory: {parent}')


def install(payloads):
    # Preflight every destination before changing any file.
    for path, data in payloads.items():
        if path.is_symlink():
            raise ValueError(f'Refusing symlink: {path}')
        if path.exists():
            s = path.stat()
            if not stat.S_ISREG(s.st_mode) or s.st_uid != os.geteuid() or s.st_mode & 0o022 or path.read_bytes() != data:
                raise ValueError(f'Unexpected existing file retained: {path}')
    created = []
    try:
        for path, data in payloads.items():
            if path.exists():
                continue
            # Exclusive creation, no overwrites even if a file appears after preflight.
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
            created.append(path)
            with os.fdopen(fd, 'wb') as file:
                file.write(data)
                file.flush()
                os.fsync(file.fileno())
            if path.read_bytes() != data:
                raise ValueError('Post-install hash mismatch')
    except BaseException:
        for path in reversed(created):
            path.unlink()
        raise
    return created


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source-commit', required=True)
    p.add_argument('--activate', action='store_true')
    args = p.parse_args()
    if os.geteuid() != 0 or not re.fullmatch('[0-9a-f]{40}', args.source_commit):
        p.error('Requires root and a full lowercase 40-character commit SHA')
    pwd.getpwnam('cosmoot-collect')
    if shutil.disk_usage('/var/lib').free < 3 * 1024**3:
        raise SystemExit('Need at least 3 GiB free before installing history collection')
    targets = {path: (REPO / path if path.startswith('scripts/') else UNITS / Path(path).name) for path in FILES}
    for target in targets.values():
        secure_parent(target)
    os.umask(0o022)
    fd = os.open('/run/cosmoot-validator-history-install.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'a') as lock, tempfile.TemporaryDirectory(prefix='cosmoot-validator-install-') as temp:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        payloads = {}
        for source, expected in FILES.items():
            url = f'https://raw.githubusercontent.com/cristianoneta/neta-dao/{args.source_commit}/{source}'
            with urlopen(url, timeout=30) as response:
                data = response.read(1024 * 1024 + 1)
            if hashlib.sha256(data).hexdigest() != expected:
                raise ValueError(f'Unexpected download hash: {source}')
            if source.endswith('.py'):
                compile(data, source, 'exec')
            else:
                (Path(temp) / Path(source).name).write_bytes(data)
            payloads[targets[source]] = data
        subprocess.run(['systemd-analyze', 'verify', str(Path(temp) / 'cosmoot-validator-history.service'),
                        str(Path(temp) / 'cosmoot-validator-history.timer')], check=True)
        changed = install(payloads)
        subprocess.run(['systemctl', 'daemon-reload'], check=True)
        print(f'Verified installation: {len(changed)} new files; existing collectors unchanged.', flush=True)
        if args.activate:
            subprocess.run(['systemctl', 'enable', '--now', 'cosmoot-validator-history.timer'], check=True)
            subprocess.run(['systemctl', 'start', '--no-block', 'cosmoot-validator-history.service'], check=True)
            print('Timer enabled and first bounded run requested. Completion/freshness still require inspection.', flush=True)
            subprocess.run(['systemctl', 'show', 'cosmoot-validator-history.timer', '-p', 'ActiveState', '-p', 'NextElapseUSecMonotonic'], check=True)


if __name__ == '__main__':
    main()
