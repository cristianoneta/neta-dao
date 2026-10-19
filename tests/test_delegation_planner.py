import base64
import importlib.util
from pathlib import Path
import unittest
import sys
import tempfile
from test_validator_history import history, item
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

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

    def test_common_archive_height_binds_every_balance_and_roster_read(self):
        vals, cons, delegations = self.fixtures()
        delegations[0]['delegation']['delegator_address'] = planner.PROGRAMME
        dao = {'core': planner.PROGRAMME, 'onChainName': 'Programme', 'coreCodeId': '1',
               'votingModule': 'voting', 'proposalModule': 'proposal'}
        class Reader:
            base = 'https://rest.example.org'
            def __init__(self):
                self.heights = []
                self.wrong_hash = False
                self.hash_override = None
            def get(self, path, height=None):
                if height is not None:
                    self.heights.append(height)
                    return {'contract_info': {'code_id': '1'}}
                h = 42500050 if path.endswith('/latest') else int(path.rsplit('/', 1)[1])
                return {'block': {'header': {'height': str(h), 'chain_id': 'juno-1',
                    'time': f'2026-10-14T19:17:{h-42500000:02d}Z'}},
                    'block_id': {'hash': self.hash_override if self.hash_override is not None else
                                 base64.b64encode(bytes(32) if self.wrong_hash else h.to_bytes(32, 'big')).decode()}}
            def smart(self, address, message, height):
                self.heights.append(height)
                if 'config' in message: return {'name': 'Programme'}
                if 'voting_module' in message: return 'voting'
                return [{'address': 'proposal', 'status': 'enabled'}]
            def pages(self, path, field, height):
                self.heights.append(height)
                if field == 'validators': return cons if 'validatorsets' in path else vals
                return {'delegation_responses': delegations, 'balances': [], 'redelegation_responses': []}[field]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'history.sqlite3'
            db = history.connect(path)
            history.initialize(db, '2026-10-14T19:17:10Z', 42500010, 'https://rpc.example.org', 'https://rest.example.org')
            for h in range(42500010, 42500014):
                history.append(db, item(h, when=f'2026-10-14T19:17:{h-42500000:02d}Z', keys=(0,), flags=(2,)))
            reader = Reader()
            result = planner.collect(reader, dao, path)
            self.assertEqual(result['height'], 42500013)
            self.assertEqual(set(reader.heights), {42500013})
            self.assertEqual(result['activeSetHistory']['spans'][0]['lastHeight'], result['height'])
            counts = result['activeSetHistory']['participation']
            self.assertEqual(counts['lastHeight'], result['height'])
            self.assertEqual(counts['endTime'], result['blockTime'])
            self.assertEqual(counts['validators'][0]['expected'], 4)
            self.assertEqual(counts['validators'][0]['signed'], 4)
            self.assertFalse(result['authority']['executionVerified'])
            reader.wrong_hash = True
            with self.assertRaisesRegex(ValueError, 'disagree'):
                planner.collect(reader, dao, path)
            for malformed in ('', 'invalid!', f'{42500013:064X}',
                              base64.b64encode(bytes(31)).decode(),
                              base64.b64encode(bytes(33)).decode()):
                with self.subTest(block_hash=malformed):
                    bad = Reader()
                    bad.hash_override = malformed
                    with self.assertRaises(ValueError):
                        planner.collect(bad, dao, path)
                    self.assertEqual(bad.heights, [])
            missing = planner.collect(Reader(), dao, Path(folder) / 'missing.sqlite3')
            self.assertEqual(missing['height'], 42500030)
            self.assertIsNone(missing['activeSetHistory'])
            self.assertIn('archive unavailable', missing['activeSetHistoryIssue'])
            self.assertFalse((Path(folder) / 'missing.sqlite3').exists())
            db.close()


if __name__ == '__main__':
    unittest.main()
