import base64
import copy
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import time
import unittest
import zlib
import sys
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

spec = importlib.util.spec_from_file_location('history', Path(__file__).resolve().parents[1] / 'scripts/validator_history.py')
history = importlib.util.module_from_spec(spec)
spec.loader.exec_module(history)


def fixtures(height=10, when='2026-10-14T19:17:50Z', keys=(1, 2, 3, 4), flags=(2, 2, 1, 3)):
    rows, signatures = [], []
    for i, (key, flag) in enumerate(zip(keys, flags)):
        raw = bytes([key]) * 32
        address = hashlib.sha256(raw).digest()[:20].hex().upper()
        rows.append({'address': address, 'voting_power': '10' if i < 2 else '1',
                     'pub_key': {'type': 'tendermint/PubKeyEd25519', 'value': base64.b64encode(raw).decode()}})
        signatures.append({'block_id_flag': flag, 'validator_address': '' if flag == 1 else address,
                           'signature': None if flag == 1 else base64.b64encode(bytes(64)).decode()})
    _, _, root = history.validator_set(rows)
    commit = {'canonical': True, 'signed_header': {
        'header': {'chain_id': 'juno-1', 'height': str(height), 'time': when,
                   'validators_hash': root.hex(), 'last_block_id': {'hash': f'{height - 1:064x}'},
                   'proposer_address': rows[0]['address']},
        'commit': {'height': str(height), 'round': 0, 'block_id': {'hash': f'{height:064x}'},
                   'signatures': signatures}}}
    results = {'height': str(height), 'finalize_block_events': [], 'txs_results': None}
    return commit, rows, results


def item(height=10, when='2026-10-14T19:17:50Z', **kwargs):
    return history.observation(height, *fixtures(height, when, **kwargs))


class FakeReader:
    rpc_base = history.RPC
    rest_base = history.REST

    def __init__(self, fail=None, metadata_fail=False):
        self.deadline = time.monotonic() + 60
        self.base = datetime.now(timezone.utc) - timedelta(seconds=20)
        self.fail, self.metadata_fail = fail, metadata_fail

    def timestamp(self, height):
        return (self.base + timedelta(seconds=height)).isoformat().replace('+00:00', 'Z')

    def rpc(self, method, **params):
        if method == 'status':
            return {'sync_info': {'latest_block_height': '8', 'earliest_block_height': '1',
                                 'latest_block_time': self.timestamp(8), 'catching_up': False}}
        if method == 'commit':
            return fixtures(params['height'], self.timestamp(params['height']))[0]
        raise AssertionError(method)

    def header(self, height):
        return {'time': self.timestamp(height)}

    def block(self, height):
        if height == self.fail:
            raise ValueError('incomplete source')
        return item(height, self.timestamp(height))

    def metadata(self, height):
        if self.metadata_fail:
            raise ValueError('pruned state')
        return {'sample': height}

    def blocks(self, heights):
        return [self.block(h) for h in heights]


