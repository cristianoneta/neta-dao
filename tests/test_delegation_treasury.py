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
