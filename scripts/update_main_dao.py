#!/usr/bin/env python3
"""Bound independent main DAO reads and retain prior snapshots on failure."""
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
TASKS = {
    'accounting': ('update_treasury_accounting.py', [], 150),
    'balances': ('update_treasury.py', ['--dao', 'neta'], 300),
    'events': ('update_treasury_events.py', ['--dao', 'neta'], 150),
}

def run(item):
    name, (script, args, timeout) = item
    try:
        result = subprocess.run([sys.executable, str(ROOT / 'scripts' / script), *args], cwd=ROOT,
                                capture_output=True, text=True, timeout=timeout, check=True)
        print(f'{name}: {result.stdout.strip()}')
        return name, {'status': 'completed'}
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        print(f'::warning::{name} collection failed; retaining its previous verified snapshot: {error}')
        return name, {'status': 'unavailable', 'note': 'Refresh failed; previous verified snapshot retained.'}

def main():
    with ThreadPoolExecutor(max_workers=3) as pool:
        status = dict(pool.map(run, TASKS.items()))
    status['checked_at'] = datetime.now(timezone.utc).isoformat()
    # Event collector can finish successfully with explicit unavailable coverage.
    event_path = ROOT / 'data/treasury/neta-main-events.json'
    if event_path.exists():
        event_data = json.loads(event_path.read_text())
        if event_data.get('status') == 'UNAVAILABLE':
            status['events']['status'] = 'unavailable'
    accounting_path = ROOT / 'data/treasury/neta-main-accounting.json'
    if accounting_path.exists() and json.loads(accounting_path.read_text()).get('refresh_status') != 'completed':
        status['accounting']['status'] = 'unavailable'
    path = ROOT / 'data/daos/neta-status.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(status, indent=2) + '\n')
    print(json.dumps(status))

if __name__ == '__main__':
    main()
