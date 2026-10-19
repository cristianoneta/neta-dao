import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  defaultPolicy,
  collectingPolicy,
  strictHistoryPolicy,
  legacyPolicy,
  editablePolicy,
  policy,
  simulate,
  amount,
  fingerprint
} from '../juno-delegation-core.mjs';
import {
  participationEvidence,
  meetsParticipation,
  participationText
} from '../juno-participation-history.mjs';
import {
  buildRuleReview,
  verifyRuleReview,
  readProposalReview
} from '../juno-delegation-review.mjs';
import { frozenRuleProposal } from '../planner-proposal-draft.mjs';
import {
  fixture,
  observed,
  activeHistory,
  withParticipation
} from './fixtures/delegation-planner.mjs';

test('an immutable review made by the released schema-4 engine retains its exact hash', async () => {
  const old = JSON.parse(
    await readFile(new URL('./fixtures/frozen-collecting-review.json', import.meta.url))
  );
  assert.equal(old.sourceCommit, 'a2253ffa7d93840ecee2f3fd4b64db4afdd21390');
  assert.equal((await verifyRuleReview(old.value)).hash, old.hash);
  assert.equal(old.value.rule.schema, 4);
  assert.equal(old.value.activeHistory.participation, undefined);
});

test('97.5% uses exact ratios, includes its boundary and counts nil as unsigned', () => {
  const s = fixture(),
    h = withParticipation(activeHistory(s, 5));
  const a = h.participation.validators[0],
    b = h.participation.validators[1];
  // 3,200,000 rolling slots makes an exact boundary possible.
  const full = withParticipation(activeHistory(s));
  Object.assign(full.participation.validators[0], { signed: 3120000, absent: 40000, nil: 40000 });
  Object.assign(full.participation.validators[1], { signed: 3119999, absent: 40001, nil: 40000 });
  const r = simulate(defaultPolicy(), s, amount('2500'), observed(s), full);
  assert.equal(r.rows[0].eligible, true);
  assert.equal(r.rows[1].eligible, false);
  assert.match(r.rows[1].reasons.join(), /below 97.5%/);
  assert.equal(r.rows[1].targetRaw, '0');
  assert.match(participationText(r.rows[1].participation), /^97.4999%/);
  assert.equal(meetsParticipation({ expected: 40, signed: 39 }), true);
  assert.equal(meetsParticipation({ expected: 40, signed: 38 }), false);
  assert.equal(meetsParticipation({ expected: 0, signed: 0 }), false);
  a.signed -= 90000;
  a.nil = 90000;
  b.signed -= 90000;
  b.absent = 90000;
  const partial = simulate(defaultPolicy(), s, amount('2500'), observed(s), h);
  assert.equal(partial.eligibleCount, 23);
  assert.equal(partial.executionEnabled, false);
});

test('missing counts never become zero targets or 100% participation', async () => {
  const s = fixture(),
    h = withParticipation(activeHistory(s, 5));
  for (const mutate of [(h) => delete h.participation, (h) => h.participation.validators.pop()]) {
    const bad = structuredClone(h);
    mutate(bad);
    const r = await buildRuleReview({
      rule: defaultPolicy(),
      snapshot: s,
      evidence: observed(s),
      activeHistory: bad,
      budgetRaw: '2500000000'
    });
    assert.equal(r.value.proposed.targets, null);
    assert.match(r.value.proposed.reason, /Commit-signature counts/);
  }
});

test('counts are bound to exact endpoints, rosters, denominators and balanced totals', () => {
  const s = fixture(),
    h = withParticipation(activeHistory(s, 5));
  for (const mutate of [
    (h) => h.participation.firstHeight++,
    (h) => h.participation.lastHeight--,
    (h) => (h.participation.startTime = s.blockTime),
    (h) => (h.participation.endTime = new Date(Date.parse(s.blockTime) - 1).toISOString()),
    (h) => h.participation.validators.push(h.participation.validators[0]),
    (h) => (h.participation.validators[0].address = 'F'.repeat(40)),
    (h) => h.participation.validators[0].signed--,
    (h) => {
      h.participation.validators[0].expected--;
      h.participation.validators[0].signed--;
    },
    (h) => (h.participation.validators[0].signed = -1),
    (h) => (h.participation.validators[0].nil = 0.1),
    (h) => (h.participation.validators[0].absent = '0'),
    (h) => (h.participation.validators[0].signed = Number.MAX_SAFE_INTEGER + 1)
  ]) {
    const bad = structuredClone(h);
    mutate(bad);
    assert.throws(() => participationEvidence(bad, s));
  }
});

