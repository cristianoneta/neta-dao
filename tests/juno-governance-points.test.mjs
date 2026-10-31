import { frozenRuleProposal } from '../planner-proposal-draft.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultPolicy,
  extendedCapPolicy,
  simulate,
  amount,
  policy,
  fingerprint
} from '../juno-delegation-core.mjs';
import {
  governanceEvidence,
  scorePoints,
  validatorPoints,
  weightedCapped
} from '../juno-governance-points.mjs';
import { buildRuleReview, verifyRuleReview, decodeRuleReview } from '../juno-delegation-review.mjs';
import {
  fixture,
  observed,
  withGovernance,
  activeHistory,
  withParticipation
} from './fixtures/delegation-planner.mjs';
const anchor = (s, days) => ({
  height: s.height - days * 100,
  time: new Date(Date.parse(s.blockTime) - days * 86400000).toISOString()
});
function input() {
  const s = withGovernance(fixture(), 180),
    p = defaultPolicy(),
    h = withParticipation(activeHistory(s, 90));
  s.governanceHistory.proposals = Array.from({ length: 10 }, (_, i) => ({
    id: String(100 + i),
    start: anchor(s, i + 3),
    end: { ...anchor(s, i + 2), result: 'proposal_passed' },
    votes: s.validators
      .filter((v, j) => j !== 0 || i < 8)
      .map((v, j) => ({
        voter: v.address,
        height: anchor(s, i + 2).height,
        scope: `tx:${j}`,
        index: 0,
        option: 'VOTE_OPTION_ABSTAIN:1'
      }))
  }));
  return { s, p, h, e: observed(s) };
}
const run = (x) => simulate(x.p, x.s, amount('2500'), x.e, x.h);
test('8/10 earns 80 of 100 bonus, changing base/bonus changes points and allocation', () => {
  const x = input(),
    r = run(x),
    a = r.rows[0];
  assert.equal(a.points.total.numerator, '980');
  assert.equal(a.points.governance.voted, 8);
  assert.equal(r.rows[1].points.total.numerator, '1000');
  assert.ok(BigInt(a.targetRaw) < BigInt(r.rows[1].targetRaw));
  x.p.points.base = 800;
  assert.equal(run(x).rows[0].points.total.numerator, '960');
  assert.deepEqual(
    scorePoints(
      800,
      { governance: 25, rpc: 75 },
      { governance: { numerator: '8', denominator: '10' } }
    ).bonus,
    { numerator: '40', denominator: '1' }
  );
  x.p.points.weights.governance = 0;
  delete x.s.governanceHistory;
  assert.ok(run(x).rows.every((v) => v.points.total.numerator === '800'));
  assert.equal(run(x).allocatedRaw, amount('2500').toString());
});
test('90-day inclusive window extends toward ten only inside available 180 days', () => {
  const x = input();
  x.s.governanceHistory.proposals.forEach((p, i) => {
    p.start = anchor(x.s, i * 15 + 4);
    p.end = { ...anchor(x.s, i * 15 + 2), result: i % 2 ? 'proposal_failed' : 'proposal_rejected' };
    p.votes = [];
  });
  assert.equal(governanceEvidence(x.s).count, 10);
  x.s.governanceHistory.proposals = x.s.governanceHistory.proposals.slice(0, 3);
  assert.equal(governanceEvidence(x.s).count, 3);
  const p = x.s.governanceHistory.proposals[0];
  p.start = anchor(x.s, 91);
  p.end = { ...anchor(x.s, 90), result: 'proposal_passed' };
  assert.equal(governanceEvidence(x.s).count, 3);
  const more = Array.from({ length: 12 }, (_, i) => ({ ...p, id: String(500 + i) }));
  x.s.governanceHistory.proposals = more;
  assert.equal(governanceEvidence(x.s).count, 12);
});
test('zero applicable periods are collecting, retain base, and never fabricate a rate', () => {
  const x = input();
  x.s.governanceHistory.proposals = [];
  let r = run(x);
  assert.equal(r.rows[0].points.governance.status, 'collecting');
  assert.equal(r.rows[0].points.total.numerator, '900');
  x.p.points.base = 0;
  r = run(x);
  assert.equal(r.allocatedRaw, '0');
  assert.equal(r.unallocatedRaw, amount('2500').toString());
});
test('first active entry limits opportunities without resetting on later re-entry', () => {
  const x = input(),
    entry = x.s.governanceHistory.validators[0];
  Object.assign(entry, { firstHeight: anchor(x.s, 5).height, firstTime: anchor(x.s, 5).time });
  const score = validatorPoints(x.p.points, entry.address, governanceEvidence(x.s));
  assert.equal(score.governance.applicable, 3);
  assert.equal(score.governance.programme, 10);
  assert.equal(score.governance.voted, 3);
});
test('missing, duplicate, future and malformed governance evidence block new allocation', () => {
  for (const corrupt of [
    (s) => delete s.governanceHistory,
    (s) => s.governanceHistory.proposals.push(s.governanceHistory.proposals[0]),
    (s) => s.governanceHistory.proposals[0].votes.push(s.governanceHistory.proposals[0].votes[0]),
    (s) => s.governanceHistory.coverage.end.height++,
    (s) => s.governanceHistory.validators.shift(),
    (s) => (s.governanceHistory.proposals[0].end.result = 'voting'),
    (s) => s.governanceHistory.proposals[0].votes[0].height++
  ]) {
    const x = input();
    corrupt(x.s);
    assert.throws(() => run(x), /governance observations/);
  }
});
test('weighted water filling conserves micro-units, respects caps and deterministic remainder order', () => {
  const entries = [
    { address: 'b', capacity: 2n, weight: { numerator: '1', denominator: '3' } },
    { address: 'a', capacity: 100n, weight: { numerator: '2', denominator: '3' } },
    { address: 'z', capacity: 100n, weight: { numerator: '0', denominator: '1' } }
  ];
  assert.deepEqual([...weightedCapped(11n, entries)].sort(), [
    ['a', 9n],
    ['b', 2n],
    ['z', 0n]
  ]);
  for (let budget = 1n; budget < 100n; budget++) {
    const es = Array.from({ length: 7 }, (_, i) => ({
      address: String(i),
      capacity: BigInt(i * 5),
      weight: { numerator: String(i), denominator: String(i + 1) }
    }));
    const result = weightedCapped(budget, es),
      reverse = weightedCapped(budget, [...es].reverse());
    assert.deepEqual([...result].sort(), [...reverse].sort());
    assert.equal(
      [...result.values()].reduce((a, b) => a + b, 0n),
      budget
    );
    for (const e of es) assert.ok(result.get(e.address) <= e.capacity);
  }
});
test('old policies preserve equal allocation; frozen points review reproduces and detects changed evidence', async () => {
  const x = input(),
    old = extendedCapPolicy(),
    before = simulate(old, x.s, amount('2500'), x.e, x.h);
  assert.ok(before.rows.every((v) => !v.points));
  const review = await buildRuleReview({
    rule: x.p,
    parent: {
      rule: old,
      hash: await fingerprint(old),
      proposalId: '50',
      votingEndedAt: x.s.blockTime
    },
    snapshot: x.s,
    evidence: x.e,
    activeHistory: x.h,
    budgetRaw: amount('2500').toString()
  });
  assert.equal((await verifyRuleReview(review.value)).hash, review.hash);
  const encoded = await frozenRuleProposal(review);
  assert.equal((await decodeRuleReview(encoded.values.body)).hash, review.hash);
  const bad = structuredClone(review.value);
  bad.snapshot.governanceHistory.proposals[0].votes = [];
  await assert.rejects(() => verifyRuleReview(bad), /does not reproduce/);
  assert.throws(
    () =>
      policy({ ...x.p, points: { ...x.p.points, weights: { ...x.p.points.weights, rpc: 10 } } }),
    /unavailable bonus/
  );
});
test('fixed-only commitments remain exempt from missing governance and failed regular gates', () => {
  const x = input();
  x.p.fixedAllocations = [
    {
      chainId: 'juno-1',
      validator: x.s.validators[0].address,
      amountRaw: amount('2500').toString(),
      purpose: 'Test mandate',
      startDate: '2026-01-01',
      endDate: '2027-12-31',
      documentation: ''
    }
  ];
  x.s.validators[0].jailed = true;
  delete x.s.governanceHistory;
  const r = run(x);
  assert.equal(r.rows[0].fixedRaw, amount('2500').toString());
  assert.equal(r.rows[0].regularRaw, '0');
});

