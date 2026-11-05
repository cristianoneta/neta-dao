import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as core from '../juno-delegation-core.mjs';
import {
  CRITERIA,
  criterionConfig,
  criteriaEvidenceNeeds,
  criteriaRequiresActive
} from '../juno-criteria-policy.mjs';
import { criterionContribution } from '../juno-criteria-points.mjs';
import {
  fixture,
  observed,
  withGovernance,
  activeHistory,
  withParticipation
} from './fixtures/delegation-planner.mjs';

function input() {
  const s = fixture();
  s.blockTime = s.collectedAt = '2026-11-04T00:00:00.000Z';
  withGovernance(s);
  return { p: core.composerPolicy(), s, h: withParticipation(activeHistory(s)), e: observed(s) };
}
const run = ({ p, s, h, e }, budget = core.amount('2500')) => core.simulate(p, s, budget, e, h);
const unused = (p) => {
  for (const { id } of CRITERIA) p.criteria[id] = { role: 'unused' };
};
const points = (row) => Number(row.points.total.numerator) / Number(row.points.total.denominator);
const sum = (values) => values.reduce((a, b) => a + BigInt(b), 0n);

test('exclusive criterion roles and strict settings reject dual-role or unavailable activation', () => {
  const p = core.composerPolicy();
  assert.equal(p.schema, 11);
  assert.equal(core.defaultPolicy().schema, 10);
  assert.deepEqual(core.policy(p), p);
  assert.deepEqual(core.editablePolicy(p), p);
  for (const mutate of [
    (p) => (p.criteria.uptime.alsoRequire = true),
    (p) => (p.criteria.uptime.bonus = { weight: 100 }),
    (p) => (p.criteria.uptime = { ...criterionConfig('uptime', 'bonus'), minimumBps: 9500 }),
    (p) => (p.minParticipationBps = 9750),
    (p) => (p.points.weights = { governance: 100 }),
    (p) => (p.criteria.rpc = { role: 'bonus', weight: 0 }),
    (p) => (p.criteria.activeHistory = { role: 'bonus', weight: 100 }),
    (p) => (p.criteria.activeHistory.windowDays = 45),
    (p) => (p.criteria.governance.fullBps = 0),
    (p) => (p.criteria.commission.maximumBps = '1000'),
    (p) => (p.criteria.governance.weight = 0.5),
    (p) => (p.upgrade.hiddenGate = true),
    (p) => delete p.criteria.archive
  ]) {
    const bad = structuredClone(p);
    mutate(bad);
    assert.throws(() => core.policy(bad));
  }
  assert.deepEqual(criteriaEvidenceNeeds(p), {
    activeHistory: true,
    uptime: true,
    governance: true,
    upgrade: true
  });
  assert.equal(criteriaRequiresActive(p), true);
});

test('moving uptime from eligibility to bonus removes its gate at and below 95%', () => {
  const x = input(),
    a = x.h.participation.validators[0];
  Object.assign(a, { signed: 3008000, absent: 192000, nil: 0 }); // 94%
  assert.equal(run(x).rows[0].eligible, false);
  x.p.criteria.uptime = criterionConfig('uptime', 'bonus');
  x.p.criteria.governance = { role: 'unused' };
  let row = run(x).rows[0];
  assert.equal(row.eligible, true);
  assert.equal(points(row), 900);
  assert.deepEqual(row.reasons, []);
  Object.assign(a, { signed: 3040000, absent: 160000 }); // exact 95% -> zero
  assert.equal(points(run(x).rows[0]), 900);
  Object.assign(a, { signed: 3112000, absent: 88000 }); // 97.25% -> half
  row = run(x).rows[0];
  assert.equal(points(row), 950);
  assert.deepEqual(row.points.criteria.uptime.earned, { numerator: '50', denominator: '1' });
  Object.assign(a, { signed: 3184000, absent: 16000 }); // 99.5% -> full
  assert.equal(points(run(x).rows[0]), 1000);
  x.p.criteria.uptime.zeroBps = 9000;
  x.p.criteria.uptime.fullBps = 10000;
  assert.equal(points(run(x).rows[0]), 995);
});

