import copy
import sys
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import community_block_ledger as block
import community_statement as statement


def event(kind, **attrs): return {'type':kind,'attributes':[{'key':k,'value':v} for k,v in attrs.items()]}
def result():
    return {'height':'20','finalize_block_events':[
        event('transfer',sender=block.FEES,recipient=block.DISTRIBUTION,amount='100ujuno,2uatom',mode='BeginBlock'),
        event('rewards',validator='junovaloper1a',amount='89.999999999999999999ujuno,1.8uatom',mode='BeginBlock'),
        event('commission',validator='junovaloper1a',amount='9ujuno',mode='BeginBlock')], 'txs_results':[]}
def ledger():
    a={'height':20,'timestamp':'2026-10-01T00:00:01Z','hash':'A'*64}
    b={'height':21,'timestamp':'2026-10-01T00:00:04Z','hash':'B'*64}
    return {'schema_version':1,'chain_id':block.CHAIN,'accounting_start':block.START,'distribution':block.DISTRIBUTION,
            'ranges':[{'id':'juno-1:distribution:20-21','start':a,'end':b,'blocks':2,
                'amounts':{'ujuno':'2000000.000000000000000001'},'results_sha256':'a'*64,
                'source':block.RPC,'method':'fee-collector-transfers-minus-validator-rewards'}]}

class Blocks(unittest.TestCase):
    def test_compressed_checkpoint_is_lossless_and_supports_recovered_json(self):
        with TemporaryDirectory() as directory:
            path=Path(directory)/'blocks.json.gz';data=ledger()
            block.write(path.with_suffix(''),data)
            self.assertEqual(block.read_ledger(path),data)
            block.write(path,data);first=path.read_bytes()
            self.assertEqual(block.read_ledger(path),data)
            block.write(path,data);self.assertEqual(path.read_bytes(),first)
    def test_stale_block_scan_and_failed_receipt_refresh_remain_visible(self):
        data=ledger();data.update(status='CURRENT',last_success_at='2026-10-01T00:00:04Z',last_scanned_height=21,target_height=21)
        data['ranges'][0].update(module_transfers=[],transaction_evidence=[])
        with TemporaryDirectory() as directory:
            path=Path(directory)/'blocks.json.gz';block.write(path,data)
            with patch.object(statement,'OUT',path),patch.object(statement,'prices_for',return_value={}):
                feed,accounting=statement.build({}, {'events':[],'warnings':['Funding RPC failed'],'status':'UNAVAILABLE'}, {'entries':[],'refresh_status':'unavailable'})
        self.assertEqual(feed['block_coverage']['status'],'STALE')
        self.assertIn('Funding RPC failed',feed['warnings'])
        self.assertEqual(accounting['refresh_status'],'unavailable')
        self.assertEqual(len(accounting['entries']),1)
    def test_exact_residual_not_current_tax_or_commission(self):
        values,extra,tx=block.allocation(result(),20)
        self.assertEqual(values,{'ujuno':'10.000000000000000001','uatom':'0.2'})
        self.assertEqual(extra,[]);self.assertEqual(tx,[])
    def test_missing_duplicate_and_negative_results_fail(self):
        for mutate in [lambda d:d.update(height='21'),lambda d:d['finalize_block_events'].pop(0),
                       lambda d:d['finalize_block_events'].append(d['finalize_block_events'][1]),
                       lambda d:d['finalize_block_events'][1].update(attributes=event('rewards',validator='junovaloper1a',amount='101ujuno',mode='BeginBlock')['attributes'])]:
            d=result();mutate(d)
            with self.assertRaises(ValueError):block.allocation(d,20)
    def test_reward_withdrawals_never_become_pool_expenses(self):
        d=result();events=[event('transfer',sender=block.DISTRIBUTION,recipient='user',amount='10ujuno'),event('withdraw_rewards',amount='10ujuno')]
        d['txs_results']=[{'code':0,'events':events},{'code':4,'events':events}]
        values,_,tx=block.allocation(d,20)
        self.assertEqual(len(tx),1);self.assertEqual(tx[0]['events'],events)
        self.assertEqual(values['ujuno'],'10.000000000000000001')
    def test_contiguity_cutoff_and_identity(self):
        d=ledger();block.validate(d)
        for mutate in [lambda d:d.update(chain_id='wrong'),lambda d:d['ranges'].append(copy.deepcopy(d['ranges'][0])),lambda d:d['ranges'][0]['start'].update(timestamp='2026-09-30T00:00:00Z')]:
            d=ledger();mutate(d)
            with self.assertRaises(ValueError):block.validate(d)
    def test_projection_preserves_fractional_tokens_and_unpriced_evidence(self):
        d=ledger();events,entries=statement.project(d,{})
        self.assertIsNone(entries[0]['usd_value']);self.assertEqual(entries[0]['amount'],'2.000000000000000000000001')
        self.assertIsNone(events[0]['tx_hash']);self.assertTrue(events[0]['explorer_url'].endswith('/21'))
        q={'decimals':6,'symbol':'JUNO','usd_price':'0.01'}
        _,entries=statement.project(d,{'2026-10-01:ujuno':q})
        self.assertEqual(entries[0]['usd_value'],'0.020000000000000000')

if __name__=='__main__':unittest.main()
