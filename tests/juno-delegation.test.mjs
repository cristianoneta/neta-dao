import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PROGRAMME,
  defaultPolicy,
  policy,
  snapshot,
  simulate,
  amount,
  units,
  capFraction,
  equalCapped,
  upgradeEvidence,
  fingerprint,
  suggestedBudget
} from '../juno-delegation-core.mjs';

import { fixture, observed } from './fixtures/delegation-planner.mjs';
const total = (values) => values.reduce((a, b) => a + BigInt(b), 0n);
test('amounts retain exact micro-JUNO precision and reject coercion', () => {
  assert.equal(amount('123.000001'), 123000001n);
  assert.equal(units(123000001n), '123.000001');
  for (const bad of ['-1', '1e6', '1.0000001', '1,000', '01', 1, 'Infinity'])
    assert.throws(() => amount(bad));
});
test('cap uses full active set, factor and hard 30% ceiling', () => {
  assert.deepEqual(capFraction(defaultPolicy(), 25), { numerator: 15n, denominator: 250n });
  assert.deepEqual(capFraction(defaultPolicy(), 3), { numerator: 3n, denominator: 10n });
  const s = fixture(),
    p = defaultPolicy();
  p.exclusions = [
    { chainId: 'juno-1', validator: s.validators[0].address, reason: 'Exchange operator' }
  ];
  assert.equal(simulate(p, s, amount('2500'), observed(s)).cap.denominator, '250');
});
test('existing programme stake is replaced, not counted twice', () => {
  const s = fixture(),
    r = simulate(defaultPolicy(), s, amount('2500'), observed(s));
  assert.equal(r.projectedBondedRaw, '27500000000');
  assert.equal(r.unallocatedRaw, '0');
  assert.ok(r.rows.every((v) => v.targetRaw === '100000000' && v.deltaRaw === '0'));
});
test('cap redistribution and deterministic remainder preserve every micro-unit', () => {
  const entries = [
    { address: 'c', capacity: 100n },
    { address: 'a', capacity: 2n },
    { address: 'b', capacity: 100n }
  ];
  assert.deepEqual([...equalCapped(9n, entries)].sort(), [
    ['a', 2n],
    ['b', 4n],
    ['c', 3n]
  ]);
  assert.deepEqual(
    [...equalCapped(9n, [...entries].reverse())].sort(),
    [...equalCapped(9n, entries)].sort()
  );
});
test('late observation and missing evidence remain explicit and ineligible', () => {
  const s = fixture(),
    e = observed(s);
  e.records.set(s.validators[0].consensusAddress, { status: 'late-observation' });
  e.records.delete(s.validators[1].consensusAddress);
  const r = simulate(defaultPolicy(), s, amount('2500'), e);
  assert.equal(r.evidenceReviewCount, 2);
  assert.equal(r.eligibleCount, 23);
  assert.equal(r.rows[0].targetRaw, '0');
  assert.match(r.rows[0].reasons.join(), /unverified/);
  assert.equal(r.rows[1].upgrade.status, 'unknown');
});
test('jailed, commission and manual exclusions prevent allocation; standby remains eligible', () => {
  const s = fixture(),
    p = defaultPolicy();
  s.validators[0].active = false;
  s.activeCount--;
  s.validators[1].jailed = true;
  s.validators[2].commissionBps = 1001;
  p.exclusions = [{ chainId: 'juno-1', validator: s.validators[3].address, reason: 'CEX' }];
  const r = simulate(p, s, amount('2500'), observed(s));
  assert.ok(r.rows.slice(1, 4).every((v) => v.targetRaw === '0'));
  assert.equal(r.rows[0].eligible, true);
  assert.ok(BigInt(r.rows[0].targetRaw) > 0n);
  assert.equal(r.eligibleCount, 22);
});
test('unallocatable funds are not included in the bonded denominator', () => {
  const s = fixture(),
    e = observed(s);
  for (const v of s.validators.slice(1)) e.records.delete(v.consensusAddress);
  const r = simulate(defaultPolicy(), s, amount('2500'), e);
  assert.ok(BigInt(r.unallocatedRaw) > 0n);
  assert.equal(BigInt(r.projectedBondedRaw), 25000000000n + BigInt(r.allocatedRaw));
  const target = r.rows[0];
  assert.ok(
    BigInt(target.projectedRaw) * BigInt(r.cap.denominator) <=
      BigInt(r.projectedBondedRaw) * BigInt(r.cap.numerator)
  );
});
test('zero eligible validators leaves the complete programme unallocated', () => {
  const s = fixture(),
    e = { window: { coverageComplete: true }, records: new Map() };
  const r = simulate(defaultPolicy(), s, amount('2500'), e);
  assert.equal(r.allocatedRaw, '0');
  assert.equal(r.unallocatedRaw, '2500000000');
  assert.equal(r.projectedBondedRaw, '25000000000');
});
test('reduced programme amount records released funds separately', () => {
  const s = fixture(),
    r = simulate(defaultPolicy(), s, amount('1000'), observed(s));
  assert.equal(r.releasedRaw, '1500000000');
  assert.equal(r.projectedBondedRaw, '26000000000');
});
test('invalid identities, duplicate validators, overdraw and incomplete archive fail closed', () => {
  const s = fixture();
  assert.throws(() => simulate(defaultPolicy(), s, amount('3501'), observed(s)));
  assert.throws(() => simulate(defaultPolicy(), s, 0n, observed(s)));
  assert.throws(() =>
    simulate(defaultPolicy(), s, 1n, { window: { coverageComplete: false }, records: new Map() })
  );
  for (const change of [
    (x) => (x.chainId = 'uni-7'),
    (x) => (x.programme = 'juno1other'),
    (x) => x.activeCount++,
    (x) => x.validators.push(x.validators[0]),
    (x) => (x.validators[0].currentRaw = '999999999999'),
    (x) => (x.validators[0].tokensRaw = '-1')
  ]) {
    const x = structuredClone(s);
    change(x);
    assert.throws(() => snapshot(x));
  }
});
test('rule identities include reasons and exclude mutable display data', async () => {
  const p = defaultPolicy(),
    s = fixture();
  p.exclusions = [{ chainId: 'juno-1', validator: s.validators[0].address, reason: 'CEX' }];
  const original = await fingerprint(policy(p));
  assert.equal(await fingerprint(policy({ ...p, displayName: 'ignored' })), original);
  p.exclusions[0].reason = 'Updated reason';
  assert.notEqual(await fingerprint(policy(p)), original);
  p.exclusions.push(p.exclusions[0]);
  assert.throws(() => policy(p));
  assert.throws(() => policy({ ...defaultPolicy(), method: 'weighted' }));
});
test('real archived evidence uses earliest recorded vote, inclusive five-hour boundary', () => {
  const history = JSON.parse(
      readFileSync(new URL('../data/validator-upgrades/juno-v31.json', import.meta.url))
    ),
    readiness = JSON.parse(
      readFileSync(new URL('../data/validator-upgrades/juno-v31-readiness.json', import.meta.url))
    );
  const e = upgradeEvidence(history, readiness);
  assert.equal(e.window.coverageComplete, true);
  assert.equal(e.records.size, 25);
  assert.ok([...e.records.values()].some((v) => v.evidence === 'consensus'));
  assert.ok([...e.records.values()].some((v) => v.status === 'unknown'));
  assert.ok([...e.records.values()].filter((v) => v.status === 'observed').length >= 22);
});
test('seeded scenarios conserve the budget and respect every recipient cap', () => {
  let seed = 41;
  const rand = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  for (let trial = 0; trial < 100; trial++) {
    const s = fixture(5 + rand(26)),
      p = defaultPolicy();
    p.factorTenths = 10 + rand(11);
    for (const v of s.validators) {
      v.tokensRaw = String(100000000 + rand(1500000000));
      v.currentRaw = String(rand(100000000));
      if (rand(7) === 0) v.commissionBps = 1100;
    }
    const budget = total(s.validators.map((v) => v.currentRaw)) + BigInt(rand(950000000)),
      r = simulate(p, s, budget, observed(s));
    assert.equal(total(r.rows.map((v) => v.targetRaw)) + BigInt(r.unallocatedRaw), budget);
    assert.equal(total(r.rows.map((v) => v.targetRaw)), BigInt(r.allocatedRaw));
    for (const v of r.rows) {
      assert.ok(BigInt(v.targetRaw) >= 0n);
      if (BigInt(v.targetRaw) > 0n)
        assert.ok(
          BigInt(v.projectedRaw) * BigInt(r.cap.denominator) <=
            BigInt(r.projectedBondedRaw) * BigInt(r.cap.numerator)
        );
      if (!v.eligible) assert.equal(v.targetRaw, '0');
    }
    assert.equal(r.executionEnabled, false);
  }
});

