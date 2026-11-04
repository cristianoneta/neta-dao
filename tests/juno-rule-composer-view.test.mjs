import test from 'node:test';
import assert from 'node:assert/strict';
import { criterionSummary } from '../juno-rule-composer-view.mjs';
import { delegationEntry } from '../juno-delegation-entry.mjs';

test('criterion summaries distinguish admission thresholds from bonus curves and unused criteria', () => {
  assert.equal(
    criterionSummary('uptime', { role: 'eligibility', minimumBps: 9500 }),
    'Eligibility · at least 95%'
  );
  const bonus = criterionSummary('uptime', {
    role: 'bonus',
    weight: 40,
    zeroBps: 9500,
    fullBps: 9950
  });
  assert.match(bonus, /Bonus · weight 40/);
  assert.match(bonus, /0 points at 95%, full points at 99.5%/);
  assert.doesNotMatch(bonus, /Eligibility/);
  assert.equal(criterionSummary('uptime', { role: 'unused' }), 'Unused');
  assert.match(
    criterionSummary('commission', { role: 'bonus', weight: 10, zeroBps: 1000, fullBps: 0 }),
    /0 points at 10%, full points at 0%/
  );
});

test('the programme landing goes directly to the real rule editor and preserves deep links', () => {
  assert.equal(
    delegationEntry(new URL('https://cosmoot.com/community-tools/delegation/')),
    'https://cosmoot.com/community-tools/juno/delegation/#rules'
  );
  assert.equal(
    delegationEntry(
      new URL('https://cosmoot.com/community-tools/delegation/?source=home#rebalance')
    ),
    'https://cosmoot.com/community-tools/juno/delegation/?source=home#rebalance'
  );
});
