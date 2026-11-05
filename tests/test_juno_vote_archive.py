import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from test_validator_history import history, item
from test_validator_governance import encode, event
from juno_vote_archive import ballot_options, collect


class VoteArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.path, self.state, self.public = root/'history.db', root/'state', root/'public'
        self.db = history.connect(self.path)
        self.addCleanup(self.db.close)
        history.initialize(self.db, '2026-11-05T17:15:00Z', 10, history.RPC, history.REST)
        self.voter = encode('juno', bytes([9])*20)
        self.other = encode('juno', bytes([8])*20)

    def append(self, h, events):
        time = '17:15:' if h < 12 else '17:16:'
        b = item(h, when=f'2026-11-05T{time}{h}Z')
        b['events'] = events
        history.append(self.db, b)

    def start(self, pid, index=0):
        return event('proposal_deposit', {'voting_period_start': pid}, index=index)

    def vote(self, pid, voter, choices, scope='tx:1'):
        return event('proposal_vote', {'proposal_id':pid, 'voter':voter, 'option':json.dumps(
            [{'option':v,'weight':w} for v,w in choices])},scope=scope)

    def end(self, pid, outcome='proposal_passed'):
        return event('active_proposal', {'proposal_id':pid,'proposal_result':outcome},scope='block')

    def run_archive(self):
        collect(self.path,self.state,self.public)

    def read(self, pid):
        return json.loads((self.public/(pid+'.json')).read_text())

    def test_cutover_closing_block_revotes_weighted_addresses_and_permanent_storage(self):
        self.append(10,[self.start('386'),self.start('387',1),self.start('388',2)])
        self.append(11,[self.end('386'),self.vote('387',self.voter,[(2,'1')])])
        self.run_archive()
        self.assertFalse((self.public/'386.json').exists())
        self.assertIsNone(self.read('387')['outcome'])
        self.append(12,[self.start('389'),self.vote('389', self.other,[(1,'1')])])
        self.append(13,[self.end('387'),self.vote('387',self.voter,[(1,'0.25'),(4,'0.75')],'tx:10'),
                        self.vote('387',self.voter,[(3,'1')],'tx:2'),
                        self.vote('387',self.other,[(2,'1')],'tx:5')])
        self.run_archive()
        final = self.read('387')
        self.assertEqual((final['start']['height'],final['through']['height'],final['outcome']),
                         (10,13,'proposal_passed'))
        votes={v['voter']:v['options'] for v in final['votes']}
        self.assertEqual(len(votes),2)
        self.assertEqual(votes[self.voter], [{'option':'VOTE_OPTION_YES','weight':'0.25'},
                                             {'option':'VOTE_OPTION_NO_WITH_VETO','weight':'0.75'}])
        self.assertEqual(self.read('389')['votes'][0]['voter'],self.other)
        self.assertEqual(self.read('388')['votes'],[])
        self.db.execute('DELETE FROM events'); self.db.execute('DELETE FROM blocks'); self.db.commit()
        (self.public/'387.json').unlink()
        self.run_archive()
        self.assertEqual(self.read('387'),final)

    def test_outage_does_not_replace_verified_votes_with_zero(self):
        self.append(10,[self.start('387')]); self.run_archive()
        original = self.read('387')
        self.append(11,[self.vote('387',self.voter,[(1,'1')])])
        self.db.execute('DELETE FROM events WHERE height=11');self.db.commit()
        with self.assertRaisesRegex(ValueError,'Missing captured'):
            self.run_archive()
        self.assertEqual(self.read('387'),original)
        self.append(12,[])
        self.db.execute('DELETE FROM blocks WHERE height=11');self.db.commit()
        with self.assertRaisesRegex(ValueError,'Gap'):
            self.run_archive()
        self.assertEqual(self.read('387'),original)

    def test_prior_power_preserved_and_expedited_conversion_clears_first_round(self):
        self.append(10,[self.start('387')])
        self.append(11,[self.vote('387',self.voter,[(1,'1')])]); self.run_archive()
        data = self.read('387')
        data['power'] = {'blockHash':data['through']['hash'],'height':11}
        (self.public/'387.json').write_text(json.dumps(data))
        self.append(12,[self.end('387','expedited_proposal_rejected')])
        self.append(13,[self.vote('387',self.other,[(2,'1')])])
        self.append(14,[self.end('387','proposal_rejected')]); self.run_archive()
        final = self.read('387')
        self.assertEqual([v['voter'] for v in final['votes']],[self.other])
        self.assertEqual(final['previousPower'], data['power'])

    def test_missing_start_is_partial_and_bad_weights_reject_entire_batch(self):
        self.append(10,[self.vote('387',self.other,[(1,'1')])]); self.run_archive()
        self.assertIsNone(self.read('387')['start'])
        self.append(11,[self.vote('387',self.voter,[(1,'0.1')])])
        with self.assertRaisesRegex(ValueError,'do not total'):
            self.run_archive()
        self.assertEqual(self.read('387')['through']['height'],10)
        self.assertEqual(ballot_options('[{"option":"VOTE_OPTION_NO","weight":"1.000000000000000000"}]')[0]['option'],'VOTE_OPTION_NO')
