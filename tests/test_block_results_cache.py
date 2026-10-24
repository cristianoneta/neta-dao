import copy
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import block_results_cache as cache
import community_block_ledger as community
from test_community_blocks import result as tax_result
from test_validator_history import fixtures
import validator_history as history


class CacheTests(unittest.TestCase):
    def test_provider_chain_height_and_expiry_isolation(self):
        with tempfile.TemporaryDirectory() as root:
            now = [100]
            stored = cache.Cache(root, now=lambda: now[0])
            value = {'height': '20', 'finalize_block_events': []}
            stored.put('https://source', 'juno-1', 20, value)
            self.assertEqual(stored.get('https://source', 'juno-1', 20), value)
            for provider, chain, height in [('https://other', 'juno-1', 20), ('https://source', 'uni-7', 20), ('https://source', 'juno-1', 21)]:
                self.assertIsNone(stored.get(provider, chain, height))
            now[0] += cache.TTL
            self.assertIsNone(stored.get('https://source', 'juno-1', 20))
            with self.assertRaises(ValueError):
                stored.put('https://source', 'juno-1', 21, value)

    def test_corrupt_cache_falls_back_and_stored_bytes_are_bounded(self):
        with tempfile.TemporaryDirectory() as root, patch.dict(os.environ, {'COSMOOT_BLOCK_CACHE_DIRECTORY': root}):
            small = cache.Cache(root, max_stored=150)
            for h in range(1, 15):
                small.put('source', 'juno-1', h, {'height': str(h), 'events': 'x' * 100})
            db = small.connect()
            try:
                total, count = db.execute('SELECT sum(length(payload)),count(*) FROM results').fetchone()
                self.assertLessEqual(total, 150)
                self.assertLess(count, 14)
                with db:
                    db.execute("UPDATE results SET payload=x'00' WHERE height=14")
            finally:
                db.close()
            self.assertIsNone(cache.get('source', 'juno-1', 14))
            with patch.object(cache.Cache, 'connect', side_effect=sqlite3.OperationalError('locked')):
                self.assertIsNone(cache.get('source', 'juno-1', 20))
                cache.put('source', 'juno-1', 20, {'height': '20'})

    def test_collectors_share_results_without_skipping_commit_or_roster_checks(self):
        with tempfile.TemporaryDirectory() as root, patch.dict(os.environ, {'COSMOOT_BLOCK_CACHE_DIRECTORY': root}):
            commit, validators, results = fixtures(20)
            results = tax_result()
            class Reader(history.Reader):
                rpc_base = community.RPC
                def __init__(self):
                    self.requested = []
                def get(self, url, **kwargs):
                    self.requested.extend(request['method'] for request in kwargs['payload'])
                    values = {'commit': commit, 'validators': {'block_height': '20', 'validators': validators,
                              'total': '4', 'count': '4'}, 'block_results': results}
                    return [{'id': request['id'], 'result': copy.deepcopy(values[request['method']])}
                            for request in kwargs['payload']]
            reader = Reader()
            original = reader.blocks([20])
            self.assertEqual(reader.requested, ['commit', 'validators', 'block_results'])
            with patch.object(community, 'request', side_effect=AssertionError('unexpected repeated RPC')):
                calculated = community.batch([20])
            self.assertEqual(calculated[0][1]['ujuno'], '10.000000000000000001')
            reader.requested = []
            self.assertEqual(reader.blocks([20]), original)
            self.assertEqual(reader.requested, ['commit', 'validators'])
            commit['canonical'] = False
            with self.assertRaises(ValueError):
                reader.blocks([20])

    def test_mixed_hits_fetch_only_missing_heights_and_preserve_order(self):
        with tempfile.TemporaryDirectory() as root, patch.dict(os.environ, {'COSMOOT_BLOCK_CACHE_DIRECTORY': root}):
            cache.put(community.RPC, community.CHAIN, 20, tax_result())
            value = tax_result(); value['height'] = '21'
            with patch.object(community, 'request', return_value=[{'id': 21, 'result': value}]) as request:
                output = community.batch([20, 21])
            self.assertEqual([row[0] for row in output], [20, 21])
            self.assertEqual([v['id'] for v in request.call_args.args[1]], [21])


if __name__ == '__main__':
    unittest.main()
