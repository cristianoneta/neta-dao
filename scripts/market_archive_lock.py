"""Bounded coordination with other archive writers and encrypted backups."""
import fcntl
import math
import sys
import time

ARCHIVE_LOCK_WAIT_SECONDS = 60


def acquire_archive_lock(handle, timeout=ARCHIVE_LOCK_WAIT_SECONDS):
    """Keep the existing lock inode and exclusive protection while waiting."""
    if not math.isfinite(timeout) or timeout < 0:
        raise ValueError('Archive lock timeout must be finite and nonnegative')
    started = time.monotonic()
    deadline = started + timeout
    waiting = False
    while True:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            if waiting:
                print(f'Archive lock acquired after {time.monotonic() - started:.2f}s',
                      file=sys.stderr, flush=True)
            return
        except BlockingIOError as error:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError(
                    f'Shared archive lock remained busy for {timeout:g}s; '
                    'publication deferred, collected observations retained'
                ) from error
            if not waiting:
                print(f'Waiting up to {timeout:g}s for the shared archive lock',
                      file=sys.stderr, flush=True)
                waiting = True
            time.sleep(min(0.25, remaining))
