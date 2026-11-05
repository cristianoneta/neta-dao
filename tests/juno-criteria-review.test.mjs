import test from 'node:test';
import assert from 'node:assert/strict';
import {
  composerPolicy,
  defaultPolicy,
  canonical,
  fingerprint,
  simulate
} from '../juno-delegation-core.mjs';
import {
  buildRuleReview,
  verifyRuleReview,
  readProposalReview,
  ruleChanges
} from '../juno-delegation-review.mjs';
import { packReview, unpackReview } from '../juno-review-transport.mjs';
import { frozenRuleProposal } from '../planner-proposal-draft.mjs';
import {
  fixture,
  observed,
  withGovernance,
  activeHistory,
  withParticipation
} from './fixtures/delegation-planner.mjs';

function input(rule = composerPolicy()) {
  const snapshot = withGovernance(fixture());
  return {
    rule,
    snapshot,
    evidence: observed(snapshot),
    activeHistory: withParticipation(activeHistory(snapshot)),
    budgetRaw: '2500000000',
    createdAt: snapshot.blockTime
  };
}
function unused() {
  const rule = composerPolicy();
  for (const id of Object.keys(rule.criteria)) rule.criteria[id] = { role: 'unused' };
  rule.points.base = 1000;
  rule.votingPowerCapBps = 10000;
  return rule;
}

test('exclusive roles, exact curves and own evidence roundtrip through the frozen proposal', async () => {
  const i = input();
  i.rule.criteria.commission = { role: 'bonus', weight: 35, zeroBps: 1000, fullBps: 0 };
  i.rule.criteria.governance.weight = 65;
  const review = await buildRuleReview(i);
  assert.deepEqual(review.value.rule, i.rule);
  assert.equal(review.value.engine, 'points-capped-review-1');
  assert.equal(review.hash, (await verifyRuleReview(review.value)).hash);
  assert.equal(canonical(unpackReview(packReview(review.value))), canonical(review.value));
  const draft = await frozenRuleProposal(review, { referenced: true });
  const restored = await readProposalReview(draft.values);
  assert.equal(restored.hash, review.hash);
  assert.deepEqual(restored.value.rule.criteria.commission, i.rule.criteria.commission);
  assert.deepEqual(JSON.parse(draft.values.actions_json), []);
  const tampered = structuredClone(review.value);
  tampered.rule.criteria.commission.weight++;
  await assert.rejects(verifyRuleReview(tampered), /reproduce/);
});

test('removing historical gates retains unheld standby candidates and their exact targets', async () => {
  const i = input(unused());
  i.snapshot = fixture(26);
  i.snapshot.activeCount = 25;
  const standby = i.snapshot.validators.at(-1);
  standby.active = false;
  standby.currentRaw = '0';
  standby.tokensRaw = '1';
  i.evidence = null;
  i.activeHistory = null;
  const review = await buildRuleReview(i);
  assert.equal(review.value.proposed.status, 'calculated');
  assert.equal(review.value.snapshot.validators.length, 26);
  assert.deepEqual(review.value.evidence, { window: { coverageComplete: false }, records: [] });
  const row = review.model.proposed.result.rows.find((v) => v.address === standby.address);
  assert.equal(row.eligible, true);
  assert.ok(BigInt(row.targetRaw) > 0n);
  const full = simulate(i.rule, i.snapshot, BigInt(i.budgetRaw), null, null);
  assert.equal(row.targetRaw, full.rows.find((v) => v.address === standby.address).targetRaw);
  assert.equal((await verifyRuleReview(review.value)).hash, review.hash);
  const omitted = structuredClone(review.value);
  omitted.snapshot.validators = omitted.snapshot.validators.filter(
    (v) => v.address !== standby.address
  );
  await assert.rejects(verifyRuleReview(omitted), /reproduce/);
});

test('snapshot reduction removes only irrelevant rows and retains recipients of either policy', async () => {
  const i = input();
  i.snapshot = fixture(26);
  i.snapshot.activeCount = 25;
  const standby = i.snapshot.validators.at(-1);
  standby.active = false;
  standby.currentRaw = '0';
  standby.tokensRaw = '1';
  withGovernance(i.snapshot);
  i.evidence = observed(i.snapshot);
  i.activeHistory = withParticipation(activeHistory(i.snapshot));
  let review = await buildRuleReview(i);
  assert.equal(review.value.snapshot.validators.length, 25);
  assert.equal(review.value.sourceValidatorCount, 26);
  const full = simulate(i.rule, i.snapshot, BigInt(i.budgetRaw), i.evidence, i.activeHistory);
  assert.equal(full.rows.find((v) => v.address === standby.address).targetRaw, '0');
  for (const v of full.rows.filter((v) => BigInt(v.targetRaw) > 0n))
    assert.equal(
      review.model.proposed.result.rows.find((next) => next.address === v.address)?.targetRaw,
      v.targetRaw
    );
  assert.equal((await verifyRuleReview(review.value)).hash, review.hash);
  const previous = unused();
  i.parent = {
    proposalId: '901',
    votingEndedAt: '2026-10-01T00:00:00Z',
    rule: previous,
    hash: await fingerprint(previous)
  };
  review = await buildRuleReview(i);
  assert.equal(review.value.snapshot.validators.length, 26);
  assert.ok(
    BigInt(review.model.previous.result.rows.find((v) => v.address === standby.address).targetRaw) >
      0n
  );
  assert.equal((await verifyRuleReview(review.value)).hash, review.hash);
});

