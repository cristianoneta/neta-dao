import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import {
  amount,
  initialState,
  quote,
  swap,
  addLiquidity,
  withdraw,
  createPool,
  featured,
  buybackPreview,
  incentivePlan
} from '../community-tools/neta/dex/model.mjs';

function totals(state) {
  const result = { ...state.balances };
  for (const p of state.pools) {
    result[p.token] += p.reserve;
    result.NETA += p.neta;
  }
  for (const [token, value] of Object.entries(state.fees)) result[token] += value;
  result.DAO += state.burned;
  return result;
}
test('exact six-decimal input rejects malformed and zero amounts', () => {
  assert.equal(amount('0.000001'), 1n);
  for (const input of [
    '0',
    '-1',
    'NaN',
    'Infinity',
    '1e6',
    '1.0000001',
    '1,2',
    '',
    ' 1',
    '01',
    '9999999999999'
  ])
    assert.throws(() => amount(input));
});
test('incentive plans last exactly 84 days across leap days and reject invalid dates', () => {
  const input = { token: 'JUNO', reward: 'NETA', total: '1200', start: '2028-02-01' };
  const now = new Date('2028-01-01T00:00:00Z');
  const plan = incentivePlan(input, now);
  assert.equal(plan.end, '2028-04-25');
  assert.equal((Date.parse(plan.end) - Date.parse(plan.start)) / 86400000, 84);
  assert.equal(plan.total, amount('1200'));
  for (const start of ['2027-12-31', '2028-02-30', 'invalid', '2028-1-1'])
    assert.throws(() => incentivePlan({ ...input, start }, now));
  assert.throws(() => incentivePlan({ ...input, total: '0' }, now));
});
test('XYK output fees divide into two thirds LP and one third protocol', () => {
  const state = initialState(),
    total = totals(state),
    p = state.pools[0];
  const k = p.reserve * p.neta;
  const q = swap(state, 'JUNO', amount('100'), false);
  assert.equal(q.gross, 2497502n);
  assert.equal(q.received, 2490010n);
  assert.equal(q.lp, 4995n);
  assert.equal(q.protocol, 2497n);
  assert.equal(state.fees.NETA, 2497n);
  assert.ok(p.reserve * p.neta >= k);
  assert.deepEqual(totals(state), total);
  const reverse = swap(state, 'JUNO', amount('10'), true);
  assert.equal(reverse.out, 'JUNO');
  assert.ok(state.fees.JUNO > 0n);
  assert.deepEqual(totals(state), total);
});
test('insufficient balance leaves every pool, fee and balance unchanged', () => {
  const state = initialState(),
    before = structuredClone(state);
  assert.throws(() => swap(state, 'JUNO', amount('10001'), false), /Not enough/);
  assert.throws(() => addLiquidity(state, 'USDC', amount('99999')), /Not enough/);
  assert.deepEqual(state, before);
});
test('LP deposits and full withdrawals conserve assets and retain only rounding dust', () => {
  const state = initialState(),
    total = totals(state),
    before = { ...state.balances };
  addLiquidity(state, 'JUNO', amount('1000'));
  assert.ok(state.pools[0].owned > 0n);
  withdraw(state, 'JUNO');
  assert.equal(state.pools[0].owned, 0n);
  assert.ok(before.JUNO - state.balances.JUNO <= 1n);
  assert.ok(before.NETA - state.balances.NETA <= 1n);
  assert.deepEqual(totals(state), total);
  assert.throws(() => withdraw(state, 'JUNO'), /No demo liquidity/);
});
test('creation fixes NETA counterpart, rejects duplicates, and keeps small pools usable', () => {
  const state = initialState(),
    total = totals(state);
  createPool(state, 'OSMO', amount('100'), amount('10'));
  const pool = state.pools.at(-1);
  assert.equal(featured(pool), false);
  assert.equal(featured({ neta: amount('250') }), true);
  assert.equal(featured({ neta: amount('249.999999') }), false);
  assert.throws(() => createPool(state, 'OSMO', amount('1'), amount('1')), /already/);
  assert.throws(() => createPool(state, 'NETA', amount('1'), amount('1')), /supported/);
  swap(state, 'OSMO', amount('1'), false);
  withdraw(state, 'OSMO');
  assert.ok(pool.shares > 0n && pool.reserve > 0n && pool.neta > 0n);
  assert.deepEqual(totals(state), total);
});
test('buyback preview routes both fee assets, burns DAO and conserves assets', () => {
  const state = initialState(),
    total = totals(state);
  swap(state, 'JUNO', amount('100'), false);
  swap(state, 'JUNO', amount('10'), true);
  const before = structuredClone(state),
    result = buybackPreview(state);
  assert.deepEqual(state, before, 'preview is read-only');
  assert.ok(result.burned > 0n);
  assert.equal(result.routes.length, 2);
  assert.ok(result.routes.every((r) => !r.skipped));
  assert.deepEqual(totals(result.next), total);
  assert.equal(result.next.burned, result.burned);
});
test('buyback routes over the impact limit are skipped atomically', () => {
  const state = initialState();
  state.fees.JUNO = amount('100000');
  const before = structuredClone(state),
    result = buybackPreview(state);
  assert.equal(result.burned, 0n);
  assert.match(result.routes[0].skipped, /Impact/);
  assert.deepEqual(result.next, before);
});
test('unlisted page has indexing guards and no incoming public HTML link', async () => {
  const path = 'community-tools/neta/dex/index.html';
  const html = await readFile(path, 'utf8');
  assert.match(html, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.match(html, /connect-src 'none'/);
  const headers = await readFile('deploy/cosmoot/pages-headers', 'utf8');
  assert.match(
    headers,
    /\/community-tools\/neta\/dex\/\*\n  X-Robots-Tag: noindex, nofollow, noarchive/
  );
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0');
  for (const file of files.filter((f) => f.endsWith('.html') && f !== path))
    assert.doesNotMatch(
      await readFile(file, 'utf8'),
      /(?:href|src)=["'][^"']*\/neta\/dex(?:\/|["'#?])/,
      file
    );
});
