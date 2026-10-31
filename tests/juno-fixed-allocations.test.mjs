import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultPolicy,
  configurableParticipationPolicy,
  policy,
  simulate,
  amount,
  fingerprint,
  editablePolicy
} from '../juno-delegation-core.mjs';
import { fixedStatus, fixedByValidator } from '../juno-fixed-allocations.mjs';
import {
  buildRuleReview,
  verifyRuleReview,
  readProposalReview,
  ruleChanges
} from '../juno-delegation-review.mjs';
import { frozenRuleProposal } from '../planner-proposal-draft.mjs';
import {
  executionReview,
  executionValues,
  readExecutionReview
} from '../juno-rebalance-execution.mjs';
import {
  movementPlan,
  checkCurrentAllocation,
  checkMovementState
} from '../juno-programme-staking.mjs';
import {
  fixture,
  observed,
  activeHistory,
  withParticipation,
  withGovernance
} from './fixtures/delegation-planner.mjs';
const now = '2026-10-29T12:00:00Z';
function inputs() {
  const s = fixture(10);
  s.blockTime = s.collectedAt = now;
  s.liquidRaw = amount('10000050').toString();
  s.validators.forEach((v) => {
    v.tokensRaw = amount('10000000').toString();
    v.currentRaw = '0';
  });
  const h = withParticipation(activeHistory(s, 5));
  withGovernance(s);
  return { s, h, e: observed(s), p: defaultPolicy() };
}
const entry = (s, index = 0, value = '500000') => ({
  chainId: 'juno-1',
  validator: s.validators[index].address,
  amountRaw: amount(value).toString(),
  purpose:
    'Provide a public archive. Publish monthly availability evidence; programme reviewers assess delivery.',
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  documentation: 'https://example.org/mandate'
});
const run = ({ p, s, e, h }, budget = '10000000') => simulate(p, s, amount(budget), e, h);
const state = (s) => ({
  blockTime: s.blockTime,
  activeCount: s.activeCount,
  positions: s.validators.map((v) => ({ address: v.address, currentRaw: v.currentRaw })),
  validators: s.validators.map((v) => ({
    ...v,
    exchangeRateValid: true,
    commissionAtoms: String(BigInt(v.commissionBps) * 100000000000000n)
  })),
  liquidRaw: s.liquidRaw,
  maxEntries: 7,
  redelegations: [],
  unbondings: []
});
const reviewInput = (x) => ({
  rule: x.p,
  snapshot: x.s,
  evidence: x.e,
  activeHistory: x.h,
  budgetRaw: amount('10000000').toString(),
  createdAt: now
});

test('fixed target reserves budget before equal allocation and never compounds existing holdings', () => {
  const x = inputs();
  x.p.fixedAllocations = [entry(x.s)];
  const r = run(x);
  assert.equal(r.fixedRaw, amount('500000').toString());
  assert.equal(r.regularBudgetRaw, amount('9500000').toString());
  assert.equal(r.rows[0].targetRaw, amount('1450000').toString());
  assert.equal(r.rows[0].regularRaw, amount('950000').toString());
  assert.equal(r.rows[1].targetRaw, amount('950000').toString());
  const next = structuredClone(x);
  next.s.validators.forEach((v, i) => {
    v.currentRaw = r.rows[i].targetRaw;
    v.tokensRaw = String(BigInt(v.tokensRaw) + BigInt(v.currentRaw));
  });
  next.s.liquidRaw = amount('50').toString();
  assert.deepEqual(
    run(next).rows.map((v) => v.targetRaw),
    r.rows.map((v) => v.targetRaw)
  );
  assert.ok(run(next).rows.every((v) => v.deltaRaw === '0'));
});

