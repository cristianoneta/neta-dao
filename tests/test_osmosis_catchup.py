"""Recovery regressions using paginated Cosmos transaction receipts and SQLite."""
import hashlib
import json
from pathlib import Path
import re
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import collect_pool_pilot as p


NOW = 1800000000
CHAIN = 'osmosis-1'
BASE = 'https://fixture.invalid'
KEY = CHAIN + ':1'
SPEC = {
    'key': KEY, 'chain_id': CHAIN, 'pool': '1', 'venue': 'Osmosis',
    'assets': [{'denom': 'ua', 'symbol': 'A', 'decimals': 6},
               {'denom': 'ub', 'symbol': 'B', 'decimals': 6}],
    'targets': {'atom': ['ua']},
}


class ReceiptProvider:
    """Serve actual query ranges/pages; every fixture execution has a stable hash."""

    def __init__(self, heights, target=1300, chain=CHAIN, matches_per_tx=1):
        self.base = BASE
        self.http_identity = self
        self.chain = chain
        self.target = target
        self.tip = target + 30
        self.matches_per_tx = matches_per_tx
        self.deadline = float('inf')
        self.fail_above = None
        self.fail_from = None
        self.failure = RuntimeError
        self.stale_tip = False
        self.changed_saved_height = None
        self.changed_refresh_above = None
        self.calls = []
        self.block_calls = []
        self.receipts = []
        for ordinal, height in enumerate(heights):
            digest = hashlib.sha256(f'{chain}:{height}:{ordinal}'.encode()).hexdigest().upper()
            if chain == CHAIN:
                attrs = {'pool_id': '1', 'tokens_in': '1000000ua', 'tokens_out': '2000000ub'}
                kind = 'token_swapped'
            else:
                attrs = {'_contract_address': 'pair', 'action': 'swap', 'offer_asset': 'ua',
                         'ask_asset': 'ub', 'offer_amount': '1000000', 'return_amount': '2000000'}
                kind = 'wasm'
            event = {'type': kind, 'attributes': [{'key': k, 'value': v} for k, v in attrs.items()]}
            self.receipts.append({
                'txhash': digest, 'height': str(height), 'timestamp': self.timestamp(height),
                'code': 0, 'events': [event for _ in range(matches_per_tx)],
            })

    def timestamp(self, height):
        return p.iso(NOW - 2 * (self.tip - height))

    def block(self, http, base, chain, height='latest', refresh=False):
        self.block_calls.append((chain, height, refresh))
        self.assert_identity(http, base, chain)
        number = self.tip if height == 'latest' else int(height)
        block_hash = f'{number:064X}'
        if number == self.changed_saved_height or (
                refresh and self.changed_refresh_above is not None
                and number > self.changed_refresh_above):
            block_hash = 'F' * 64
        at = p.iso(NOW - 1000) if height == 'latest' and self.stale_tip else self.timestamp(number)
        return {'height': number, 'block_hash': block_hash, 'block_time': at}

    def assert_identity(self, http, base, chain):
        if http is not self.http_identity or base != self.base or chain != self.chain:
            raise AssertionError('Unexpected provider or chain')

    def __call__(self, url):
        parsed = urlsplit(url)
        if parsed.scheme + '://' + parsed.netloc != self.base or parsed.path != '/cosmos/tx/v1beta1/txs':
            raise AssertionError('Unexpected HTTP endpoint: ' + url)
        qs = parse_qs(parsed.query)
        query = qs['query'][0]
        lower_match = re.search(r'tx\.height>=(\d+)', query)
        upper_match = re.search(r'tx\.height<=(\d+)', query)
        lower = int(lower_match.group(1)) if lower_match else 1
        upper = int(upper_match.group(1)) if upper_match else self.tip
        page, limit = int(qs['page'][0]), int(qs['limit'][0])
        order = qs['order_by'][0]
        candidates = [r for r in self.receipts if lower <= int(r['height']) <= upper]
        positions = [r for r in candidates for _ in range(self.matches_per_tx)]
        if order == 'ORDER_BY_DESC':
            positions.reverse()
        self.calls.append({'lower': lower, 'upper': upper, 'page': page, 'limit': limit,
                           'order': order, 'total': len(positions)})
        if (self.fail_above is not None and upper > self.fail_above
                or self.fail_from is not None and lower >= self.fail_from):
            raise self.failure('fixture provider interrupted before unverified range')
        # Some Cosmos forks paginate matching events, then deduplicate receipts.
        selected = positions[(page - 1) * limit:page * limit]
        rows = list({r['txhash']: r for r in selected}.values())
        return {'data': {'total': str(len(positions)), 'tx_responses': rows,
                         'txs': [{'body': {'messages': []}} for _ in rows]}}


