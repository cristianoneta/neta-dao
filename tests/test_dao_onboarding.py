import base64, importlib.util, json, unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
def module(name):
 s=importlib.util.spec_from_file_location(name,ROOT/'scripts'/f'{name}.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
members=module('update_dao_directory');events=module('update_treasury_events')
DAO=next(d for d in json.loads((ROOT/'data/dao-directory.json').read_text())['daos'] if d['id']=='neta')
ADDRESS='juno1'+'q'*38
class Onboarding(unittest.TestCase):
 def model(self,prefix=b'\x00\x0fstaked_balances',amount='1000000'):
  return {'key':(prefix+ADDRESS.encode()).hex(),'value':base64.b64encode(json.dumps(amount).encode()).decode()}
 def test_member_decoder_excludes_claims_and_zero(self):
  self.assertEqual(members.decode_member(self.model())['power_raw'],'1000000')
  self.assertIsNone(members.decode_member(self.model(b'\x00\x06claims')))
  self.assertIsNone(members.decode_member(self.model(amount='0')))
  with self.assertRaises(ValueError):members.decode_member(self.model(amount='-1'))
 def test_collection_reconciles_and_rejects_wrong_identity_or_power(self):
  def get(base,path,height=None):
   if path.endswith('latest'):return {'block':{'header':{'chain_id':'juno-1','height':'120'}}}
   return {'models':[self.model()],'pagination':{'next_key':None}}
  def smart(base,address,msg,height):
   key=next(iter(msg))
   return {'config':({'name':DAO['name']} if address==DAO['core'] else {'dao':DAO['core']}),'voting_module':DAO['votingModule'],'proposal_modules':[DAO['proposalModule']],'staking_contract':DAO['stakingContract'],'token_contract':DAO['tokenContract'],'total_power_at_height':{'power':'1000000','height':100},'proposal_count':3}[key]
  with patch.object(members,'get',side_effect=get),patch.object(members,'smart',side_effect=smart):
   self.assertTrue(members.collect(DAO,'fixture')['members_complete'])
  def mismatch(base,address,msg,height):
   return {'power':'2000000','height':100} if 'total_power_at_height' in msg else smart(base,address,msg,height)
  with patch.object(members,'get',side_effect=get),patch.object(members,'smart',side_effect=mismatch):
   with self.assertRaisesRegex(ValueError,'reconcile'):members.collect(DAO,'fixture')
  def foreign(base,address,msg,height):
   return 'other' if 'voting_module' in msg else smart(base,address,msg,height)
  with patch.object(members,'get',side_effect=get),patch.object(members,'smart',side_effect=foreign):
   with self.assertRaisesRegex(ValueError,'identity'):members.collect(DAO,'fixture')
 def test_cw20_movements_require_exact_token_recipient_and_successful_tx_upstream(self):
  def event(token,to,action='transfer'):
   return {'type':'wasm','attributes':[{'key':k,'value':v} for k,v in {'_contract_address':token,'action':action,'from':'sender','to':to,'amount':'5000000'}.items()]}
  token=DAO['tokenContract'];known={token:{'symbol':'NETA','decimals':6}}
  data=[event(token,DAO['core']),event('fake',DAO['core']),event(token,'other'),event(token,DAO['core'],'mint')]
  rows=events.movements(data,{},DAO['core'],known)
  self.assertEqual(len(rows),1);self.assertEqual(rows[0]['amount'],'5');self.assertEqual(rows[0]['counterparty'],'sender')
  self.assertNotIn('revenue_source',rows[0])
 def test_dao_inventory_separates_custody_and_capabilities(self):
  rows=json.loads((ROOT/'data/dao-directory.json').read_text())['daos'];ops=next(d for d in rows if d['id']=='neta-operations');juno=next(d for d in rows if d['id']=='juno')
  self.assertNotEqual(DAO['core'],ops['core']);self.assertNotEqual(DAO['core'],DAO['stakingContract']);self.assertFalse(DAO['canVote']);self.assertIsNone(DAO['nnsRegistry']);self.assertIsNone(juno['core'])

class MainDaoCoverage(unittest.TestCase):
 def test_unavailable_index_keeps_verified_records_and_never_zero_revenue(self):
  old={'scope':'neta-main-dao','treasuries':[{'chain_id':'juno-1','address':DAO['core']}],
       'generated_at':'2026-10-01T00:00:00Z','last_success_at':'2026-10-01T00:00:00Z',
       'events':[{'chain_id':'juno-1','treasury_address':DAO['core'],'tx_hash':'KEEP'}],
       'sources':[{'chain_id':'juno-1','address':DAO['core'],'last_scanned_height':123}]}
  with patch.object(events,'load_existing',return_value=old),patch.object(events,'collect',side_effect=RuntimeError('empty index')):
   result=events.collect_main(DAO,Path('/unused'))
  self.assertEqual(result['status'],'UNAVAILABLE');self.assertEqual(result['events'],old['events'])
  self.assertEqual(result['sources'],old['sources']);self.assertEqual(result['generated_at'],old['generated_at'])
  self.assertIsNone(result['nns']['revenue_raw'])
 def test_foreign_ledger_is_not_relabelled_as_main_dao(self):
  with patch.object(events,'load_existing',return_value={'events':[{'chain_id':'juno-1','treasury_address':'wrong'}]}):
   with self.assertRaisesRegex(RuntimeError,'identity mismatch'):events.collect_main(DAO,Path('/unused'))
 def test_unknown_decimals_keep_exact_raw_units(self):
  treasury=module('update_treasury')
  with patch.object(treasury,'native_metadata',return_value={'symbol':'unknown','decimals':None}):
   row=treasury.native_assets([{'denom':'ibc/unknown','amount':'9007199254740993123'}],{},[])[0]
  self.assertEqual(row['raw_amount'],'9007199254740993123');self.assertIsNone(row['amount']);self.assertIsNone(row['usd_value'])
 def test_main_collector_timeout_keeps_existing_output(self):
  collector=module('update_main_dao')
  with patch.object(collector.subprocess,'run',side_effect=collector.subprocess.TimeoutExpired('test',180)):
   name,result=collector.run(('members',collector.TASKS['members']))
  self.assertEqual(name,'members');self.assertEqual(result['status'],'unavailable')

if __name__=='__main__':unittest.main()