class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = history.connect(Path(self.temp.name) / 'history.sqlite3')

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def initialize(self, height=10, when='2026-10-14T19:17:50Z'):
        history.initialize(self.db, when, height, history.RPC, history.REST)

    def test_missing_signature_slot_has_correct_validator_and_nil_stays_distinct(self):
        c, rows, r = fixtures()
        obs = history.observation(10, c, rows, r)
        flags = dict(zip(obs['roster'], obs['flags']))
        self.assertEqual(flags[rows[2]['address']], 1)
        self.assertEqual(flags[rows[3]['address']], 3)
        self.initialize()
        history.append(self.db, obs)
        self.assertEqual(self.db.execute('SELECT sum(expected),sum(signed),sum(absent),sum(nil),sum(proposed) FROM daily').fetchone(), (4, 2, 1, 1, 1))
        self.assertFalse(history.report(self.db)['ninetyDayWindowCollected'])

    def test_wrong_chain_height_or_noncanonical_commit_rejected(self):
        for mutate in (
                lambda c, v, r: c.update(canonical=False),
                lambda c, v, r: c['signed_header']['header'].update(chain_id='uni-7'),
                lambda c, v, r: r.update(height='9'),
                lambda c, v, r: c['signed_header']['commit'].update(height='9')):
            values = fixtures()
            mutate(*values)
            with self.assertRaises(ValueError):
                history.observation(10, *values)

    def test_modified_or_incomplete_validator_set_cannot_match_header(self):
        for mode in ('power', 'key', 'duplicate', 'truncated', 'order'):
            c, rows, r = fixtures()
            if mode == 'power':
                rows[0]['voting_power'] = '11'
            elif mode == 'key':
                rows[0]['pub_key']['value'] = base64.b64encode(bytes(32)).decode()
            elif mode == 'duplicate':
                rows[1] = copy.deepcopy(rows[0])
            elif mode == 'truncated':
                rows.pop()
            else:
                rows.reverse()
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                history.observation(10, c, rows, r)

    def test_signature_identity_truncation_and_quorum_are_checked(self):
        for mode in ('order', 'count', 'quorum', 'malformed', 'absent'):
            c, rows, r = fixtures()
            sigs = c['signed_header']['commit']['signatures']
            if mode == 'order':
                sigs[0], sigs[1] = sigs[1], sigs[0]
            elif mode == 'count':
                sigs.pop()
            elif mode == 'quorum':
                sigs[0] = {'block_id_flag': 1, 'validator_address': '', 'signature': None}
            elif mode == 'malformed':
                sigs[0]['signature'] = 'AAAA'
            else:
                sigs[2]['validator_address'] = rows[2]['address']
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                history.observation(10, c, rows, r)

    def test_events_preserve_jail_and_votes_but_ignore_failed_transactions(self):
        slash = {'type': 'slash', 'attributes': [{'key': 'jailed', 'value': 'address'}]}
        vote = {'type': 'proposal_vote', 'attributes': [{'key': 'option', 'value': 'Abstain'},
                                                        {'key': 'option', 'value': 'weighted'}]}
        c, v, r = fixtures()
        r['finalize_block_events'] = [slash, {'type': 'transfer', 'attributes': []}]
        r['txs_results'] = [{'code': 1, 'events': [vote]}, {'code': 0, 'events': [vote]}]
        events = history.observation(10, c, v, r)['events']
        self.assertEqual([e['type'] for e in events], ['slash', 'proposal_vote'])
        self.assertEqual(events[1]['scope'], 'tx:1')
        self.assertEqual(len(events[1]['attributes']), 2)
        del r['finalize_block_events']
        with self.assertRaises(ValueError):
            history.observation(10, c, v, r)

    def test_cursor_is_atomic_and_duplicates_gaps_and_changed_hashes_stop(self):
        self.initialize()
        history.append(self.db, item())
        for bad in (item(), item(12), {**item(11), 'previous': bytes(32)}):
            with self.assertRaises(ValueError):
                history.append(self.db, bad)
        self.assertEqual(history.get_meta(self.db, 'cursor')['height'], 10)
        self.assertEqual(self.db.execute('SELECT sum(expected) FROM daily').fetchone()[0], 4)
        history.append(self.db, item(11))
        self.assertEqual(self.db.execute('SELECT sum(expected) FROM daily').fetchone()[0], 8)

    def test_membership_exit_and_reentry_reset_observed_streak(self):
        self.initialize()
        history.append(self.db, item())
        gone = fixtures()[1][3]['address']
        history.append(self.db, item(11, keys=(1, 2, 3, 5)))
        self.assertIsNone(self.db.execute('SELECT * FROM streaks WHERE address=?', (gone,)).fetchone())
        history.append(self.db, item(12))
        self.assertEqual(self.db.execute('SELECT entered_height,observed_at_start FROM streaks WHERE address=?', (gone,)).fetchone(), (12, 0))
        self.assertEqual(self.db.execute('SELECT type FROM transitions WHERE address=? ORDER BY height', (gone,)).fetchall(), [('observed',), ('exit',), ('enter',)])

    def test_restart_retries_missing_height_without_counting_prefetched_blocks(self):
        reader = FakeReader(fail=5)
        start = reader.timestamp(2)
        result = history.run(self.db, reader, start)
        self.assertEqual(result['through']['height'], 4)
        self.assertEqual(result['status'], 'blocked')
        self.assertEqual(self.db.execute('SELECT count(*) FROM blocks').fetchone()[0], 3)
        reader.fail = None
        result = history.run(self.db, reader, start)
        self.assertEqual(result['through']['height'], 6)
        self.assertEqual(result['status'], 'current')
        self.assertEqual(self.db.execute('SELECT sum(expected) FROM daily').fetchone()[0], 20)
        history.run(self.db, reader, start)
        self.assertEqual(self.db.execute('SELECT sum(expected) FROM daily').fetchone()[0], 20)

    def test_metadata_failure_does_not_erase_block_coverage(self):
        reader = FakeReader(metadata_fail=True)
        result = history.run(self.db, reader, reader.timestamp(2), max_blocks=2)
        self.assertIn('pruned state', result['metadataError'])
        self.assertEqual(result['through']['height'], 3)
        self.assertEqual(result['status'], 'catching-up')
        self.assertIsNone(result['metadataHeight'])

    def test_changed_source_or_start_time_cannot_reset_coverage(self):
        reader = FakeReader()
        start = reader.timestamp(2)
        history.run(self.db, reader, start, max_blocks=1)
        with self.assertRaises(ValueError):
            history.run(self.db, reader, reader.timestamp(3))
        reader.rpc_base = 'https://other.example'
        with self.assertRaises(ValueError):
            history.run(self.db, reader, start)
        self.assertEqual(history.get_meta(self.db, 'cursor')['height'], 2)

    def test_retention_preserves_daily_totals_cursor_and_current_streaks(self):
        self.initialize(10, '2026-01-01T00:00:00Z')
        history.append(self.db, item(10, '2026-01-01T00:00:00Z'))
        history.append(self.db, item(11, '2026-01-02T00:00:00Z'))
        history.retain(self.db, '2026-05-01T12:00:00Z', archive_dir=Path(self.temp.name) / 'archive')
        self.assertEqual(self.db.execute('SELECT height FROM blocks').fetchall(), [(11,)])
        self.assertEqual(self.db.execute('SELECT sum(expected) FROM daily').fetchone()[0], 8)
        self.assertEqual(history.get_meta(self.db, 'cursor')['height'], 11)
        self.assertEqual(self.db.execute('SELECT count(*) FROM streaks').fetchone()[0], 4)

    def test_archive_failure_or_missing_destination_cannot_delete_history(self):
        self.initialize(10, '2026-01-01T00:00:00Z')
        history.append(self.db, item(10, '2026-01-01T00:00:00Z'))
        self.assertEqual(history.retain(self.db, '2026-05-01T12:00:00Z')['status'], 'retained')
        with patch('validator_archive.store', side_effect=OSError('archive unavailable')), self.assertRaises(OSError):
            history.retain(self.db, '2026-05-01T12:00:00Z', archive_dir=Path(self.temp.name) / 'archive')
        self.assertEqual(self.db.execute('SELECT height FROM blocks').fetchall(), [(10,)])

    def test_transaction_rollback_reuses_export_and_corrupt_export_blocks_pruning(self):
        self.initialize(10, '2026-01-01T00:00:00Z')
        history.append(self.db, item(10, '2026-01-01T00:00:00Z'))
        root = Path(self.temp.name) / 'archive'
        with patch.object(history, 'set_meta', side_effect=RuntimeError('interrupted before commit')), self.assertRaises(RuntimeError):
            history.retain(self.db, '2026-05-01T12:00:00Z', archive_dir=root)
        self.assertEqual(self.db.execute('SELECT height FROM blocks').fetchall(), [(10,)])
        bundle = next(root.rglob('*.json.gz'))
        original = bundle.read_bytes()
        bundle.write_bytes(b'broken archive')
        with self.assertRaises((ValueError, OSError)):
            history.retain(self.db, '2026-05-01T12:00:00Z', archive_dir=root)
        self.assertEqual(self.db.execute('SELECT height FROM blocks').fetchall(), [(10,)])
        bundle.write_bytes(original)
        history.retain(self.db, '2026-05-01T12:00:00Z', archive_dir=root)
        self.assertEqual(len(list(root.rglob('*.json.gz'))), 1)
        self.assertEqual(self.db.execute('SELECT height FROM blocks').fetchall(), [])

    def test_archived_rows_restore_exactly_including_blobs_rosters_events_and_metadata(self):
        from evidence_archive import read_bundle
        from validator_archive import decode
        self.initialize(10, '2026-01-01T00:00:00Z')
        observed = item(10, '2026-01-01T00:00:00Z')
        observed['events'] = [{'type': 'slash', 'attributes': []}]
        history.append(self.db, observed)
        with self.db:
            self.db.execute('INSERT INTO snapshots VALUES (?,?,?,?)', (10, 1767225600, zlib.compress(b'{"validator":"original"}'), 'original'))
        names = ('blocks', 'events', 'transitions', 'snapshots', 'rosters')
        original = {name: self.db.execute('SELECT * FROM ' + name).fetchall() for name in names}
        root = Path(self.temp.name) / 'archive'
        receipt = history.retain(self.db, '2026-05-01T12:00:00Z', archive_dir=root)
        bundle = read_bundle(root / receipt['path'])['payload']
        restored = history.connect(Path(self.temp.name) / 'restored.sqlite3')
        try:
            for name in names:
                record = bundle['tables'][name]
                values = [tuple(decode(cell) for cell in row) for row in record['rows']]
                placeholders = ','.join('?' for _ in record['columns'])
                restored.executemany(f'INSERT INTO {name} VALUES ({placeholders})', values)
                self.assertEqual(sorted(restored.execute('SELECT * FROM ' + name).fetchall()), sorted(original[name]))
            self.assertEqual(bundle['identity'], history.get_meta(self.db, 'identity'))
            self.assertEqual(self.db.execute('SELECT count(*) FROM blocks').fetchone()[0], 0)
        finally:
            restored.close()

    def test_repeated_parameters_are_deduplicated_but_changes_and_jail_events_remain(self):
        self.initialize()
        params = {'type': 'consensus_param_updates', 'updates': {'block': {'max_gas': '100'}}}
        for h in (10, 11):
            v = item(h)
            v['events'] = [params]
            history.append(self.db, v)
        v = item(12)
        v['events'] = [copy.deepcopy(params), {'type': 'slash', 'attributes': []}]
        v['events'][0]['updates']['block']['max_gas'] = '200'
        history.append(self.db, v)
        self.assertEqual(self.db.execute('SELECT height FROM events ORDER BY height').fetchall(), [(10,), (12,)])
        last_events = json.loads(zlib.decompress(self.db.execute('SELECT payload FROM events WHERE height=12').fetchone()[0]))
        self.assertEqual([e['type'] for e in last_events], ['consensus_param_updates', 'slash'])
        self.assertEqual(history.get_meta(self.db, 'lastConsensusParameters'), {'block': {'max_gas': '200'}})

    def test_start_boundary_is_not_guessed_or_advanced_past_pruned_data(self):
        reader = FakeReader()
        self.assertEqual(history.first_height(reader, reader.timestamp(3), 2, 6), 3)
        between = (reader.base + timedelta(seconds=3.5)).isoformat().replace('+00:00', 'Z')
        self.assertEqual(history.first_height(reader, between, 2, 6), 4)
        with self.assertRaises(ValueError):
            history.first_height(reader, reader.timestamp(1), 2, 6)

    def test_batch_reordering_is_safe_and_missing_duplicate_or_error_ids_fail(self):
        class BatchReader(history.Reader):
            def __init__(self, mode):
                self.mode = mode
                self.rpc_base = history.RPC

            def get(self, url, **kwargs):
                output = []
                for request in kwargs['payload']:
                    h = int(request['params']['height'])
                    c, vals, results = fixtures(h)
                    value = {'commit': c, 'validators': {'block_height': str(h), 'validators': vals,
                             'total': '4', 'count': '4'}, 'block_results': results}[request['method']]
                    output.append({'id': request['id'], 'result': value})
                output.reverse()
                if self.mode == 'missing':
                    output.pop()
                elif self.mode == 'duplicate':
                    output[0] = copy.deepcopy(output[1])
                elif self.mode == 'foreign':
                    output[0]['id'] = 'foreign'
                elif self.mode == 'error':
                    output[0]['error'] = {'message': 'pruned'}
                return output

        self.assertEqual([r['height'] for r in BatchReader('ok').blocks([10, 11, 12])], [10, 11, 12])
        for mode in ('missing', 'duplicate', 'foreign', 'error'):
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                BatchReader(mode).blocks([10, 11])

    def test_budget_exhaustion_retains_partial_progress_without_false_source_failure(self):
        class Bounded(FakeReader):
            def blocks(self, heights):
                if 5 in heights:
                    raise history.BudgetExhausted('budget')
                return super().blocks(heights)
        reader = Bounded()
        r = history.run(self.db, reader, reader.timestamp(2))
        self.assertIsNone(r['error'])
        self.assertEqual(r['status'], 'catching-up')
        self.assertEqual(r['through']['height'], 4)

    def test_health_cannot_call_a_recent_process_with_old_data_healthy(self):
        now = datetime.now(timezone.utc)
        recent = now.isoformat().replace('+00:00', 'Z')
        value = {'schema': 1, 'identity': {'chain': 'juno-1'}, 'checkedAt': recent,
                 'through': {'time': recent}, 'status': 'current', 'error': None,
                 'metadataError': None, 'metadataEpoch': now.timestamp()}
        self.assertTrue(history.health(value, now)['ok'])
        value['through']['time'] = (now - timedelta(minutes=6)).isoformat().replace('+00:00', 'Z')
        self.assertEqual(history.health(value, now)['issues'], ['blocks-stale'])
        value['metadataEpoch'] -= 5000
        self.assertIn('metadata-stale', history.health(value, now)['issues'])

    def test_no_signing_or_credentials_in_service(self):
        root = Path(__file__).resolve().parents[1]
        service = (root / 'deploy/cosmoot/systemd/cosmoot-validator-history.service').read_text()
        self.assertIn('MemoryMax=256M', service)
        self.assertIn('ProtectSystem=strict', service)
        self.assertNotIn('LoadCredential', service)
        self.assertNotIn('run-server-collector.py', service)


if __name__ == '__main__':
    unittest.main()