test('curves use exact observed ratios, invert commission, and never exceed their bonus', () => {
  const c = criterionConfig('uptime', 'bonus');
  assert.deepEqual(criterionContribution(c, { numerator: '9500001', denominator: '10000000' }), {
    numerator: '1',
    denominator: '450000'
  });
  const commission = criterionConfig('commission', 'bonus');
  for (const [bps, expected] of [
    [0, 1],
    [500, 1],
    [750, 0.5],
    [1000, 0],
    [10000, 0]
  ]) {
    const q = criterionContribution(commission, { numerator: String(bps), denominator: '10000' });
    assert.equal(Number(q.numerator) / Number(q.denominator), expected);
  }
  const x = input();
  x.p.criteria.commission = commission;
  x.p.criteria.governance = { role: 'unused' };
  x.s.validators[0].commissionBps = 9000;
  const r = run(x);
  assert.equal(r.rows[0].eligible, true);
  assert.equal(points(r.rows[0]), 900);
  assert.equal(points(r.rows[1]), 1000);
});

test('zero governance opportunities retain their weight and equal base; roles remain exclusive', () => {
  const x = input();
  x.p.points.base = 800;
  x.p.criteria.upgrade = { role: 'bonus', weight: 25 };
  x.p.criteria.governance.weight = 75;
  const row = run(x).rows[0];
  assert.equal(row.points.governance.status, 'collecting');
  assert.equal(row.points.criteria.governance.status, 'collecting');
  assert.equal(row.points.criteria.governance.weight, 75);
  assert.equal(points(row), 850);
  assert.deepEqual(row.points.criteria.upgrade.earned, { numerator: '50', denominator: '1' });
  x.p.criteria.governance = { role: 'eligibility', minimumBps: 0 };
  assert.equal(run(x).rows[0].eligible, false);
  assert.match(run(x).rows[0].reasons.join(), /No observed governance opportunities/);
  assert.equal(run(x).rows[0].points.criteria.governance.weight, undefined);
});

test('own captured votes supply the exact governance threshold and chosen bonus curve', () => {
  const x = input();
  const anchor = (days) => ({
    height: x.s.height - days * 100,
    time: new Date(Date.parse(x.s.blockTime) - days * 86400000).toISOString()
  });
  x.s.governanceHistory.proposals = Array.from({ length: 10 }, (_, i) => ({
    id: String(i + 1),
    start: anchor(i + 3),
    end: { ...anchor(i + 2), result: 'proposal_passed' },
    votes: x.s.validators
      .filter((_, j) => j !== 0 || i < 8)
      .map((v, j) => ({
        voter: v.address,
        height: anchor(i + 2).height,
        scope: `tx:${j}`,
        index: 0,
        option: 'VOTE_OPTION_ABSTAIN:1'
      }))
  }));
  assert.equal(points(run(x).rows[0]), 980);
  x.p.criteria.governance = { role: 'eligibility', minimumBps: 8000 };
  assert.equal(run(x).rows[0].eligible, true);
  assert.equal(points(run(x).rows[0]), 900);
  x.p.criteria.governance.minimumBps++;
  assert.equal(run(x).rows[0].eligible, false);
  x.p.criteria.governance = { role: 'bonus', weight: 20, zeroBps: 9000, fullBps: 10000 };
  x.p.criteria.upgrade = { role: 'bonus', weight: 10 };
  const a = run(x).rows[0];
  assert.equal(a.eligible, true);
  assert.deepEqual(a.points.criteria.governance.contribution, { numerator: '0', denominator: '1' });
  assert.deepEqual(a.points.total, { numerator: '2800', denominator: '3' });
  assert.equal(a.points.governance.voted, 8);
  assert.equal(a.points.governance.applicable, 10);
});

