#!/usr/bin/env python3
"""Build DAO-scoped accounting reviews from collector-owned receipt exports.

Known funding stays outside operating income. Unclassified payments block totals;
no current market quote, proposal title, direction or balance delta creates a P&L entry.
"""
import argparse
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
import json
from datetime import datetime, timezone
from pathlib import Path
from treasury_history import ACCOUNTING_START, instant
from update_treasury_events import now
from update_community_accounting import atomic

ROOT = Path(__file__).resolve().parents[1]


def build(dao, events, previous=None):
    config = dao['accountingSource']
    identity = {'scope': config['scope'], 'treasuries': config['treasuries']}
    for source in (events, previous):
        if source and any(source.get(k) != value for k, value in identity.items()):
            raise ValueError('Accounting source identity mismatch')
    if not isinstance(events.get('events'), list) or not isinstance(events.get('sources'), list):
        raise ValueError('Missing receipt collection')
    accounts = {(t['chain_id'], t['address']) for t in config['treasuries']}
    if len(accounts) != len(config['treasuries']): raise ValueError('Duplicate treasury account')
    movements, entries, seen, event_ids = [], [], set(), set()
    for event in events.get('events', []):
        if (event.get('chain_id'), event.get('treasury_address')) not in accounts:
            raise ValueError('Foreign treasury event')
        if event.get('id') in event_ids: raise ValueError('Duplicate treasury event')
        event_ids.add(event.get('id'))
        timestamp = event.get('timestamp')
        # Legacy archive exports have unknown timestamps; keep them untouched.
        # Only the date-bounded receipt adapter can establish post-cutoff coverage.
        if not timestamp:
            floors = [source.get('accounting_boundary', {}).get('height', 0) for source in events.get('sources', []) if source.get('chain_id') == event.get('chain_id')]
            if event.get('accounting_start') == ACCOUNTING_START or not floors or int(event.get('height', 0)) >= min(floors):
                raise ValueError('New receipt lacks timestamp')
            continue
        if instant(timestamp) < instant(ACCOUNTING_START): continue
        if event.get('status') == 'failed':
            if event.get('movements'): raise ValueError('Failed transaction has payment legs')
            continue
        if event.get('status') != 'confirmed': raise ValueError('Unconfirmed payment')
        for index, movement in enumerate(event.get('movements', [])):
            uid = f"{event['id']}:{index}"
            if uid in seen: raise ValueError('Duplicate Treasury leg')
            seen.add(uid)
            raw = movement['raw_amount']
            if not isinstance(raw, str) or not raw.isdigit() or int(raw) <= 0:
                raise ValueError('Invalid payment amount')
            if movement['direction'] not in ('in', 'out'): raise ValueError('Invalid movement direction')
            row = {'id': uid, 'chain_id': event['chain_id'], 'treasury_address': event['treasury_address'],
                   'tx_hash': event['tx_hash'], 'timestamp': timestamp, 'height': event['height'],
                   'message_index': movement.get('message_index'), 'denom': movement['denom'],
                   'asset': movement.get('asset', movement['denom']), 'amount': movement.get('amount'),
                   'direction': movement['direction'], 'raw_amount': raw,
                   'counterparty': movement['counterparty'], 'classification': 'unreviewed',
                   'usd_value': None, 'receipt_id': None}
            # Funding is protocol-evidenced only for the native CP adapter.
            if dao['id'] == 'juno' and movement.get('classification') == 'funding' and movement['direction'] == 'in':
                row.update(classification='funding', receipt_id=uid)
                entries.append({**row, 'category': 'funding', 'evidence': event['evidence']})
            movements.append(row)
    gaps = list(events.get('coverage_gaps', []))
    if dao['id'] == 'juno' and not gaps:
        raise ValueError('Native module coverage must remain explicit')
    source_accounts = {(s.get('chain_id'), s.get('address')) for s in events.get('sources', [])}
    sources_ok = source_accounts == accounts and len(events.get('sources', [])) == len(accounts) and all(
        s.get('adapter') == 'cosmos-rest-receipts' and s.get('accounting_start') == ACCOUNTING_START
        and s.get('last_scanned_height', 0) > 0 and s.get('anchor_hash') for s in events.get('sources', []))
    stamp = events.get('last_success_at') or events.get('generated_at')
    age = (datetime.now(timezone.utc) - instant(stamp)).total_seconds() if stamp else float('inf')
    completed = events.get('status') == 'PARTIAL' and sources_ok and -60 <= age <= 7200
    # Retained classified records may not disappear or silently change on replay.
    current = {row['id']: row for row in entries}
    for old in (previous or {}).get('entries', []):
        if old['id'] not in current or any(old[k] != current[old['id']][k] for k in
                ('timestamp', 'raw_amount', 'denom', 'category', 'usd_value', 'treasury_address')):
            raise ValueError('Previously recorded accounting receipt changed or disappeared')
    unresolved = sum(m['classification'] == 'unreviewed' for m in movements)
    return {'schema_version': 2, 'dao_id': dao['id'], **identity, 'chain_id': dao['network'],
            'accounting_start': ACCOUNTING_START, 'adapter': config['adapter'],
            'status': 'PARTIAL', 'refresh_status': 'completed' if completed else 'unavailable',
            'checked_at': now(), 'last_success_at': stamp if completed else (previous or {}).get('last_success_at'),
            'sources': events.get('sources', []), 'coverage_gaps': gaps,
            'execution_candidates': events.get('execution_candidates', []),
            'warnings': events.get('warnings', []), 'entries': entries,
            'movement_review': {'accounting_start': ACCOUNTING_START, 'status': 'PARTIAL',
                'event_refresh_status': events.get('status'), 'matched_receipts': len(entries),
                'unmatched_receipt_ids': [], 'unreviewed_movements': unresolved, 'movements': movements,
                'balance_reconciliation': 'UNAVAILABLE',
                'note': 'Recorded receipts only. Unknown purpose or missing payment-time valuation blocks period totals.'}}


