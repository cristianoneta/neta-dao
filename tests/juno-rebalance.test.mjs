import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availableBudget,
  buildRebalanceReview,
  verifyRebalanceBaseline
} from '../juno-rebalance.mjs';
import { legacyPolicy, defaultPolicy, fingerprint, amount } from '../juno-delegation-core.mjs';
import {
  fixture,
  observed,
  activeHistory,
  withParticipation
} from './fixtures/delegation-planner.mjs';
async function context(rule = legacyPolicy()) {
  const s = fixture();
  const approval = {
    proposalId: '950',
    votingEndedAt: new Date(Date.now() - 3600000).toISOString(),
    rule,
    hash: await fingerprint(rule)
  };
  return { approval, snapshot: s, evidence: observed(s), budgetRaw: amount('3000').toString() };
}
test('Max retains the reserve at micro-JUNO precision and never includes rewards', () => {
  const s = fixture();
  s.liquidRaw = '1000000001';
  s.unclaimedRewardsRaw = '999999999999';
  assert.equal(availableBudget(s), 3450000001n);
  s.liquidRaw = '0';
  s.validators.forEach((v) => (v.currentRaw = '0'));
  assert.equal(availableBudget(s), 0n);
});
test('Rebalance preserves historical approved rules and freezes holdings, targets and evidence', async () => {
  const input = await context();
  const frozen = await buildRebalanceReview(input);
  assert.equal(frozen.value.kind, 'ALLOCATION_SIMULATION');
  assert.equal(frozen.value.executionEnabled, false);
  assert.deepEqual(frozen.value.messages, []);
  assert.equal(frozen.value.calculation.rule.schema, 2);
  assert.deepEqual(frozen.value.calculation.rule, input.approval.rule);
  assert.equal(frozen.result.allocatedRaw, amount('3000').toString());
  await verifyRebalanceBaseline(frozen, input.approval, input.snapshot);
  input.approval.rule.commissionMaxBps = 0;
  input.snapshot.validators[0].name = 'Edited after freeze';
  assert.equal(frozen.value.calculation.rule.commissionMaxBps, 1000);
  assert.notEqual(frozen.value.calculation.snapshot.validators[0].name, 'Edited after freeze');
});
test('approval, evidence, budget and freshness failures cannot produce an allocation draft', async () => {
  const input = await context();
  await assert.rejects(buildRebalanceReview({ ...input, approval: null }), /approve/);
  await assert.rejects(buildRebalanceReview({ ...input, budgetRaw: '0' }), /positive/);
  await assert.rejects(buildRebalanceReview({ ...input, budgetRaw: '999999999999' }), /reserve/);
  await assert.rejects(
    buildRebalanceReview({
      ...input,
      evidence: { ...input.evidence, window: { coverageComplete: false } }
    }),
    /incomplete/
  );
  await assert.rejects(buildRebalanceReview({ ...input, now: Date.now() + 3600001 }), /one hour/);
  await assert.rejects(
    buildRebalanceReview({
      ...input,
      snapshot: { ...input.snapshot, collectedAt: new Date(Date.now() + 600000).toISOString() }
    }),
    /one hour/
  );
  input.approval.hash = '0'.repeat(64);
  await assert.rejects(buildRebalanceReview(input), /parent policy/);
});
test('current rules require complete participation history and allocate nothing to failed gates', async () => {
  const input = await context(defaultPolicy());
  await assert.rejects(buildRebalanceReview(input));
  input.snapshot.activeSetHistory = withParticipation(activeHistory(input.snapshot));
  input.snapshot.validators[0].commissionBps = 1100;
  const result = await buildRebalanceReview(input);
  assert.equal(
    result.result.rows.find((v) => v.address === input.snapshot.validators[0].address).targetRaw,
    '0'
  );
  input.snapshot.validators.forEach((v) => (v.jailed = true));
  await assert.rejects(buildRebalanceReview(input), /No allocation/);
});
test('export rejects newer approvals, changed observations, modified drafts and expired evidence', async () => {
  const input = await context(),
    frozen = await buildRebalanceReview(input);
  await assert.rejects(verifyRebalanceBaseline(frozen, null, input.snapshot), /rules have changed/);
  await assert.rejects(
    verifyRebalanceBaseline(frozen, { ...input.approval, proposalId: '951' }, input.snapshot),
    /rules have changed/
  );
  await assert.rejects(
    verifyRebalanceBaseline(frozen, input.approval, {
      ...input.snapshot,
      height: input.snapshot.height + 1
    }),
    /observations changed/
  );
  await assert.rejects(
    verifyRebalanceBaseline(frozen, input.approval, input.snapshot, Date.now() + 3600001),
    /one hour/
  );
  frozen.value.messages.push({ fake: true });
  await assert.rejects(
    verifyRebalanceBaseline(frozen, input.approval, input.snapshot),
    /draft has changed/
  );
});
