import copy
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import update_generic_accounting as generic
import update_community_accounting as community
from treasury_history import ACCOUNTING_START

DAOS = json.loads((generic.ROOT / 'data/dao-directory.json').read_text())['daos']
OPS = next(d for d in DAOS if d['id'] == 'neta-operations')
CP = next(d for d in DAOS if d['id'] == 'juno')
HASH = 'A' * 64

def feed(dao=OPS):
    config = dao['accountingSource']
    return {'scope': config['scope'], 'treasuries': config['treasuries'], 'status': 'PARTIAL',
            'generated_at': datetime.now(timezone.utc).isoformat(), 'events': [],
            'coverage_gaps': community.GAPS if dao['id'] == 'juno' else [],
            'sources': [{**a, 'adapter': 'cosmos-rest-receipts', 'accounting_start': ACCOUNTING_START,
                         'last_scanned_height': 500, 'anchor_hash': HASH, 'accounting_boundary': {'height': 100}}
                        for a in config['treasuries']]}

def event(dao=OPS):
    return {'id': f'juno-1:{HASH}', 'chain_id': 'juno-1', 'treasury_address': dao['accountingSource']['treasuries'][0]['address'],
            'tx_hash': HASH, 'height': 300, 'timestamp': '2026-10-04T12:00:00Z', 'status': 'confirmed',
            'movements': [{'direction': 'out', 'denom': 'ujuno', 'raw_amount': '1000000', 'amount': '1', 'counterparty': 'recipient'}]}

class Generic(unittest.TestCase):
    def test_empty_ops_requires_both_accounts_and_recent_refresh(self):
        data = generic.build(OPS, feed()); self.assertEqual(data['refresh_status'], 'completed')
        self.assertEqual(data['movement_review']['unreviewed_movements'], 0)
        for mutate in [lambda d: d['sources'].pop(), lambda d: d.update(status='UNAVAILABLE'),
                       lambda d: d.update(generated_at='2026-10-01T00:00:00Z')]:
            d=feed(); mutate(d); self.assertEqual(generic.build(OPS,d)['refresh_status'],'unavailable')
    def test_unknown_payments_are_not_expenses_or_income(self):
        for direction in ['in','out']:
            d=feed(); row=event();row['movements'][0]['direction']=direction;d['events']=[row]
            result=generic.build(OPS,d);self.assertEqual(result['entries'],[])
            self.assertEqual(result['movement_review']['unreviewed_movements'],1)
    def test_identity_duplicates_and_recent_undated_events_fail(self):
        for mutate in [lambda d: d.update(scope='wrong'), lambda d: d['events'][0].update(treasury_address='wrong'),
                       lambda d: d['events'].append(copy.deepcopy(d['events'][0])),
                       lambda d: d['events'][0].update(timestamp=None)]:
            d=feed();d['events']=[event()];mutate(d)
            with self.assertRaises(ValueError):generic.build(OPS,d)
    def test_old_exports_preserved_but_not_in_october_accounting(self):
        d=feed();row=event();row.update(timestamp=None,height=50);d['events']=[row]
        self.assertEqual(generic.build(OPS,d)['movement_review']['movements'],[])
        self.assertIsNone(d['events'][0]['timestamp'])
    def test_failed_attempt_is_not_payment(self):
        d=feed();row=event();row.update(status='failed',movements=[]);d['events']=[row]
        self.assertEqual(generic.build(OPS,d)['entries'],[])
        row['movements']=event()['movements']
        with self.assertRaises(ValueError):generic.build(OPS,d)
    def test_cp_gaps_and_funding_separate_from_income(self):
        d=feed(CP);row=event(CP);row['movements'][0].update(direction='in',classification='funding')
        row['evidence']={'kind':'provider-receipt','provider':'fixture'};d['events']=[row]
        result=generic.build(CP,d)
        self.assertEqual(result['entries'][0]['category'],'funding');self.assertIsNone(result['entries'][0]['usd_value'])
        self.assertTrue(result['coverage_gaps'])
        d['events']=[]
        with self.assertRaises(ValueError):generic.build(CP,d,result)

