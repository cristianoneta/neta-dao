#!/usr/bin/env python3
"""Refresh every configured membership adapter independently; preserve good data."""
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from evidence_archive import atomic_json

ROOT = Path(__file__).resolve().parents[1]


def run(dao):
    try:
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/update_dao_directory.py'),
                                 '--dao', dao['id']], cwd=ROOT, capture_output=True, text=True,
                                timeout=540, check=True)
        print(result.stdout, flush=True)
        return dao['id'], {'status': 'completed'}
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        print(f'::warning::{dao["id"]}: membership refresh unavailable; prior snapshot retained. {error}', flush=True)
        if isinstance(error, subprocess.CalledProcessError):
            print(error.stdout, error.stderr, flush=True)
        return dao['id'], {'status': 'unavailable',
                          'note': 'Refresh failed; previous verified snapshot retained if available.'}


def main():
    daos = [dao for dao in json.loads((ROOT / 'data/dao-directory.json').read_text())['daos']
            if dao.get('membershipSource')]
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = dict(pool.map(run, daos))
    data = {'checked_at': datetime.now(timezone.utc).isoformat(), 'daos': results}
    path = ROOT / 'data/daos/membership-status.json'
    atomic_json(path, data, mode=0o644)
    print(json.dumps(data), flush=True)
    return 0 if all(result['status'] == 'completed' for result in results.values()) else 1


if __name__ == '__main__':
    raise SystemExit(main())
