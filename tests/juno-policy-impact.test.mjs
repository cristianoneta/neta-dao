import test from 'node:test';
import assert from 'node:assert/strict';
import { policyImpact } from '../juno-policy-impact.mjs';
import { defaultPolicy } from '../juno-delegation-core.mjs';
import {
  fixture,
  observed,
  activeHistory,
  withParticipation
} from './fixtures/delegation-planner.mjs';

function context() {
  const data = fixture();
  data.activeSetHistory = withParticipation(activeHistory(data));
  return { rules: defaultPolicy(), data, evidence: observed(data), budget: '3000.000001' };
}
test('live impact preserves policy and observations, exposes exact conserved targets', () => {
  const input = context();
  const before = structuredClone(input);
  const model = policyImpact(input);
  assert.deepEqual(input, before);
  assert.equal(model.error, undefined);
  assert.equal(model.result.executionEnabled, false);
  assert.equal(model.result.budgetRaw, '3000000001');
  assert.equal(model.largest, '4.00%');
  assert.equal(model.topThree, '12.00%');
  assert.equal(
    model.result.rows.reduce((sum, row) => sum + BigInt(row.targetRaw), 0n) +
      BigInt(model.result.unallocatedRaw),
    3000000001n
  );
});
test('editing a gate changes live impact without changing the earlier result', () => {
  const input = context();
  const original = policyImpact(input);
  input.rules.commissionMaxBps = 400;
  const changed = policyImpact(input);
  assert.equal(original.result.eligibleCount, 25);
  assert.equal(changed.result.eligibleCount, 0);
  assert.equal(changed.result.allocatedRaw, '0');
});
test('unknown history and invalid controls or budget never show calculated targets', () => {
  const input = context();
  for (const override of [{ valid: false }, { budget: '' }, { budget: '999999' }, { data: null }]) {
    const result = policyImpact({ ...input, ...override });
    assert.equal(result.result, undefined);
    assert.ok(result.error);
  }
  input.data.activeSetHistory = null;
  const unknown = policyImpact(input);
  assert.equal(unknown.result, undefined);
  assert.ok(unknown.error);
});
test('historical observations remain explicitly historical', () => {
  const input = context();
  input.data.collectedAt = new Date(Date.now() - 7200000).toISOString();
  assert.equal(policyImpact(input).historical, true);
});