test('upgrade is binary bonus or gate; inactive validators are allowed when active-history is unused', () => {
  const x = input();
  x.e.records.delete(x.s.validators[0].consensusAddress);
  assert.equal(run(x).rows[0].eligible, false);
  x.p.criteria.upgrade = criterionConfig('upgrade', 'bonus');
  x.p.criteria.governance = { role: 'unused' };
  assert.equal(run(x).rows[0].eligible, true);
  assert.equal(points(run(x).rows[0]), 900);
  unused(x.p);
  x.s.validators[0].active = false;
  x.s.activeCount--;
  x.e = x.h = null;
  const r = run(x);
  assert.equal(r.rows[0].eligible, true);
  assert.ok(BigInt(r.rows[0].targetRaw) > 0n);
  assert.equal(criteriaRequiresActive(x.p), false);
  assert.equal(r.evidenceReviewCount, 0);
  assert.deepEqual(r.criteriaEvidence, {
    activeHistory: null,
    uptime: null,
    governance: null,
    upgrade: null
  });
});

test('missing or corrupt selected evidence blocks, while unused evidence has no effect', () => {
  for (const mutate of [
    (x) => (x.h = null),
    (x) => delete x.h.participation,
    (x) => x.h.participation.validators[0].signed--,
    (x) => x.h.participation.validators.pop(),
    (x) => delete x.s.governanceHistory,
    (x) => x.s.governanceHistory.coverage.end.height--,
    (x) => x.s.governanceHistory.validators.shift(),
    (x) => (x.e.window.coverageComplete = false),
    (x) => (x.e.records.get(x.s.validators[0].consensusAddress).status = 'fabricated')
  ]) {
    const x = input();
    mutate(x);
    assert.throws(() => run(x));
  }
  const x = input();
  unused(x.p);
  x.s.governanceHistory = x.h = x.e = { corrupt: true };
  assert.equal(run(x).allocatedRaw, core.amount('2500').toString());
  x.p.criteria.governance = criterionConfig('governance', 'bonus');
  x.p.criteria.governance.weight = 0;
  x.p.points.base = 1000;
  assert.throws(() => run(x), /governance observations/);
});

test('fixed mandates reserve first and bypass regular gates, cap, scoring and selected-evidence requirements', () => {
  const x = input(),
    budget = core.amount('2500');
  x.p.fixedAllocations = [
    {
      chainId: 'juno-1',
      validator: x.s.validators[0].address,
      amountRaw: budget.toString(),
      purpose: 'Special duty',
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      documentation: ''
    }
  ];
  x.p.votingPowerCapBps = 1;
  x.p.exclusions = [
    { chainId: 'juno-1', validator: x.s.validators[0].address, reason: 'Regular exclusion' }
  ];
  x.s.validators[0].jailed = true;
  x.s.validators[0].commissionBps = 10000;
  delete x.s.governanceHistory;
  x.h = x.e = null;
  const r = run(x);
  assert.equal(r.fixedRaw, budget.toString());
  assert.equal(r.regularBudgetRaw, '0');
  assert.equal(r.rows[0].fixedRaw, budget.toString());
  assert.equal(r.rows[0].regularRaw, '0');
  assert.equal(r.rows[0].eligible, false);
  assert.equal(sum(r.rows.map((v) => v.targetRaw)), budget);
  x.p.fixedAllocations[0].amountRaw = (budget + 1n).toString();
  assert.throws(() => run(x), /exceed the budget/);
});

