"""Private atomic upgrade checkpoint storage; no network, scheduling or publishing.

Every mutation re-reads the current state under one exclusive lock. An old worker
cannot replace an archive that another worker already closed.
"""
import copy
import fcntl
import json
import os
from pathlib import Path
import stat
import tempfile

MAX_BYTES = 8 * 1024 * 1024


def validate(value):
    if not isinstance(value, dict) or value.get('schema') != 1 or value.get('chainId') != 'juno-1':
        raise ValueError('Invalid upgrade checkpoint schema')
    events = value.get('events')
    if not isinstance(events, dict) or len(events) > 10000:
        raise ValueError('Invalid upgrade event inventory')
    for identifier, event in events.items():
        if not isinstance(event, dict) or event.get('id') != identifier or event.get('chainId') != 'juno-1':
            raise ValueError('Invalid persisted event identity')


def transact(directory, mutate):
    directory = Path(directory)
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = directory.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o077:
        raise ValueError('Checkpoint directory must be private and operator-owned')
    lock_fd = os.open(directory / 'events.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lock_fd, 'r+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        path = directory / 'events.json'
        current = {'schema': 1, 'chainId': 'juno-1', 'events': {}}
        if path.exists() or path.is_symlink():
            info = path.lstat()
            if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_BYTES or info.st_mode & 0o077:
                raise ValueError('Unsafe upgrade checkpoint file')
            current = json.loads(path.read_text())
        validate(current)
        updated = mutate(copy.deepcopy(current))
        validate(updated)
        if updated.get('observedHeight', 0) < current.get('observedHeight', 0):
            raise ValueError('Cannot move governance watermark backwards')
        for identifier, old in current['events'].items():
            new = updated['events'].get(identifier)
            if new is None:
                raise ValueError('Cannot remove a known upgrade')
            if old.get('status') == 'closed' and new != old:
                raise ValueError('A closed upgrade archive is immutable')
            if old.get('status') == 'observing':
                for key in ('halt', 'deadline', 'validators', 'upgradeHeight', 'plan'):
                    if new.get(key) != old.get(key):
                        raise ValueError('Cannot alter an active observation anchor')
                if new.get('status') not in ('observing', 'closed'):
                    raise ValueError('Cannot reopen active observation governance')
                if new.get('scannedThrough', 0) < old.get('scannedThrough', 0):
                    raise ValueError('Cannot move scan watermark backwards')
        if updated == current and path.exists():
            return updated
        content = (json.dumps(updated, sort_keys=True, indent=2) + '\n').encode()
        if len(content) > MAX_BYTES:
            raise ValueError('Upgrade checkpoint size limit exceeded')
        fd, temporary = tempfile.mkstemp(prefix='.events-', dir=directory)
        try:
            with os.fdopen(fd, 'wb') as output:
                output.write(content)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, path)
            directory_fd = os.open(directory, os.O_DIRECTORY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
        finally:
            Path(temporary).unlink(missing_ok=True)
        return updated