test('shared window advances automatically; late entry still fails membership at 100% signatures', () => {
  const s = fixture();
  for (const days of [0.01, 5, 89.999, 90]) {
    const h = withParticipation(activeHistory(s, days)),
      c = participationEvidence(h, s);
    assert.equal(c.complete, true);
    assert.equal(c.collecting, days < 90);
    assert.ok(Math.abs(c.observedDays - days) < 1e-7);
    assert.equal(simulate(defaultPolicy(), s, amount('2500'), observed(s), h).eligibleCount, 25);
  }
  const h = activeHistory(s, 5),
    all = [...h.spans[0].addresses];
  h.spans[0].lastHeight = s.height - 1;
  h.spans[0].endTime = new Date(Date.parse(s.blockTime) - 1000).toISOString();
  h.spans[0].addresses = all.slice(1);
  h.spans.push({
    firstHeight: s.height,
    lastHeight: s.height,
    startTime: s.blockTime,
    endTime: s.blockTime,
    addresses: all
  });
  withParticipation(h);
  const r = simulate(defaultPolicy(), s, amount('2500'), observed(s), h);
  assert.equal(r.rows[0].participation.expected, 1);
  assert.equal(r.rows[0].eligible, false);
  assert.match(r.rows[0].reasons.join(), /observed period/);
  assert.equal(r.rows[1].eligible, true);
});

test('only editable rules migrate; settings and original approvals retain their meaning', async () => {
  const s = fixture(),
    h = withParticipation(activeHistory(s, 5));
  for (const original of [
    legacyPolicy(),
    strictHistoryPolicy(),
    collectingPolicy(),
    defaultPolicy()
  ]) {
    original.factorTenths = 18;
    original.commissionMaxBps = null;
    original.exclusions = [
      { chainId: 'juno-1', validator: s.validators[0].address, reason: 'Kept' }
    ];
    const hash = await fingerprint(original),
      migrated = editablePolicy(original);
    assert.equal(migrated.schema, 5);
    assert.equal(migrated.minParticipationBps, 9750);
    assert.equal(migrated.factorTenths, 18);
    assert.equal(migrated.commissionMaxBps, null);
    assert.deepEqual(migrated.exclusions, original.exclusions);
    assert.equal(await fingerprint(policy(original)), hash);
    assert.equal(await fingerprint(original), hash);
  }
  assert.throws(() => policy({ ...defaultPolicy(), minParticipationBps: 9500 }));
  delete h.participation;
  assert.equal(simulate(collectingPolicy(), s, amount('2500'), observed(s), h).eligibleCount, 25);
  assert.throws(
    () => simulate(strictHistoryPolicy(), s, amount('2500'), observed(s), h),
    /90 days/
  );
});

test('frozen schema-5 reviews embed counts, expose the rule change and reject altered results', async () => {
  const s = fixture(),
    h = withParticipation(activeHistory(s, 5)),
    old = collectingPolicy(),
    row = h.participation.validators[0];
  row.signed -= 90000;
  row.absent = 90000;
  const r = await buildRuleReview({
    rule: defaultPolicy(),
    snapshot: s,
    evidence: observed(s),
    activeHistory: h,
    budgetRaw: '2500000000',
    parent: {
      rule: old,
      proposalId: '902',
      votingEndedAt: '2026-10-01T00:00:00Z',
      hash: await fingerprint(old)
    }
  });
  assert.equal(r.model.previous.result.eligibleCount, 25);
  assert.equal(r.model.proposed.result.eligibleCount, 24);
  assert.match(r.model.changes.find((c) => c.key === 'eligibility').after, /97.5%/);
  assert.equal((await verifyRuleReview(r.value)).hash, r.hash);
  const proposal = await frozenRuleProposal(r);
  assert.equal((await readProposalReview(proposal.values)).hash, r.hash);
  const bad = structuredClone(r.value);
  bad.activeHistory.participation.validators[0].signed += 90000;
  bad.activeHistory.participation.validators[0].absent = 0;
  await assert.rejects(verifyRuleReview(bad), /does not reproduce/);
  assert.deepEqual(r.value.messages, []);
});
