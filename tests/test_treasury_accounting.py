import copy
import importlib.util
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('accounting', ROOT / 'scripts/update_treasury_accounting.py')
accounting = importlib.util.module_from_spec(spec)
spec.loader.exec_module(accounting)


class AccountingTests(unittest.TestCase):
    def setUp(self):
        self.manifest = json.loads(accounting.MANIFEST.read_text())
        self.tx = json.loads(accounting.ARCHIVE.read_text())['transactions'][-1]

    def rows(self, tx=None):
        return accounting.extract(tx or self.tx, self.manifest, {'kind': 'test'})

    def test_real_receipt_and_frozen_usd_not_buyer_gas(self):
        rows = self.rows()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['raw_amount'], '4755098')
        self.assertEqual(rows[0]['usd_value'], '5.000000976594010594')
        self.assertEqual(rows[0]['category'], 'nns_registration')
        self.assertEqual(rows[0]['treasury_address'], self.manifest['treasury'])

    def test_failed_receipt_and_plain_transfer_are_not_income(self):
        self.tx['code'] = 5
        self.assertEqual(self.rows(), [])
        self.tx['code'] = 0
        self.tx['events'] = [e for e in self.tx['events'] if not any(a['value'] == 'register_name' for a in e['attributes'])]
        self.assertEqual(self.rows(), [])

    def test_missing_wrong_or_duplicate_forwarding_rejected(self):
        for mutation in ('missing', 'wrong', 'duplicate'):
            tx = copy.deepcopy(self.tx)
            event = next(e for e in tx['events'] if any(a['value'] == 'transfer' for a in e['attributes']) and any(a['value'] == self.manifest['token'] for a in e['attributes']))
            if mutation == 'missing': tx['events'].remove(event)
            if mutation == 'duplicate': tx['events'].append(copy.deepcopy(event))
            if mutation == 'wrong':
                next(a for a in event['attributes'] if a['key'] == 'to')['value'] = 'wrong'
            with self.assertRaises(ValueError): self.rows(tx)

    def test_wrong_token_and_duplicate_payment_rejected(self):
        tx = copy.deepcopy(self.tx)
        tx['tx']['body']['messages'][0]['contract'] = 'wrong'
        with self.assertRaises(ValueError): self.rows(tx)
        tx = copy.deepcopy(self.tx)
        event = next(e for e in tx['events'] if any(a['value'] == 'register_name' for a in e['attributes']))
        tx['events'].append(copy.deepcopy(event))
        with self.assertRaises(ValueError): self.rows(tx)

    def test_price_binding_and_renewal(self):
        import base64
        tx = copy.deepcopy(self.tx)
        send = tx['tx']['body']['messages'][0]['msg']['send']
        hook = json.loads(base64.b64decode(send['msg']))
        payload = hook['register_snapshot']
        payload['offer']['quote']['operation'] = 'renew'
        send['msg'] = base64.b64encode(json.dumps({'renew_snapshot': payload}).encode()).decode()
        for e in tx['events']:
            for a in e['attributes']:
                if a['value'] == 'register_name': a['value'] = 'renew_name'
        self.assertEqual(self.rows(tx)[0]['category'], 'nns_renewal')
        payload['offer']['snapshot']['usd_per_neta_12'] = '2000000000000'
        send['msg'] = base64.b64encode(json.dumps({'renew_snapshot': payload}).encode()).decode()
        with self.assertRaises(ValueError): self.rows(tx)

    def test_outage_retains_archive_without_complete_period_claim(self):
        with patch.object(accounting, 'scan', side_effect=OSError('offline')):
            data = accounting.collect()
        self.assertEqual(data['status'], 'PARTIAL')
        self.assertEqual(data['refresh_status'], 'unavailable')
        self.assertEqual(len(data['entries']), 1)

    def test_scan_truncation_and_wrong_chain(self):
        header = {'block': {'header': {'chain_id': 'wrong'}}}
        with patch.object(accounting, 'request_json', return_value=header):
            with self.assertRaises(ValueError): accounting.scan('https://example.test', self.manifest)
        header['block']['header'] = {'chain_id': 'juno-1', 'height': '42410000', 'time': accounting.datetime.now(accounting.timezone.utc).isoformat()}
        with patch.object(accounting, 'request_json', side_effect=[header, {'total': '2', 'tx_responses': [self.tx]}, {'total': '2', 'tx_responses': []}]):
            with self.assertRaises(ValueError): accounting.scan('https://example.test', self.manifest)


if __name__ == '__main__': unittest.main()
