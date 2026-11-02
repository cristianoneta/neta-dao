import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  defaultPolicy,
  pointsPolicy,
  policy,
  withVotingPowerCap,
  restoreVotingPowerCap,
  capFraction,
  simulate,
  amount,
  fingerprint,
  upgradeEvidence
} from '../juno-delegation-core.mjs';
import { buildRuleReview, readProposalReview, ruleChanges } from '../juno-delegation-review.mjs';
import { frozenRuleProposal } from '../planner-proposal-draft.mjs';
import { recalculateRuleCap } from '../juno-rule-revision.mjs';
import { approvedRule } from '../juno-approved-rules.mjs';
import { ruleProposalSummary } from '../juno-rule-summary.mjs';
import {
  fixture,
  observed,
  activeHistory,
  withParticipation,
  withGovernance
} from './fixtures/delegation-planner.mjs';

const source = () => {
  const s = withGovernance(fixture(3));
  s.liquidRaw = amount('3000').toString();
  s.activeSetHistory = withParticipation(activeHistory(s));
  s.validators.slice(1).forEach((v) => {
    v.commissionBps = 2000;
  });
  return s;
};
test('direct percentage accepts the full range, stays fixed across set sizes and rejects ambiguous rules', () => {
  for (const bps of [1, 600, 1000, 2000, 3000, 9999, 10000]) {
    const p = withVotingPowerCap(defaultPolicy(), bps);
    assert.deepEqual(policy(JSON.parse(JSON.stringify(p))), p);
    for (const n of [1, 3, 25, 200])
      assert.deepEqual(capFraction(p, n), { numerator: BigInt(bps), denominator: 10000n });
  }
  for (const bps of [0, -1, 10001, 10.1, '10000', null, NaN, Infinity])
    assert.throws(() => withVotingPowerCap(defaultPolicy(), bps), /Invalid rule/);
  assert.throws(() => policy({ ...defaultPolicy(), factorTenths: 25 }));
  assert.throws(() => policy({ ...pointsPolicy(), votingPowerCapBps: 10000 }));
});
test('50% and 100% really allocate beyond 30%, while eligibility and fixed exceptions still apply', () => {
  const s = source(),
    e = observed(s),
    h = s.activeSetHistory;
  const run = (bps) => simulate(withVotingPowerCap(defaultPolicy(), bps), s, amount('2500'), e, h);
  const limited = run(3000),
    half = run(5000),
    full = run(10000);
  assert.equal(limited.allocatedRaw, '0'); // External stake alone exceeds 30%.
  assert.equal(half.allocatedRaw, amount('1000').toString());
  assert.equal(full.allocatedRaw, amount('2500').toString());
  assert.equal(full.unallocatedRaw, '0');
  assert.equal(full.rows[1].targetRaw, '0');
  const p = withVotingPowerCap(defaultPolicy(), 1);
  p.fixedAllocations = [
    {
      chainId: 'juno-1',
      validator: s.validators[1].address,
      amountRaw: amount('500').toString(),
      purpose: 'Maintain an archive',
      startDate: s.blockTime.slice(0, 10),
      endDate: '2099-12-31',
      documentation: 'https://example.org/mandate'
    }
  ];
  const fixed = simulate(p, s, amount('2500'), e, h);
  assert.equal(fixed.rows[1].targetRaw, amount('500').toString());
  assert.equal(fixed.regularBudgetRaw, amount('2000').toString());
});
test('editing and resetting a relative cap preserve unrelated rules and old review hashes', async () => {
  const old = pointsPolicy(),
    hash = await fingerprint(old);
  const next = withVotingPowerCap(old, 600);
  next.commissionMaxBps = 700;
  const change = ruleChanges(old, next).find((r) => r.key === 'votingPowerCapBps');
  assert.equal(change.changed, true); // Same value at 25 validators, different semantics.
  assert.match(change.after, /^6%/);
  const reset = restoreVotingPowerCap(next, old);
  assert.equal(reset.schema, 9);
  assert.equal(reset.factorTenths, old.factorTenths);
  assert.equal(reset.commissionMaxBps, 700);
  assert.equal(await fingerprint(policy(old)), hash);
  assert.equal(restoreVotingPowerCap(old, next).votingPowerCapBps, 600);
});
test('old and direct rules round-trip through compact review and native approval; summaries use percentages', async () => {
  const s = source();
  for (const rule of [pointsPolicy(), withVotingPowerCap(defaultPolicy(), 10000)]) {
    const review = await buildRuleReview({
      rule,
      snapshot: s,
      evidence: observed(s),
      activeHistory: s.activeSetHistory,
      budgetRaw: amount('2500').toString()
    });
    const draft = await frozenRuleProposal(review);
    assert.equal((await readProposalReview(draft.values)).hash, review.hash);
    const approved = await approvedRule({
      id: '99',
      title: draft.values.title,
      summary: draft.values.summary + '\n\n' + draft.values.body,
      status: 'PROPOSAL_STATUS_PASSED',
      voting_end_time: new Date(Date.now() - 1000).toISOString(),
      messages: []
    });
    assert.deepEqual(approved.rule, rule);
  }
  const summary = ruleProposalSummary({
    value: {
      parent: { rule: withVotingPowerCap(defaultPolicy(), 1000) },
      rule: withVotingPowerCap(defaultPolicy(), 10000)
    }
  });
  assert.match(summary, /10%.*100%/);
  assert.doesNotMatch(summary, /factor/);
  assert.ok([...summary].length <= 300);
});