test('a fixed-only recipient remains visible and reserved before allocation of the regular remainder', () => {
  const x = input();
  x.p.votingPowerCapBps = 10000;
  x.p.fixedAllocations = [
    {
      chainId: 'juno-1',
      validator: x.s.validators[0].address,
      amountRaw: core.amount('500').toString(),
      purpose: 'Special duty',
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      documentation: ''
    }
  ];
  x.s.validators[0].commissionBps = 10000;
  x.p.exclusions = [
    {
      chainId: 'juno-1',
      validator: x.s.validators[0].address,
      reason: 'Excluded from regular allocation'
    }
  ];
  const r = run(x);
  assert.equal(r.regularBudgetRaw, core.amount('2000').toString());
  assert.equal(r.rows[0].targetRaw, core.amount('500').toString());
  assert.equal(r.rows[0].eligible, false);
  assert.equal(r.rows[0].regularRaw, '0');
  assert.equal(sum(r.rows.map((v) => v.regularRaw)), core.amount('2000'));
  assert.equal(sum(r.rows.map((v) => v.targetRaw)), core.amount('2500'));
});

test('base changes, empty weights and exact micro-JUNO allocation remain deterministic', () => {
  const x = input();
  x.p.votingPowerCapBps = 10000;
  x.p.criteria.governance = { role: 'unused' };
  x.p.criteria.uptime = criterionConfig('uptime', 'bonus');
  Object.assign(x.h.participation.validators[0], { signed: 3112000, absent: 88000 });
  const budget = core.amount('2500.000013');
  for (const base of [0, 100, 750, 900, 1000]) {
    x.p.points.base = base;
    const r = run(x, budget),
      reverse = run({ ...x, s: { ...x.s, validators: [...x.s.validators].reverse() } }, budget);
    assert.equal(sum(r.rows.map((v) => v.targetRaw)), budget);
    assert.deepEqual(
      r.rows.map((v) => [v.address, v.targetRaw]).sort(),
      reverse.rows.map((v) => [v.address, v.targetRaw]).sort()
    );
    assert.ok(r.rows.every((v) => points(v) >= base && points(v) <= 1000));
    assert.equal(points(r.rows[0]), base + (1000 - base) / 2);
  }
  unused(x.p);
  x.p.points.base = 0;
  assert.equal(run(x).allocatedRaw, '0');
  x.p.points.base = 750;
  assert.equal(run(x).allocatedRaw, core.amount('2500').toString());
  assert.ok(run(x).rows.every((v) => points(v) === 750));
});

test('explicit draft conversion preserves originals, thresholds and direct caps; old relative caps cannot silently round', async () => {
  const original = core.defaultPolicy();
  original.votingPowerCapBps = 10000;
  original.minParticipationBps = 9901;
  const hash = await core.fingerprint(original),
    next = core.editableComposerPolicy(original);
  assert.equal(next.votingPowerCapBps, 10000);
  assert.equal(next.criteria.uptime.minimumBps, 9901);
  assert.equal(next.points.base, original.points.base);
  assert.equal(await core.fingerprint(original), hash);
  assert.equal(await core.fingerprint(core.policy(original)), hash);
  assert.equal(core.withVotingPowerCap(next, 1).schema, 11);
  assert.equal(core.restoreVotingPowerCap(next, original).schema, 11);
  assert.throws(() => core.editableComposerPolicy(core.pointsPolicy()), /consensus-set size/);
  assert.throws(
    () => core.editableComposerPolicy(core.pointsPolicy(), 29),
    /not an exact percentage/
  );
  assert.equal(core.editableComposerPolicy(core.pointsPolicy(), 25).votingPowerCapBps, 600);
});

test('real packaged observation archive drives schema-11 scoring and fails closed when selected history is altered', async () => {
  const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url)));
  const s = await read('../data/daos/juno-delegation-planner.json');
  const e = core.upgradeEvidence(
    await read('../data/validator-upgrades/juno-v31.json'),
    await read('../data/validator-upgrades/juno-v31-readiness.json')
  );
  const p = core.composerPolicy();
  p.criteria.governance = { role: 'unused' }; // The packaged 24 October sample predates governance collection.
  p.criteria.uptime = criterionConfig('uptime', 'bonus');
  const r = core.simulate(p, s, core.suggestedBudget(s), e, s.activeSetHistory);
  assert.equal(r.rows.length, s.validators.length);
  assert.ok(r.eligibleCount > 0);
  for (const row of r.rows.filter((v) => v.eligible)) {
    assert.deepEqual(
      row.points.criteria.uptime.contribution,
      criterionContribution(p.criteria.uptime, {
        numerator: String(row.participation.signed),
        denominator: String(row.participation.expected)
      })
    );
    assert.ok(BigInt(row.targetRaw) <= BigInt(row.capacityRaw));
  }
  assert.equal(sum(r.rows.map((v) => v.targetRaw)), BigInt(r.allocatedRaw));
  const corrupted = structuredClone(s.activeSetHistory);
  corrupted.participation.validators[0].signed--;
  assert.throws(
    () => core.simulate(p, s, core.suggestedBudget(s), e, corrupted),
    /commit-signature/i
  );
});