test('failed criteria exempt only the fixed portion, including jail, exclusions, missing upgrade and signatures', () => {
  for (const failure of ['jail', 'commission', 'exclusion', 'upgrade', 'signatures', 'standby']) {
    const x = inputs();
    x.p.fixedAllocations = [entry(x.s)];
    const v = x.s.validators[0];
    if (failure === 'jail') v.jailed = true;
    if (failure === 'commission') v.commissionBps = 9900;
    if (failure === 'exclusion')
      x.p.exclusions = [
        { chainId: 'juno-1', validator: v.address, reason: 'Excluded from regular programme' }
      ];
    if (failure === 'upgrade') x.e.records.delete(v.consensusAddress);
    if (failure === 'signatures') {
      const c = x.h.participation.validators[0];
      c.absent = c.signed;
      c.signed = 0;
    }
    if (failure === 'standby') {
      v.active = false;
      x.s.activeCount--;
      x.h = withParticipation(activeHistory(x.s, 5));
    }
    const r = run(x);
    assert.equal(r.rows[0].eligible, false, failure);
    assert.equal(r.rows[0].regularRaw, '0', failure);
    if (failure === 'jail')
      assert.equal(r.rows[0].capException, false, 'Jailed stake has no voting power');
    assert.equal(r.rows[0].targetRaw, amount('500000').toString(), failure);
    assert.equal(
      r.rows.reduce((n, v) => n + BigInt(v.targetRaw), 0n) + BigInt(r.unallocatedRaw),
      amount('10000000')
    );
    checkCurrentAllocation({ rule: x.p, snapshot: x.s }, movementPlan(r.rows), state(x.s));
  }
});

test('fixed stake counts toward the real cap, consumes regular capacity and can exceed it alone', () => {
  const x = inputs();
  x.s.validators[0].tokensRaw = amount('15000000').toString();
  x.p.fixedAllocations = [entry(x.s, 0, '2000000')];
  let r = run(x);
  assert.equal(r.rows[0].targetRaw, amount('2250000').toString());
  assert.equal(r.rows[0].regularRaw, amount('250000').toString());
  assert.equal(r.rows[0].capException, false);
  x.p.fixedAllocations[0].amountRaw = amount('3000000').toString();
  r = run(x);
  assert.equal(r.rows[0].regularRaw, '0');
  assert.equal(r.rows[0].capException, true);
  const plan = movementPlan(r.rows);
  checkCurrentAllocation({ rule: x.p, snapshot: x.s }, plan, state(x.s));
  const recipient = plan.positions.find((v) => v.address === x.s.validators[0].address);
  recipient.targetRaw = String(BigInt(recipient.targetRaw) + 1n);
  assert.throws(
    () => checkCurrentAllocation({ rule: x.p, snapshot: x.s }, plan, state(x.s)),
    /cap/
  );
});

test('zero regular budget and no eligible recipients conserve exact reservations; overcommit cannot be scaled away', () => {
  const x = inputs();
  x.p.fixedAllocations = [entry(x.s, 0, '10000000')];
  const r = run(x);
  assert.equal(r.regularBudgetRaw, '0');
  assert.equal(r.rows[0].targetRaw, r.budgetRaw);
  x.p.fixedAllocations[0].amountRaw = amount('10000000.000001').toString();
  assert.throws(() => run(x), /exceed.*0.000001/);
  x.p.fixedAllocations = [entry(x.s)];
  x.s.validators.forEach((v) => (v.commissionBps = 10000));
  const none = run(x);
  assert.equal(none.allocatedRaw, amount('500000').toString());
  assert.equal(none.unallocatedRaw, amount('9500000').toString());
  x.p.fixedAllocations[0].validator = fixture(11).validators[10].address;
  assert.throws(() => run(x), /missing.*reservation/);
});

test('UTC period boundaries are deterministic and frozen reviews do not expire retrospectively', async () => {
  const x = inputs();
  const a = entry(x.s);
  x.p.fixedAllocations = [a];
  assert.equal(fixedStatus(a, '2026-09-30T23:59:59Z'), 'Scheduled');
  assert.equal(fixedStatus(a, '2026-10-01T00:00:00Z'), 'Active');
  assert.equal(fixedStatus(a, '2026-12-31T23:59:59Z'), 'Active');
  assert.equal(fixedStatus(a, '2027-01-01T00:00:00Z'), 'Ended');
  const review = await buildRuleReview(reviewInput(x));
  assert.equal((await verifyRuleReview(review.value)).hash, review.hash);
  const current = state(x.s);
  current.blockTime = '2027-01-01T00:00:00Z';
  assert.throws(
    () => checkCurrentAllocation({ rule: x.p, snapshot: x.s }, movementPlan(run(x).rows), current),
    /period changed/
  );
  x.p.fixedAllocations[0].endDate = '2026-10-28';
  assert.equal(run(x).fixedRaw, '0');
});