const history = JSON.parse(
  readFileSync(new URL('../data/validator-upgrades/juno-v31.json', import.meta.url))
);
const readiness = JSON.parse(
  readFileSync(new URL('../data/validator-upgrades/juno-v31-readiness.json', import.meta.url))
);
async function revisionInput() {
  const s = source();
  s.validators.forEach((v, i) => {
    v.consensusAddress = history.validators[i].address;
  });
  s.activeSetHistory = withParticipation(activeHistory(s));
  const evidence = upgradeEvidence(history, readiness);
  const original = await buildRuleReview({
    rule: pointsPolicy(),
    snapshot: s,
    evidence,
    activeHistory: s.activeSetHistory,
    budgetRaw: amount('2500').toString(),
    rationale: 'Keep this explanation.'
  });
  const draft = await frozenRuleProposal(original, { referenced: true });
  const paths = [];
  const options = {
    now: Date.parse(s.blockTime),
    approvals: async () => ({ current: null }),
    fetcher: async (path) => {
      paths.push(path);
      return new Response(
        JSON.stringify(
          path.includes('planner') ? s : path.includes('readiness') ? readiness : history
        )
      );
    }
  };
  return { s, draft, original, options, paths };
}
test('discussion revision recalculates 100% targets from fresh own data and preserves the authored content', async () => {
  const x = await revisionInput(),
    before = structuredClone(x.draft.values);
  const next = await recalculateRuleCap(x.draft.values, 10000, x.options);
  assert.equal(next.review.value.rule.votingPowerCapBps, 10000);
  assert.equal(next.review.value.proposed.allocatedRaw, amount('2500').toString());
  assert.notEqual(next.review.hash, x.original.hash);
  assert.equal(next.review.value.budgetRaw, x.original.value.budgetRaw);
  assert.equal(next.review.value.rationale, x.original.value.rationale);
  assert.equal(next.values.title, before.title);
  assert.equal(next.values.summary, before.summary);
  assert.equal(next.values.actions_json, '[]');
  assert.deepEqual(x.draft.values, before);
  assert.equal((await readProposalReview(next.values)).hash, next.review.hash);
  assert.match(next.changeNote, /100%.*recalculate/);
  assert.ok(x.paths.every((path) => path.startsWith('/data/')));
});
test('revision preparation rejects stale or future data, changed approvals and unavailable calculation without modifying the original', async () => {
  for (const change of [
    (x) => {
      x.options.now += 3600001;
    },
    (x) => {
      x.options.now -= 300001;
    },
    (x) => {
      x.s.height--;
    },
    (x) => {
      x.options.approvals = async () => ({ current: { proposalId: '1', hash: 'a'.repeat(64) } });
    },
    (x) => {
      delete x.s.activeSetHistory;
    },
    (x) => {
      delete x.s.governanceHistory;
    },
    (x) => {
      x.options.fetcher = async () => new Response('{}', { status: 503 });
    }
  ]) {
    const x = await revisionInput(),
      before = structuredClone(x.draft.values);
    change(x);
    await assert.rejects(recalculateRuleCap(x.draft.values, 10000, x.options));
    assert.deepEqual(x.draft.values, before);
  }
});