// Golden hashes captured from unchanged 07c1e8852453b5f51adba9cc2953bd7450a9c9a9.
// These bind complete policy bytes and complete calculation output for every
// previously supported schema, rather than comparing two calls to the new code.
const historical = [
  [
    'legacyPolicy',
    '251885e44a9299d2e109f1bd7772d0af1dc50c962b330721d43c696348f56f4d',
    '4e8abab144296b49b41d24cb33ebe78ce45118fb5788a39774a6b551ddb3b3bb'
  ],
  [
    'strictHistoryPolicy',
    '44c1f06c0da5658ec63a405dd22355935281e24599115a3b7d030c7458c80dd3',
    '796eaba80a2c8a3e7167677bbef161608f8d9c332bf859f8e7c7c298df6e79ee'
  ],
  [
    'collectingPolicy',
    '17206d81a90e8c740ba8f4a1af6d16a7be9d2cd6a548a82368dd920f0d6bf75a',
    'ab219d0efb766e95afafc71809dd2ee09cdfb7425ae28d1882b4b22efb310707'
  ],
  [
    'observedCommitPolicy',
    'e217172921c0cb2fcee37c5c6ca152b2012c562d0e60f06858aae2639b74afa4',
    'fa1367e3c6454f141e76810e9ad5f735ded50a93aabe6611762ec60ade222423'
  ],
  [
    'configurableParticipationPolicy',
    '6064ab1ddd9725195155134a0e9694c7960b6a03b39e1028ec05f8a4acd1767a',
    'e8a104179450044cb0c94af03b7c05c18ce9abb22ebc590f28cdf368577f54ec'
  ],
  [
    'fixedAllocationPolicy',
    'e20c8366d289c20be4e33cb38e3919e47dbcea3cc3752b92acc3f54f0813383d',
    '3bb1506bb8db0e5db47a794be6f52f981635c4cefdc23310d9ded6cd7237be5c'
  ],
  [
    'extendedCapPolicy',
    '57a823df76c9bf0e94657db0768d0a73be80dff022653f77ad9b55f7edd133ae',
    '4995b1c1d2f4355ea12e2cfc61d57c57eefd2268b3c0cf619b806162d86ee060'
  ],
  [
    'pointsPolicy',
    '5b6b6ebdddd54ec0ccd4ec97085b60ba4d7b18b74b16d029d6ca3e8ce174158b',
    'ac71b956c7f9922968d7a1cca91b239d8b25f5e21ee3bd36350ed437a2fc6c5c'
  ],
  [
    'defaultPolicy',
    'c20fb3c08ef84895b6d99bc539a46f69970cbbd09e8d580df5399e7457c92a73',
    'e3793aac0d0258bc425caf8bd14e513b8a8aaa3dd66083b9de0171c01ea0f5c4'
  ]
];
test('schemas 2–10 retain their exact policy and calculation hashes', async () => {
  const x = input();
  for (const [name, policyHash, calculationHash] of historical) {
    const p = core[name]();
    assert.equal(await core.fingerprint(core.policy(p)), policyHash, `${name} policy`);
    assert.equal(await core.fingerprint(run({ ...x, p })), calculationHash, `${name} calculation`);
  }
});