test('programme-sized points review and execution retain ten complete proposal samples within the publishing limit', async () => {
  const { reviewSizeInput } = await import('./fixtures/delegation-review-size.mjs');
  const { approvedRule } = await import('../juno-approved-rules.mjs');
  const { executionReview, executionValues, readExecutionReview } = await import(
    '../juno-rebalance-execution.mjs'
  );
  const x = reviewSizeInput({ points: true }),
    s = x.snapshot;
  const at = (day) => anchor(s, day);
  s.governanceHistory.proposals = Array.from({ length: 10 }, (_, i) => ({
    id: String(600 + i),
    start: at(i + 3, 'start' + i),
    end: { ...at(i + 2, 'end' + i), result: 'proposal_passed' },
    votes: s.validators
      .filter((v) => v.active)
      .filter((v, j) => j !== 0 || i < 8)
      .map((v, j) => ({
        voter: v.address,
        height: s.height - (i + 2) * 100 + j,
        scope: `tx:${j % 3}`,
        index: j % 7,
        option: 'VOTE_OPTION_ABSTAIN:1'
      }))
  }));
  // Each vote precedes its period's close; retain a unique immutable block/event reference.
  for (const p of s.governanceHistory.proposals) for (const v of p.votes) v.height -= 50;
  const review = await buildRuleReview(x),
    draft = await frozenRuleProposal(review);
  assert.ok(Buffer.byteLength(draft.values.summary + '\n\n' + draft.values.body) <= 10000);
  const approved = await approvedRule({
    id: '950',
    title: draft.values.title,
    summary: draft.values.body,
    status: 'PROPOSAL_STATUS_PASSED',
    voting_end_time: s.blockTime,
    messages: []
  });
  assert.deepEqual(approved.rule, x.rule);
  const restored = await decodeRuleReview(draft.values.body);
  assert.deepEqual(restored.value, review.value);
  const bad = draft.values.body.replace('Rule SHA-256: ', 'Rule SHA-256: f');
  await assert.rejects(() => decodeRuleReview(bad));
  x.parent = {
    rule: x.rule,
    hash: await fingerprint(x.rule),
    proposalId: '950',
    votingEndedAt: s.blockTime
  };
  const execution = await executionReview((await buildRuleReview(x)).value);
  const values = await executionValues(execution);
  assert.equal((await readExecutionReview(values)).hash, execution.hash);
});

test('missing governance blocks approval even when other history is unavailable; disabled bonus needs no governance', async () => {
  const x = input();
  delete x.s.governanceHistory;
  await assert.rejects(
    () =>
      buildRuleReview({
        rule: x.p,
        snapshot: x.s,
        evidence: x.e,
        activeHistory: null,
        budgetRaw: amount('2500').toString()
      }),
    /governance observations/
  );
  x.p.points.weights.governance = 0;
  x.s.governanceHistory = { schema: 999 };
  const r = await buildRuleReview({
    rule: x.p,
    snapshot: x.s,
    evidence: x.e,
    activeHistory: x.h,
    budgetRaw: amount('2500').toString()
  });
  assert.equal(r.model.proposed.result.allocatedRaw, amount('2500').toString());
});