test('contract operator addresses remain visible in current positions', () => {
  const s = fixture();
  s.validators[0].address =
    'junovaloper185hgkqs8q8ysnc8cvkgd8j2knnq2m0ah6ae73gntv9ampgwpmrxqlfzywn';
  assert.equal(snapshot(s).validators[0].address, s.validators[0].address);
});
test('the halt anchor and unknown-evidence handling are part of the proposed rule', () => {
  const p = defaultPolicy();
  p.upgrade.haltTime = '2026-10-07T07:53:29Z';
  assert.throws(() => policy(p));
  const q = defaultPolicy();
  q.upgrade.unknownHandling = 'eligible';
  assert.throws(() => policy(q));
});

test('default includes spendable balance, reserves fifty and rounds down to hundreds', () => {
  const s = fixture(1);
  s.validators[0].currentRaw = '1000000000';
  s.liquidRaw = '249000000';
  assert.equal(suggestedBudget(s), amount('1100'));
  for (const [available, expected] of [
    ['50', '1000'],
    ['49.999999', '900'],
    ['150', '1100'],
    ['0', '900']
  ]) {
    s.liquidRaw = amount(available).toString();
    assert.equal(suggestedBudget(s), amount(expected));
  }
  s.validators[0].currentRaw = '0';
  assert.equal(suggestedBudget(s), 0n);
  s.liquidRaw = amount('49').toString();
  assert.equal(suggestedBudget(s), 0n);
  assert.throws(
    () => simulate(defaultPolicy(), fixture(), amount('3450.000001'), observed(fixture())),
    /50 JUNO/
  );
  assert.throws(() => policy({ ...defaultPolicy(), schema: 1, activeOnly: true }));
});

