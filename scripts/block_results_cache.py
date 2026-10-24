"""Optional bounded cache shared by the two read-only block collectors.

Only height-addressed block_results are cached. Consumers still check their
headers, checkpoints, identities and event semantics. Never cache latest state,
authentication, signing, failed RPC responses or a different provider's result.
Cache corruption/unavailability is a miss, not permission to skip collection.
"""
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import threading
import time
import zlib

MAX_RAW = 8 * 1024 * 1024
MAX_STORED = 128 * 1024 * 1024
TTL = 2 * 60 * 60
_counts = {'hits': 0, 'misses': 0, 'errors': 0, 'writes': 0}
_lock = threading.Lock()


def count(key):
    with _lock:
        _counts[key] += 1


def metrics():
    with _lock:
        return dict(_counts)


class Cache:
    def __init__(self, root, now=time.time, max_stored=MAX_STORED):
        self.root, self.now, self.max_stored = Path(root).absolute(), now, max_stored

    def connect(self):
        path = self.root / 'block-results.sqlite3'
        if any(p.is_symlink() for p in (path, *path.parents)):
            raise ValueError('Cache symlink')
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        db = sqlite3.connect(path, timeout=0.2)
        try:
            db.executescript('''PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
              PRAGMA journal_size_limit=8388608;
              CREATE TABLE IF NOT EXISTS results (
                provider TEXT NOT NULL, chain TEXT NOT NULL, height INTEGER NOT NULL,
                expires REAL NOT NULL, payload BLOB NOT NULL, digest TEXT NOT NULL,
                PRIMARY KEY(provider,chain,height));
              CREATE INDEX IF NOT EXISTS expiry ON results(expires);''')
            # Include SQLite overhead; cache writes fail harmlessly at this bound.
            size = db.execute('PRAGMA page_size').fetchone()[0]
            db.execute(f'PRAGMA max_page_count={256 * 1024 * 1024 // size}')
            return db
        except BaseException:
            db.close()
            raise

    def get(self, provider, chain, height):
        db = self.connect()
        try:
            row = db.execute('SELECT payload,digest FROM results WHERE provider=? AND chain=? AND height=? AND expires>?',
                             (provider, chain, height, self.now())).fetchone()
            if not row:
                return None
            decoder = zlib.decompressobj()
            raw = decoder.decompress(row[0], MAX_RAW + 1)
            if len(raw) > MAX_RAW or not decoder.eof or decoder.unused_data or hashlib.sha256(raw).hexdigest() != row[1]:
                raise ValueError('Invalid cache payload')
            value = json.loads(raw)
            if not isinstance(value, dict) or str(value.get('height')) != str(height):
                raise ValueError('Cached block height differs')
            return value
        finally:
            db.close()

    def put(self, provider, chain, height, value):
        if type(height) is not int or height < 1 or not isinstance(value, dict) or str(value.get('height')) != str(height):
            raise ValueError('Cache accepts only exact block results')
        raw = json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
        if len(raw) > MAX_RAW:
            raise ValueError('Cache result too large')
        payload = zlib.compress(raw)
        if len(payload) > self.max_stored:
            return
        db = self.connect()
        try:
            with db:
                db.execute('DELETE FROM results WHERE expires<=?', (self.now(),))
                db.execute('INSERT OR REPLACE INTO results VALUES (?,?,?,?,?,?)',
                           (provider, chain, height, self.now() + TTL, payload, hashlib.sha256(raw).hexdigest()))
                # Small cache, bounded byte inventory. Evict oldest results only.
                total = db.execute('SELECT coalesce(sum(length(payload)),0) FROM results').fetchone()[0]
                if total > self.max_stored:
                    for rowid, size in db.execute('SELECT rowid,length(payload) FROM results ORDER BY expires,rowid').fetchall():
                        db.execute('DELETE FROM results WHERE rowid=?', (rowid,))
                        total -= size
                        if total <= self.max_stored:
                            break
        finally:
            db.close()


def get(provider, chain, height):
    root = os.environ.get('COSMOOT_BLOCK_CACHE_DIRECTORY')
    if not root:
        return None
    try:
        value = Cache(root).get(provider, chain, height)
        count('hits' if value is not None else 'misses')
        return value
    except (OSError, ValueError, sqlite3.Error, zlib.error):
        count('errors')
        return None


def put(provider, chain, height, value):
    root = os.environ.get('COSMOOT_BLOCK_CACHE_DIRECTORY')
    if not root:
        return
    try:
        Cache(root).put(provider, chain, height, value)
        count('writes')
    except (OSError, ValueError, sqlite3.Error):
        count('errors')
