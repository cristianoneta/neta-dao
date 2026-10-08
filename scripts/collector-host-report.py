"""Bounded read-only host inventory. No environment, key, database or journal reads.

Run from reviewed source; the output is a private operator record, not CI evidence.
This never installs source, reloads systemd, starts collectors or changes timers.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import time
from server_job_status import check as check_jobs
from server_source_status import check as check_sources

TIMERS = ['cosmoot-' + name + '.timer' for name in ('treasury', 'main', 'members', 'health')]
SERVICES = ['cosmoot-collect@' + name + '.service' for name in ('treasury', 'main', 'members')] + ['cosmoot-health.service']
PROPERTIES = ['Id', 'LoadState', 'ActiveState', 'SubState', 'UnitFileState', 'Result',
              'ExecMainStatus', 'NextElapseUSecRealtime', 'LastTriggerUSec']


def units():
    try:
        result = subprocess.run(['systemctl', 'show', '--no-pager', '--property=' + ','.join(PROPERTIES),
                                 *TIMERS, *SERVICES], capture_output=True, text=True, timeout=15)
        if result.returncode:
            return {'available': False, 'reason': 'systemd-query-failed'}
        records = []
        for block in result.stdout.strip().split('\n\n'):
            row = dict(line.split('=', 1) for line in block.splitlines() if '=' in line)
            records.append({key: value for key, value in row.items() if key in PROPERTIES})
        if (len(records) != len(TIMERS + SERVICES)
                or {row.get('Id') for row in records} != set(TIMERS + SERVICES)
                or any(not {'LoadState', 'ActiveState', 'SubState'} <= row.keys() for row in records)):
            return {'available': False, 'reason': 'systemd-response-incomplete'}
        return {'available': True, 'units': records}
    except (OSError, subprocess.TimeoutExpired):
        return {'available': False, 'reason': 'systemd-query-unavailable'}


def report(repo, state, snapshots):
    fingerprints = {}
    for name in ('scripts/run-server-collector.py', 'scripts/server_job_status.py',
                 'scripts/server_source_status.py', 'scripts/publish-server-snapshots.py'):
        path = Path(repo) / name
        try:
            fingerprints[name] = hashlib.sha256(path.read_bytes()).hexdigest()
        except OSError:
            fingerprints[name] = None
    return {'checkedAt': int(time.time()), 'systemd': units(), 'code': fingerprints,
            'processes': check_jobs(state), 'published': check_sources(snapshots),
            'scope': 'Read-only inventory, not activation or backup acceptance; keep this report private.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', default='/srv/cosmoot/collectors/repo')
    parser.add_argument('--state', default='/var/lib/cosmoot-collect')
    parser.add_argument('--snapshots', default='/srv/cosmoot/public-snapshots/current')
    args = parser.parse_args()
    # Inventory succeeds even when it reports missing/inactive components.
    print(json.dumps(report(args.repo, args.state, args.snapshots), indent=2))