test('standby membership is projected and never counted as bonded when outside the set', () => {
  const s = fixture(26);
  s.activeCount = 25;
  s.validators[25].active = false;
  s.validators[25].currentRaw = '0';
  s.validators[25].tokensRaw = '1';
  const r = simulate(defaultPolicy(), s, amount('3000'), observed(s));
  assert.equal(r.rows[25].eligible, true);
  assert.ok(BigInt(r.rows[25].targetRaw) > 0n);
  assert.equal(r.rows[25].projectedActive, false);
  assert.equal(
    total(r.rows.filter((v) => v.projectedActive).map((v) => v.projectedRaw)),
    BigInt(r.projectedBondedRaw)
  );
  for (const v of r.rows.filter((v) => BigInt(v.targetRaw) > 0n))
    assert.ok(
      BigInt(v.projectedRaw) * BigInt(r.cap.denominator) <=
        BigInt(r.projectedBondedRaw) * BigInt(r.cap.numerator)
    );
  s.validators[25].tokensRaw = '1000000001';
  const joined = simulate(defaultPolicy(), s, amount('3000'), observed(s));
  assert.equal(joined.rows[25].projectedActive, true);
  const e = observed(s);
  e.records.delete(s.validators[25].consensusAddress);
  assert.equal(simulate(defaultPolicy(), s, amount('3000'), e).rows[25].eligible, false);
});
