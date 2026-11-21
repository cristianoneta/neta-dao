import gzip
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from collect_cosmos_markets import sample,validate,valid_supply,publish
from collect_neta_market import database,record
NOW=1800000000
from datetime import datetime,timezone
def iso(t):return datetime.fromtimestamp(t,timezone.utc).isoformat()
SPEC={'chain':'osmosis-1','denom':'uatom-ibc','supplyDenom':'uatom','pool':'3505'}
def raw(t=NOW,height=100):return {'schema_version':1,'chain_id':'osmosis-1','token':'uatom-ibc','pool':'3505','source_label':'Pool','current':{'time':t,'observed_at':iso(t),'height':height,'block_hash':'A'*64,'block_time':iso(t),'price_quote':2,'price_usd':1.998,'usd_anchor':{'price':.999,'observed_at':iso(t)}}}
def supply(t=NOW):return {'denom':'uatom','total_supply':100,'observed_at':iso(t),'height':100}
class Tests(unittest.TestCase):
 def test_reuses_weekly_supply_without_fetch(self):
  calls=[]
  def fetch(path):calls.append(path);return raw()
  c=sample('atom',SPEC,supply(NOW-600000),NOW,fetch)
  self.assertEqual(len(calls),1);self.assertEqual(c['supply_reference_at'],iso(NOW-600000));self.assertEqual(c['supply_basis'],'weekly-reference')
 def test_expired_supply_refreshes_and_keeps_true_date(self):
  calls=[]
  def fetch(path):calls.append(path);return supply(NOW-1) if path.startswith('/api/supply') else raw()
  c=sample('atom',SPEC,supply(NOW-604801),NOW,fetch)
  self.assertEqual(len(calls),2);self.assertEqual(c['supply_reference_at'],iso(NOW-1))
 def test_supply_failure_keeps_price_not_stale_supply(self):
  def fetch(path):
   if path.startswith('/api/supply'):raise ValueError('offline')
   return raw()
  c=sample('atom',SPEC,supply(NOW-604801),NOW,fetch)
  self.assertIsNone(c['total_supply']);self.assertEqual(c['price_usd'],1.998)
 def test_wrong_identity_stale_and_wrong_usd_rejected(self):
  for bad in [dict(raw(),token='another'),raw(NOW-181),dict(raw(),current=dict(raw()['current'],price_usd=10))]:
   with self.assertRaises(ValueError):validate(bad,SPEC,NOW)
 def test_native_and_alloy_supply_expiries(self):
  self.assertTrue(valid_supply(supply(NOW-500),SPEC,NOW))
  self.assertFalse(valid_supply(supply(NOW-500),dict(SPEC,alloyContract='contract'),NOW))
 def test_gns_daily_supply_expires_without_using_maximum_supply(self):
  spec={'chain':'gnoland-1','denom':'gno.land/r/gnoswap/gns.GNS','supplyInterval':86400}
  value=dict(supply(NOW-86400),denom=spec['denom'],total_supply=140774677.816237,height=None,state_query='latest-state-unpinned')
  self.assertTrue(valid_supply(value,spec,NOW));self.assertFalse(valid_supply(value,spec,NOW+1))
  self.assertFalse(valid_supply(dict(value,denom='ugnot'),spec,NOW))
 def test_gno_supply_never_invents_height(self):
  g=dict(supply(),denom='ugnot',height=None,state_query='latest-state-unpinned')
  self.assertTrue(valid_supply(g,{'chain':'gnoland-1','denom':'ugnot'},NOW))
  self.assertFalse(valid_supply(dict(g,state_query='pinned'),{'chain':'gnoland-1','denom':'ugnot'},NOW))
 def test_first_sample_retained_and_archive_preserves_supply_reference(self):
  with tempfile.TemporaryDirectory() as tmp:
   path=Path(tmp);db=database(path/'data.sqlite3')
   c=sample('atom',SPEC,supply(NOW-400000),NOW,lambda p:raw())
   self.assertTrue(record(db,c));self.assertFalse(record(db,dict(c,price_usd=200)))
   out=publish(db,SPEC,path/'public',path/'archive',NOW)
   self.assertEqual(out['current']['price_usd'],1.998)
   h=json.loads((path/'public/1d.json').read_text());self.assertEqual(h['points'][0]['supply_reference_at'],iso(NOW-400000));self.assertEqual(h['token'],SPEC['denom'])
   f=next((path/'archive').glob('*.gz'));a=json.loads(gzip.decompress(f.read_bytes()));self.assertEqual(a['observations'][0]['height'],100)
   self.assertIsNone(out['change_24h_pct']);db.close()
if __name__=='__main__':unittest.main()
