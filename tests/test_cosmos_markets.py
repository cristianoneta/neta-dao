import gzip
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from collect_cosmos_markets import sample,validate,valid_supply,publish,record,native_solana_supply
from collect_neta_market import database
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
class ExternalTests(unittest.TestCase):
 def setUp(self):
  self.spec={'chain':'ethereum','denom':'LINK','pool':'coingecko:chainlink','referenceKind':'external-reference','priceId':'chainlink','supplyKind':'erc20','decimals':18}
  self.current={'time':NOW,'observed_at':iso(NOW),'price_observed_at':iso(NOW-20),'reference_kind':'external-reference','price_quote':12,'price_usd':12,'quote_symbol':'USD','height':None,'block_hash':None,'block_time':None,'liquidity_usd':None,'reserve_token':None,'price_source':{'provider':'coingecko','asset_id':'chainlink','currency':'usd','observed_at':iso(NOW-20)}}
  self.raw={'schema_version':1,'chain_id':'ethereum','token':'LINK','pool':'coingecko:chainlink','current':self.current}
 def test_external_accepts_provider_evidence_without_fake_block(self):
  c=validate(self.raw,self.spec,NOW);self.assertIsNone(c['height']);self.assertEqual(c['price_usd'],12)
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp);db=database(p/'x.sqlite3');self.assertTrue(record(db,c));self.assertFalse(record(db,c));self.assertTrue(record(db,dict(c,time=NOW+60,observed_at=iso(NOW+60))));publish(db,self.spec,p/'out',p/'archive',NOW)
   h=json.loads((p/'out/1d.json').read_text());self.assertEqual(h['points'][0]['kind'],'external-reference');db.close()
 def test_external_rejects_fake_blocks_wrong_token_and_stale_price(self):
  patches=[{'height':100},{'liquidity_usd':100},{'usd_anchor':{'price':1}},{'price_quote':13},{'price_source':dict(self.current['price_source'],asset_id='uniswap')},{'price_source':dict(self.current['price_source'],observed_at=iso(NOW-1801)),'price_observed_at':iso(NOW-1801)}]
  for patch in patches:
   with self.assertRaises(ValueError):validate(dict(self.raw,current=dict(self.current,**patch)),self.spec,NOW)
 def test_external_price_regression_never_overwrites_history(self):
  with tempfile.TemporaryDirectory() as tmp:
   db=database(Path(tmp)/'prices.sqlite3');record(db,self.current)
   with self.assertRaises(ValueError):record(db,dict(self.current,time=NOW+60,price_usd=13))
   with self.assertRaises(ValueError):record(db,dict(self.current,time=NOW+60,price_source=dict(self.current['price_source'],observed_at=iso(NOW-40))))
   self.assertEqual(db.execute('SELECT COUNT(*) FROM samples').fetchone()[0],1);db.close()
 def test_external_supply_uses_origin_evidence_and_exact_raw_amount(self):
  v={'denom':'LINK','chain_id':'ethereum','height':100,'block_hash':'a'*64,'block_time':iso(NOW-900),'observed_at':iso(NOW),'total_supply':1e9,'issued_supply_raw':str(10**27),'burned_supply_raw':'0','total_supply_raw':str(10**27),'burn_address':None}
  self.assertTrue(valid_supply(v,self.spec,NOW));self.assertFalse(valid_supply(dict(v,total_supply_raw=str(10**26)),self.spec,NOW));self.assertFalse(valid_supply(dict(v,burned_supply_raw='1'),self.spec,NOW))
 def test_uni_burn_reference_validates_exact_net_supply(self):
  spec=dict(self.spec,denom='UNI',burnAddress='0xdead');burned=114433581213802937903387397;total=10**27-burned
  v={'denom':'UNI','chain_id':'ethereum','height':100,'block_hash':'a'*64,'block_time':iso(NOW-900),'observed_at':iso(NOW),'total_supply':float(total/10**18),'issued_supply_raw':str(10**27),'burned_supply_raw':str(burned),'total_supply_raw':str(total),'burn_address':'0xdead'}
  self.assertTrue(valid_supply(v,spec,NOW));self.assertFalse(valid_supply(dict(v,burn_address='another'),spec,NOW))
 def test_sol_supply_uses_finalized_slot_and_genesis_not_cosmos_height(self):
  spec={'chain':'solana-mainnet-beta','denom':'sol','supplyKind':'solana','genesisHash':'expected','decimals':9}
  v={'denom':'sol','chain_id':spec['chain'],'genesis_hash':'expected','slot':123,'total_supply_raw':'637981533195550360','total_supply':637981533.1955504,'observed_at':iso(NOW),'block_time':iso(NOW-10)}
  self.assertTrue(valid_supply(v,spec,NOW));self.assertFalse(valid_supply(dict(v,height=123),spec,NOW));self.assertFalse(valid_supply(dict(v,genesis_hash='other'),spec,NOW));self.assertFalse(valid_supply(dict(v,total_supply=1),spec,NOW))
 def test_native_solana_fallback_preserves_integer_and_finalized_calls(self):
  import time
  now=int(time.time());calls=[]
  spec={'chain':'solana-mainnet-beta','denom':'sol','supplyKind':'solana','genesisHash':'expected','decimals':9,'supplyBase':'https://api.mainnet-beta.solana.com'}
  def rpc(method,params):
   calls.append((method,params));return {'getGenesisHash':'expected','getSupply':{'context':{'slot':123},'value':{'total':637981533195550360}},'getBlockTime':now-10}[method]
  value=native_solana_supply(spec,rpc);self.assertEqual(value['total_supply'],'637981533.19555036');self.assertEqual(value['total_supply_raw'],'637981533195550360');self.assertEqual(calls[1][1][0]['commitment'],'finalized');self.assertTrue(valid_supply(value,spec,now))
 def test_existing_pool_spec_cannot_use_external_path(self):
  with self.assertRaises(ValueError):validate(dict(self.raw,chain_id=SPEC['chain'],token=SPEC['denom'],pool=SPEC['pool']),SPEC,NOW)

if __name__=='__main__':unittest.main()
