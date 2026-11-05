// Real local Juno execution, using synthetic historical observations only.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PROGRAMME, defaultPolicy, policy } from '../juno-delegation-core.mjs';
import {
  activeHistory,
  withParticipation,
  withGovernance,
  observed
} from '../tests/fixtures/delegation-planner.mjs';
import { buildRuleReview } from '../juno-delegation-review.mjs';
import { frozenRuleProposal, rebalanceProposal } from '../planner-proposal-draft.mjs';
import { approvedRule } from '../juno-approved-rules.mjs';
import { finalizedReview } from '../juno-community-governance.mjs';
import { availableBudget, buildRebalanceReview } from '../juno-rebalance.mjs';
import { executionReview } from '../juno-rebalance-execution.mjs';
import { readExecutionContent } from '../juno-execution-reference-read.mjs';
import { stakingState, checkRebalanceSource } from '../juno-rebalance-chain.mjs';

export async function lifecycleSnapshot(get) {
  const header = (await get('/cosmos/base/tendermint/v1beta1/blocks/latest')).block.header;
  const state = await stakingState(get, header.height);
  const raw = (await get('/cosmos/staking/v1beta1/validators?pagination.limit=100')).validators;
  const sample = {
    schema: 1,
    chainId: 'juno-1',
    programme: PROGRAMME,
    height: Number(header.height),
    blockTime: header.time,
    collectedAt: new Date().toISOString(),
    source: 'https://local-fixture.example.org',
    activeCount: state.activeCount,
    liquidRaw: state.liquidRaw,
    redelegations: state.redelegations,
    validators: state.validators.map((v) => ({
      address: v.address,
      consensusAddress: createHash('sha256')
        .update(
          Buffer.from(
            raw.find((r) => r.operator_address === v.address).consensus_pubkey.key,
            'base64'
          )
        )
        .digest('hex')
        .slice(0, 40)
        .toUpperCase(),
      name: 'Local ' + v.address.slice(-8),
      tokensRaw: v.tokensRaw,
      currentRaw: state.positions.find((p) => p.address === v.address)?.currentRaw || '0',
      active: v.active,
      jailed: v.jailed,
      commissionBps: Number(BigInt(v.commissionAtoms) / 100000000000000n)
    }))
  };
  // Deliberately synthetic: the local chain cannot supply five days of history.
  sample.activeSetHistory = withParticipation(activeHistory(sample, 5));
  withGovernance(sample);
  return sample;
}

export async function checkRebalanceLifecycle({
  get,
  workshopTx,
  queryReview,
  runProposal,
  extraValidators,
  lockedValidators
}) {
  const snapshot = () => lifecycleSnapshot(get);
  async function publish(values, id) {
    const tx = await workshopTx({ publish_proposal: { content: values } });
    assert.equal(tx.code, 0, tx.raw_log);
    const finalized = await workshopTx({ finalize: { proposal_id: id, version: 1 } });
    assert.equal(finalized.code, 0, finalized.raw_log);
    const record = await queryReview({ proposal: { proposal_id: id } });
    const [revision] = await queryReview({
      revisions: { proposal_id: id, start_after: null, limit: 1 }
    });
    return finalizedReview(record, revision, 'juno-1');
  }
  const initial = await snapshot(),
    rule = defaultPolicy(),
    day = initial.blockTime.slice(0, 10);
  rule.fixedAllocations = [...extraValidators, ...lockedValidators].map((address) => ({
    chainId: 'juno-1',
    validator: address,
    amountRaw: lockedValidators.includes(address)
      ? initial.validators.find((v) => v.address === address).currentRaw
      : '5000000',
    purpose: 'Synthetic local infrastructure obligation',
    documentation: '',
    startDate: day,
    endDate: day
  }));
  const rules = await buildRuleReview({
    rule: policy(rule),
    snapshot: initial,
    activeHistory: initial.activeSetHistory,
    evidence: observed(initial),
    budgetRaw: availableBudget(initial).toString()
  });
  const rulesFinal = await publish(
    (await frozenRuleProposal(rules, { referenced: true })).values,
    2
  );
  const rulesVote = await runProposal('referenced-fixed-rule-approval', [], rulesFinal.content);
  assert.equal(rulesVote.status, 'PROPOSAL_STATUS_PASSED', rulesVote.failed_reason);
  const approval = await approvedRule(rulesVote, Date.now(), { get });
  assert.equal(approval.hash, rules.value.policyHash);
  const current = await snapshot();
  const simulation = await buildRebalanceReview({
    approval,
    snapshot: current,
    evidence: observed(current),
    budgetRaw: availableBudget(current).toString()
  });
  const review = await executionReview(simulation.value.calculation);
  assert.ok(
    review.value.plan.moves.length >= 41,
    'Full planner must generate at least 41 movements'
  );
  const final = await publish((await rebalanceProposal(review)).values, 3);
  assert.ok(Buffer.byteLength(final.content.summary) < 2000);
  assert.deepEqual(final.content.messages, review.messages);
  const restored = await readExecutionContent(final.content, { get });
  assert.equal(restored.hash, review.hash);
  const header = (await get('/cosmos/base/tendermint/v1beta1/blocks/latest')).block.header;
  await checkRebalanceSource(get, restored, header.height, header.time);
  const unbonded = async () =>
    (
      await get(
        `/cosmos/staking/v1beta1/delegators/${PROGRAMME}/unbonding_delegations?pagination.limit=100`
      )
    ).unbonding_responses
      .flatMap((v) => v.entries)
      .reduce((sum, e) => sum + BigInt(e.balance), 0n);
  const unbondingBefore = await unbonded();
  const vote = await runProposal(
    'referenced-programme-rebalance',
    final.content.messages,
    final.content
  );
  assert.equal(vote.status, 'PROPOSAL_STATUS_PASSED', vote.failed_reason);
  assert.equal((await readExecutionContent(vote, { get })).hash, review.hash);
  const after = await snapshot();
  for (const target of review.value.plan.positions) {
    const actual = BigInt(
      after.validators.find((v) => v.address === target.address)?.currentRaw || '0'
    );
    const expected = BigInt(target.targetRaw);
    assert.ok(
      actual <= expected && expected - actual <= 1n,
      `Exact target, bounded share rounding: ${target.address}: ${actual}/${expected}`
    );
  }
  assert.ok(BigInt(after.liquidRaw) >= 50000000n);
  const unbondingDelta = (await unbonded()) - unbondingBefore;
  const expectedUnbonding = BigInt(review.value.plan.totals.undelegate);
  assert.ok(unbondingDelta <= expectedUnbonding && expectedUnbonding - unbondingDelta <= 1n);

  return {
    status: vote.status,
    movements: review.value.plan.moves.length,
    fixedTargets: rule.fixedAllocations.length,
    ruleApproval: rulesVote.status,
    nativeTextBytes: Buffer.byteLength(final.content.summary),
    reviewBodyCharacters: Array.from(final.values.body).length,
    actionsCharacters: Array.from(final.values.actions_json).length,
    exactTargets: true,
    unbondingUjuno: unbondingDelta.toString(),
    liquidReservePreserved: true,
    referencedEvidenceVerified: true,
    submissionGasPolicy: 'unchanged 5,000,000 maximum with 1.4 simulation buffer'
  };
}
