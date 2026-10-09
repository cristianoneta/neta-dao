import base64
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from staking_accrual import collect, interval, validate, ADDRESS
from staking_reward_rpc import decode_rewards, historical_rewards, query
from update_delegation_treasury import staking_positions


def field(number, value):
    value = value.encode() if isinstance(value, str) else value
    length, encoded = len(value), bytearray()
    while length > 127:
        encoded.append((length & 127) | 128)
        length >>= 7
    return bytes([number * 8 + 2]) + bytes(encoded) + bytes([length]) + value


def reward_coin(amount):
    return field(1, 'ujuno') + field(2, amount)


def reward_sample(height, amount, timestamp, boundary=None):
    row = dict(height=height, hash='A'*64, rewards={'ujuno': str(amount)},
               timestamp=timestamp, source='fixture', method='withdrawable-rewards-truncated-per-validator')
    if boundary:
        row['boundary_at'] = boundary
    return row


class HistoricalRewards(unittest.TestCase):
    def test_sdk_decimal_scale_and_per_validator_truncation(self):
        validators = ['junovaloper1' + 'q'*38, 'junovaloper1' + 'q'*58]
        raw = b''.join(field(1, field(1, v) + field(2, reward_coin('1900000000000000000'))) for v in validators)
        raw += field(2, reward_coin('3800000000000000000'))
        decoded = decode_rewards(raw)
        self.assertEqual(decoded['total'][0]['amount'], '3.800000000000000000')
        self.assertEqual(staking_positions([], [], decoded, ADDRESS)['rewards'], [{'denom':'ujuno','amount':'2'}])
        decoded['total'][0]['amount'] = '4'
        with self.assertRaises(ValueError):
            staking_positions([], [], decoded, ADDRESS)

    def test_corrupt_unknown_duplicate_or_negative_fields_fail(self):
        row = field(1, 'junovaloper1'+'q'*38) + field(2, reward_coin('-1'))
        for raw in [b'\x0a\x05x', b'\x08\x00', b'\x1a\x00', field(1, row), field(2, field(1,'ujuno')+field(1,'other')+field(2,'1'))]:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                decode_rewards(raw)

    def test_rpc_rejects_unconfirmed_height_pruning_and_oversized_body(self):
        response = MagicMock()
        response.__enter__.return_value = response
        with patch('staking_reward_rpc.urlopen', return_value=response) as opened:
            valid = {'result':{'response':{'code':0,'height':'42','value':base64.b64encode(b'valid').decode()}}}
            response.read.return_value = json.dumps(valid).encode()
            self.assertEqual(query('DelegationTotalRewards', ADDRESS, 42), b'valid')
            self.assertIn('height=42', opened.call_args.args[0].full_url)
            self.assertEqual(opened.call_args.kwargs['timeout'], 12)
            for changes in [{'height':'43'}, {'height':42}, {'height':None}, {'code':38}, {'code':False}, {'value':'not base64'}]:
                payload = copy.deepcopy(valid);payload['result']['response'].update(changes)
                response.read.return_value = json.dumps(payload).encode()
                with self.subTest(changes=changes), self.assertRaises(ValueError):
                    query('DelegationTotalRewards', ADDRESS, 42)
            response.read.return_value = b'x'*(512*1024+1)
            with self.assertRaises(ValueError):query('DelegationTotalRewards', ADDRESS, 42)

    def test_historical_withdrawal_owner_is_required(self):
        with patch('staking_reward_rpc.query', side_effect=[b'',field(1,'another-owner')]):
            with self.assertRaisesRegex(ValueError, 'owner changed'):
                historical_rewards(ADDRESS,42)


class Catchup(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)/'archive.json'
        first=reward_sample(100,100,'2026-10-06T13:00:00Z')
        end=reward_sample(200,110,'2026-10-06T15:00:00Z')
        self.data=dict(schema_version=1,chain_id='juno-1',treasury_address=ADDRESS,
                       opening=first,intervals=[interval(first,end,[])],last_sample_day='2099-01-01')
        self.path.write_text(json.dumps(self.data))
        self.dao={'core':ADDRESS}
        self.snapshot=dict(chain_id='juno-1',treasury_address=ADDRESS,height=1000,
                           generated_at='2026-10-09T01:00:00Z',balance_source='fixture')
        self.events={'status':'PARTIAL','sources':[{'last_scanned_height':1000}],'events':[]}
        self.samples=[reward_sample(300,120,'2026-10-06T23:59:59Z','2026-10-07T00:00:00Z'),
                      reward_sample(400,140,'2026-10-07T23:59:59Z','2026-10-08T00:00:00Z'),
                      reward_sample(500,170,'2026-10-08T23:59:59Z','2026-10-09T00:00:00Z')]

    def test_bounded_catchup_resumes_on_same_day_and_keeps_original_interval(self):
        with patch('staking_accrual.closing_sample', side_effect=self.samples) as closing:
            first=collect(self.dao,self.snapshot,self.events,self.path,max_intervals=1)
            self.assertEqual(len(first['intervals']),2);self.assertTrue(first['catchup_pending'])
            second=collect(self.dao,self.snapshot,self.events,self.path,max_intervals=2)
            self.assertEqual(closing.call_count,3)
        self.assertFalse(second['catchup_pending']);self.assertEqual(validate(second)['height'],500)
        self.assertEqual(second['intervals'][0],self.data['intervals'][0])
        self.assertEqual([r['day'] for r in second['intervals'][1:]],['2026-10-06','2026-10-07','2026-10-08'])
        before=self.path.read_bytes()
        with patch('staking_accrual.closing_sample', side_effect=AssertionError('duplicate query')):
            self.assertEqual(collect(self.dao,self.snapshot,self.events,self.path),second)
        self.assertEqual(before,self.path.read_bytes())

    def test_later_failure_preserves_completed_checkpoint(self):
        with patch('staking_accrual.closing_sample', side_effect=[self.samples[0],ValueError('pruned')]):
            with self.assertRaisesRegex(ValueError,'pruned'):
                collect(self.dao,self.snapshot,self.events,self.path)
        retained=json.loads(self.path.read_text());self.assertEqual(validate(retained)['height'],300)
        self.assertTrue(retained['catchup_pending'])

    def test_expired_budget_reports_pending_without_touching_archive(self):
        before = self.path.read_bytes()
        with patch('staking_accrual.time.monotonic', side_effect=[0, 91]):
            with patch('staking_accrual.closing_sample') as closing:
                result = collect(self.dao, self.snapshot, self.events, self.path)
        closing.assert_not_called()
        self.assertTrue(result['catchup_pending'])
        self.assertEqual(before, self.path.read_bytes())

    def test_missing_receipts_and_wrong_identity_never_modify_archive(self):
        before=self.path.read_bytes();self.events['sources'][0]['last_scanned_height']=299
        with patch('staking_accrual.closing_sample', return_value=self.samples[0]):
            with self.assertRaisesRegex(ValueError,'Receipt scan'):
                collect(self.dao,self.snapshot,self.events,self.path)
        self.snapshot['chain_id']='uni-7'
        with self.assertRaisesRegex(ValueError,'identity'):
            collect(self.dao,self.snapshot,self.events,self.path)
        self.assertEqual(before,self.path.read_bytes())


if __name__ == '__main__':
    unittest.main()
