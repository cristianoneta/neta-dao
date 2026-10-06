import copy
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import treasury_history as history
import update_treasury_events as events
import update_treasury_accounting as accounting


class ReceiptHistoryTests(unittest.TestCase):
    def setUp(self):
        self.manifest = json.loads(accounting.MANIFEST.read_text())
        self.tx = json.loads(accounting.ARCHIVE.read_text())['transactions'][-1]
        self.chain = {**events.CHAINS[0], 'address': self.manifest['treasury']}

    def test_empty_query_is_valid_but_truncation_and_duplicate_are_not(self):
        get = lambda *a, **k: {'total': '0', 'tx_responses': []}
        self.assertEqual(history.search(get, 'base', 'transfer.recipient', 'a', 1, 99), {})
        for data in ({'total':'1','tx_responses':[]}, {'total':'2','tx_responses':[self.tx,self.tx]}):
            with self.assertRaises(ValueError):
                history.search(lambda *a, **k: data,'base','wasm.to','a',1,50_000_000)

    def test_scan_floor_is_before_exact_october_cutoff(self):
        cutoff = history.instant(history.ACCOUNTING_START)
        def get_block(get, base, height, chain):
            return {'height': str(height), 'hash': 'A'*64,
                    'time': (cutoff + timedelta(seconds=int(height)-250000)).isoformat()}
        with patch.object(history, 'block', side_effect=get_block):
            result = history.boundary(None, 'base', self.chain, get_block(None,None,300000,None), None)
        self.assertLessEqual(result['height'],250000)
        self.assertEqual(result['kind'],'scan-floor-before-start')
        self.assertEqual(result['start_at'],history.ACCOUNTING_START)

    def test_all_indexes_scanned_despite_empty_native_probe(self):
        tip = {'height':'42420000','time':datetime.now(timezone.utc).isoformat(),'hash':'A'*64}
        def search(get,base,key,address,start,end):
            return {self.tx['txhash']:self.tx} if key == 'wasm.to' else {}
        with patch.object(history,'block',return_value=tip), patch.object(history,'boundary',return_value={'height':42000000,'hash':'B'*64,'start_at':history.ACCOUNTING_START}), patch.object(history,'search',side_effect=search) as calls:
            found, source = history.scan(None,'base',self.chain,[])
        self.assertEqual(len(found),1)
        self.assertEqual(calls.call_count,len(history.QUERY_KEYS))
        self.assertFalse(source['incremental'])
        self.assertEqual(source['coverage'],'provider-index-only')

    def test_lost_prior_receipt_and_stale_tip_fail(self):
        tip={'height':'42420000','time':datetime.now(timezone.utc).isoformat(),'hash':'A'*64}
        with patch.object(history,'block',return_value=tip), patch.object(history,'boundary',return_value={'height':42000000}), patch.object(history,'search',return_value={}):
            with self.assertRaisesRegex(ValueError,'lost recorded'):
                history.scan(None,'base',self.chain,[{'height':42400450,'tx_hash':self.tx['txhash']}])
        tip['time']='2026-01-01T00:00:00Z'
        with patch.object(history,'block',return_value=tip):
            with self.assertRaisesRegex(ValueError,'Stale'):
                history.scan(None,'base',self.chain,[])

    def test_incremental_overlap_and_daily_full_replay(self):
        tip={'height':'42420000','time':datetime.now(timezone.utc).isoformat(),'hash':'A'*64}
        source={'adapter':'cosmos-rest-receipts','last_scanned_height':42410000,'anchor_hash':'A'*64,
                'last_full_replay_day':datetime.now(timezone.utc).date().isoformat()}
        with patch.object(history,'block',return_value=tip), patch.object(history,'boundary',return_value={'height':42000000}), patch.object(history,'search',return_value={}):
            _, result=history.scan(None,'base',self.chain,[],source)
            self.assertEqual(result['scan_start_height'],42409900)
            self.assertTrue(result['incremental'])
            source['last_full_replay_day']='2026-01-01'
            _, result=history.scan(None,'base',self.chain,[],source)
            self.assertEqual(result['scan_start_height'],42000000)
            self.assertFalse(result['incremental'])

    def test_exact_nns_leg_linked_once_unknown_transfers_left_open(self):
        chain={**self.chain,'cw20_tokens':{self.manifest['token']:{'symbol':'NETA','decimals':6}}}
        tx={'hash':self.tx['txhash'],'height':self.tx['height'],'tx_result':{'events':self.tx['events']}}
        row=events.normalize(tx,self.tx['timestamp'],{},chain)
        ledger={'scope':'neta-main-dao','chain_id':'juno-1','treasury_address':self.manifest['treasury'],
                'registry':self.manifest['registry'],'token':self.manifest['token'],
                'entries':accounting.extract(self.tx,self.manifest,{'kind':'fixture'})}
        data={'scope':'neta-main-dao','treasuries':[{'chain_id':'juno-1','address':self.manifest['treasury']}],
              'status':'PARTIAL','events':[row]}
        review=accounting.reconcile_movements(data,ledger)
        self.assertEqual(review['matched_receipts'],1)
        self.assertEqual(review['unreviewed_movements'],0)
        self.assertEqual(review['movements'][0]['usd_value'],'5.000000976594010594')
        row['movements'][0]['counterparty']='unknown'
        review=accounting.reconcile_movements(data,ledger)
        self.assertEqual(review['matched_receipts'],0)
        self.assertEqual(review['unreviewed_movements'],1)
        self.assertIsNone(review['movements'][0]['usd_value'])
        row['movements'][0]['counterparty']=self.manifest['registry']
        row['movements'].append(copy.deepcopy(row['movements'][0]))
        with self.assertRaisesRegex(ValueError,'Multiple Treasury legs'):
            accounting.reconcile_movements(data,ledger)

    def test_corrupt_or_foreign_history_cannot_reset_collection(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'events.json'
            path.write_text('{invalid')
            with self.assertRaises(json.JSONDecodeError): events.load_existing(path)
        with patch.object(events, 'load_existing', return_value={'scope':'wrong', 'events':[{}]}):
            with self.assertRaisesRegex(ValueError,'identity mismatch'):
                events.collect()

    def test_failed_receipts_cannot_create_transfer_rows(self):
        tx=copy.deepcopy(self.tx);tx['code']=5
        with patch.object(events,'receipt_scan',return_value=({tx['txhash']:tx},{})):
            rows,_=events.collect_receipt_chain(self.chain,[],{}, {})
        self.assertEqual(rows[0]['status'],'failed')
        self.assertEqual(rows[0]['movements'],[])

    def test_changed_movement_preserves_old_ledger(self):
        old={'chain_id':'juno-1','tx_hash':self.tx['txhash'],'height':42400450,
             'timestamp':self.tx['timestamp'],'movements':[{'raw_amount':'999','denom':'ujuno'}]}
        with patch.object(events,'receipt_scan',return_value=({self.tx['txhash']:self.tx},{})):
            with self.assertRaisesRegex(RuntimeError,'recorded movement changed'):
                events.collect_receipt_chain(self.chain,[old],{}, {})
        self.assertEqual(old['movements'][0]['raw_amount'],'999')

if __name__ == '__main__': unittest.main()