class Community(unittest.TestCase):
    def receipt(self):
        return {'code':0,'txhash':HASH,'height':'300','timestamp':'2026-10-04T12:00:00Z',
                'tx':{'body':{'messages':[{'@type':community.FUND,'depositor':'payer','amount':[{'denom':'ujuno','amount':'1000000'}]}]}},
                'events':[{'type':'transfer','attributes':[{'key':k,'value':v} for k,v in
                    {'sender':'payer','recipient':community.ADDRESS,'amount':'1000000ujuno'}.items()]}]}
    def test_funding_requires_exact_successful_receipt(self):
        receipt=self.receipt();event=community.funding_event(receipt,'fixture')
        self.assertEqual(event['movements'][0]['classification'],'funding')
        receipt['code']=1;self.assertIsNone(community.funding_event(receipt,'fixture'))
        receipt=self.receipt();receipt['events']=[]
        with self.assertRaises(ValueError):community.funding_event(receipt,'fixture')
        receipt=self.receipt();receipt['events']*=2
        with self.assertRaises(ValueError):community.funding_event(receipt,'fixture')
    def test_plain_distribution_transfers_and_nested_messages_are_not_funding(self):
        receipt=self.receipt();receipt['tx']['body']['messages'][0]['@type']='/cosmos.bank.v1beta1.MsgSend'
        with self.assertRaises(ValueError):community.funding_event(receipt,'fixture')
    def test_pagination_and_passage_do_not_fabricate_payment(self):
        def proposal(pid,time,status='PROPOSAL_STATUS_PASSED'):
            return {'id':str(pid),'voting_end_time':time,'status':status,'messages':[{'@type':community.SPEND,'recipient':'r','amount':[]}]}
        pages=[{'proposals':[proposal(2,'2026-09-01T00:00:00Z')],'pagination':{'next_key':'next'}},
               {'proposals':[proposal(1,'2026-10-05T00:00:00Z'),proposal(3,'2026-10-04T00:00:00Z','PROPOSAL_STATUS_FAILED')],'pagination':{}}]
        result,count=community.governance(lambda *a,**k:pages.pop(0),'fixture')
        self.assertEqual(count["checked"],3);self.assertEqual(len(result),1);self.assertEqual(result[0]['status'],'execution-receipt-required')
        self.assertNotIn('usd_value',result[0]);self.assertNotIn('timestamp',result[0])
        d={'proposals':[],'pagination':{'next_key':'same'}}
        with self.assertRaises(ValueError):community.governance(lambda *a,**k:d,'fixture')
    def test_old_governance_page_failure_is_visible_without_discarding_recent_reads(self):
        first={'proposals':[{'id':'1','status':'PROPOSAL_STATUS_PASSED','messages':[]}], 'pagination':{'next_key':'old'}}
        with patch.object(community, 'request_json', side_effect=[first, RuntimeError('old page')]) as get:
            candidates, source=community.governance(get,'fixture')
        self.assertEqual(source['checked'],1);self.assertEqual(source['status'],'PARTIAL')
        self.assertIn('incomplete',source['warning']);self.assertEqual(candidates,[])

    def test_failure_keeps_previous_evidence_and_watermarks(self):
        old=feed(CP);old['events']=[event(CP)]
        d=community.collect(old,get=lambda *a,**k:(_ for _ in ()).throw(RuntimeError('offline')))
        self.assertEqual(d['status'],'UNAVAILABLE');self.assertEqual(d['events'],old['events']);self.assertEqual(d['sources'],old['sources'])

    def test_funding_refresh_retains_block_evidence_until_projection_succeeds(self):
        old=feed(CP);row=event(CP);row['evidence']={'kind':'block-distribution'}
        old['events']=[row];old['block_coverage']={'through_height':300}
        def get(url,**kwargs):
            if 'module_accounts' in url:return {'account':{'name':'distribution','base_account':{'address':community.ADDRESS}}}
            return {'params':{'community_tax':'0.1'}}
        with patch.object(community,'scan',return_value=({},old['sources'][0])),patch.object(community,'governance',return_value=([],{'checked':0,'status':'provider-index-only'})):
            data=community.collect(old,get)
        self.assertEqual(data['events'],[row]);self.assertEqual(data['block_coverage'],old['block_coverage'])

if __name__=='__main__':unittest.main()