test('schema 7 validates exact positive amounts, unique identities, real dates, bounded obligations and safe references', () => {
  const x = inputs(),
    a = entry(x.s);
  x.p.fixedAllocations = [a];
  for (const change of [
    { amountRaw: '0' },
    { amountRaw: '-1' },
    { amountRaw: '1.1' },
    { amountRaw: 500000 },
    { purpose: ' ' },
    { purpose: 'x'.repeat(1201) },
    { startDate: '2026-02-30' },
    { endDate: '2026-09-30' },
    { documentation: 'javascript:alert(1)' },
    { documentation: 'https://user:password@example.org' },
    { extra: true }
  ])
    assert.throws(() => policy({ ...x.p, fixedAllocations: [{ ...a, ...change }] }));
  assert.throws(() => policy({ ...x.p, fixedAllocations: [a, a] }));
  assert.deepEqual(defaultPolicy().fixedAllocations, []);
  assert.deepEqual(editablePolicy(configurableParticipationPolicy()).fixedAllocations, []);
  assert.deepEqual(editablePolicy(x.p).fixedAllocations, [a]);
});

test('mandates survive compact rule and execution transport; every change is bound and compared', async () => {
  const x = inputs();
  x.p.fixedAllocations = [entry(x.s)];
  const review = await buildRuleReview(reviewInput(x));
  const proposal = await frozenRuleProposal(review);
  assert.equal((await readProposalReview(proposal.values)).hash, review.hash);
  assert.deepEqual(review.value.rule.fixedAllocations, x.p.fixedAllocations);
  for (const change of [
    { amountRaw: '1' },
    { purpose: 'Different duties' },
    { endDate: '2026-11-30' },
    { documentation: 'https://example.org/changed' }
  ]) {
    const bad = structuredClone(review.value);
    Object.assign(bad.rule.fixedAllocations[0], change);
    await assert.rejects(verifyRuleReview(bad));
    const diff = ruleChanges(x.p, bad.rule).filter((c) => c.changed);
    assert.equal(diff.length, 1);
    assert.match(diff[0].key, /fixed:/);
  }
  const approved = {
    proposalId: '999',
    votingEndedAt: '2026-10-28T00:00:00Z',
    rule: x.p,
    hash: await fingerprint(x.p)
  };
  const executable = await executionReview(
    (await buildRuleReview({ ...reviewInput(x), parent: approved })).value
  );
  const decoded = await readExecutionReview(await executionValues(executable));
  assert.equal(decoded.hash, executable.hash);
  assert.deepEqual(decoded.value.calculation.rule.fixedAllocations, x.p.fixedAllocations);
});

test('snapshot compaction retains an outside-set unheld fixed recipient and preserves unknown evidence', async () => {
  const x = inputs();
  const v = x.s.validators[9];
  v.active = false;
  x.s.activeCount--;
  v.tokensRaw = '1';
  x.h = withParticipation(activeHistory(x.s, 5));
  x.e.records.delete(v.consensusAddress);
  x.p.fixedAllocations = [entry(x.s, 9)];
  const r = await buildRuleReview(reviewInput(x));
  assert.ok(r.value.snapshot.validators.some((a) => a.address === v.address));
  const row = r.model.proposed.result.rows.find((a) => a.address === v.address);
  assert.equal(row.targetRaw, amount('500000').toString());
  assert.equal(row.participation, null);
  assert.equal((await verifyRuleReview(r.value)).hash, r.hash);
});

