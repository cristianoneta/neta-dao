import test from 'node:test';
import assert from 'node:assert/strict';
import { claimRewardsOverview } from '../juno-claim-rewards.mjs';
import { claimProposal } from '../planner-proposal-draft.mjs';
import { suggestedBudget } from '../juno-delegation-core.mjs';
import { fixture } from './fixtures/delegation-planner.mjs';
import { rewardsFixture } from './fixtures/claim-rewards.mjs';

test('claim overview uses separately truncated current rewards, with optional USD and observation time', () => {
  const planner = fixture(),
    source = rewardsFixture(planner),
    before = suggestedBudget(planner);
  planner.validators[0].active = false;
  planner.activeCount--;
  planner.validators[1].jailed = true;
  const result = claimRewardsOverview(source, planner);
  assert.equal(result.amountRaw, '3837025339927');
  assert.equal(result.validatorCount, 25);
  assert.equal(result.observedAt, source.generated_at);
  assert.ok(Math.abs(result.usd - 33896.32022316852) < 0.000001);
  const draft = claimProposal(planner, Date.now(), source);
  assert.match(draft.values.summary, /3837025.339927 JUNO/);
  assert.ok(draft.values.summary.includes(source.generated_at));
  assert.match(draft.values.body, /amount can change before governance execution/);
  assert.equal(suggestedBudget(planner), before);
  source.assets[0].usd_price = null;
  source.status = 'PARTIAL';
  source.price_source = 'Unavailable';
  assert.equal(claimRewardsOverview(source, planner).usd, null);
  assert.equal(claimRewardsOverview(source, planner).amountRaw, result.amountRaw);
});
test('missing, partial, stale and mismatched reward observations never become a zero estimate', () => {
  const planner = fixture();
  for (const edit of [
    (v) => delete v.staking.rewards,
    (v) => v.staking.validator_count--,
    (v) => (v.staking.withdraw_address = 'other'),
    (v) => (v.status = 'UNAVAILABLE'),
    (v) => (v.balance_height_pinned = false),
    (v) => (v.chain_id = 'uni-7'),
    (v) => (v.treasury_address = 'other'),
    (v) => (v.generated_at = new Date(Date.now() - 3600001).toISOString()),
    (v) => (v.checked_at = new Date(Date.now() + 600000).toISOString()),
    (v) => (v.assets[0].raw_amount = '0'),
    (v) => v.staking.rewards.push(v.staking.rewards[0]),
    (v) => (v.staking.rewards[0].amount = '-1')
  ]) {
    const source = rewardsFixture(planner);
    edit(source);
    assert.throws(() => claimRewardsOverview(source, planner));
    assert.match(
      claimProposal(planner, Date.now(), source).values.summary,
      /estimate is unavailable/
    );
  }
  assert.throws(() => claimRewardsOverview(null, planner));
  const zero = rewardsFixture(planner, '0');
  zero.staking.rewards = [];
  zero.assets = [];
  assert.equal(claimRewardsOverview(zero, planner).amountRaw, '0');
});
