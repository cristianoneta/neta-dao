import base64
import copy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import juno_upgrade_lifecycle as lifecycle
import update_validator_upgrades as scanner


class LifecycleTests(unittest.TestCase):
    now = 1791475200

    def proposal(self, status='PROPOSAL_STATUS_PASSED', height=1000):
        return {'id': '32', 'status': status, 'title': 'Title is never parsed', 'messages': [
            {'@type': lifecycle.MODERN, 'plan': {'name': 'v32.1-rc', 'height': str(height)}}]}

    def observations(self, proposal=None, active=True, height=900):
        proposal = proposal or self.proposal()
        return [{'source': source, 'chainId': 'juno-1', 'complete': True, 'height': height,
                 'activePlan': proposal['messages'][0]['plan'] if active else None,
                 'proposals': [copy.deepcopy(proposal)]} for source in lifecycle.GOVERNANCE_SOURCES]

    def registry(self):
        return {'schema': 1, 'chainId': 'juno-1', 'events': {}}

    def scheduled(self):
        registry = lifecycle.reconcile(self.registry(), self.observations(), self.now)
        return next(iter(registry['events'].values()))

    def anchored(self):
        event = self.scheduled()
        validators = [{'address': str(i + 1) * 40, 'voting_power': str(power),
                       'pub_key': {'type': 'tendermint/PubKeyEd25519', 'value': base64.b64encode(bytes([i + 1]) * 32).decode()}}
                      for i, power in enumerate([40, 30, 20, 10])]
        block = {'canonical': True, 'signed_header': {
            'header': {'chain_id': 'juno-1', 'height': '999', 'time': lifecycle.timestamp(self.now),
                       'validators_hash': 'C' * 64},
            'commit': {'height': '999', 'round': 0, 'block_id': {'hash': 'A' * 64}}}}
        sets = {'block_height': '1000', 'validators': validators, 'count': '4', 'total': '4'}
        anchored = lifecycle.anchor(event, [block, copy.deepcopy(block)], [sets, copy.deepcopy(sets)], self.now)
        state = {'schema': 1, 'upgradeId': event['id'], 'chainId': 'juno-1', 'upgradeHeight': 999,
                 'halt': anchored['halt'], 'sources': scanner.SOURCES, 'validators': anchored['validators'],
                 'firstSignatures': anchored['firstSignatures'], 'firstResumedSignatureTime': None,
                 'scannedThrough': 999, 'scannedHash': 'A' * 64, 'complete': False}
        resumed = {'header': {'height': '1000', 'chain_id': 'juno-1', 'time': lifecycle.timestamp(self.now),
                             'validators_hash': 'C' * 64, 'last_block_id': {'hash': 'A' * 64}},
                   'commit': {'height': '1000', 'round': 0, 'block_id': {'hash': 'B' * 64},
                              'signatures': [{'block_id_flag': 2, 'validator_address': v['address'],
                                              'timestamp': lifecycle.timestamp(self.now + 10),
                                              'signature': base64.b64encode(bytes(64)).decode()} for v in validators]}}
        return anchored, state, resumed, validators

    def consume(self, state, block, validators):
        with patch.object(scanner.time, 'time', return_value=self.now + 20000):
            return scanner.consume(state, block, validators)

    def test_only_actual_modern_or_legacy_upgrade_messages(self):
        self.assertEqual(lifecycle.upgrades([self.proposal()])[0]['plan']['name'], 'v32.1-rc')
        fake = {'id': '5', 'status': 3, 'title': 'Software upgrade v99', 'messages': [{'@type': '/bank.Send'}]}
        self.assertEqual(lifecycle.upgrades([fake]), [])
        p = self.proposal(); p['messages'][0]['@type'] = lifecycle.LEGACY
        self.assertEqual(len(lifecycle.upgrades([p])), 1)
        p['messages'] = [{'@type': lifecycle.WRAPPER, 'content': p['messages'][0]}]
        self.assertEqual(len(lifecycle.upgrades([p])), 1)
        p['content'] = p.pop('messages')[0]['content']
        self.assertEqual(len(lifecycle.upgrades([p])), 1)

    def test_repeated_reads_are_idempotent_and_title_independent(self):
        observations = self.observations()
        first = lifecycle.reconcile(self.registry(), observations, self.now)
        self.assertEqual(first, lifecycle.reconcile(first, observations, self.now))
        for source in observations: source['proposals'][0]['title'] = '../../untrusted title'
        self.assertEqual(first, lifecycle.reconcile(first, observations, self.now))
        event = next(iter(first['events'].values()))
        self.assertRegex(event['id'], r'^juno-plan-[0-9a-f]{24}$')

    def test_passage_and_matching_active_plan_are_both_required(self):
        for status, active, expected in [('PROPOSAL_STATUS_VOTING_PERIOD', True, 'voting'),
                                          ('PROPOSAL_STATUS_PASSED', False, 'not-scheduled'),
                                          ('PROPOSAL_STATUS_REJECTED', False, 'rejected'),
                                          ('PROPOSAL_STATUS_FAILED', False, 'failed')]:
            registry = lifecycle.reconcile(self.registry(), self.observations(self.proposal(status), active), self.now)
            event = next(iter(registry['events'].values()))
            self.assertEqual(event['status'], expected)
            with self.assertRaises(ValueError): lifecycle.anchor(event, [], [], self.now)

    def test_plan_revision_keeps_one_permanent_event_and_cancellation_does_not_start_it(self):
        first = lifecycle.reconcile(self.registry(), self.observations(), self.now)
        revised = self.proposal(height=1200); revised['id'] = '33'
        second = lifecycle.reconcile(first, self.observations(revised), self.now + 1)
        self.assertEqual(list(first['events']), list(second['events']))
        event = next(iter(second['events'].values()))
        self.assertEqual(event['revisions'][0]['plan']['height'], 1000)
        cancelled = lifecycle.reconcile(second, self.observations(revised, active=False), self.now + 2)
        self.assertEqual(next(iter(cancelled['events'].values()))['status'], 'cancelled')

    def test_unknown_historical_plan_is_not_assumed_to_have_executed(self):
        event = next(iter(lifecycle.reconcile(self.registry(), self.observations(active=False, height=1100), self.now)['events'].values()))
        self.assertEqual(event['status'], 'not-scheduled')
        with self.assertRaises(ValueError): lifecycle.anchor(event, [], [], self.now)

    def test_disagreement_partial_wrong_chain_or_duplicate_source_preserves_registry(self):
        for mutate in [lambda p: p[1].update(height=901), lambda p: p[1].update(complete=False),
                       lambda p: p[1].update(chainId='uni-7'), lambda p: p[1].update(source=p[0]['source']),
                       lambda p: p[1].update(activePlan=None), lambda p: p[1].pop('activePlan')]:
            observations = self.observations(); mutate(observations)
            registry = self.registry(); before = copy.deepcopy(registry)
            with self.assertRaises(ValueError): lifecycle.reconcile(registry, observations, self.now)
            self.assertEqual(registry, before)

    def test_anchor_uses_last_committed_block_not_execution_height_or_eta(self):
        event, _, _, _ = self.anchored()
        self.assertEqual(event['plan']['height'], 1000)
        self.assertEqual(event['halt']['height'], 999)
        self.assertEqual(lifecycle.instant(event['deadline']) - lifecycle.instant(event['halt']['time']), 18000)
        self.assertEqual(lifecycle.anchor(event, [], [], self.now + 500), event)

    def test_all_baseline_signatures_and_resumption_close_early(self):
        event, state, block, validators = self.anchored()
        history = self.consume(state, block, validators)
        closed = lifecycle.observe(event, history, self.now + 11)
        self.assertEqual(closed['reason'], 'all-validators-evidenced')
        self.assertTrue(closed['coverageComplete'])
        self.assertEqual(lifecycle.observe(closed, {'bad': 'late writer'}, self.now + 99999), closed)

    def test_quorum_is_not_all_validators_and_partial_deadline_does_not_claim_absence(self):
        event, state, block, validators = self.anchored()
        block['commit']['signatures'][-1] = {'block_id_flag': 1, 'validator_address': '', 'signature': None}
        history = self.consume(state, block, validators)
        current = lifecycle.observe(event, history, self.now + 11)
        self.assertEqual(current['status'], 'observing')
        closed = lifecycle.observe(current, None, self.now + 18000)
        self.assertEqual(closed['reason'], 'five-hour-limit')
        self.assertEqual(closed['missingEvidenceNote'], 'Observation coverage incomplete')
        self.assertFalse(closed['coverageComplete'])

    def test_late_signature_is_excluded_and_deadline_never_extended(self):
        event, state, block, validators = self.anchored()
        block['commit']['signatures'][-1]['timestamp'] = lifecycle.timestamp(self.now + 18001)
        history = self.consume(state, block, validators)
        history['scannedBlockTime'] = lifecycle.timestamp(self.now + 18002)
        closed = lifecycle.observe(event, history, self.now + 18003)
        self.assertIsNone(closed['firstSignatures'][validators[-1]['address']])
        self.assertEqual(closed['endedAt'], event['deadline'])
        self.assertEqual(closed['missingEvidenceNote'], 'No upgrade evidenced within 5h')
        self.assertEqual(closed['reason'], 'five-hour-limit')

    def test_changed_baseline_and_watermark_are_rejected(self):
        event, state, block, validators = self.anchored()
        history = self.consume(state, block, validators)
        current = lifecycle.observe(event, None, self.now + 1)
        changed = copy.deepcopy(history); changed['validators'][0]['power'] = '39'
        with self.assertRaises(ValueError): lifecycle.observe(current, changed, self.now + 11)
        current['scannedThrough'] = 1001
        with self.assertRaises(ValueError): lifecycle.observe(current, history, self.now + 11)
        current['deadline'] = lifecycle.timestamp(self.now + 18001)
        with self.assertRaises(ValueError): lifecycle.observe(current, None, self.now + 11)

    def test_closed_archive_is_preserved_across_proposal_refresh(self):
        event, state, block, validators = self.anchored()
        closed = lifecycle.observe(event, self.consume(state, block, validators), self.now + 11)
        registry = self.registry(); registry['events'][closed['id']] = closed
        updated = lifecycle.reconcile(registry, self.observations(self.proposal(height=9999)), self.now + 20)
        self.assertEqual(updated['events'][closed['id']], closed)


if __name__ == '__main__': unittest.main()
