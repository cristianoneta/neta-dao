import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fixture, observed } from './fixtures/delegation-planner.mjs';
import { defaultPolicy, fingerprint } from '../juno-delegation-core.mjs';
import { createComposerPolicy, criterionConfig } from '../juno-criteria-policy.mjs';
import {
  checkCurrentAllocation,
  checkMovementState,
  movementPlan,
  assertStaking
} from '../juno-programme-staking.mjs';
import { rebalanceRuleFacts, rebalanceEvidenceReady } from '../juno-rebalance-view.mjs';
import { buildRuleReview } from '../juno-delegation-review.mjs';
import { frozenRuleProposal } from '../planner-proposal-draft.mjs';
import { approvedRule } from '../juno-approved-rules.mjs';
import { buildRebalanceReview } from '../juno-rebalance.mjs';
import { stakingState } from '../juno-rebalance-chain.mjs';
import {
  executionReview,
  executionValues,
  readExecutionReview
} from '../juno-rebalance-execution.mjs';

function scenario() {
  const snapshot = fixture(3),
    rule = createComposerPolicy(defaultPolicy());
  rule.votingPowerCapBps = 10000;
  for (const id of Object.keys(rule.criteria)) rule.criteria[id] = { role: 'unused' };
  rule.criteria.commission = criterionConfig('commission', 'bonus');
  snapshot.activeCount = 2;
  snapshot.validators[2].active = false;
  snapshot.validators[2].commissionBps = 2000;
  const plan = movementPlan(
    snapshot.validators.map((v, i) => ({
      address: v.address,
      currentRaw: v.currentRaw,
      targetRaw: i === 2 ? '200000000' : '150000000'
    }))
  );
  const state = {
    activeCount: snapshot.activeCount,
    blockTime: snapshot.blockTime,
    liquidRaw: snapshot.liquidRaw,
    maxEntries: 7,
    positions: plan.positions,
    validators: snapshot.validators.map((v) => ({
      ...v,
      exchangeRateValid: true,
      commissionAtoms: String(BigInt(v.commissionBps) * 100000000000000n),
      bondStatus: v.active ? 'BOND_STATUS_BONDED' : 'BOND_STATUS_UNBONDED'
    })),
    redelegations: [],
    unbondings: []
  };
  return { rule, snapshot, calculation: { rule, snapshot }, plan, state };
}

test('bonus commission and unused active history do not become live execution gates', () => {
  const { calculation, plan, state } = scenario();
  assert.doesNotThrow(() => checkCurrentAllocation(calculation, plan, state));
  assert.deepEqual(checkMovementState(plan, state), []);
  calculation.rule.criteria.commission = { role: 'unused' };
  assert.doesNotThrow(() => checkCurrentAllocation(calculation, plan, state));
});

test('live commission eligibility retains exact atom comparison at the approved boundary', () => {
  const { calculation, plan, state } = scenario();
  calculation.rule.criteria.commission = criterionConfig('commission', 'eligibility');
  assert.throws(() => checkCurrentAllocation(calculation, plan, state), /commission limit/);
  state.validators[2].commissionAtoms = '100000000000000000';
  assert.doesNotThrow(() => checkCurrentAllocation(calculation, plan, state));
  state.validators[2].commissionAtoms = '100000000000000001';
  assert.throws(() => checkCurrentAllocation(calculation, plan, state), /commission limit/);
});

test('active history eligibility and consensus identity integrity remain separate checks', () => {
  const { calculation, plan, state } = scenario();
  calculation.rule.criteria.activeHistory = criterionConfig('activeHistory', 'eligibility');
  assert.throws(() => checkCurrentAllocation(calculation, plan, state), /consensus set/);
  calculation.rule.criteria.activeHistory = { role: 'unused' };
  state.validators[2].consensusAddress = 'F'.repeat(40);
  assert.throws(() => checkCurrentAllocation(calculation, plan, state), /consensus identity/);
  state.validators[2].consensusAddress = calculation.snapshot.validators[2].consensusAddress;
  assert.doesNotThrow(() => checkCurrentAllocation(calculation, plan, state));
});

test('regular targets still reject jail, invalid exchange rates and voting-power cap breaches', () => {
  const { calculation, plan, state } = scenario();
  state.validators[2].jailed = true;
  assert.throws(() => checkCurrentAllocation(calculation, plan, state), /unavailable or jailed/);
  state.validators[2].jailed = false;
  state.validators[2].exchangeRateValid = false;
  assert.throws(() => checkCurrentAllocation(calculation, plan, state), /unavailable or jailed/);
  state.validators[2].exchangeRateValid = true;
  calculation.rule.votingPowerCapBps = 100;
  assert.throws(() => checkCurrentAllocation(calculation, plan, state), /voting-power cap/);
});

