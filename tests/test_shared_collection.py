import base64
from datetime import datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
from threading import Event, Thread
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

SCRIPTS = Path(__file__).resolve().parents[1] / 'scripts'
sys.path.insert(0, str(SCRIPTS))
import check_public_data as public
import publication_metrics
import treasury_history as history
import update_treasury_events as events
import wynd_market

spec = importlib.util.spec_from_file_location('publisher', SCRIPTS/'publish-server-snapshots.py')
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class SharedCollectionTests(unittest.TestCase):
    def test_market_http_identification_keeps_height_and_error_checks(self):
        observed = []
        class Provider(BaseHTTPRequestHandler):
            response_height = '72'
            status = 200
            def log_message(self, *args):
                pass
            def do_GET(self):
                observed.append((self.path, self.headers.get('x-cosmos-block-height'),
                                 self.headers.get('Accept')))
                status = self.status if self.headers.get('User-Agent') == 'NETA-DAO-Treasury/1.0' else 403
                self.send_response(status)
                if self.response_height is not None:
                    self.send_header('x-cosmos-block-height', self.response_height)
                self.end_headers()
                self.wfile.write(b'{"data":{"total_share":"42"}}')
        server = ThreadingHTTPServer(('127.0.0.1', 0), Provider)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = 'http://127.0.0.1:' + str(server.server_port)
            path = '/cosmwasm/wasm/v1/contract/pair/smart/query'
            self.assertEqual(wynd_market.pinned(base, path, 72), {'data': {'total_share': '42'}})
            for height in ('71', None):
                Provider.response_height = height
                with self.subTest(response_height=height), self.assertRaisesRegex(ValueError, 'Unconfirmed WYND query height'):
                    wynd_market.pinned(base, path, 72)
            Provider.response_height, Provider.status = '72', 403
            with self.assertRaises(HTTPError) as failed:
                wynd_market.pinned(base, path, 72)
            self.assertEqual(failed.exception.code, 403)
            self.assertEqual(observed, [(path, '72', 'application/json')] * 4)
        finally:
            server.shutdown()
            thread.join(timeout=5)
            server.server_close()

    def test_independent_progress_retains_failed_chain_and_retries_its_own_cursor(self):
        old = '2026-11-14T01:15:19Z'
        chains = events.CHAINS
        existing = []
        for c in chains:
            row = events.normalize({'hash': c['id'], 'height': 21}, old, {}, c)
            row['movements'] = [{'raw_amount':'77', 'denom':'test'}]
            existing.append(row)
        sources = [{'chain_id': c['id'], 'address': c['address'], 'last_scanned_height': 22} for c in chains]
        prior = {'scope': 'neta-operations-cross-chain', 'generated_at': old,
                 'treasuries': [{'chain_id': c['id'], 'address': c['address']} for c in chains],
                 'sources': sources, 'events': existing}
        positions = []
        persisted = Event()
        checkpoints = []
        def scan(chain, rows, registry, titles, source):
            positions.append((chain['id'], source['last_scanned_height']))
            if chain['id'] == 'osmosis-1' and source['last_scanned_height'] == 22 and len(positions) <= 2:
                if not persisted.wait(3):
                    raise AssertionError('Healthy chain was not checkpointed before the slow chain finished')
                raise RuntimeError('archive unavailable')
            return [r for r in rows if r['chain_id'] == chain['id']], {**source,'last_scanned_height':source['last_scanned_height']+1}
        with tempfile.TemporaryDirectory() as temp, patch.object(events,'collect_receipt_chain',side_effect=scan), patch.object(events,'proposal_titles',return_value={}):
            path = Path(temp)/'events.json'
            path.write_text(json.dumps(prior))
            def checkpoint(data):
                path.write_text(json.dumps(data))
                checkpoints.append(json.loads(path.read_text()))
                persisted.set()
            first = events.collect(output=path,checkpoint=checkpoint)
            self.assertEqual(checkpoints[0]['chain_refresh']['osmosis-1']['status'],'pending')
            self.assertEqual(checkpoints[0]['sources'][0]['last_scanned_height'],23)
            self.assertEqual(first['status'],'UNAVAILABLE')
            self.assertEqual(first['last_success_at'],old)
            self.assertEqual(first['sources'][1],sources[1])
            self.assertEqual(first['events'],existing)
            self.assertEqual(first['chain_refresh']['osmosis-1']['last_success_at'],old)
            self.assertEqual(first['chain_refresh']['juno-1']['status'],'completed')
            path.write_text(json.dumps(first))
            second = events.collect(output=path)
            self.assertEqual(second['status'],'PARTIAL')
            self.assertNotEqual(second['last_success_at'],old)
            self.assertCountEqual(positions, [('juno-1',22),('osmosis-1',22),('juno-1',23),('osmosis-1',22)])
            path.write_text(json.dumps({**first, 'sources': [*first['sources'], first['sources'][0]]}))
            with self.assertRaisesRegex(ValueError,'Duplicate'):
                events.collect(output=path)

    def test_rpc_receipt_binds_bytes_index_height_and_chain(self):
        raw = b'fixture'
        b64 = base64.b64encode(raw).decode()
        item = dict(height='10', index=0, tx=b64, hash=hashlib.sha256(raw).hexdigest(),
                    tx_result={'code':0,'events':[]})
        header = dict(height='10',chain_id='osmosis-1',time='2026-11-15T12:00:00Z')
        def get(url, timeout):
            self.assertTrue(url.startswith(base + '/'))
            if '/tx_search?' in url:
                return {'result':{'txs':[item],'total_count':'1'}}
            return {'result':{'block':{'header':header, 'data':{'txs':[b64]}}}}
        for base in history.OSMOSIS_ARCHIVE_RPCS:
            receipt = history.search(get, base, 'transfer.sender', 'account',9,11)
            self.assertEqual(receipt[item['hash'].upper()]['timestamp'],header['time'])
            for field, value in [('hash', 'A'*64), ('index', -1), ('height','12')]:
                with self.subTest(base=base,field=field), patch.dict(item,{field:value}), self.assertRaises(ValueError):
                    history.search(get, base, 'transfer.sender','account',9,11)

    def test_archive_positive_controls_precede_the_accounting_floor(self):
        chain = events.CHAINS[1]
        transfer = {'type':'transfer', 'attributes':[{'key':k,'value':v} for k,v in
                    [('recipient',chain['address']),('sender','counterparty'),('amount','123uosmo')]]}
        old = dict(height=5, timestamp=None, movements=events.movements([transfer],{},chain['address']))
        receipt = dict(code=0, events=[transfer], timestamp='2026-06-28T11:35:10Z')
        args = history.OSMOSIS_ARCHIVE_RPCS[-1], chain, {}, {'A':old}, 10
        with patch.object(events,'receipt_search',return_value={'A':receipt}) as call:
            self.assertEqual(events.verify_archive_controls(*args),{'A':receipt['timestamp']})
            call.assert_called_once_with(events.request_json,args[0],'transfer.recipient',chain['address'],5,5)
        for returned in ({},{'A':{**receipt,'events':[]}},{'A':{**receipt,'code':1}}):
            with patch.object(events,'receipt_search',return_value=returned),self.assertRaises(ValueError):
                events.verify_archive_controls(*args)
        with patch.object(events,'receipt_scan',return_value=({}, {'incremental':False,'accounting_boundary':{'height':10}})), \
             patch.object(events,'receipt_search',return_value={'A':receipt}):
            saved = {**old, 'tx_hash':'A', 'chain_id':chain['id']}
            enriched, coverage = events.collect_receipt_chain({**chain,'rests':(args[0],)},[saved],{}, {})
            self.assertEqual(enriched,[{**saved, 'timestamp':receipt['timestamp'], 'timestamp_status':'confirmed',
                                        'timestamp_source':args[0]}])
            self.assertEqual(coverage['pre_period_controls_verified'],1)
            self.assertIsNone(saved['timestamp'])

    def test_only_verified_generation_files_link_and_corruption_is_repaired(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo,out = Path(tmp)/'repo', Path(tmp)/'out'
            name,other = 'data/nns/price.json','data/treasury/current.json'
            for path in (name,other):
                (repo/path).parent.mkdir(parents=True)
                (repo/path).write_text('{}')
            publisher.publish(repo,out,[name,other])
            public_file = out/'current'/name
            inode = public_file.stat().st_ino
            self.assertNotEqual(inode,(repo/name).stat().st_ino)
            for i in range(4):
                (repo/other).write_text(str(i))
                metrics = {}
                self.assertTrue(publisher.publish(repo,out,[name,other],metrics=metrics))
                self.assertEqual(inode,public_file.stat().st_ino)
                self.assertEqual((metrics['linked_bytes'],metrics['written_bytes']), (2,1))
            self.assertEqual(len(list(out.glob('generation-*'))),3)
            public_file.write_text('xx')
            self.assertTrue(publisher.publish(repo,out,[name,other]))
            self.assertEqual(public_file.read_text(),'{}')
            self.assertNotEqual(public_file.stat().st_ino,inode)
            (repo/other).write_text('99')
            metrics = {}
            with patch.object(os,'link',side_effect=OSError('not supported')):
                self.assertTrue(publisher.publish(repo,out,[name,other],metrics=metrics))
            self.assertEqual((metrics['linked_bytes'],metrics['written_bytes']), (0,4))

    def test_fresh_request_time_does_not_hide_stale_site_data(self):
        fresh = datetime.now(timezone.utc)
        def get(site,name):
            return {'generated_at': '2026-10-07T00:00:00Z', 'updated_at':'2026-10-07T00:00:00Z',
                    'checked_at':fresh.isoformat(),'validation':{'passed':True}},None
        report = public.inspect(public.NETA_SITE,int(fresh.timestamp()),get)
        self.assertFalse(report['ok'])
        self.assertTrue(all('stale-observation' in s['issues'] for s in report['sources']))

    def test_daily_metrics_include_only_real_reported_window(self):
        now = 100000
        msg = {'job':'members','snapshot_publication':dict(files=2,input_bytes=11,changed_bytes=3,linked_bytes=8,written_bytes=3,switched=True)}
        lines = [json.dumps({'__REALTIME_TIMESTAMP':str(t*1000000),'MESSAGE':json.dumps(msg)}) for t in (1000,99999)]
        result=publication_metrics.summarize(lines, now)
        self.assertEqual(result['samples'],1)
        self.assertEqual(result['totals']['linked_bytes'],8)

    def test_market_requires_pair_lp_assets_fee_and_positive_reserves(self):
        fixture = json.loads((SCRIPTS.parent/'tests/fixtures/wynd-five-pools.json').read_text())['pools'][0]
        pair = fixture['pair']
        conf = (fixture['name'],pair['liquidity_token'],pair['contract_addr'],pair['staking_addr'])
        infos = dict(zip(('JUNO','ATOM'),pair['asset_infos']))
        def read(base,path,height):
            self.assertEqual(height,72)
            if '/smart/' not in path: return fixture['info']
            from urllib.parse import unquote
            msg = json.loads(base64.b64decode(unquote(path.split('/')[-1])))
            return {'data': fixture[next(iter(msg))]}
        self.assertEqual(wynd_market.read_pool('lcd',72,conf,infos,read)[0],conf[2])
        with patch.dict(pair,{'staking_addr':'other'}), self.assertRaises(ValueError):
            wynd_market.read_pool('lcd',72,conf,infos,read)
