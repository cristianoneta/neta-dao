import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from update_delegation_treasury import staking_positions, token_list
from unittest.mock import patch

class DelegationPositions(unittest.TestCase):
    def test_count_owned_stake_once_and_truncate_rewards_per_validator(self):
        ds=[{'delegation':{'delegator_address':'dao','validator_address':'v'},'balance':{'denom':'ujuno','amount':'1000000'}}]
        us=[{'delegator_address':'dao','validator_address':'v','entries':[{'balance':'400000','initial_balance':'500000'}]}]
        rs={'rewards':[{'validator_address':'v','reward':[{'denom':'ujuno','amount':'2.9'}]},{'validator_address':'w','reward':[{'denom':'ujuno','amount':'3.9'}]}],'total':[{'denom':'ujuno','amount':'6.8'}]}
        result=staking_positions(ds,us,rs,'dao')
        self.assertEqual(result['delegated'][0]['amount'],'1000000')
        self.assertEqual(result['unbonding'][0]['amount'],'400000')
        self.assertEqual(result['rewards'][0]['amount'],'5')
        with self.assertRaises(ValueError):staking_positions(ds*2,us,rs,'dao')
        with self.assertRaises(ValueError):staking_positions(ds,us,rs,'foreign')
        rs['total'][0]['amount']='7'
        with self.assertRaises(ValueError):staking_positions(ds,us,rs,'dao')
    def test_cw20_discovery_paginates_and_rejects_repeated_pages(self):
        with patch('update_delegation_treasury.smart',side_effect=[['a'],['b'],[]]):
            self.assertEqual(token_list('base','dao',12),['a','b'])
        with patch('update_delegation_treasury.smart',side_effect=[['a'],['a']]):
            with self.assertRaises(ValueError):token_list('base','dao',12)
if __name__=='__main__':unittest.main()

class IbcIdentity(unittest.TestCase):
    def test_v10_trace_checks_hash_without_trusting_ticker_for_price(self):
        import hashlib
        from update_treasury import native_metadata
        digest=hashlib.sha256(b'transfer/channel-999/uatom').hexdigest().upper()
        payload={'denom':{'base':'uatom','trace':[{'port_id':'transfer','channel_id':'channel-999'}]}}
        with patch('update_treasury.rest',side_effect=[RuntimeError('deprecated'),(payload,'provider')]):
            meta=native_metadata('ibc/'+digest)
            self.assertEqual(meta['base_denom'],'uatom')
            self.assertIsNone(meta['decimals']);self.assertNotIn('coingecko',meta)
        with patch('update_treasury.rest',side_effect=[RuntimeError('deprecated'),(payload,'provider')]):
            with self.assertRaises(ValueError):native_metadata('ibc/'+'A'*64)
    def test_bitsong_route_is_juno_scoped(self):
        from update_treasury import native_metadata
        denom='ibc/008BFD000A10BCE5F0D4DD819AE1C1EC2942396062DABDD6AE64A655ABC7085B'
        self.assertEqual(native_metadata(denom)['symbol'],'BTSG')
        self.assertEqual(native_metadata(denom)['decimals'],6)
        with patch('update_treasury.rest',return_value=({'denom_trace':{'base_denom':'ubtsg','path':'transfer/channel-17'}},'provider')):
            self.assertNotIn('coingecko',native_metadata(denom,source_chain='osmosis'))
