import base64
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('planner', Path(__file__).resolve().parents[1] / 'scripts/update_delegation_planner.py')
planner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(planner)


class PlannerCollector(unittest.TestCase):
    def fixtures(self):
        key = {'@type': '/cosmos.crypto.ed25519.PubKey', 'key': base64.b64encode(bytes(32)).decode()}
        validator = {'operator_address': 'operator', 'consensus_pubkey': key, 'tokens': '1000', 'description': {'moniker': 'A'}, 'jailed': False, 'commission': {'commission_rates': {'rate': '0.100000000000000001'}}}
        delegation = {'delegation': {'delegator_address': 'programme', 'validator_address': 'operator'}, 'balance': {'denom': 'ujuno', 'amount': '100'}}
        return [validator], [{'pub_key': key}], [delegation]

    def test_mapping_and_commission_rounding(self):
        rows, count = planner.assemble(*self.fixtures(), 'programme')
        self.assertEqual(count, 1)
        self.assertEqual(rows[0]['currentRaw'], '100')
        self.assertEqual(rows[0]['commissionBps'], 1001)
        self.assertTrue(rows[0]['active'])

    def test_duplicates_and_missing_positions_rejected(self):
        for which in (0, 1, 2):
            values = self.fixtures()
            values[which].append(values[which][0])
            with self.assertRaises(ValueError):
                planner.assemble(*values, 'programme')
        values = self.fixtures()
        values[2][0]['delegation']['validator_address'] = 'missing'
        with self.assertRaises(ValueError):
            planner.assemble(*values, 'programme')

    def test_wrong_owner_and_overcount_rejected(self):
        with self.assertRaises(ValueError):
            planner.assemble(*self.fixtures(), 'another-programme')
        values = self.fixtures()
        values[2][0]['balance']['amount'] = '1001'
        with self.assertRaises(ValueError):
            planner.assemble(*values, 'programme')

    def test_pubkey_shape_rejected(self):
        with self.assertRaises(ValueError):
            planner.consensus_address({'@type': '/cosmos.crypto.ed25519.PubKey', 'key': 'AAAA'})


if __name__ == '__main__':
    unittest.main()
