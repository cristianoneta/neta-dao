import copy
import json
import sys
import tempfile
import unittest
import io
from concurrent.futures import ThreadPoolExecutor
from urllib.error import HTTPError
from urllib.parse import urlparse
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

    def test_archive_requests_share_a_rate_limit_across_query_workers(self):
        clock, waits = [100.0], []
        def sleep(delay):
            waits.append(delay)
            clock[0] += delay
        with patch.object(events, '_archive_next_request', 0.0), \
                patch.object(events.time, 'monotonic', side_effect=lambda: clock[0]), \
                patch.object(events.time, 'sleep', side_effect=sleep), \
                patch.object(events.urllib.request, 'urlopen', side_effect=lambda *a, **k: io.BytesIO(b'{}')):
            with ThreadPoolExecutor(max_workers=3) as pool:
                result = list(pool.map(events.request_json, ['https://lcd.archive.osmosis.zone/test'] * 8))
            self.assertEqual(result, [{}] * 8)
            self.assertEqual(waits, [0.25] * 7)
            events.request_json('https://juno.example.org/test')
            self.assertEqual(len(waits), 7)

    def test_operations_replay_uses_archive_when_other_sources_prune_the_floor(self):
        chain = {**events.CHAINS[1], 'creation_height': 1}
        start = {'start_at': history.ACCOUNTING_START, 'height': 100,
                 'hash': 'A'*64, 'timestamp': '2026-09-27T06:03:24Z',
                 'kind': 'scan-floor-before-start'}
        source = {'chain_id': chain['id'], 'address': chain['address'],
                  'adapter': 'cosmos-rest-receipts', 'accounting_boundary': start,
                  'last_scanned_height': 400, 'anchor_hash': 'B'*64,
                  'last_full_replay_day': '2026-10-01',
                  'query_pairs': [[key, chain['address']] for key in history.QUERY_KEYS]}
        old = {'chain_id': chain['id'], 'tx_hash': 'C'*64, 'height': 50,
               'timestamp': '2026-09-01T00:00:00Z', 'movements': []}
        original = copy.deepcopy((old, source))
        requests = []
        def get(url, **kwargs):
            requests.append(url)
            if urlparse(url).netloc != 'lcd.archive.osmosis.zone':
                raise HTTPError(url, 500, 'height is not available, lowest height is 450', {}, None)
            path = urlparse(url).path
            if path.endswith('/txs'):
                return {'total': '0', 'tx_responses': []}
            height = path.rsplit('/', 1)[-1]
            height = 500 if height == 'latest' else int(height)
            return {'block_id': {'hash': start['hash'] if height == 100 else 'B'*64},
                    'block': {'header': {'chain_id': chain['id'], 'height': str(height),
                       'time': start['timestamp'] if height == 100 else datetime.now(timezone.utc).isoformat()}}}
        with patch.object(events, 'request_json', side_effect=get):
            rows, coverage = events.collect_receipt_chain(chain, [old], {}, {}, source)
        self.assertEqual(rows, [old])
        self.assertEqual((old, source), original)
        self.assertEqual(coverage['accounting_boundary'], start)
        self.assertEqual(coverage['scan_start_height'], start['height'])
        self.assertEqual(coverage['last_scanned_height'], 480)
        self.assertFalse(coverage['incremental'])
        self.assertEqual(coverage['last_full_replay_day'], datetime.now(timezone.utc).date().isoformat())
        self.assertEqual(sum(urlparse(u).path.endswith('/txs') for u in requests), len(history.QUERY_KEYS))
        # Archive loss must still fail without dropping evidence or advancing its cursor.
        with patch.object(events, 'request_json', side_effect=HTTPError('fixture', 500, 'pruned', {}, None)):
            with self.assertRaisesRegex(RuntimeError, 'Receipt refresh unavailable'):
                events.collect_receipt_chain(chain, [old], {}, {}, source)
        self.assertEqual((old, source), original)
        # An archive that returns a conflicting original floor is not a recovery.
        changed = {**source, 'accounting_boundary': {**start, 'hash': 'D'*64}}
        with patch.object(events, 'request_json', side_effect=get):
            with self.assertRaisesRegex(RuntimeError, 'Accounting scan floor changed'):
                events.collect_receipt_chain(chain, [old], {}, {}, changed)

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
        source={'chain_id':self.chain['id'],'address':self.chain['address'],'query_pairs':[[key,self.chain['address']] for key in history.QUERY_KEYS],'adapter':'cosmos-rest-receipts','last_scanned_height':42410000,'anchor_hash':'A'*64,
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