test('fixed-only targets bypass selected gates and cap but preserve technical and staking checks', () => {
  const { calculation, state } = scenario(),
    target = state.validators[2],
    date = calculation.snapshot.blockTime.slice(0, 10);
  calculation.rule.criteria.commission = criterionConfig('commission', 'eligibility');
  calculation.rule.criteria.activeHistory = criterionConfig('activeHistory', 'eligibility');
  calculation.rule.votingPowerCapBps = 1;
  calculation.rule.fixedAllocations = [
    {
      chainId: 'juno-1',
      validator: target.address,
      amountRaw: '500000000',
      purpose: 'Provide incident reports for the approved period',
      documentation: '',
      startDate: date,
      endDate: date
    }
  ];
  const plan = movementPlan(
    state.positions.map((position) => ({
      ...position,
      targetRaw: position.address === target.address ? '500000000' : '0'
    }))
  );
  target.jailed = true;
  const fixed = new Map([[target.address, 500000000n]]);
  assert.doesNotThrow(() => checkCurrentAllocation(calculation, plan, state));
  assert.deepEqual(checkMovementState(plan, state, fixed), []);
  target.exchangeRateValid = false;
  assert.throws(() => checkCurrentAllocation(calculation, plan, state), /unavailable or jailed/);
  assert.match(checkMovementState(plan, state, fixed).join(' '), /exchange rate/);
  target.exchangeRateValid = true;
  state.redelegations = [
    {
      source: target.address,
      destination: state.positions[0].address,
      entries: [{ completionTime: '2099-01-01T00:00:00Z' }]
    }
  ];
  assert.match(checkMovementState(plan, state, fixed).join(' '), /incoming redelegation/);
  state.blockTime = new Date(Date.parse(date) + 86400000).toISOString();
  assert.throws(() => checkCurrentAllocation(calculation, plan, state), /period changed/);
});

test('a fixed portion does not exempt a regular top-up from selected eligibility', () => {
  const { calculation, plan, state } = scenario(),
    date = calculation.snapshot.blockTime.slice(0, 10);
  calculation.rule.criteria.commission = criterionConfig('commission', 'eligibility');
  calculation.rule.fixedAllocations = [
    {
      chainId: 'juno-1',
      validator: state.validators[2].address,
      amountRaw: '100000000',
      purpose: 'Provide incident reports',
      documentation: '',
      startDate: date,
      endDate: date
    }
  ];
  assert.throws(() => checkCurrentAllocation(calculation, plan, state), /commission limit/);
});

test('schema-10 live guards preserve current-active and commission requirements', () => {
  const { calculation, plan, state } = scenario();
  calculation.rule = { ...defaultPolicy(), votingPowerCapBps: 10000 };
  assert.throws(() => checkCurrentAllocation(calculation, plan, state), /commission limit/);
  state.validators[2].commissionAtoms = '50000000000000000';
  assert.throws(() => checkCurrentAllocation(calculation, plan, state), /consensus set/);
  state.validators[2].active = true;
  assert.doesNotThrow(() => checkCurrentAllocation(calculation, plan, state));
});

test('live staking reads derive inactive consensus identity from its on-chain Ed25519 key', async () => {
  const { snapshot } = scenario();
  const validators = snapshot.validators.map((v, i) => ({
    operator_address: v.address,
    consensus_pubkey: {
      '@type': '/cosmos.crypto.ed25519.PubKey',
      key: Buffer.alloc(32, i + 1).toString('base64')
    },
    jailed: false,
    status: v.active ? 'BOND_STATUS_BONDED' : 'BOND_STATUS_UNBONDED',
    tokens: v.tokensRaw,
    delegator_shares: `${v.tokensRaw}.000000000000000000`,
    commission: { commission_rates: { rate: '0.050000000000000000' } }
  }));
  const identity = (key) =>
    createHash('sha256').update(Buffer.from(key, 'base64')).digest().subarray(0, 20);
  const page = (key, data) => ({ [key]: data, pagination: { next_key: null } });
  const get = async (path) => {
    if (path.endsWith('/params'))
      return { params: { bond_denom: 'ujuno', max_entries: 7, unbonding_time: '1814400s' } };
    if (path.includes('/spendable_balances/'))
      return { balance: { denom: 'ujuno', amount: snapshot.liquidRaw } };
    if (path.startsWith('/cosmos/staking/v1beta1/delegations/'))
      return page('delegation_responses', []);
    if (path.startsWith('/cosmos/staking/v1beta1/validators?'))
      return page('validators', validators);
    if (path.includes('/redelegations?')) return page('redelegation_responses', []);
    if (path.includes('/unbonding_delegations?')) return page('unbonding_responses', []);
    if (path.includes('/validatorsets/'))
      return {
        ...page(
          'validators',
          validators.slice(0, 2).map((v) => ({
            address: identity(v.consensus_pubkey.key).toString('base64'),
            pub_key: { key: v.consensus_pubkey.key }
          }))
        ),
        block_height: String(snapshot.height)
      };
    throw Error('Unexpected fixture path ' + path);
  };
  const state = await stakingState(get, String(snapshot.height));
  assert.deepEqual(
    state.validators.map((v) => v.active),
    [true, true, false]
  );
  assert.deepEqual(
    state.validators.map((v) => v.consensusAddress),
    validators.map((v) => identity(v.consensus_pubkey.key).toString('hex').toUpperCase())
  );
  for (const invalid of [
    { '@type': '/cosmos.crypto.secp256k1.PubKey', key: validators[2].consensus_pubkey.key },
    { '@type': '/cosmos.crypto.ed25519.PubKey', key: Buffer.alloc(31).toString('base64') },
    { '@type': '/cosmos.crypto.ed25519.PubKey', key: validators[2].consensus_pubkey.key + '\n' }
  ]) {
    validators[2].consensus_pubkey = invalid;
    await assert.rejects(stakingState(get, String(snapshot.height)), /consensus key/);
  }
});

