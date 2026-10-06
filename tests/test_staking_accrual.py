import copy, json, sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from staking_accrual import interval, withdrawals, project, collect, ADDRESS
from unittest.mock import patch
from tempfile import TemporaryDirectory
from community_cash_review import review
from community_block_ledger import DISTRIBUTION, START
from update_generic_accounting import build
from tests.test_generic_accounting import feed, event, DAOS
DAO=next(d for d in DAOS if d['id']=='juno-delegation')
def sample(h,amount,time):
 return {'height':h,'hash':'A'*64,'timestamp':time,'rewards':{'ujuno':str(amount)},'method':'withdrawable-rewards-truncated-per-validator','source':'fixture'}
def ev(kind,**attrs):return {'type':kind,'attributes':[{'key':k,'value':str(v)} for k,v in attrs.items()]}
class Accrual(unittest.TestCase):
 def test_opening_stock_not_income_and_claim_not_double_counted(self):
  a=sample(100,1000000000,'2026-10-06T00:00:01Z');b=sample(200,1100000000,'2026-10-06T12:00:00Z')
  self.assertEqual(interval(a,b,[])['amounts'],{'ujuno':'100000000'})
  b['rewards']['ujuno']='50000000'
  c=[{'height':150,'amounts':{'ujuno':'1050000000'}}]
  self.assertEqual(interval(a,b,c)['amounts'],{'ujuno':'100000000'})
  b['rewards']['ujuno']='0';c[0]['amounts']['ujuno']='1000000000'
  self.assertEqual(interval(a,b,c)['amounts'],{})
 def test_unexplained_decrease_month_crossing_and_future_claim_fail(self):
  a=sample(100,100,'2026-10-06T00:00:00Z');b=sample(200,90,'2026-10-06T12:00:00Z')
  with self.assertRaises(ValueError):interval(a,b,[])
  b['rewards']['ujuno']='110';b['timestamp']='2026-11-01T00:01:00Z'
  with self.assertRaises(ValueError):interval(a,b,[])
  b['timestamp']='2026-10-06T12:00:00Z'
  with self.assertRaises(ValueError):interval(a,b,[{'height':201,'amounts':{'ujuno':'1'}}])
 def test_explicit_and_automatic_rewards_require_delegator_identity(self):
  rows=[ev('withdraw_rewards',delegator=ADDRESS,validator='junovaloper1x',amount='5ujuno'),ev('withdraw_rewards',delegator='other',validator='junovaloper1x',amount='9ujuno')]
  self.assertEqual(withdrawals(rows,ADDRESS)[0]['amounts'],{'ujuno':'5'})
  self.assertEqual(len(withdrawals(rows,ADDRESS)),1)
 def test_matching_claim_is_settlement_not_operating_income(self):
  f=feed(DAO);r=event(DAO);r['reward_withdrawals']=[{'event_index':1,'validator':'junovaloper1x','amounts':{'ujuno':'1000000'}}]
  r['evidence']={'kind':'provider-receipt'};r['movements'][0].update(direction='in',counterparty=DISTRIBUTION);f['events']=[r]
  result=build(DAO,f);self.assertEqual(result['entries'],[]);self.assertEqual(result['movement_review']['unreviewed_movements'],0);self.assertEqual(len(result['reward_settlements']),1)
  r['reward_withdrawals'][0]['amounts']['ujuno']='999999'
  result=build(DAO,f);self.assertEqual(result['movement_review']['unreviewed_movements'],1)
 def test_midnight_boundary_assigns_next_day_without_month_leak(self):
  a=sample(100,100,'2026-10-31T23:59:58Z');a['boundary_at']='2026-11-01T00:00:00Z'
  b=sample(200,150,'2026-11-01T23:59:58Z');b['boundary_at']='2026-11-02T00:00:00Z'
  self.assertEqual(interval(a,b,[])['day'],'2026-11-01')
 def test_repeated_daily_run_is_idempotent(self):
  from datetime import datetime,timezone
  a=sample(100,100,'2026-10-06T13:00:00Z');b=sample(200,110,'2026-10-06T15:00:00Z')
  data={'schema_version':1,'chain_id':'juno-1','treasury_address':ADDRESS,'opening':a,'intervals':[interval(a,b,[])],'last_sample_day':datetime.now(timezone.utc).date().isoformat()}
  with TemporaryDirectory() as tmp, patch('staking_accrual.closing_sample',side_effect=AssertionError('unnecessary query')):
   p=Path(tmp)/'daily.json';p.write_text(json.dumps(data))
   self.assertEqual(collect(DAO,{}, {},p),data)
 def test_zero_expense_review_rejects_extra_outflow_and_cross_message_masking(self):
  tx=[ev('transfer',sender=DISTRIBUTION,recipient='a',amount='20ujuno',msg_index=0),ev('withdraw_rewards',amount='20ujuno',msg_index=0)]
  row={'id':'juno-1:distribution:1-1','start':{'height':1,'timestamp':START},'end':{'height':1},'blocks':1,'module_transfers':[],'transaction_evidence':[{'height':1,'transactions':[{'tx_index':0,'events':tx}]}]}
  b={'schema_version':1,'chain_id':'juno-1','accounting_start':START,'distribution':DISTRIBUTION,'ranges':[row],'last_scanned_height':1}
  self.assertEqual(review(b)['status'],'reviewed')
  tx[1]['attributes'][-1]['value']='1';self.assertEqual(review(b)['status'],'incomplete')
  tx[1]['attributes'][-1]['value']='0';tx.append(ev('transfer',sender=DISTRIBUTION,recipient='b',amount='1ujuno',msg_index=0));self.assertEqual(review(b)['status'],'incomplete')
if __name__=='__main__':unittest.main()