test('fixed-only jail exception does not waive insufficient funds, invalid exchange rates or redelegation locks', () => {
  const x = inputs();
  x.p.fixedAllocations = [entry(x.s)];
  x.s.validators[0].jailed = true;
  const r = run(x),
    plan = movementPlan(r.rows),
    s = state(x.s),
    fixed = fixedByValidator(x.p, x.s.blockTime);
  assert.deepEqual(checkMovementState(plan, s, fixed), []);
  assert.match(checkMovementState(plan, s).join(' '), /jailed/);
  s.validators[0].exchangeRateValid = false;
  assert.match(checkMovementState(plan, s, fixed).join(' '), /exchange rate/);
  s.validators[0].exchangeRateValid = true;
  s.liquidRaw = '50000000';
  assert.throws(() => checkMovementState(plan, s, fixed), /reserve/);
  const source = x.s.validators[1].address,
    destination = x.s.validators[0].address;
  const lockedPlan = movementPlan([
    { address: source, currentRaw: '100', targetRaw: '0' },
    { address: destination, currentRaw: '0', targetRaw: '100' }
  ]);
  s.positions = lockedPlan.positions;
  s.redelegations = [
    {
      source: x.s.validators[2].address,
      destination: source,
      entries: [{ completionTime: '2026-12-01T00:00:00Z' }]
    }
  ];
  assert.match(
    checkMovementState(lockedPlan, s, new Map([[destination, 100n]])).join(' '),
    /incoming redelegation/
  );
});

test('shrinking a mandate can be reviewed when the prior commitments exceed the illustrative budget', async () => {
  const x = inputs();
  x.p.fixedAllocations = [entry(x.s, 0, '1000')];
  const parent = {
    rule: structuredClone(x.p),
    hash: await fingerprint(x.p),
    proposalId: '999',
    votingEndedAt: '2026-10-28T00:00:00Z'
  };
  x.p.fixedAllocations[0].amountRaw = amount('100').toString();
  const r = await buildRuleReview({
    ...reviewInput(x),
    budgetRaw: amount('500').toString(),
    parent
  });
  assert.equal(r.model.previous.result, null);
  assert.match(r.model.previous.reason, /exceed/);
  assert.ok(r.model.proposed.result);
});

test('varied portfolios conserve budget and enforce cap only when a regular portion exists', () => {
  let seed = 20261029;
  const next = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  for (let i = 0; i < 100; i++) {
    const x = inputs();
    for (const v of x.s.validators) {
      v.tokensRaw = amount(String(1 + next(30000000))).toString();
      v.jailed = next(9) === 0;
      v.commissionBps = next(2000);
    }
    x.p.fixedAllocations = Array.from({ length: 3 }, (_, j) =>
      entry(x.s, j, String(1 + next(3000000)))
    );
    const r = run(x),
      total = r.rows.reduce((n, v) => n + BigInt(v.targetRaw), 0n);
    assert.equal(total + BigInt(r.unallocatedRaw), BigInt(r.budgetRaw));
    for (const v of r.rows) {
      assert.equal(BigInt(v.targetRaw), BigInt(v.fixedRaw) + BigInt(v.regularRaw));
      if (!v.eligible) assert.equal(v.regularRaw, '0');
      if (BigInt(v.regularRaw) > 0n)
        assert.equal(
          v.capException,
          false,
          'A fixed exception cannot carry an above-cap regular portion'
        );
    }
    checkCurrentAllocation({ rule: x.p, snapshot: x.s }, movementPlan(r.rows), state(x.s));
  }
});

test('an empty fixed list preserves schema-6 target, capacity and denominator calculations', () => {
  const x = inputs();
  x.s.validators[0].tokensRaw = amount('25000000').toString();
  x.s.validators[1].jailed = true;
  const current = run(x),
    old = run({ ...x, p: configurableParticipationPolicy() });
  for (const key of ['allocatedRaw', 'unallocatedRaw', 'projectedBondedRaw'])
    assert.equal(current[key], old[key]);
  assert.deepEqual(
    current.rows.map(({ fixedRaw, regularRaw, fixedAllocation, capException, points, ...v }) => v),
    old.rows
  );
});
