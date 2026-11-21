import copy
from decimal import Decimal
import gzip
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs,urlparse
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import collect_neta_pools as m

NOW=1795267200

def event(spec,amount='2500000',reverse=False):
 if spec['venue']=='WYND':
  attrs={'_contract_address':m.PAIR,'action':'swap','offer_asset':m.NETA if reverse else 'ujuno','ask_asset':'ujuno' if reverse else m.NETA,'offer_amount':'1000000' if reverse else amount,'return_amount':amount if reverse else '1000000'}
  kind='wasm'
 else:
  attrs={'pool_id':'631','tokens_in':('1000000'+m.OSMO_NETA) if reverse else amount+'uosmo','tokens_out':amount+'uosmo' if reverse else '1000000'+m.OSMO_NETA};kind='token_swapped'
 return {'type':kind,'attributes':[{'key':k,'value':v} for k,v in attrs.items()]}

def tx(spec,digest='A',at=NOW-50,**kwargs):
 return {'txhash':digest*64,'height':'99','timestamp':m.iso(at),'code':0,'events':[event(spec)],**kwargs}

class PoolsTests(unittest.TestCase):
 def test_pool_timeout_can_grow_without_changing_minute_default(self):
  import collect_neta_market as prices
  for reader,expected in [(prices.Reader(),5),(prices.Reader(request_timeout=10),10)]:
   with patch.object(prices,'urlopen') as opening:
    opening.return_value.__enter__.return_value.read.return_value=b'{}'
    self.assertEqual(reader('https://fixture.invalid'),{})
    self.assertEqual(opening.call_args.kwargs['timeout'],expected)

 def test_both_directions_count_one_quote_leg(self):
  for spec in m.POOLS:
   for reverse in (False,True):
    t=tx(spec,events=[event(spec,reverse=reverse)])
    swaps=m.swap_events(t,spec)
    self.assertEqual(len(swaps),1);self.assertEqual(swaps[0]['quote_amount'],'2.5')
 def test_repeated_execution_in_one_tx_and_other_route_hops(self):
  spec=m.POOLS[1];other=event(spec);other['attributes'][0]['value']='999'
  rows=m.swap_events(tx(spec,events=[event(spec),other,event(spec)]),spec)
  self.assertEqual([r['event_index'] for r in rows],[0,2])
 def test_failure_deposit_and_foreign_assets(self):
  spec=m.POOLS[0];self.assertEqual(m.swap_events(tx(spec,code=5),spec),[])
  deposit=event(spec);deposit['attributes'][1]['value']='provide_liquidity'
  self.assertEqual(m.swap_events(tx(spec,events=[deposit]),spec),[])
  foreign=event(spec);foreign['attributes'][2]['value']='wrong'
  with self.assertRaises(ValueError):m.swap_events(tx(spec,events=[foreign]),spec)
 def test_ambiguous_or_decimal_amount_rejected(self):
  spec=m.POOLS[0]
  with self.assertRaises(ValueError):m.swap_events(tx(spec,events=[event(spec,'2.5')]),spec)
  e=event(spec);e['attributes'].append(e['attributes'][2])
  with self.assertRaises(ValueError):m.swap_events(tx(spec,events=[e]),spec)
 def scan(self,batches,control=None):
  spec=m.POOLS[0];end={'height':'100','hash':'B'*64,'time':m.iso(NOW)};floor={'height':'1','hash':'C'*64,'time':m.iso(NOW-100000)}
  def block(reader,base,height,chain):return end if height==100 else floor
  def reader(url):
   q=parse_qs(urlparse(url).query)
   if q.get('limit')==['1']:return {'tx_responses':[control or tx(spec)]}
   return batches[int(q['page'][0])-1]
  with patch.object(m,'block',side_effect=block):
   return m.volume(reader,'https://fixture.invalid',spec,{'height':120,'usd_anchor':{'price':'2','observed_at':m.iso(NOW),'source':'fixture'}},NOW)
 def test_exact_window_and_no_double_counting(self):
  spec=m.POOLS[0];a=tx(spec,at=NOW-86400);b=tx(spec,'B');c=tx(spec,'C',code=1)
  v,rows=self.scan([{'total':'3','tx_responses':[a,b,c]}],control=b)
  self.assertEqual(v['swaps'],1);self.assertEqual(v['usd'],'5.0');self.assertEqual(len(rows),1)
 def test_zero_requires_complete_index_and_positive_control(self):
  v,_=self.scan([{'total':'0','tx_responses':[]}],control=tx(m.POOLS[0],at=NOW-90000))
  self.assertEqual(Decimal(v['usd']),0)
  with self.assertRaises(ValueError):self.scan([{'total':'0','tx_responses':[]}])
 def test_pagination_truncation_and_duplicate_fail_closed(self):
  t=tx(m.POOLS[0])
  for batches in ([{'total':'2','tx_responses':[t]},{'total':'2','tx_responses':[]}],[{'total':'2','tx_responses':[t,t]}],[{'total':'2','tx_responses':[t]},{'total':'3','tx_responses':[]}]):
   with self.assertRaises(ValueError):self.scan(batches)
 def test_weighted_pool_and_explicit_latest_state_boundary(self):
  pool={'@type':'/osmosis.gamm.v1beta1.Pool','id':'631','address':m.OSMO_ADDRESS,'pool_params':{'swap_fee':'.003','smooth_weight_change_params':None},'pool_assets':[{'token':{'denom':m.OSMO_NETA,'amount':'100000000'},'weight':'80'},{'token':{'denom':'uosmo','amount':'1000000000'},'weight':'20'}],'total_weight':'100'}
  def reader(url,**kwargs):return {'pool':pool} if '/pools/' in url else {'denom_trace':{'path':'transfer/channel-169','base_denom':'cw20:'+m.NETA}}
  treasury={'wynd_market':{'chain_id':'juno-1','price_observed_at':m.iso(NOW),'price_source':'fixture','prices_usd':{m.JUNO_OSMO:'2'}}}
  with patch.object(m,'block',return_value={'height':'100','hash':'D'*64,'time':m.iso(NOW)}):
   o=m.osmosis_snapshot('https://fixture.invalid',reader,treasury,NOW)
  self.assertEqual(Decimal(o['price_quote']),40);self.assertEqual(Decimal(o['liquidity_usd']),10000)
  self.assertIsNone(o['state_height']);self.assertEqual(o['state_height_range'],[100,100])
 def test_quote_staleness(self):
  treasury={'wynd_market':{'chain_id':'juno-1','price_observed_at':m.iso(NOW-1801),'price_source':'fixture','prices_usd':{m.JUNO_OSMO:'2'}}}
  self.assertIsNone(m.quote_usd(treasury,m.JUNO_OSMO,NOW))
 def test_persistence_conflict_and_archive_roundtrip(self):
  with tempfile.TemporaryDirectory() as tmp,sqlite3.connect(':memory:') as db:
   pool={'id':m.POOLS[0]['id'],'volume_24h':{'status':'complete'}};trades=m.swap_events(tx(m.POOLS[0]),m.POOLS[0])
   m.save(db,pool,trades,NOW);m.save(db,pool,trades,NOW)
   self.assertEqual(db.execute('SELECT count(*) FROM swaps').fetchone()[0],1)
   other=copy.deepcopy(trades);other[0]['quote_amount']='999'
   with self.assertRaises(ValueError):m.save(db,pool,other,NOW)
   m.publish(db,[pool],Path(tmp)/'pools.json',Path(tmp)/'archive',NOW)
   data=json.loads(gzip.decompress(next((Path(tmp)/'archive').glob('*.gz')).read_bytes()))
   self.assertEqual(data['swaps'][0]['quote_amount'],'2.5')

if __name__=='__main__':unittest.main()
