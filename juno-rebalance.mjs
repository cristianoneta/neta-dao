import { sameFixedWindow } from './juno-fixed-allocations.mjs';
import { snapshot, LIQUID_RESERVE, fingerprint } from './juno-delegation-core.mjs';
import { buildRuleReview, parentMatches } from './juno-delegation-review.mjs';

export function availableBudget(input) {
  const s = snapshot(input);
  const available =
    s.validators.reduce((sum, v) => sum + BigInt(v.currentRaw), 0n) +
    BigInt(s.liquidRaw) -
    LIQUID_RESERVE;
  return available > 0n ? available : 0n;
}

export function requireFreshSnapshot(input, now = Date.now()) {
  const s = snapshot(input);
  for (const value of [s.blockTime, s.collectedAt]) {
    const age = now - Date.parse(value);
    if (!Number.isFinite(age) || age > 3600000 || age < -300000)
      throw Error('Refresh programme data: Rebalance requires a snapshot less than one hour old.');
  }
  return s;
}

// Read-only targets, deliberately not an executable or submittable proposal.
// Never editablePolicy(): historical approvals must retain their exact semantics.
export async function buildRebalanceReview({
  approval,
  snapshot: input,
  evidence,
  budgetRaw,
  now = Date.now()
}) {
  if (!approval)
    throw Error('The community must approve a rule proposal before Rebalance is available.');
  const s = requireFreshSnapshot(input, now);
  if (Date.parse(approval.votingEndedAt) > now)
    throw Error('The rule approval voting period has not ended.');
  const review = await buildRuleReview({
    rule: structuredClone(approval.rule),
    parent: structuredClone(approval),
    snapshot: s,
    evidence,
    activeHistory: s.activeSetHistory ?? null,
    budgetRaw,
    createdAt: new Date(now).toISOString()
  });
  if (!review.model.proposed.result)
    throw Error(review.model.proposed.reason || 'Complete allocation evidence is required.');
  const result = review.model.proposed.result;
  if (BigInt(result.allocatedRaw) === 0n)
    throw Error('No allocation is possible under the approved rules and current observations.');
  const value = {
    schema: 1,
    kind: 'ALLOCATION_SIMULATION',
    executionEnabled: false,
    approvedProposalId: approval.proposalId,
    approvedPolicyHash: approval.hash,
    createdAt: review.value.createdAt,
    calculation: structuredClone(review.value),
    messages: []
  };
  return { value, hash: await fingerprint(value), result: structuredClone(result) };
}

export async function verifyRebalanceBaseline(review, currentApproval, input, now = Date.now()) {
  if (
    review?.value?.kind !== 'ALLOCATION_SIMULATION' ||
    review.value.executionEnabled !== false ||
    !Array.isArray(review.value.messages) ||
    review.value.messages.length ||
    review.hash !== (await fingerprint(review.value))
  )
    throw Error('The allocation draft has changed. Simulate it again.');
  requireFreshSnapshot(input, now);
  if (
    !sameFixedWindow(
      review.value.calculation.rule,
      review.value.calculation.snapshot.blockTime,
      new Date(now).toISOString()
    )
  )
    throw Error('A fixed-allocation period changed. Refresh data and simulate again.');
  if (!parentMatches(review.value.calculation.parent, currentApproval))
    throw Error(
      'The approved rules have changed. Simulate again with the current approved rulebook.'
    );
  if (review.value.calculation.sourceSnapshotHash !== (await fingerprint(snapshot(input))))
    throw Error('Programme observations changed. Simulate again before downloading.');
  return true;
}
