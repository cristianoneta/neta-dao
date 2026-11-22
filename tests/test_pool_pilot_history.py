import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
import collect_pool_pilot as p
from pool_pilot_history import freeze_values, publish_histories

NOW=1800000000
KEY='osmosis-1:1'

class PoolHistoryTest(unittest.TestCase):
    def setUp(self):
        self.db=p.connect(':memory:')
        self.spec={'key':KEY,'chain_id':'osmosis-1','pool':'1'}
        self.db.execute('INSERT INTO pools VALUES (?,?,?)',(KEY,NOW-7200,json.dumps(self.spec)))
        self.trade={'pool':KEY,'chain':'osmosis-1','txhash':'A'*64,'event_index':0,'time':NOW-60,'height':10,'denom_in':'ua','raw_in':'2000000','denom_out':'ub','raw_out':'1'}
        self.cursor={'time':NOW,'block_time':p.iso(NOW),'first_time':NOW-7200,'source':'fixture'}
        p.record_scan(self.db,'osmosis-1',self.cursor,[self.trade],[])
        self.refs=({'atom':{'price':'10','observed_at':p.iso(NOW-120)}},{'osmosis-1:ua':('atom',6)})
    def tearDown(self):self.db.close()
    def test_frozen_value_never_changes_with_later_price(self):
        freeze_values(self.db,self.refs,'/missing-fixture',NOW)
        self.assertEqual(p.volume(self.db,self.spec,self.cursor,self.refs,NOW)['usd'],20)
        newer=({'atom':{'price':'200','observed_at':p.iso(NOW)}},self.refs[1])
        freeze_values(self.db,newer,'/missing-fixture',NOW)
        self.assertEqual(p.volume(self.db,self.spec,self.cursor,newer,NOW)['usd'],20)
        self.assertEqual(self.db.execute('SELECT count(*) FROM trade_values').fetchone()[0],1)
    def test_future_and_expired_references_do_not_value_a_trade(self):
        for at in (NOW,NOW-2000):
            self.db.execute('DELETE FROM trade_values');self.db.execute('DELETE FROM usd_references')
            freeze_values(self.db,({'atom':{'price':'10','observed_at':p.iso(at)}},self.refs[1]),'/missing-fixture',NOW)
            self.assertIsNone(p.volume(self.db,self.spec,self.cursor,self.refs,NOW)['usd'])
    def test_existing_minute_archive_values_prior_trade_without_network(self):
        with tempfile.TemporaryDirectory() as root:
            folder=Path(root)/'cosmos';folder.mkdir()
            from collect_neta_market import database
            db=database(folder/'atom.sqlite3')
            o={'time':NOW-120,'price_usd':'7','block_time':p.iso(NOW-120)}
            db.execute('INSERT INTO samples VALUES (?,?,?)',((NOW-120)//60,NOW-120,json.dumps(o)));db.commit();db.close()
            freeze_values(self.db,({},self.refs[1]),root,NOW)
            self.assertEqual(p.volume(self.db,self.spec,self.cursor,self.refs,NOW)['usd'],14)
    def test_history_preserves_gaps_and_counts_intervals_once(self):
        freeze_values(self.db,self.refs,'/missing-fixture',NOW)
        self.db.execute('INSERT INTO observations VALUES (?,?,?)',(KEY,NOW-300,json.dumps({'status':'ok','liquidity_usd':'100'})))
        self.db.execute('INSERT INTO observations VALUES (?,?,?)',(KEY,NOW-1,json.dumps({'status':'unavailable','liquidity_usd':None})))
        exported={}
        publish_histories(self.db,{KEY:self.spec},{'osmosis-1':self.cursor},'/tmp/unused',NOW,lambda path,data:exported.setdefault(path.name,data))
        day=exported['1d.json'];self.assertEqual(day['resolution_seconds'],300)
        self.assertTrue(any(row[1] is None for row in day['points']))
        self.assertEqual(sum(row[2] or 0 for row in day['points']),20)
        self.assertEqual(sum(row[3] or 0 for row in day['points']),1)
        self.assertLessEqual(len(exported['7d.json']['points']),169)

if __name__=='__main__':unittest.main()
