"""Immutable, bounded local evidence bundles. No network, credentials or pruning.

The SHA-256 names the canonical uncompressed document. A successful write means
fsync plus read-back verification, not independent retention or chain truth.
"""
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tempfile

MAX_BYTES = 64 * 1024 * 1024
MIN_FREE = 512 * 1024 * 1024


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def directory(path):
    path = Path(path).absolute()
    for item in (path, *path.parents):
        if item.is_symlink():
            raise ValueError('Archive directory must not contain symlinks')
    for item in reversed((path, *path.parents)):
        if not item.exists():
            item.mkdir(mode=0o700)
            sync_directory(item.parent)
        elif not item.is_dir():
            raise ValueError('Archive parent is not a directory')
    return path


def sync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def atomic_json(path, value, mode=0o600):
    path = Path(path)
    if path.is_symlink():
        raise ValueError('Refusing JSON symlink')
    raw = json.dumps(value, indent=2, sort_keys=True, allow_nan=False).encode() + b'\n'
    fd, temporary = tempfile.mkstemp(prefix='.' + path.name + '-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            os.fchmod(stream.fileno(), mode)
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        sync_directory(path.parent)
    finally:
        Path(temporary).unlink(missing_ok=True)


def read_bundle(path):
    path = Path(path)
    if not re.fullmatch(r'[0-9a-f]{64}\.json\.gz', path.name):
        raise ValueError('Invalid archive digest filename')
    with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW), 'rb') as stream:
        with gzip.GzipFile(fileobj=stream) as compressed:
            raw = compressed.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES or hashlib.sha256(raw).hexdigest() != path.name[:64]:
        raise ValueError('Archive size or digest mismatch')
    value = json.loads(raw)
    if not isinstance(value, dict) or value.get('archiveSchema') != 1 or canonical(value) != raw:
        raise ValueError('Unsupported or noncanonical archive')
    return value


def store(root, kind, payload):
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,63}', kind):
        raise ValueError('Invalid archive kind')
    raw = canonical({'archiveSchema': 1, 'kind': kind, 'payload': payload})
    if len(raw) > MAX_BYTES:
        raise ValueError('Archive bundle too large')
    digest = hashlib.sha256(raw).hexdigest()
    target_dir = directory(Path(root) / kind)
    path = target_dir / (digest + '.json.gz')
    packed = gzip.compress(raw, mtime=0)
    if shutil.disk_usage(target_dir).free < MIN_FREE + len(packed):
        raise OSError('Archive needs 512 MiB free reserve; original evidence retained')
    fd, temporary = tempfile.mkstemp(prefix='.pending-', dir=target_dir)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(packed)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            os.link(temporary, path)  # Never overwrite a prior/corrupt bundle.
        except FileExistsError:
            pass
        sync_directory(target_dir)
        if canonical(read_bundle(path)) != raw:
            raise ValueError('Archive read-back differs from source')
    finally:
        Path(temporary).unlink(missing_ok=True)
    return {'path': kind + '/' + path.name, 'sha256': digest, 'decodedBytes': len(raw)}
