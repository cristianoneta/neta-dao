import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zlib
from test_validator_history import history, item
from validator_governance import governance_history, account_bytes

# Independent Bech32 test encoder, including 20- and 32-byte Cosmos addresses.
def encode(prefix, raw):
    bits = ''.join(f'{b:08b}' for b in raw)
    bits += '0' * ((5 - len(bits) % 5) % 5)
    words = [int(bits[i:i+5], 2) for i in range(0, len(bits), 5)]
    values = [ord(c) >> 5 for c in prefix] + [0] + [ord(c) & 31 for c in prefix] + words + [0]*6
    checksum = 1
    for value in values:
        top, checksum = checksum >> 25, ((checksum & 0x1ffffff) << 5) ^ value
        for i, generator in enumerate((0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3)):
            if (top >> i) & 1:
                checksum ^= generator
    checksum ^= 1
    alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
    return prefix + '1' + ''.join(alphabet[w] for w in words + [(checksum >> (5*(5-i))) & 31 for i in range(6)])


def event(kind, attrs, index=0, scope='tx:0'):
    return {'type': kind, 'scope': scope, 'index': index,
            'attributes': [{'key': k, 'value': v} for k, v in attrs.items()]}


class GovernanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'history.sqlite3'
        self.db = history.connect(self.path)
        history.initialize(self.db, '2026-10-14T19:17:50Z', 10, history.RPC, history.REST)
        self.operator = encode('junovaloper', bytes([7])*20)
        self.voter = encode('juno', bytes([7])*20)
        self.start = event('submit_proposal', {'voting_period_start': '1'})
        self.vote = event('proposal_vote', {'proposal_id': '1', 'voter': self.voter, 'option': 'VOTE_OPTION_ABSTAIN:1'})
        self.end = event('active_proposal', {'proposal_id': '1', 'proposal_result': 'proposal_passed'}, scope='block')

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def fill(self, events=None):
        events = events if events is not None else {11: [self.start], 12: [self.vote], 14: [self.end]}
        for h in range(10, 16):
            block = item(h, when=f'2026-10-14T19:17:{40+h}Z')
            block['events'] = events.get(h, [])
            history.append(self.db, block)
        return {'height': 15, 'blockTime': '2026-10-14T19:17:55Z', 'validators': [
            {'address': self.operator, 'consensusAddress': item()['roster'][0]}]}

    def test_young_complete_local_period_with_accepted_own_vote_requires_no_network(self):
        snapshot = self.fill()
        with patch('urllib.request.urlopen', side_effect=AssertionError('No external backfill')):
            result = governance_history(self.path, snapshot)
        self.assertEqual(len(result['proposals']), 1)
        self.assertEqual(result['proposals'][0]['votes'][0]['voter'], self.operator)
        self.assertEqual(result['validators'][0]['firstHeight'], 10)
        self.assertEqual(result['coverage']['start']['height'], 10)

    def test_weighted_authorized_repeated_votes_use_real_voter_and_count_once(self):
        repeat = copy.deepcopy(self.vote)
        repeat['attributes'][-1]['value'] = 'VOTE_OPTION_YES:0.5,VOTE_OPTION_NO:0.5'
        other = event('proposal_vote', {'proposal_id': '1', 'voter': encode('juno', bytes([8])*20), 'option': 'VOTE_OPTION_YES:1'}, 1)
        s = self.fill({11: [self.start], 12: [self.vote, other], 13: [repeat], 14: [self.end]})
        votes = governance_history(self.path, s)['proposals'][0]['votes']
        self.assertEqual(len(votes), 1)
        self.assertEqual(votes[0]['height'], 13)
        self.assertIn('0.5', votes[0]['option'])

    def test_deposit_trigger_starts_period_and_execution_failure_counts(self):
        self.start['type'] = 'proposal_deposit'
        self.end['attributes'][1]['value'] = 'proposal_failed'
        result = governance_history(self.path, self.fill())
        self.assertEqual(result['proposals'][0]['end']['result'], 'proposal_failed')
        kept = history.selected_events({'finalize_block_events': [], 'txs_results': [{'code': 0, 'events': [self.start]}]})
        self.assertEqual(kept[0]['type'], 'proposal_deposit')

    def test_open_deposit_partial_and_cancelled_periods_do_not_become_missed_votes(self):
        s = self.fill({12: [self.vote], 14: [self.end]})
        result = governance_history(self.path, s)
        self.assertEqual(result['proposals'], [])
        self.assertEqual(result['excluded'], [{'id': '1', 'reason': 'voting-start-not-observed'}])
        self.db.execute('DELETE FROM events'); self.db.execute('DELETE FROM event_checks'); self.db.execute("DELETE FROM meta WHERE key='eventChecksStart'");self.db.commit()
        self.assertEqual(governance_history(self.path, s)['proposals'], [])

    def test_cancelled_period_and_expedited_conversion_are_not_terminal_samples(self):
        expedited = copy.deepcopy(self.end);expedited['attributes'][1]['value'] = 'expedited_proposal_rejected'
        cancel = event('cancel_proposal', {'proposal_id': '1'})
        s = self.fill({11: [self.start], 12: [self.vote], 13: [expedited], 14: [cancel]})
        self.assertEqual(governance_history(self.path, s)['proposals'], [])
        kept = history.selected_events({'finalize_block_events': [], 'txs_results': [{'code': 0, 'events': [cancel]}, {'code': 1, 'events': [self.vote]}]})
        self.assertEqual([v['type'] for v in kept], ['cancel_proposal'])

    def test_later_terminal_result_after_expedited_conversion_counts_once(self):
        expedited = copy.deepcopy(self.end);expedited['attributes'][1]['value'] = 'expedited_proposal_rejected'
        s = self.fill({11: [self.start], 12: [self.vote], 13: [expedited], 14: [self.end]})
        self.assertEqual(len(governance_history(self.path, s)['proposals']), 1)

    def test_missing_voter_and_message_without_ballot_fail_closed(self):
        self.vote['attributes'] = [a for a in self.vote['attributes'] if a['key'] != 'voter']
        s = self.fill()
        with self.assertRaisesRegex(ValueError, 'voter'):
            governance_history(self.path, s)

    def test_accepted_message_without_complete_vote_is_not_nonparticipation(self):
        s = self.fill({11:[self.start],12:[event('message',{'action':'/cosmos.gov.v1.MsgVote'})],14:[self.end]})
        with self.assertRaisesRegex(ValueError, 'no complete ballot'):
            governance_history(self.path,s)

    def test_deleted_events_and_corrupt_payload_cannot_silently_lower_score(self):
        s = self.fill()
        self.db.execute('DELETE FROM events WHERE height=12');self.db.commit()
        with self.assertRaisesRegex(ValueError, 'Missing captured'):
            governance_history(self.path,s)

    def test_changed_events_and_missing_integrity_record_fail_closed(self):
        s = self.fill()
        self.db.execute('UPDATE events SET payload=? WHERE height=12',(zlib.compress(b'[]'),));self.db.commit()
        with self.assertRaisesRegex(ValueError, 'events changed'):
            governance_history(self.path,s)
        self.db.execute('DELETE FROM event_checks WHERE height=10');self.db.commit()
        with self.assertRaisesRegex(ValueError,'integrity record'):
            governance_history(self.path,s)

    def test_missing_prefix_and_internal_block_gap_cannot_restart_collection(self):
        s = self.fill()
        self.db.execute('DELETE FROM blocks WHERE height=12');self.db.commit()
        with self.assertRaisesRegex(ValueError,'continuity'):
            governance_history(self.path,s)
        self.db.execute('DELETE FROM blocks WHERE height=10');self.db.commit()
        with self.assertRaisesRegex(ValueError,'origin'):
            governance_history(self.path,s)

    def test_first_entry_survives_exit_reentry_and_additive_upgrade(self):
        s = self.fill()
        original = self.db.execute('SELECT * FROM first_entries ORDER BY address').fetchall()
        self.db.execute('DELETE FROM streaks');self.db.commit()
        history.append(self.db, item(16, when='2026-10-14T19:17:56Z'))
        self.assertEqual(self.db.execute('SELECT * FROM first_entries ORDER BY address').fetchall(),original)
        self.db.execute('DROP TABLE first_entries');self.db.commit();self.db.close()
        self.db = history.connect(self.path)
        self.assertEqual(self.db.execute('SELECT * FROM first_entries ORDER BY address').fetchall(),original)
        self.assertEqual(governance_history(self.path,s)['validators'][0]['firstHeight'],10)

    def test_checksum_prefix_and_long_account_validation(self):
        for size in (20,32):
            raw=bytes(range(size))
            self.assertEqual(account_bytes(encode('juno',raw),'juno'),raw)
            self.assertEqual(account_bytes(encode('junovaloper',raw),'junovaloper'),raw)
        with self.assertRaises(ValueError):account_bytes(self.voter[:-1]+'x','juno')
        with self.assertRaises(ValueError):account_bytes(self.operator,'juno')

    def test_read_only_export_does_not_create_missing_database(self):
        path=Path(self.tmp.name)/'missing.sqlite3'
        with self.assertRaises(Exception):governance_history(path,{})
        self.assertFalse(path.exists())
