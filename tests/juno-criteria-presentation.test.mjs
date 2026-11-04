import test from 'node:test';
import assert from 'node:assert/strict';
import { composerPolicy, simulate } from '../juno-delegation-core.mjs';
import { criterionConfig } from '../juno-criteria-policy.mjs';
import { ruleProposalSummary } from '../juno-rule-summary.mjs';
import {
  pointsText,
  governanceWindowText,
  appendPointsDetails
} from '../juno-governance-points-view.mjs';
import { selectRows, rowStatus } from '../juno-delegation-view.mjs';
import { fixture } from './fixtures/delegation-planner.mjs';

function commissionOnly() {
  const rule = composerPolicy();
  for (const key of Object.keys(rule.criteria)) rule.criteria[key] = { role: 'unused' };
  rule.criteria.commission = criterionConfig('commission', 'bonus');
  rule.votingPowerCapBps = 10000;
  return rule;
}

test('criterion summaries describe role changes and remain within the proposal field', () => {
  const old = commissionOnly(),
    next = structuredClone(old);
  next.criteria.commission = criterionConfig('commission', 'eligibility');
  const summary = ruleProposalSummary({ value: { parent: { rule: old }, rule: next } });
  assert.match(summary, /Commission: bonus → eligibility \(≤10%\)/);
  assert.match(summary, /Rules only; fund movements require a separate proposal/);
  assert.ok([...summary].length <= 300);
  next.points.base = 750;
  next.criteria.uptime = criterionConfig('uptime', 'bonus');
  next.criteria.governance = criterionConfig('governance', 'bonus');
  const combined = ruleProposalSummary({ value: { parent: { rule: old }, rule: next } });
  assert.match(combined, /900\/100 → 750\/250/);
  assert.ok([...combined].length <= 300);
});

test('real criterion scores expose the earned bonus and curve without inventing governance evidence', () => {
  const rule = commissionOnly(),
    snapshot = fixture(2);
  snapshot.validators[0].commissionBps = 750;
  const result = simulate(rule, snapshot, 300000000n, null);
  const points = result.rows[0].points;
  assert.match(pointsText(points), /950 points.*900 base \+ 50 earned bonus.*1 bonus criterion/);
  assert.doesNotMatch(governanceWindowText(result), /Points are fixed/);
  assert.match(governanceWindowText(result), /No governance evidence is used/);
  class Node {
    children = [];
    textContent = '';
    append(...nodes) {
      this.children.push(...nodes);
    }
    text() {
      return this.textContent + this.children.map((node) => node.text()).join(' ');
    }
  }
  const previous = globalThis.document;
  globalThis.document = { createElement: () => new Node() };
  try {
    const host = new Node();
    appendPointsDetails(host, points, undefined, rule);
    assert.match(host.text(), /Commission · Bonus · 7.5% observed · weight 100 · 50 points/);
    assert.match(host.text(), /0 points at 10%; full score at 5%/);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});

test('unused upgrade evidence does not put every validator in the evidence-review filter', () => {
  const rule = commissionOnly(),
    snapshot = fixture(2);
  let result = simulate(rule, snapshot, 300000000n, null);
  assert.equal(selectRows(result, { filter: 'review' }).length, 0);
  rule.criteria.commission = criterionConfig('commission', 'eligibility');
  snapshot.validators[0].commissionBps = 2000;
  result = simulate(rule, snapshot, 300000000n, null);
  assert.equal(rowStatus(result.rows[0]), 'Commission above limit');
  assert.equal(selectRows(result, { filter: 'excluded' }).length, 1);
});