def collect_sources():
    def task(item):
        script, filename = item
        path = ROOT / 'data/treasury' / filename
        try:
            result = subprocess.run([sys.executable, str(ROOT / 'scripts' / script)],
                                    cwd=ROOT, capture_output=True, text=True, timeout=240, check=True)
            print(result.stdout[-2000:])
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
            print(f'::warning::{script}: refresh unavailable ({type(error).__name__})')
            if path.exists():
                data = json.loads(path.read_text())
                data.update(status='UNAVAILABLE', checked_at=now(), warnings=['Latest collector failed; prior evidence retained.'])
                atomic(path, data)
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(task, [('update_treasury_events.py', 'events.json'),
                             ('update_community_accounting.py', 'juno-community-events.json')]))


def run():
    daos = json.loads((ROOT / 'data/dao-directory.json').read_text())['daos']
    for dao in daos:
        config = dao.get('accountingSource', {})
        if config.get('adapter') not in ('treasury-receipts', 'native-community-pool'): continue
        path = ROOT / 'data/treasury' / config['file']
        previous = json.loads(path.read_text()) if path.exists() else None
        try:
            data = build(dao, json.loads((ROOT / 'data/treasury' / dao['events']).read_text()), previous)
        except Exception as error:
            data = {**(previous or {}), 'schema_version': 2, 'dao_id': dao['id'], 'scope': config['scope'],
                    'chain_id': dao['network'], 'treasuries': config['treasuries'], 'adapter': config['adapter'],
                    'accounting_start': ACCOUNTING_START, 'status': 'PARTIAL', 'refresh_status': 'unavailable',
                    'checked_at': now(), 'warnings': [f'Refresh failed; retained evidence: {type(error).__name__}: {error}'],
                    'entries': (previous or {}).get('entries', [])}
        atomic(path, data)
        print(json.dumps({'dao': dao['id'], 'refresh_status': data['refresh_status'],
                          'entries': len(data['entries']), 'unreviewed': data.get('movement_review', {}).get('unreviewed_movements')}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--collect', action='store_true'); args = parser.parse_args()
    if args.collect: collect_sources()
    run()
