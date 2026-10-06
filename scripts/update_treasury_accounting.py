#!/usr/bin/env python3
"""Receipt-backed NNS income. Never infer whole-Treasury P&L from balances."""
import argparse
import base64
import json
import re
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlencode

from update_treasury_events import request_json

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'docs/deployments/nns-mainnet.json'
ARCHIVE = ROOT / 'docs/deployments/nns-mainnet-launch-receipts-2026-10-05.json'
OUTPUT = ROOT / 'data/treasury/neta-main-accounting.json'
RESTS = ('https://juno.api.m.stavr.tech', 'https://juno-api.polkachu.com')
START_HEIGHT = 42391393


def instant(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Timestamp has no timezone')
    return parsed


def positive(value):
    if not isinstance(value, str) or not re.fullmatch(r'[1-9][0-9]{0,38}', value):
        raise ValueError('Invalid positive integer')
    return int(value)


def decode(value):
    return json.loads(base64.b64decode(value, validate=True)) if isinstance(value, str) else value


def extract(receipt, manifest, source):
    """Match one top-level CW20 send, registry action and forwarding per msg_index.

    Nested/multi-payment messages are deliberately unsupported, never guessed.
    Successful provider receipts are observations, not light-client proofs.
    """
    if receipt.get('code') != 0:
        return []
    digest = receipt['txhash'].upper()
    if not re.fullmatch(r'[0-9A-F]{64}', digest):
        raise ValueError('Invalid transaction hash')
    timestamp = receipt['timestamp']
    paid_at = instant(timestamp).timestamp()
    height = int(receipt['height'])
    if height < START_HEIGHT:
        raise ValueError('Receipt predates registry')
    events = []
    for event in receipt.get('events', []):
        if event.get('type') != 'wasm':
            continue
        attrs = event['attributes']
        if len({a['key'] for a in attrs}) != len(attrs):
            raise ValueError('Ambiguous event attributes')
        events.append({a['key']: a['value'] for a in attrs})
    payments = [e for e in events if e.get('_contract_address') == manifest['registry']
                and e.get('action') in ('register_name', 'renew_name')]
    rows = []
    for event in payments:
        index = int(event['msg_index'])
        if index < 0:
            raise ValueError('Invalid message index')
        message = receipt['tx']['body']['messages'][index]
        if message.get('@type') != '/cosmwasm.wasm.v1.MsgExecuteContract' or message.get('contract') != manifest['token']:
            raise ValueError('Unsupported NNS payment message')
        send = decode(message['msg'])['send']
        raw = positive(send['amount'])
        operation = 'register' if event['action'] == 'register_name' else 'renew'
        hook = decode(send['msg'])
        offer = hook[operation + '_snapshot']['offer']
        quote, snapshot = offer['quote'], offer['snapshot']
        rate = positive(snapshot['usd_per_neta_12'])
        if (send['contract'] != manifest['registry'] or quote['operation'] != operation
                or quote['amount'] != str(raw) or event['amount'] != str(raw)
                or quote['payer'] != message['sender'] or quote['owner'] != event['owner']
                or quote['name'] != event['name'] or not re.fullmatch(r'[a-z0-9-]{3,32}\.neta', quote['name'])
                or quote['usd_per_neta_12'] != snapshot['usd_per_neta_12']
                or quote['signer_version'] != snapshot['signer_version']
                or not 1 <= int(quote['years']) <= 5
                or not snapshot['observed_at'] <= paid_at <= snapshot['expires_at']
                or not 0 < snapshot['expires_at'] - snapshot['observed_at'] <= 86400):
            raise ValueError('Payment, registry event and price binding disagree')
        related = [e for e in events if e.get('msg_index') == str(index)]
        if sum(e.get('_contract_address') == manifest['registry'] and e.get('action') in ('register_name', 'renew_name') for e in related) != 1:
            raise ValueError('Ambiguous multiple registry payments')
        def matches(action, sender, recipient):
            return [e for e in related if e.get('_contract_address') == manifest['token']
                    and e.get('action') == action and e.get('from') == sender
                    and e.get('to') == recipient and e.get('amount') == str(raw)]
        if len(matches('send', message['sender'], manifest['registry'])) != 1 or len(matches('transfer', manifest['registry'], manifest['treasury'])) != 1:
            raise ValueError('Exact NETA forwarding to Treasury is missing or ambiguous')
        rows.append({
            'id': f"{manifest['chain_id']}:{digest}:{index}", 'chain_id': manifest['chain_id'],
            'tx_hash': digest, 'message_index': index, 'height': height, 'timestamp': timestamp,
            'treasury_address': manifest['treasury'], 'registry': manifest['registry'],
            'category': 'nns_registration' if operation == 'register' else 'nns_renewal',
            'name': quote['name'], 'years': int(quote['years']), 'payer': message['sender'],
            'asset': 'NETA', 'token': manifest['token'], 'raw_amount': str(raw),
            'amount': str(Decimal(raw) / 10**6),
            'usd_value': f'{raw * rate // 10**18}.{raw * rate % 10**18:018d}',
            'valuation': {'method': 'executed-snapshot-rate', 'usd_per_neta_12': str(rate),
                          'observed_at': snapshot['observed_at'], 'expires_at': snapshot['expires_at'],
                          'note': 'Conversion rate accepted by the registry at payment; not a spot-price measurement.'},
            'evidence': source,
        })
    return rows


def scan(base, manifest):
    block = request_json(base + '/cosmos/base/tendermint/v1beta1/blocks/latest', timeout=15)
    header = (block.get('block') or block.get('sdk_block'))['header']
    if header['chain_id'] != manifest['chain_id']:
        raise ValueError('Wrong chain')
    age = datetime.now(timezone.utc).timestamp() - instant(header['time']).timestamp()
    if not -60 <= age <= 600:
        raise ValueError('Stale chain header')
    end = int(header['height']) - 20
    found, expected = {}, None
    # New registry: bounded full replay, at most 100 pages. No empty-index = zero claim.
    for page in range(1, 101):
        query = f"wasm._contract_address='{manifest['registry']}' AND tx.height>={START_HEIGHT} AND tx.height<={end}"
        params = {'query': query, 'page': page, 'limit': 100, 'order_by': 'ORDER_BY_ASC'}
        result = request_json(base + '/cosmos/tx/v1beta1/txs?' + urlencode(params), timeout=15)
        total = int(result['total'])
        if expected is not None and total != expected:
            raise ValueError('Index changed during scan')
        expected = total
        batch = result.get('tx_responses') or []
        if not batch:
            raise ValueError('Empty or truncated registry index')
        for tx in batch:
            if tx['txhash'] in found or not START_HEIGHT <= int(tx['height']) <= end:
                raise ValueError('Duplicate or out-of-range receipt')
            found[tx['txhash']] = tx
        if len(found) == expected:
            return found, {'provider': base, 'through_height': end, 'indexed_transactions': len(found)}
        if len(found) > expected:
            raise ValueError('Invalid page total')
    raise ValueError('Registry scan limit reached')


def reconcile_movements(event_data, ledger):
    """Attach already validated NNS receipts to exact Treasury legs; never double-count.

    Other transfers require reviewed purpose and payment-time pricing. Reconciliation
    is a receipt cross-reference, not an opening/closing balance reconciliation.
    """
    if (event_data.get('scope') != ledger['scope'] or event_data.get('treasuries') != [
            {'chain_id': ledger['chain_id'], 'address': ledger['treasury_address']}]):
        raise ValueError('Movement review identity mismatch')
    payments = {row['id']: row for row in ledger['entries']}
    matched, unresolved, review = set(), 0, []
    for event in event_data.get('events', []):
        if not event.get('timestamp') or instant(event['timestamp']) < instant('2026-10-01T00:00:00Z'):
            continue
        for index, movement in enumerate(event.get('movements', [])):
            key = f"{event['chain_id']}:{event['tx_hash']}:{movement.get('message_index')}"
            receipt = payments.get(key)
            item = {'id': f"{event['id']}:{index}", 'tx_hash': event['tx_hash'],
                    'timestamp': event['timestamp'], 'denom': movement['denom'],
                    'direction': movement['direction'], 'raw_amount': movement['raw_amount'],
                    'counterparty': movement['counterparty'], 'classification': 'unreviewed',
                    'usd_value': None, 'receipt_id': None}
            if receipt and (movement['direction'], movement['denom'], movement['raw_amount'], movement['counterparty']) == (
                    'in', 'cw20:' + ledger['token'], receipt['raw_amount'], ledger['registry']):
                if key in matched:
                    raise ValueError('Multiple Treasury legs match one income receipt')
                matched.add(key)
                item.update(classification=receipt['category'], usd_value=receipt['usd_value'], receipt_id=key)
            else:
                unresolved += 1
            review.append(item)
    return {'accounting_start': '2026-10-01T00:00:00Z', 'status': 'PARTIAL',
            'event_refresh_status': event_data.get('status', 'UNAVAILABLE'),
            'matched_receipts': len(matched), 'unmatched_receipt_ids': sorted(set(payments) - matched),
            'unreviewed_movements': unresolved, 'movements': review,
            'balance_reconciliation': 'UNAVAILABLE',
            'note': 'Receipt cross-reference only. Missing activity, funding, expenses, internal transfers and historical prices remain unresolved.'}


def collect(offline=False):
    manifest = json.loads(MANIFEST.read_text())
    dao = next(d for d in json.loads((ROOT / 'data/dao-directory.json').read_text())['daos'] if d['id'] == 'neta')
    if (manifest['chain_id'], manifest['treasury'], manifest['token']) != (dao['network'], dao['core'], dao['tokenContract']):
        raise ValueError('Accounting identity differs from directory')
    archive = json.loads(ARCHIVE.read_text())
    if archive['chain_id'] != manifest['chain_id']:
        raise ValueError('Archive chain mismatch')
    rows = {}
    previous = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    if previous and (previous.get('scope'), previous.get('treasury_address'), previous.get('registry')) != ('neta-main-dao', manifest['treasury'], manifest['registry']):
        raise ValueError('Prior accounting identity mismatch')
    for row in previous.get('entries', []):
        rows[row['id']] = row
    for tx in archive['transactions']:
        for row in extract(tx, manifest, {'kind': 'archived-provider-receipt', 'provider': archive['provider'], 'path': str(ARCHIVE.relative_to(ROOT))}):
            rows.setdefault(row['id'], row)
    warnings = ['Whole-Treasury history and expense classification are incomplete. Totals, result and missing categories are unavailable, not zero.',
                'NNS values are a subtotal of matched receipts, not a guarantee of complete registry history.']
    source, live = previous.get('source'), False
    if not offline:
        for base in RESTS:
            try:
                receipts, candidate_source = scan(base, manifest)
                parsed = {}
                for tx in receipts.values():
                    for row in extract(tx, manifest, {'kind': 'provider-receipt', 'provider': base}):
                        parsed[row['id']] = row
                if not set(rows).issubset(parsed):
                    raise ValueError('Index lost previously recorded income')
                for key, old in rows.items():
                    if any(old[field] != parsed[key][field] for field in ('raw_amount', 'usd_value', 'timestamp', 'category', 'token', 'treasury_address')):
                        raise ValueError('Previously recorded payment changed')
                rows, source, live = parsed, candidate_source, True
                break
            except Exception as error:
                warnings.append(f'{base}: receipt refresh unavailable ({type(error).__name__}); existing evidence retained.')
    checked = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    return {'schema_version': 1, 'scope': 'neta-main-dao', 'chain_id': manifest['chain_id'],
            'treasury_address': manifest['treasury'], 'registry': manifest['registry'], 'token': manifest['token'],
            'accounting_start': '2026-10-01T00:00:00Z', 'status': 'PARTIAL', 'refresh_status': 'completed' if live else 'unavailable',
            'checked_at': checked, 'last_success_at': checked if live else previous.get('last_success_at'),
            'source': source, 'warnings': warnings,
            'entries': sorted(rows.values(), key=lambda r: (r['timestamp'], r['id']))}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--offline', action='store_true', help='Use existing archived evidence only; never claim a live scan')
    args = parser.parse_args()
    data = collect(args.offline)
    temporary = OUTPUT.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(data, indent=2) + '\n')
    temporary.replace(OUTPUT)
    print(json.dumps({'entries': len(data['entries']), 'status': data['status'], 'refresh_status': data['refresh_status']}))
