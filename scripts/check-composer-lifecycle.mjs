// Additional real Juno execution under schema 11. Keep the schema-10 lifecycle
// intact; this small follow-up changes only one existing inactive position.
import assert from 'node:assert/strict';
import { composerPolicy, policy } from '../juno-delegation-core.mjs';
import { criterionConfig } from '../juno-criteria-policy.mjs';
import { observed } from '../tests/fixtures/delegation-planner.mjs';
import { lifecycleSnapshot } from './check-rebalance-lifecycle.mjs';
import { buildRuleReview } from '../juno-delegation-review.mjs';
import { frozenRuleProposal, rebalanceProposal } from '../planner-proposal-draft.mjs';
import { finalizedReview } from '../juno-community-governance.mjs';
import { approvedRule } from '../juno-approved-rules.mjs';
import { buildRebalanceReview } from '../juno-rebalance.mjs';
import { executionReview } from '../juno-rebalance-execution.mjs';
import { readExecutionContent } from '../juno-execution-reference-read.mjs';
import { checkRebalanceSource } from '../juno-rebalance-chain.mjs';

export async function checkComposerLifecycle({
  get,
  workshopTx,
  queryReview,
  runProposal,
  recipient
}) {
  const snapshot = () => lifecycleSnapshot(get);
  async function publish(values) {
    const receipt = await workshopTx({ publish_proposal: { content: values } });
    assert.equal(receipt.code, 0, receipt.raw_log);
    const id = Number(
      receipt.events
        .find((event) => event.type === 'wasm')
        .attributes.find((attribute) => attribute.key === 'proposal_id').value
    );
    const finalized = await workshopTx({ finalize: { proposal_id: id, version: 1 } });
    assert.equal(finalized.code, 0, finalized.raw_log);
    const record = await queryReview({ proposal: { proposal_id: id } });
    const [revision] = await queryReview({
      revisions: { proposal_id: id, start_after: null, limit: 1 }
    });
    return finalizedReview(record, revision, 'juno-1');
  }
  const initial = await snapshot(),
    target = initial.validators.find((v) => v.address === recipient),
    rule = composerPolicy(),
    day = initial.blockTime.slice(0, 10);
  assert.equal(target.active, false, 'Fixture must exercise an inactive regular recipient');
  assert.equal(target.jailed, false);
  assert.ok(BigInt(target.currentRaw) > 1000000n);
  rule.votingPowerCapBps = 10000;
  for (const id of Object.keys(rule.criteria)) rule.criteria[id] = { role: 'unused' };
  rule.criteria.commission = criterionConfig('commission', 'bonus');
  rule.exclusions = initial.validators
    .filter((v) => v.address !== recipient)
    .map((v) => ({
      chainId: 'juno-1',
      validator: v.address,
      reason: 'Synthetic test: retain other positions through fixed targets'
    }));
  rule.fixedAllocations = initial.validators
    .filter((v) => v.address !== recipient && BigInt(v.currentRaw) > 0n)
    .map((v) => ({
      chainId: 'juno-1',
      validator: v.address,
      amountRaw: v.currentRaw,
      purpose: 'Synthetic test: preserve previous lifecycle holdings',
      documentation: '',
      startDate: day,
      endDate: day
    }));
  const holdings = (sample) => sample.validators.map((v) => [v.address, v.currentRaw]).sort();
  const budgetRaw = String(
    initial.validators.reduce((n, v) => n + BigInt(v.currentRaw), 0n) - 1000000n
  );
  const rules = await buildRuleReview({
    rule: policy(rule),
    snapshot: initial,
    evidence: observed(initial),
    budgetRaw
  });
  const finalRules = await publish((await frozenRuleProposal(rules, { referenced: true })).values);
  assert.deepEqual(finalRules.content.messages, []);
  const ruleVote = await runProposal('composer-rule-approval', [], finalRules.content);
  assert.equal(ruleVote.status, 'PROPOSAL_STATUS_PASSED', ruleVote.failed_reason);
  const approval = await approvedRule(ruleVote, Date.now(), { get });
  assert.equal(approval.rule.schema, 11);
  assert.equal(approval.hash, rules.value.policyHash);
  const current = await snapshot();
  assert.deepEqual(holdings(current), holdings(initial), 'Rule approval must not move holdings');
  assert.equal(
    current.liquidRaw,
    initial.liquidRaw,
    'Rule approval must not spend programme funds'
  );
  const simulation = await buildRebalanceReview({
    approval,
    snapshot: current,
    evidence: observed(current),
    budgetRaw
  });
  assert.equal(simulation.result.rows.find((v) => v.address === recipient).eligible, true);
  const review = await executionReview(simulation.value.calculation);
  assert.deepEqual(review.value.plan.moves, [
    {
      kind: 'undelegate',
      source: recipient,
      amountRaw: '1000000'
    }
  ]);
  const final = await publish((await rebalanceProposal(review)).values);
  const restored = await readExecutionContent(final.content, { get });
  assert.equal(restored.hash, review.hash);
  assert.deepEqual(final.content.messages, review.messages);
  const header = (await get('/cosmos/base/tendermint/v1beta1/blocks/latest')).block.header;
  await checkRebalanceSource(get, restored, header.height, header.time);
  const vote = await runProposal(
    'composer-programme-rebalance',
    final.content.messages,
    final.content
  );
  assert.equal(vote.status, 'PROPOSAL_STATUS_PASSED', vote.failed_reason);
  assert.equal((await readExecutionContent(vote, { get })).hash, review.hash);
  const after = await snapshot();
  for (const position of review.value.plan.positions) {
    const actual = after.validators.find((v) => v.address === position.address)?.currentRaw || '0';
    assert.equal(actual, position.targetRaw, 'Exact fixture target after schema-11 execution');
  }
  assert.ok(BigInt(after.liquidRaw) >= 50000000n);
  return {
    schema: 11,
    ruleApproval: ruleVote.status,
    status: vote.status,
    movements: review.value.plan.moves.length,
    inactiveRegularRecipient: true,
    roleAwarePreflight: true,
    exactTargets: true,
    previousOtherHoldingsPreserved: true,
    referencedEvidenceVerified: true
  };
}
