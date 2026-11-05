import copy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import staking_block_receipts as blocks
import update_treasury_events as receipts
from staking_accrual import ADDRESS, claim_rows, interval
from update_generic_accounting import build
from tests.test_generic_accounting import DAOS, feed

DAO = next(d for d in DAOS if d['id'] == 'juno-delegation')
CHAIN = {**receipts.CHAINS[0], 'address': ADDRESS, 'staking_rewards': True}
VAL = 'junovaloper12rkgnycfaqqyclrhquzerrm4nfwg6um26l2aqw'
LONG_VAL = 'junovaloper185hgkqs8q8ysnc8cvkgd8j2knnq2m0ah6ae73gntv9ampgwpmrxqlfzywn'
ANCHOR = {'height': 150, 'hash': 'A' * 64, 'timestamp': '2026-10-06T12:00:00Z'}


def ev(kind, **values):
    return {'type': kind, 'attributes': [{'key': k, 'value': v} for k, v in {'mode': 'EndBlock', **values}.items()]}


def capture():
    pay = ev('transfer', sender=blocks.DISTRIBUTION, recipient=ADDRESS, amount='105ujuno')
    events = [pay, ev('withdraw_rewards', delegator=ADDRESS, validator=VAL, amount='105ujuno'),
              ev('withdraw_rewards', delegator=ADDRESS, validator=LONG_VAL, amount='0stake')]
    recorded = [{'index': 0, 'type': 'transfer', **blocks.attributes(pay)}]
    chunk = {'id': 'juno-1:distribution:150-150', 'start': ANCHOR, 'end': ANCHOR, 'blocks': 1,
             'module_transfers': [{'height': 150, 'events': recorded}]}
    ledger = {'schema_version': 1, 'chain_id': 'juno-1', 'accounting_start': '2026-10-01T00:00:00Z',
              'distribution': blocks.DISTRIBUTION, 'ranges': [chunk]}
    return ledger, {'height': '150', 'finalize_block_events': events}


class FinalizedRewards(unittest.TestCase):
    def load(self, ledger, raw, old=()):
        with patch.object(blocks, 'read_ledger', return_value=ledger), patch.object(blocks, 'header', return_value=ANCHOR), \
                patch.object(blocks, 'rpc', return_value=raw) as rpc:
            rows, low, high = blocks.collect(CHAIN, {'ujuno': {'symbol': 'JUNO', 'decimals': 6}}, old, 155)
        self.assertEqual((low, high), (150, 150))
        return rows, rpc.call_count

    def test_replay_payout_settlement_and_accrual(self):
        ledger, raw = capture()
        rows, n = self.load(ledger, raw)
        self.assertEqual(n, 1)
        self.assertEqual(self.load(ledger, None, rows), (rows, 0))
        self.assertIsNone(rows[0]['tx_hash'])
        self.assertEqual([r['amounts'] for r in rows[0]['reward_withdrawals']], [{'ujuno': '105'}, {}])
        data = feed(DAO); data['events'] = rows
        result = build(DAO, data)
        self.assertEqual(result['entries'], [])
        self.assertEqual([r['raw_amount'] for r in result['reward_settlements']], ['105'])
        a = {**ANCHOR, 'height': 100, 'timestamp': '2026-10-06T00:00:00Z', 'rewards': {'ujuno': '100'}}
        b = {**ANCHOR, 'height': 200, 'rewards': {'ujuno': '5'}}
        self.assertEqual(interval(a, b, claim_rows(data, a, b))['amounts'], {'ujuno': '10'})

    def test_reject_missing_mismatched_or_changed_evidence(self):
        ledger, raw = capture()
        rows, _ = self.load(ledger, raw)
        for k in ('amount', 'recipient'):
            bad = copy.deepcopy(raw)
            bad['finalize_block_events'][0]['attributes'][-1 if k == 'amount' else -2]['value'] = 'wrong'
            with self.assertRaises(ValueError): self.load(ledger, bad)
        bad = copy.deepcopy(raw)
        bad['finalize_block_events'][1]['attributes'][-1]['value'] = '91ujuno'
        with self.assertRaisesRegex(ValueError, 'does not match'): self.load(ledger, bad)
        modified = copy.deepcopy(rows)
        modified[0]['evidence']['proof']['claims'][1]['validator'] = VAL
        with self.assertRaisesRegex(ValueError, 'Retained block'): self.load(ledger, None, modified)
        ledger['ranges'][0]['module_transfers'] = []
        with self.assertRaisesRegex(ValueError, 'missing'): self.load(ledger, None, rows)

    def test_unrelated_module_transfer_stays_unreviewed(self):
        ledger, raw = capture()
        raw['finalize_block_events'] = raw['finalize_block_events'][:1]
        rows, _ = self.load(ledger, raw)
        data = feed(DAO); data['events'] = rows
        result = build(DAO, data)
        self.assertEqual(result['reward_settlements'], [])
        self.assertEqual(result['movement_review']['unreviewed_movements'], 1)

    def test_previous_block_events_never_enter_transaction_search(self):
        ledger, raw = capture()
        rows, _ = self.load(ledger, raw)
        with patch.object(receipts, 'receipt_scan', return_value=({}, {})) as scan:
            result, _ = receipts.collect_receipt_chain(CHAIN, rows, {}, {})
        self.assertEqual(result, [])
        self.assertEqual(scan.call_args.args[3], [])
