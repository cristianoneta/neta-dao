import base64, copy, json, unittest, urllib.parse
from unittest.mock import patch
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from test_dao_onboarding import members, ROOT
DAOS={d['id']:d for d in json.loads((ROOT/'data/dao-directory.json').read_text())['daos']}
class MembershipAdapters(unittest.TestCase):
 def test_group_identity_and_total_reconciliation(self):
  dao=DAOS['neta-operations']
  def query(base,address,msg,height):
   key=next(iter(msg))
   return {'config':{'name':dao['onChainName']},'voting_module':dao['votingModule'],'dao':dao['core'],'group_contract':dao['groupContract'],'info':{'info':{'contract':'crates.io:dao-voting-cw4'}},'total_power_at_height':{'height':100,'power':'5'},'list_members':{'members':[] if msg.get('list_members',{}).get('start_after') else [{'addr':'one','weight':3},{'addr':'two','weight':2}]}}[key]
  latest={'block':{'header':{'chain_id':'juno-1','height':'120'}}}
  with patch.object(members,'get',return_value=latest),patch.object(members,'smart',side_effect=query):
   data=members.collect_group(dao,'fixture')
  self.assertEqual([m['power_raw'] for m in data['members']],['3','2']);self.assertNotIn('token_contract',data)
  def bad(*args):
   if 'group_contract' in args[2]:return 'foreign'
   return query(*args)
  with patch.object(members,'get',return_value=latest),patch.object(members,'smart',side_effect=bad):
   with self.assertRaisesRegex(ValueError,'group identity'):members.collect_group(dao,'fixture')
 def test_native_aggregates_delegator_without_adding_validator_power(self):
  vals=[{'operator_address':v,'tokens':'3','delegator_shares':'3.000000000000000001','status':'BOND_STATUS_BONDED','description':{'moniker':v}} for v in ['val1','val2']]
  def get(base,path,height=None):
   if path.endswith('latest'):return {'block':{'header':{'chain_id':'juno-1','height':'120'}}}
   self.assertEqual(height,100)
   if path.endswith('/params'):return {'params':{'bond_denom':'ujuno'}}
   return {'pool':{'bonded_tokens':'6'}}
  def pages(base,path,field,height):
   if field=='validators':return vals
   v=path.split('/')[-2]
   return [{'delegation':{'delegator_address':'same-wallet','validator_address':v,'shares':'3.000000000000000001'},'balance':{'amount':'3','denom':'ujuno'}}]
  with patch.object(members,'get',side_effect=get),patch.object(members,'paginated',side_effect=pages):
   data=members.collect_native(DAOS['juno'],'fixture')
  self.assertEqual(len(data['members']),1);self.assertEqual(data['total_power_raw'],'6');self.assertEqual(len(data['validators']),2)
  self.assertEqual(len(data['members'][0]['delegations']),2)
  vals[0]['delegator_shares']='4'
  with patch.object(members,'get',side_effect=get),patch.object(members,'paginated',side_effect=pages):
   with self.assertRaisesRegex(ValueError,'shares do not reconcile'):members.collect_native(DAOS['juno'],'fixture')
 def test_partitioned_stakers_visit_disjoint_ranges_and_stop_at_boundary(self):
  ns=b'\x00\x0fstaked_balances';seen=set()
  def get(base,path,height):
   self.assertEqual(height,100)
   key=base64.b64decode(urllib.parse.parse_qs(urllib.parse.urlparse(path).query)['pagination.key'][0])
   seen.add(key)
   address=(key[len(ns):]+b'q'*37).decode()
   models=[{'key':(ns+address.encode()).hex(),'value':base64.b64encode(b'"1"').decode()}, {'key':b'zzzz'.hex(),'value':''}]
   return {'models':models,'pagination':{'next_key':'not-followed'}}
  with patch.object(members,'get',side_effect=get):rows=members.collect_stakers('fixture','contract',100)
  self.assertEqual(len(rows),len('023456789acdefghjklmnpqrstuvwxyz'))
  self.assertEqual(len({r['address'] for r in rows}),len(rows));self.assertEqual(len(seen),len(rows))
 def test_pagination_rejects_repeated_cursor(self):
  with patch.object(members,'get',return_value={'rows':[1],'pagination':{'next_key':'same'}}):
   with self.assertRaisesRegex(ValueError,'pagination repeated'):members.paginated('fixture','/source','rows',100)
if __name__=='__main__':unittest.main()
