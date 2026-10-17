import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultPolicy,
  legacyPolicy,
  simulate,
  fingerprint,
  amount
} from '../juno-delegation-core.mjs';
import { activeSetEvidence } from '../juno-active-set-history.mjs';
import {
  buildRuleReview,
  verifyRuleReview,
  ruleChanges,
  comparison,
  parentMatches,
  readProposalReview,
  encodeRuleReview
} from '../juno-delegation-review.mjs';
import { frozenRuleProposal } from '../planner-proposal-draft.mjs';
import { approvedRule } from '../juno-approved-rules.mjs';
import { fixture, observed, activeHistory } from './fixtures/delegation-planner.mjs';
async function setup({
  parent = false,
  history = true,
  rule = defaultPolicy(),
  snapshot = fixture(),
  budgetRaw = '2500000000'
} = {}) {
  const old = parent
    ? {
        rule: defaultPolicy(),
        proposalId: '901',
        votingEndedAt: '2026-10-01T00:00:00Z',
        hash: await fingerprint(defaultPolicy())
      }
    : null;
  return buildRuleReview({
    rule,
    parent: old,
    snapshot,
    evidence: observed(snapshot),
    activeHistory: history ? activeHistory(snapshot) : null,
    budgetRaw
  });
}
test('initial adoption has real holdings but no fabricated old values or policy target', async () => {
  const s = fixture(26);
  s.validators[25].active = false;
  s.activeCount = 25;
  const r = await setup({ snapshot: s });
  assert.ok(r.model.changes.every((c) => c.before === 'Not established'));
  assert.equal(comparison(r.model, 'policy').available, false);
  const c = comparison(r.model),
    outside = c.rows.find((v) => !v.active);
  assert.equal(outside.currentRaw, '100000000');
  assert.equal(outside.after, '0');
  assert.equal(c.outsideRaw, '100000000');
  assert.equal(c.beforeCount, 26);
  assert.ok(c.afterCount < c.beforeCount);
});
test('policy effect isolates rules from existing portfolio drift and a new budget', async () => {
  const s = fixture();
  s.validators[0].currentRaw = '200000000';
  const r = await setup({ parent: true, snapshot: s, budgetRaw: '2800000000' });
  assert.ok(comparison(r.model).rows.some((v) => v.delta !== '0'));
  assert.ok(comparison(r.model, 'policy').rows.every((v) => v.delta === '0'));
  assert.equal(comparison(r.model, 'policy').net, '0');
  assert.equal(comparison(r.model).net, '200000000');
  assert.equal(r.model.changes.filter((c) => c.changed).length, 0);
});
test('commission change includes indirect redistribution and conserves increases/decreases', async () => {
  const s = fixture();
  s.validators[0].commissionBps = 1500;
  const rule = { ...defaultPolicy(), commissionMaxBps: 2000 },
    r = await setup({ snapshot: s, parent: true, rule });
  const c = comparison(r.model, 'policy');
  assert.ok(BigInt(c.rows.find((v) => v.address === s.validators[0].address).delta) > 0n);
  assert.ok(c.rows.some((v) => BigInt(v.delta) < 0n));
  assert.equal(c.increases, c.decreases);
  assert.equal(c.net, '0');
  assert.deepEqual(
    r.model.changes.filter((v) => v.changed).map((v) => v.key),
    ['commissionMaxBps']
  );
});
test('one micro-JUNO differences remain exact even when display rounds', async () => {
  const s = fixture();
  s.validators[0].currentRaw = '100000001';
  const r = await setup({ snapshot: s });
  assert.equal(
    comparison(r.model).rows.find((v) => v.address === s.validators[0].address).delta,
    '-1'
  );
});
test('missing and short 90-day evidence produces unavailable targets, never a zero allocation plan', async () => {
  const r = await setup({ history: false });
  assert.equal(r.value.proposed.targets, null);
  const c = comparison(r.model);
  assert.equal(c.decreases, null);
  assert.equal(c.afterCount, null);
  assert.ok(c.rows.every((v) => v.after === null && v.delta === null));
  const s = fixture();
  assert.equal(activeSetEvidence(activeHistory(s, 3), s).complete, false);
  assert.throws(() => simulate(defaultPolicy(), s, amount('2500'), observed(s)), /90-day/);
  assert.equal(simulate(legacyPolicy(), s, amount('2500'), observed(s)).allocatedRaw, '2500000000');
});
test('90-day continuity rejects gaps, mismatched height, changed roster and short edge', () => {
  const s = fixture(),
    h = activeHistory(s);
  assert.equal(activeSetEvidence(h, s).members.size, 25);
  for (const change of [
    (h) => h.spans[0].lastHeight--,
    (h) => (h.spans[0].endTime = new Date(Date.parse(s.blockTime) - 1000).toISOString())
  ]) {
    const bad = structuredClone(h);
    change(bad);
    assert.equal(activeSetEvidence(bad, s).complete, false);
  }
  const changed = structuredClone(h);
  changed.spans[0].addresses.pop();
  assert.throws(() => activeSetEvidence(changed, s), /disagree/);
  const bad = structuredClone(h);
  bad.spans.push({ ...bad.spans[0], firstHeight: s.height + 2, lastHeight: s.height + 2 });
  assert.throws(() => activeSetEvidence(bad, s), /gap/);
});
test('leaving and rejoining resets continuity, while entry before the exact cutoff qualifies', () => {
  const s = fixture(),
    h = activeHistory(s, 92),
    first = h.spans[0];
  first.lastHeight = s.height - 2;
  first.endTime = new Date(Date.parse(s.blockTime) - 91 * 86400000).toISOString();
  first.addresses = first.addresses.slice(1);
  h.spans.push({
    firstHeight: s.height - 1,
    lastHeight: s.height,
    startTime: new Date(Date.parse(s.blockTime) - 90 * 86400000).toISOString(),
    endTime: s.blockTime,
    addresses: s.validators.map((v) => v.consensusAddress)
  });
  assert.equal(activeSetEvidence(h, s).members.size, 25);
  h.spans[1].startTime = new Date(Date.parse(s.blockTime) - 89 * 86400000).toISOString();
  assert.equal(activeSetEvidence(h, s).members.size, 24);
});
test('exclusion reason edits are distinct from changes to numeric allocation criteria', () => {
  const old = defaultPolicy(),
    rule = defaultPolicy(),
    address = fixture().validators[0].address;
  old.exclusions = [{ chainId: 'juno-1', validator: address, reason: 'First reason' }];
  rule.exclusions = [{ ...old.exclusions[0], reason: 'Clarified reason' }];
  const changes = ruleChanges(old, rule).filter((v) => v.changed);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].numerical, false);
});
test('the frozen self-contained proposal reproduces both policies and remains unchanged after edits', async () => {
  const r = await setup({ parent: true }),
    p = await frozenRuleProposal(r),
    original = p.values.body;
  assert.ok(p.values.body.length <= 10000);
  assert.deepEqual(JSON.parse(p.values.actions_json), []);
  const read = await readProposalReview(p.values);
  assert.equal(read.hash, r.hash);
  r.value.rule.factorTenths = 20;
  assert.equal(p.values.body, original);
  assert.equal(read.value.rule.factorTenths, 15);
  await assert.rejects(verifyRuleReview(r.value));
});
test('tampered output, unsupported algorithms, missing package and execution actions are rejected', async () => {
  const r = await setup(),
    p = await frozenRuleProposal(r);
  for (const mutate of [
    (v) => (v.proposed.targets[0] = '999'),
    (v) => (v.engine = 'unknown'),
    (v) => (v.policyHash = '0'.repeat(64)),
    (v) => v.messages.push({ bank: 'send' }),
    (v) => (v.snapshot.validators[0].currentRaw = '1')
  ]) {
    const bad = structuredClone(r.value);
    mutate(bad);
    await assert.rejects(verifyRuleReview(bad));
  }
  await assert.rejects(readProposalReview({ ...p.values, actions_json: '[{}]' }), /no execution/);
  await assert.rejects(
    readProposalReview({ ...p.values, body: p.values.body.replace('"schema":3', '"schema":2') })
  );
  await assert.rejects(
    readProposalReview({
      ...p.values,
      body: p.values.body.split('## Frozen allocation review')[0]
    }),
    /complete frozen/
  );
  await assert.rejects(
    readProposalReview({ ...p.values, body: p.values.body + '\n' + (await encodeRuleReview(r)) }),
    /duplicated/
  );
});
test('only exact parent proposal and rule hash match; changed policy stops an old draft', () => {
  const parent = { proposalId: '900', hash: 'a'.repeat(64) };
  assert.equal(parentMatches(parent, { ...parent }), true);
  assert.equal(parentMatches(parent, { ...parent, proposalId: '901' }), false);
  assert.equal(parentMatches(parent, { ...parent, hash: 'b'.repeat(64) }), false);
  assert.equal(parentMatches(null, parent), false);
  assert.equal(parentMatches(null, null), true);
});
test('passed schema-3 rule approval requires a verified frozen comparison, but does not authorize funds', async () => {
  const r = await setup({ history: false }),
    p = await frozenRuleProposal(r);
  const proposal = {
    id: '902',
    title: p.values.title,
    summary: p.values.body,
    status: 'PROPOSAL_STATUS_PASSED',
    messages: [],
    voting_end_time: new Date(Date.now() - 1000).toISOString()
  };
  assert.equal((await approvedRule(proposal)).hash, r.value.policyHash);
  proposal.summary = proposal.summary.split('## Frozen allocation review')[0];
  await assert.rejects(approvedRule(proposal), /complete frozen/);
});
test('snapshot reduction retains held excluded validators and reproduces full-network caps', async () => {
  const s = fixture(30);
  s.activeCount = 25;
  s.validators.slice(25).forEach((v, i) => {
    v.active = false;
    v.currentRaw = i === 0 ? '7' : '0';
    v.tokensRaw = i === 0 ? '7' : '1';
  });
  const r = await setup({ snapshot: s });
  assert.equal(r.value.snapshot.validators.length, 26);
  assert.equal(r.value.sourceValidatorCount, 30);
  assert.ok(r.value.snapshot.validators.some((v) => v.currentRaw === '7'));
  assert.equal((await verifyRuleReview(r.value)).hash, r.hash);
});