test('approved rule facts show bonus curves and unused roles without legacy NaN thresholds', () => {
  const { rule, snapshot } = scenario();
  rule.criteria.uptime = criterionConfig('uptime', 'bonus');
  const facts = new Map(rebalanceRuleFacts(rule, snapshot));
  assert.match(facts.get('Commission'), /Bonus.*0 points at 10%; full points at 5%/);
  assert.match(facts.get('Observed commit participation'), /Bonus.*95%.*99.5%/);
  assert.equal(facts.get('Active-set history'), 'Not used');
  assert.equal(facts.get('Points'), '900 base + up to 100 bonus');
  assert.doesNotMatch(JSON.stringify([...facts]), /NaN|undefined/);
  assert.equal(
    new Map(rebalanceRuleFacts(defaultPolicy(), snapshot)).get('Minimum uptime'),
    '97.5%'
  );
});

test('Rebalance evidence gate follows the upgrade role and fixed-only budget', () => {
  const { rule, snapshot } = scenario();
  assert.equal(rebalanceEvidenceReady(rule, null), true);
  rule.criteria.upgrade = criterionConfig('upgrade', 'bonus');
  assert.equal(rebalanceEvidenceReady(rule, null), false);
  rule.criteria.upgrade = criterionConfig('upgrade', 'eligibility');
  assert.equal(rebalanceEvidenceReady(rule, null), false);
  assert.equal(rebalanceEvidenceReady(rule, observed(fixture())), true);
  assert.equal(rebalanceEvidenceReady(defaultPolicy(), null), false);
  const date = snapshot.blockTime.slice(0, 10);
  rule.fixedAllocations = [
    {
      chainId: 'juno-1',
      validator: snapshot.validators[0].address,
      amountRaw: '100000000',
      purpose: 'Synthetic fixed mandate',
      documentation: '',
      startDate: date,
      endDate: date
    }
  ];
  assert.equal(
    rebalanceEvidenceReady(rule, null, { budgetRaw: '100000000', blockTime: snapshot.blockTime }),
    true
  );
  assert.equal(
    rebalanceEvidenceReady(rule, null, { budgetRaw: '100000001', blockTime: snapshot.blockTime }),
    false
  );
});

test('approved composer rules reproduce allocation, frozen execution and exact staking messages', async () => {
  const { rule, snapshot } = scenario(),
    evidence = null,
    frozen = await buildRuleReview({ rule, snapshot, evidence, budgetRaw: '500000000' }),
    proposal = await frozenRuleProposal(frozen),
    approval = await approvedRule({
      id: '951',
      title: proposal.values.title,
      summary: proposal.values.body,
      status: 'PROPOSAL_STATUS_PASSED',
      voting_end_time: new Date(Date.now() - 3600000).toISOString(),
      messages: []
    });
  assert.equal(approval.hash, await fingerprint(rule));
  const rebalance = await buildRebalanceReview({
    approval,
    snapshot,
    evidence,
    budgetRaw: '500000000'
  });
  const inactive = rebalance.result.rows.find((v) => v.address === snapshot.validators[2].address);
  assert.equal(inactive.eligible, true);
  assert.ok(BigInt(inactive.targetRaw) > 0n, 'Inactive validator retains base allocation');
  const execution = await executionReview(rebalance.value.calculation),
    values = await executionValues(execution, { referenced: true }),
    restored = await readExecutionReview(values);
  assert.equal(restored.hash, execution.hash);
  assert.deepEqual(restored.value.calculation.rule, rule);
  assert.deepEqual(assertStaking(restored.messages), execution.value.plan.moves);
  const { state } = scenario();
  assert.doesNotThrow(() =>
    checkCurrentAllocation(restored.value.calculation, restored.value.plan, state)
  );
});