class ProviderPair:
    def __init__(self, first, second):
        second.base = 'https://fallback.fixture.invalid'
        self.providers = {first.base: first, second.base: second}
        self.target = first.target
        self.deadline = float('inf')
        for provider in self.providers.values():
            provider.http_identity = self

    def __call__(self, url):
        parsed = urlsplit(url)
        return self.providers[parsed.scheme + '://' + parsed.netloc](url)

    def block(self, http, base, chain, height='latest', refresh=False):
        return self.providers[base].block(http, base, chain, height, refresh)


class OsmosisCatchupTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'pools.sqlite3'
        self.db = p.connect(self.path)
        self.addCleanup(lambda: self.db.close())
        self.db.execute('INSERT INTO pools VALUES (?,?,?)', (KEY, NOW - 10000, json.dumps(SPEC)))
        self.db.commit()
        self.addCleanup(patch.stopall)
        patch.object(p.time, 'time', return_value=NOW).start()

    def fixture(self, heights=range(100, 1301), target=1300, first_height=100):
        provider = ReceiptProvider(heights, target)
        patch.object(p, 'block', side_effect=provider.block).start()
        patch.dict(p.CHAINS, {CHAIN: {**p.CHAINS[CHAIN], 'providers': (BASE,)}}).start()
        previous = {**provider.block(provider, BASE, CHAIN, 100),
                    'first_height': first_height,
                    'first_time': int(p.stamp(provider.timestamp(first_height))),
                    'source': BASE, 'coverage': 'provider-index', 'time': NOW - 300}
        p.record_scan(self.db, CHAIN, previous, [], [])
        return provider, previous

    def saved(self):
        return json.loads(self.db.execute('SELECT payload FROM cursors WHERE chain=?', (CHAIN,)).fetchone()[0])

    def commit(self, result):
        cursor, trades, problems = result
        p.record_scan(self.db, CHAIN, cursor, trades, problems)
        return cursor

    def persisted_heights(self):
        return sorted(json.loads(row[0])['height'] for row in self.db.execute('SELECT payload FROM swaps'))

    def first_forward_checkpoint(self, provider, previous):
        iterator = p.scan_osmosis_chunks(provider, {KEY: SPEC}, previous)
        for result in iterator:
            cursor = self.commit(result)
            if cursor['height'] > previous['height']:
                self.assertLess(cursor['height'], provider.target)
                return iterator, cursor
        self.fail('No forward checkpoint before the complete target')

    def test_more_than_600_receipts_split_into_contiguous_durable_ranges(self):
        provider, previous = self.fixture()
        chunks = []
        for result in p.scan_osmosis_chunks(provider, {KEY: SPEC}, previous):
            chunks.append(self.commit(result))
        self.assertGreaterEqual(len(chunks), 3)
        self.assertEqual(chunks[-1]['height'], provider.target)
        self.assertEqual((chunks[-1]['first_height'], chunks[-1]['first_time']),
                         (previous['first_height'], previous['first_time']))
        frontier = previous['height']
        for cursor in chunks:
            if cursor['height'] > frontier:
                self.assertEqual(cursor['from_height'], frontier + 1)
                self.assertLessEqual(cursor['index_total'], 600)
                frontier = cursor['height']
        self.assertEqual(self.persisted_heights(), list(range(100, 1301)))
        self.assertTrue(any(call['total'] > 600 for call in provider.calls))
        self.assertTrue(all(call['page'] <= 12 for call in provider.calls if call['limit'] == 50))

    def test_later_provider_failure_preserves_prefix_and_restart_deduplicates_overlap(self):
        provider, previous = self.fixture()
        iterator, checkpoint = self.first_forward_checkpoint(provider, previous)
        before = self.persisted_heights()
        provider.fail_above = checkpoint['height']
        with self.assertRaises((RuntimeError, ValueError)):
            next(iterator)
        self.assertEqual(self.saved(), checkpoint)
        self.assertEqual(self.persisted_heights(), before)
        # A real close/reopen verifies durability rather than an in-memory queue.
        self.db.close()
        self.db = p.connect(self.path)
        provider.fail_above = None
        for result in p.scan_osmosis_chunks(provider, {KEY: SPEC}, self.saved()):
            self.commit(result)
        self.assertEqual(self.saved()['height'], provider.target)
        self.assertEqual(self.persisted_heights(), list(range(100, 1301)))

    def test_budget_exhaustion_cannot_discard_or_extend_committed_coverage(self):
        provider, previous = self.fixture()
        iterator, checkpoint = self.first_forward_checkpoint(provider, previous)
        provider.deadline = p.time.monotonic() - 1
        provider.fail_above = checkpoint['height']
        provider.failure = TimeoutError
        with self.assertRaises((RuntimeError, TimeoutError, StopIteration)):
            next(iterator)
        self.assertEqual(self.saved(), checkpoint)
        self.assertEqual(self.persisted_heights(), list(range(100, checkpoint['height'] + 1)))

    def test_fallback_retries_unverified_chunk_without_restarting_committed_prefix(self):
        first, previous = self.fixture()
        second = ReceiptProvider(range(100, 1301))
        pair = ProviderPair(first, second)
        with patch.object(p, 'block', side_effect=pair.block), \
                patch.dict(p.CHAINS, {CHAIN: {**p.CHAINS[CHAIN], 'providers': tuple(pair.providers)}}):
            iterator, checkpoint = self.first_forward_checkpoint(pair, previous)
            first.fail_above = checkpoint['height']
            saved_heights = [checkpoint['height']]
            for result in iterator:
                saved_heights.append(self.commit(result)['height'])
        self.assertEqual(saved_heights, sorted(saved_heights))
        self.assertEqual(saved_heights[-1], second.target)
        self.assertEqual(self.persisted_heights(), list(range(100, 1301)))
        fallback_queries = [c for c in second.calls if c['order'] == 'ORDER_BY_ASC']
        self.assertTrue(fallback_queries)
        self.assertEqual(min(c['lower'] for c in fallback_queries), checkpoint['height'] + 1)
        self.assertTrue(any(height == checkpoint['height'] for _, height, _ in second.block_calls))

    def test_fallback_must_match_the_latest_committed_provider_anchor(self):
        first, previous = self.fixture()
        second = ReceiptProvider(range(100, 1301))
        pair = ProviderPair(first, second)
        with patch.object(p, 'block', side_effect=pair.block), \
                patch.dict(p.CHAINS, {CHAIN: {**p.CHAINS[CHAIN], 'providers': tuple(pair.providers)}}):
            iterator, checkpoint = self.first_forward_checkpoint(pair, previous)
            first.fail_above = checkpoint['height']
            second.changed_saved_height = checkpoint['height']
            with self.assertRaises((RuntimeError, ValueError)):
                next(iterator)
        self.assertEqual(self.saved(), checkpoint)
        self.assertEqual(self.persisted_heights(), list(range(100, checkpoint['height'] + 1)))
        self.assertFalse(second.calls, 'Reject the mismatched anchor before fetching new receipts')

    def test_busy_overlap_is_split_but_yielded_only_after_the_whole_recheck(self):
        heights = [height for height in range(1, 101) for _ in range(7)] + list(range(101, 1301))
        provider, previous = self.fixture(heights=heights, first_height=1)
        iterator = p.scan_osmosis_chunks(provider, {KEY: SPEC}, previous)
        first = next(iterator)
        self.assertEqual(first[0]['height'], previous['height'])
        self.assertEqual(len(first[1]), 700)
        self.assertEqual(self.saved(), previous)
        self.assertEqual(self.persisted_heights(), [])
        self.assertTrue(any(c['total'] > 600 for c in provider.calls))
        self.assertTrue(any(c['lower'] > 1 for c in provider.calls if c['order'] == 'ORDER_BY_ASC'))
        self.commit(first)
        for result in iterator:
            self.assertGreater(result[0]['height'], self.saved()['height'])
            self.commit(result)
        self.assertEqual(self.persisted_heights(), heights)

    def test_failed_later_overlap_chunk_cannot_publish_partial_overlap(self):
        heights = [height for height in range(1, 101) for _ in range(7)]
        provider, previous = self.fixture(heights=heights, first_height=1)
        provider.fail_from = 51
        with self.assertRaises((RuntimeError, ValueError)):
            next(p.scan_osmosis_chunks(provider, {KEY: SPEC}, previous))
        self.assertTrue(any(c['lower'] == 1 and c['upper'] == 50 and c['limit'] == 50
                            for c in provider.calls), 'The earlier overlap chunk was fully read')
        self.assertEqual(self.saved(), previous)
        self.assertEqual(self.persisted_heights(), [])

    def test_historical_checkpoints_allowed_but_still_report_stale_volume(self):
        provider, previous = self.fixture()
        iterator, checkpoint = self.first_forward_checkpoint(provider, previous)
        self.assertFalse(p.fresh(checkpoint['block_time'], 600, NOW))
        self.assertEqual(p.volume(self.db, SPEC, checkpoint, ({}, {}), NOW)['status'], 'stale')
        for result in iterator:
            self.commit(result)
        self.assertTrue(p.fresh(self.saved()['block_time'], 600, NOW))

    def test_near_live_checkpoint_remains_stale_until_fixed_target_is_complete(self):
        heights = [height for height in range(100, 401) for _ in range(3)]
        provider, previous = self.fixture(heights=heights, target=400)
        iterator, checkpoint = self.first_forward_checkpoint(provider, previous)
        self.assertTrue(p.fresh(checkpoint['block_time'], 900, NOW))
        self.assertTrue(checkpoint['catching_up'])
        self.assertEqual(p.volume(self.db, SPEC, checkpoint, ({}, {}), NOW)['status'], 'stale')
        for result in iterator:
            self.commit(result)
        self.assertFalse(self.saved()['catching_up'])
        self.assertNotEqual(p.volume(self.db, SPEC, self.saved(), ({}, {}), NOW)['status'], 'stale')

    def test_stale_latest_head_cannot_validate_historical_progress(self):
        provider, previous = self.fixture()
        provider.stale_tip = True
        with self.assertRaises((RuntimeError, ValueError)):
            list(p.scan_osmosis_chunks(provider, {KEY: SPEC}, previous))
        self.assertEqual(self.saved(), previous)
        self.assertEqual(self.persisted_heights(), [])

    def test_changed_saved_anchor_rejected_without_new_checkpoint(self):
        provider, previous = self.fixture()
        provider.changed_saved_height = previous['height']
        with self.assertRaises((RuntimeError, ValueError)):
            list(p.scan_osmosis_chunks(provider, {KEY: SPEC}, previous))
        self.assertEqual(self.saved(), previous)
        self.assertEqual(self.persisted_heights(), [])

    def test_changed_range_end_hash_does_not_commit_its_receipts(self):
        provider, previous = self.fixture()
        provider.changed_refresh_above = previous['height']
        iterator = p.scan_osmosis_chunks(provider, {KEY: SPEC}, previous)
        with self.assertRaises((RuntimeError, ValueError)):
            for result in iterator:
                self.commit(result)
        self.assertEqual(self.saved()['height'], previous['height'])
        self.assertTrue(all(height <= previous['height'] for height in self.persisted_heights()))

    def test_empty_forward_range_advances_only_with_verified_index_control(self):
        provider, previous = self.fixture(heights=[90], first_height=1)
        chunks = []
        for result in p.scan_osmosis_chunks(provider, {KEY: SPEC}, previous):
            chunks.append(result)
            self.commit(result)
        self.assertEqual(self.saved()['height'], provider.target)
        self.assertEqual(self.persisted_heights(), [90])
        self.assertTrue(any(c['height'] > previous['height'] and not trades
                            for c, trades, _ in chunks))

    def test_single_overfull_block_fails_without_skipping_it(self):
        provider, previous = self.fixture(heights=[100] + [101] * 601, target=101)
        with self.assertRaises((RuntimeError, ValueError)) as raised:
            for result in p.scan_osmosis_chunks(provider, {KEY: SPEC}, previous):
                self.commit(result)
        self.assertRegex(str(raised.exception).lower(), r'block|600|limit|overflow')
        self.assertEqual(self.saved()['height'], 100)
        self.assertEqual(self.persisted_heights(), [100])

    def test_other_chains_retain_receipt_validation_and_event_count_semantics(self):
        for chain, matches in [('juno-1', 1), ('injective-1', 2)]:
            with self.subTest(chain=chain):
                provider = ReceiptProvider([100, 110, 120], target=120, chain=chain,
                                           matches_per_tx=matches)
                key = chain + ':pair'
                spec = {**SPEC, 'key': key, 'chain_id': chain, 'pool': 'pair'}
                previous = {**provider.block(provider, BASE, chain, 100), 'first_height': 100,
                            'first_time': int(p.stamp(provider.timestamp(100))), 'source': BASE}
                with patch.object(p, 'block', side_effect=provider.block), \
                        patch.dict(p.CHAINS, {chain: {**p.CHAINS[chain], 'providers': (BASE,)}}):
                    cursor, trades, problems = p.scan_chain(provider, chain, {key: spec}, previous)
                self.assertEqual(cursor['height'], 120)
                self.assertEqual(cursor['transactions'], 3)
                self.assertEqual(cursor['index_total'], 3 * matches)
                self.assertEqual(len(trades), 3 * matches)
                self.assertEqual(problems, [])
                self.assertEqual(cursor['count_semantics'],
                                 'transactions' if matches == 1 else 'matching-events-verified')


if __name__ == '__main__':
    unittest.main()
