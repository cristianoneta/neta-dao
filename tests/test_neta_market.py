import gzip
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import collect_neta_market as m

NOW=1795262400
class MarketTests(unittest.TestCase):
 def quote(self,age=60,value='0.005'):
  return {'wynd_market':{'chain_id':'juno-1','price_source':'source','price_observed_at':m.datetime.fromtimestamp(NOW-age,m.timezone.utc).isoformat(),'prices_usd':{'ujuno':value}}}
 def observation(self,t=NOW,usd='2'):
  return {'time':t,'price_usd':usd,'price_juno':'400','height':123,'block_time':m.datetime.fromtimestamp(t,m.timezone.utc).isoformat(),'usd_anchor':{'price':'.005'}}
 def test_stale_usd_does_not_become_zero_or_fresh(self):
  self.assertIsNone(m.usd_anchor(self.quote(1801),NOW))
  self.assertIsNone(m.usd_anchor(self.quote(-61),NOW))
  self.assertIsNone(m.usd_anchor(self.quote(value='NaN'),NOW))
  self.assertEqual(m.usd_anchor(self.quote(),NOW)['price'],'0.005')
 def test_pool_order_normalization_and_supply(self):
  pool={'reserves':{'assets':[{'info':m.ASSETS['NETA'],'amount':'500000000'},{'info':m.ASSETS['JUNO'],'amount':'200000000000'}]}}
  anchor={'height':'123','hash':'A'*64,'time':m.datetime.fromtimestamp(NOW,m.timezone.utc).isoformat()}
  def reader(*args,**kwargs):return {'data':{'symbol':'NETA','decimals':6,'total_supply':'31886600000'}}
  with patch.object(m,'block',return_value=anchor),patch.object(m,'read_pool',return_value=(m.PAIR,pool)):
   result=m.sample('source',reader,self.quote(),NOW)
  self.assertEqual(result['price_juno'],'400')
  self.assertEqual(result['price_usd'],'2.000')
  self.assertEqual(result['liquidity_usd'],'2000.000')
  self.assertEqual(result['total_supply'],'31886.6')
 def test_changed_anchor_rejected(self):
  pool={'reserves':{'assets':[]}}
  anchor={'height':'123','hash':'A'*64,'time':m.datetime.fromtimestamp(NOW,m.timezone.utc).isoformat()}
  def reader(*args,**kwargs):return {'data':{'symbol':'NETA','decimals':6,'total_supply':'31886600000'}}
  with patch.object(m,'block',side_effect=[anchor,{**anchor,'hash':'B'*64}]),patch.object(m,'read_pool',return_value=(m.PAIR,pool)):
   with self.assertRaisesRegex(ValueError,'changed'):m.sample('source',reader,self.quote(),NOW)
 def test_stale_block_rejected(self):
  anchor={'height':'123','hash':'A'*64,'time':m.datetime.fromtimestamp(NOW-121,m.timezone.utc).isoformat()}
  with patch.object(m,'block',return_value=anchor):
   with self.assertRaisesRegex(ValueError,'Stale'):m.sample('source',None,{},NOW)
 def test_idempotency_null_usd_and_archive_roundtrip(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);db=m.database(root/'neta.sqlite3');one=self.observation();two=self.observation(NOW+1,'9')
   self.assertTrue(m.record(db,one));self.assertFalse(m.record(db,two));self.assertEqual(m.rows(db),[one])
   missing=self.observation(NOW+120,None);m.record(db,missing)
   current=m.publish(db,root/'public',root/'archive',NOW+120)
   self.assertIsNone(current['current']['price_usd'])
   archive=json.loads(gzip.decompress(next((root/'archive').glob('20*.gz')).read_bytes()))
   self.assertEqual(archive['observations'],[one,missing])
   self.assertEqual(len(json.loads((root/'public/1d.json').read_text())['points']),2)
   self.assertIsNone(current['change_24h_pct'])
   db.close()
 def test_legacy_is_separate_and_not_interpolated(self):
  with tempfile.TemporaryDirectory() as tmp:
   db=m.database(Path(tmp)/'neta.sqlite3')
   history={'chain_id':'juno-1','snapshots':[{'generated_at':'2026-10-03T18:00:00Z','height':1,'assets':[{'key':'cw20:'+m.NETA,'usd_price':'1'}]},{'generated_at':'2026-10-06T18:00:00Z','height':2,'assets':[{'key':'cw20:'+m.NETA,'usd_price':'2'}]}]}
   m.import_legacy(db,history);m.import_legacy(db,history)
   self.assertEqual(len(m.series(db,86400,0,NOW)['points']),2)
   self.assertEqual(m.series(db,60,0,NOW)['points'],[])
   self.assertIsNone(m.series(db,86400,0,NOW)['points'][0]['juno'])
   db.close()
 def test_chain_qualified_juno_reference(self):
  with tempfile.TemporaryDirectory() as tmp:
   db=m.database(Path(tmp)/'neta.sqlite3')
   history={'chain_id':'juno-1','snapshots':[{'generated_at':'2026-10-03T18:00:00Z','height':1,'assets':[{'key':'cw20:'+m.NETA,'usd_price':'2'},{'key':'juno:native:ujuno','symbol':'JUNO','usd_price':'0.005'}]}]}
   m.import_legacy(db,history)
   self.assertEqual(m.series(db,86400,0,NOW)['points'][0]['juno'],'4E+2')
   db.close()
 def test_regressed_block_does_not_enter_history(self):
  with tempfile.TemporaryDirectory() as tmp:
   db=m.database(Path(tmp)/'neta.sqlite3');m.record(db,self.observation())
   older={**self.observation(NOW+60),'height':122}
   with self.assertRaisesRegex(ValueError,'regressed'):m.record(db,older)
   self.assertEqual(len(m.rows(db)),1);db.close()
 def test_long_views_read_incremental_aggregates(self):
  with tempfile.TemporaryDirectory() as tmp:
   db=m.database(Path(tmp)/'neta.sqlite3')
   for i in range(100):m.record(db,self.observation(NOW+i*60,str(2+i/100)))
   with patch.object(m,'rows',side_effect=AssertionError('Long views must not read raw minute history')):
    daily=m.series(db,86400,0,NOW+6000)
    weekly=m.series(db,900,NOW-86400,NOW+6000)
   self.assertEqual(len(daily['points']),1)
   self.assertEqual(daily['points'][0]['usd'],'2.99')
   self.assertLess(len(weekly['points']),10);db.close()
if __name__=='__main__':unittest.main()