test('unavailable comparison evidence retains possible recipients without claiming a calculation', async () => {
  const i = input(unused());
  i.snapshot = fixture(26);
  i.snapshot.activeCount = 25;
  const standby = i.snapshot.validators.at(-1);
  standby.active = false;
  standby.currentRaw = '0';
  standby.tokensRaw = '1';
  standby.commissionBps = 2000;
  i.rule.criteria.commission = { role: 'eligibility', maximumBps: 1000 };
  i.evidence = null;
  i.activeHistory = null;
  const previous = unused();
  previous.criteria.upgrade = { role: 'eligibility' };
  i.parent = {
    proposalId: '901',
    votingEndedAt: '2026-10-01T00:00:00Z',
    rule: previous,
    hash: await fingerprint(previous)
  };
  const review = await buildRuleReview(i);
  assert.equal(review.value.snapshot.validators.length, 26);
  assert.equal(review.value.proposed.status, 'calculated');
  assert.equal(review.value.previous.status, 'unavailable');
  assert.equal(review.value.previous.targets, null);
  assert.equal((await verifyRuleReview(review.value)).hash, review.hash);
});

test('only selected criteria require upgrade, commit and governance evidence', async () => {
  const i = input(unused());
  i.evidence = null;
  i.activeHistory = null;
  delete i.snapshot.governanceHistory;
  assert.equal((await buildRuleReview(i)).value.proposed.status, 'calculated');
  i.rule.criteria.upgrade = { role: 'eligibility' };
  assert.equal((await buildRuleReview(i)).value.proposed.status, 'unavailable');
  i.rule.criteria.upgrade = { role: 'unused' };
  i.rule.criteria.uptime = { role: 'bonus', weight: 100, zeroBps: 9500, fullBps: 9950 };
  assert.equal((await buildRuleReview(i)).value.proposed.status, 'unavailable');
  i.rule.criteria.uptime = { role: 'unused' };
  i.rule.criteria.governance = { role: 'eligibility', minimumBps: 5000 };
  await assert.rejects(buildRuleReview(i), /governance/i);
  withGovernance(i.snapshot);
  const review = await buildRuleReview(i);
  assert.ok(review.value.snapshot.governanceHistory);
  assert.equal(review.value.proposed.status, 'calculated');
  assert.equal(review.model.proposed.result.eligibleCount, 0);
  assert.equal(review.value.proposed.allocatedRaw, '0');
  assert.equal((await verifyRuleReview(review.value)).hash, review.hash);
});

test('a fully reserved fixed budget does not demand unused regular scoring evidence', async () => {
  const i = input();
  const recipient = i.snapshot.validators[0];
  recipient.jailed = true;
  i.rule.fixedAllocations = [
    {
      chainId: 'juno-1',
      validator: recipient.address,
      amountRaw: i.budgetRaw,
      purpose: 'Reviewed special duty',
      startDate: i.snapshot.blockTime.slice(0, 10),
      endDate: i.snapshot.blockTime.slice(0, 10),
      documentation: ''
    }
  ];
  i.evidence = null;
  i.activeHistory = null;
  delete i.snapshot.governanceHistory;
  const review = await buildRuleReview(i);
  assert.equal(review.value.proposed.status, 'calculated');
  assert.equal(review.value.proposed.allocatedRaw, i.budgetRaw);
  assert.equal(
    review.model.proposed.result.rows.find((v) => v.address === recipient.address).fixedRaw,
    i.budgetRaw
  );
  assert.equal((await verifyRuleReview(review.value)).hash, review.hash);
});

test('comparison names role, gate, curve and weight changes while preserving the old rule', async () => {
  const old = defaultPolicy(),
    next = composerPolicy();
  next.criteria.uptime = { role: 'bonus', weight: 25, zeroBps: 9500, fullBps: 9950 };
  next.criteria.governance.weight = 75;
  const original = canonical(old),
    originalHash = await fingerprint(old);
  const rows = ruleChanges(old, next);
  const uptime = rows.find((r) => r.key === 'criterion:uptime');
  assert.equal(uptime.changed, true);
  assert.match(uptime.before, /Eligibility.*97\.5%/);
  assert.match(uptime.after, /Bonus.*weight 25.*95%.*99\.5%/);
  const commission = rows.find((r) => r.key === 'criterion:commission');
  assert.equal(commission.changed, false);
  assert.match(commission.after, /maximum 10%/);
  assert.equal(canonical(old), original);
  assert.equal(await fingerprint(old), originalHash);
});

test('schema11 exact policy without its frozen comparison is rejected', async () => {
  await assert.rejects(
    readProposalReview({
      title: 'Juno Delegation Programme — allocation rules',
      body: '## Exact policy\n\n```json\n' + JSON.stringify(composerPolicy()) + '\n```',
      actions_json: '[]'
    }),
    /complete frozen comparison/
  );
});
