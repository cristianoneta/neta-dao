import { junoConsensusHex } from '../juno-consensus-address.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, observed } from './fixtures/delegation-planner.mjs';
import { PROGRAMME, legacyPolicy, fingerprint } from '../juno-delegation-core.mjs';
import { buildRebalanceReview } from '../juno-rebalance.mjs';
import {
  executionReview,
  executionValues,
  readExecutionReview
} from '../juno-rebalance-execution.mjs';
import {
  movementPlan,
  stakingMessages,
  assertStaking,
  checkMovementState
} from '../juno-programme-staking.mjs';
import { checkRebalance, stakingState } from '../juno-rebalance-chain.mjs';
import {
  GOVERNANCE,
  PROGRAMME_CODE_HASH,
  proposalContent,
  preflight
} from '../juno-governance-core.mjs';
import { reviewKind, finalizedReview } from '../juno-community-governance.mjs';
import { readFile } from 'node:fs/promises';
import { reviewSizeInput } from './fixtures/delegation-review-size.mjs';
import { buildRuleReview, readProposalReview } from '../juno-delegation-review.mjs';
import {
  rebalanceProposal,
  savePlannerProposal,
  readPlannerProposal
} from '../planner-proposal-draft.mjs';
import { governanceReadTarget } from '../governance-chain-read.mjs';

const addresses = fixture().validators.map((v) => v.address);
const row = (i, current, target) => ({
  address: addresses[i],
  currentRaw: String(current),
  targetRaw: String(target)
});
const plan = movementPlan([row(0, 900, 100), row(1, 100, 500), row(2, 0, 600)]);
const state = () => ({
  liquidRaw: '50000200',
  maxEntries: 7,
  positions: plan.positions,
  validators: addresses.map((address) => ({
    address,
    jailed: false,
    tokensRaw: '1000000000',
    exchangeRateValid: true
  })),
  redelegations: [],
  unbondings: []
});
async function prepared() {
  const snapshot = fixture(),
    rule = legacyPolicy(),
    hash = await fingerprint(rule);
  const approval = {
    proposalId: '950',
    rule,
    hash,
    votingEndedAt: new Date(Date.now() - 3600000).toISOString()
  };
  const simulation = await buildRebalanceReview({
    approval,
    snapshot,
    evidence: observed(snapshot),
    budgetRaw: '3000000000'
  });
  return { review: await executionReview(simulation.value.calculation), snapshot, approval };
}
test('movements conserve exact micro-units, use redelegation first and keep unbonding out of liquidity', () => {
  assert.deepEqual(plan.totals, { delegate: '200', redelegate: '800', undelegate: '0' });
  assert.deepEqual(checkMovementState(plan, state()), []);
  assert.throws(() => checkMovementState(plan, { ...state(), liquidRaw: '50000199' }), /reserve/);
  const lower = movementPlan([row(0, 900, 100), row(1, 100, 500)]);
  assert.deepEqual(lower.totals, { delegate: '0', redelegate: '400', undelegate: '400' });
  assert.throws(
    () =>
      checkMovementState(lower, { ...state(), positions: lower.positions, liquidRaw: '49999999' }),
    /reserve/
  );
  const large = movementPlan([
    row(0, '999999999999999999999', '0'),
    row(1, '0', '999999999999999999999')
  ]);
  assert.equal(large.totals.redelegate, '999999999999999999999');
});
test('incoming locks, entry limits, jailed recipients, changed holdings and no-ops remain explicit', () => {
  const s = state(),
    entries = Array.from({ length: 7 }, () => ({ completionTime: '2026-11-22T00:00:00Z' }));
  s.redelegations = [{ source: addresses[4], destination: addresses[0], entries }];
  assert.match(checkMovementState(plan, s).join(' '), /incoming redelegation/);
  s.redelegations = [{ source: addresses[0], destination: addresses[1], entries }];
  assert.match(checkMovementState(plan, s).join(' '), /entry limit/);
  s.validators[1].jailed = true;
  assert.match(checkMovementState(plan, s).join(' '), /jailed/);
  assert.throws(
    () => checkMovementState(plan, { ...state(), positions: [row(0, 899, 100)] }),
    /holdings/
  );
  assert.deepEqual(movementPlan([row(0, 123, 123)]).moves, []);
  const emptyDestination = state();
  emptyDestination.validators[1].tokensRaw = '0';
  assert.deepEqual(checkMovementState(plan, emptyDestination), []);
  emptyDestination.validators[1].exchangeRateValid = false;
  assert.match(checkMovementState(plan, emptyDestination).join(' '), /exchange rate/);
  const lower = movementPlan([row(0, 900, 0)]);
  assert.match(
    checkMovementState(lower, {
      ...state(),
      positions: lower.positions,
      unbondings: [{ source: addresses[0], entries }]
    }).join(' '),
    /Unbonding entry limit/
  );
});
test('staking codec rejects injected funds, authority, denominations, extra fields, duplicate envelopes and noncanonical bytes', () => {
  const messages = stakingMessages(plan.moves);
  assert.deepEqual(assertStaking(messages), plan.moves);
  for (const mutate of [
    (m) => m.push(structuredClone(m[0])),
    (m) => (m[0].sender = PROGRAMME),
    (m) => (m[0].funds = [{ denom: 'ujuno', amount: '1' }]),
    (m) => (m[0].msg.extra = {}),
    (m) => (m[0].msg.execute_admin_msgs.msgs[0].extra = true),
    (m) => (m[0].msg.execute_admin_msgs.msgs[0].stargate.value += '\n'),
    (m) => (m[0].msg.execute_admin_msgs.msgs[0].stargate.type_url = '/cosmos.bank.v1beta1.MsgSend')
  ]) {
    const changed = structuredClone(messages);
    mutate(changed);
    assert.throws(() => assertStaking(changed));
  }
});
test('frozen execution round-trips the exact approved calculation and proposal handoff without altering old rule semantics', async () => {
  const { review } = await prepared(),
    values = await executionValues(review);
  assert.equal((await readExecutionReview(values)).hash, review.hash);
  const reordered = JSON.parse(values.actions_json).map((m) =>
    Object.fromEntries(Object.entries(m).reverse())
  );
  assert.equal(
    (await readExecutionReview({ ...values, actions_json: JSON.stringify(reordered) })).hash,
    review.hash
  );
  // gzip headers are transport metadata, not a new allocation or review hash.
  const encoded = values.body.match(/```cosmoot-rebalance\n([^\n]+)/)[1];
  const packet = Buffer.from(encoded, 'base64');
  packet[9] = packet[9] === 3 ? 255 : 3;
  assert.equal(
    (
      await readExecutionReview({
        ...values,
        body: values.body.replace(encoded, packet.toString('base64'))
      })
    ).hash,
    review.hash
  );
  assert.equal(await readProposalReview(values), null);
  assert.equal(reviewKind(values), 'ALLOCATION_EXECUTION');
  assert.deepEqual(proposalContent(reviewKind(values), values).messages, review.messages);
  const proposal = await rebalanceProposal(review),
    data = new Map(),
    storage = { setItem: (k, v) => data.set(k, v), getItem: (k) => data.get(k) ?? null };
  const url = savePlannerProposal(storage, proposal);
  const id = new URL(url, 'https://cosmoot.com').searchParams.get('plannerDraft');
  assert.equal(
    readPlannerProposal(storage, new URLSearchParams({ plannerDraft: id }), 'juno-delegation').kind,
    'ALLOCATION_EXECUTION'
  );
  const hash = await fingerprint(values);
  // Review contract hashes JSON field order, rather than canonical sorted JSON.
  const digest = Buffer.from(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(values)))
  ).toString('hex');
  const finalized = await finalizedReview(
    { id: 1, withdrawn: false, finalized_version: 1, latest_version: 1, finalized_hash: digest },
    { ...values, version: 1, proposal_id: 1 },
    'juno-1'
  );
  assert.equal(finalized.kind, 'ALLOCATION_EXECUTION');
  assert.ok(hash);
  for (const altered of [
    { ...values, summary: 'Different amount' },
    { ...values, title: 'Different title' },
    { ...values, body: values.body.replace('delegate ', 'claim ') },
    { ...values, actions_json: '[]' },
    { ...values, body: values.body + '\n## Frozen rebalance execution' }
  ])
    await assert.rejects(readProposalReview(altered));
  const changed = structuredClone(review.value.calculation);
  changed.rule.commissionMaxBps = 0;
  await assert.rejects(executionReview(changed));
});

function chainFixture(snapshot, approval, mode = '') {
  const params = {
    min_deposit: [{ denom: 'ujuno', amount: '100000000' }],
    min_initial_deposit_ratio: '0.1'
  };
  const page = (key, rows) => ({ [key]: rows, pagination: { next_key: null } });
  return async (url, options = {}) => {
    const u = new URL(url),
      p = u.pathname;
    let data;
    if (p.endsWith('/blocks/latest'))
      data = {
        block: { header: { chain_id: 'juno-1', height: '42500000', time: snapshot.blockTime } }
      };
    else if (p === '/cosmos/gov/v1/proposals')
      data = page('proposals', [
        {
          id: '950',
          status: 'PROPOSAL_STATUS_PASSED',
          title: 'Juno Delegation Programme — allocation rules',
          messages: [],
          voting_end_time: approval.votingEndedAt,
          summary: `Programme: ${PROGRAMME}\nChain: juno-1\n## Exact policy\n\n\`\`\`json\n${JSON.stringify(approval.rule)}\n\`\`\`\n\nRule SHA-256: ${mode === 'approval' ? '0'.repeat(64) : approval.hash}`
        }
      ]);
    else if (p.endsWith('/params/deposit')) data = { params };
    else if (p.endsWith('/params'))
      data = { params: { bond_denom: 'ujuno', max_entries: 7, unbonding_time: '2419200s' } };
    else if (p.includes('/spendable_balances/'))
      data = { balance: { denom: 'ujuno', amount: mode === 'funds' ? '1' : '1000000000' } };
    else if (p.endsWith('/module_accounts/gov'))
      data = { account: { base_account: { address: GOVERNANCE }, name: 'gov' } };
    else if (p.endsWith('/code/4047')) data = { code_info: { data_hash: PROGRAMME_CODE_HASH } };
    else if (p.endsWith('/contract/' + PROGRAMME)) data = { contract_info: { code_id: 4047 } };
    else if (p.includes('/smart/'))
      data = {
        data: atob(decodeURIComponent(p.split('/').at(-1))).includes('admin')
          ? mode === 'admin'
            ? PROGRAMME
            : GOVERNANCE
          : { unpaused: {} }
      };
    else if (p.endsWith('/withdraw_address')) data = { withdraw_address: PROGRAMME };
    else if (p.includes('/delegations/'))
      data = page(
        'delegation_responses',
        snapshot.validators.map((v) => ({
          delegation: {
            delegator_address: PROGRAMME,
            validator_address: v.address,
            shares: v.currentRaw + '.000000000000000000'
          },
          balance: { denom: 'ujuno', amount: mode === 'positions' ? '1' : v.currentRaw }
        }))
      );
    else if (p.includes('/validatorsets/'))
      data = page(
        'validators',
        snapshot.validators.map((v, i) => ({
          address: Buffer.from(v.consensusAddress, 'hex').toString('base64'),
          pub_key: { key: 'fixture-key-' + i }
        }))
      );
    else if (p.endsWith('/validators'))
      data = page(
        'validators',
        snapshot.validators.map((v, i) => ({
          consensus_pubkey: { key: 'fixture-key-' + i },
          commission: {
            commission_rates: {
              rate: mode === 'commission' ? '0.100000000000000001' : '0.050000000000000000'
            }
          },
          operator_address: v.address,
          jailed: false,
          tokens:
            mode === 'cap' && v.address === snapshot.validators[0].address
              ? '999999999999999'
              : v.tokensRaw,
          delegator_shares: v.tokensRaw + '.000000000000000000'
        }))
      );
    else if (p.endsWith('/redelegations')) data = page('redelegation_responses', []);
    else if (p.endsWith('/unbonding_delegations')) data = page('unbonding_responses', []);
    else throw Error('Unexpected fixture path ' + url);
    if (p.includes('/validatorsets/')) data.block_height = '42500000';
    if (mode === 'pending' && data.proposals)
      data.proposals.push({
        id: '951',
        status: 'PROPOSAL_STATUS_VOTING_PERIOD',
        messages: [{ contract: PROGRAMME }]
      });
    if (mode === 'pagination' && data.pagination) delete data.pagination;
    return new Response(JSON.stringify(data), {
      headers:
        mode === 'height'
          ? {}
          : { 'x-cosmos-block-height': options.headers?.['x-cosmos-block-height'] || '42500000' }
    });
  };
}
test('draft checks and native preflight require two fresh complete height-pinned authority and staking sources', async () => {
  const { review, snapshot, approval } = await prepared(),
    endpoints = ['https://one.example', 'https://two.example'];
  const values = await executionValues(review),
    content = proposalContent('ALLOCATION_EXECUTION', values);
  assert.equal(
    (await checkRebalance(review, { endpoints, fetcher: chainFixture(snapshot, approval) })).length,
    2
  );
  assert.equal(
    (await preflight(endpoints, content, GOVERNANCE, { fetcher: chainFixture(snapshot, approval) }))
      .sources.length,
    2
  );
  for (const mode of [
    'height',
    'funds',
    'admin',
    'positions',
    'pagination',
    'approval',
    'pending',
    'commission',
    'cap'
  ]) {
    await assert.rejects(
      checkRebalance(review, { endpoints, fetcher: chainFixture(snapshot, approval, mode) }),
      mode
    );
    await assert.rejects(
      preflight(endpoints, content, GOVERNANCE, {
        fetcher: chainFixture(snapshot, approval, mode)
      }),
      mode
    );
  }
  await assert.rejects(
    checkRebalance(review, {
      endpoints: [endpoints[0], endpoints[0]],
      fetcher: chainFixture(snapshot, approval)
    }),
    /independent/
  );
  await assert.rejects(
    stakingState(async () => ({})),
    /pagination|parameters/
  );
});
test('proxy allows only bounded programme-specific staking evidence', () => {
  assert.equal(
    junoConsensusHex('junovalcons1nqryfjwgqvu5twj5auevq57rjhgzd8h2hg24rn'),
    '980644C9C8033945BA54EF32C053C395D0269EEA'
  );
  assert.throws(() => junoConsensusHex('junovalcons1nqryfjwgqvu5twj5auevq57rjhgzd8h2hg24rq'));
  assert.ok(
    governanceReadTarget(
      'juno-stavr',
      '/cosmos/base/tendermint/v1beta1/validatorsets/42500000?pagination.limit=100',
      '42500000'
    )
  );
  assert.ok(governanceReadTarget('juno-stavr', '/cosmos/staking/v1beta1/params', '123'));
  for (const suffix of ['redelegations', 'unbonding_delegations']) {
    const path = `/cosmos/staking/v1beta1/delegators/${PROGRAMME}/${suffix}?pagination.limit=100`;
    assert.ok(governanceReadTarget('juno-polkachu', path, '123'));
    assert.throws(() => governanceReadTarget('uni7-stavr', path, '123'));
    assert.throws(() =>
      governanceReadTarget('juno-stavr', path.replace(PROGRAMME, GOVERNANCE), '123')
    );
  }
});

test('complete 37- and 55-position executions fit without losing calculation evidence; oversized portfolios remain blocked', async () => {
  for (const count of [37, 55, 100]) {
    const input = reviewSizeInput({ count: 100 });
    if (count !== 37)
      input.snapshot.validators.forEach(
        (v, i) => (v.currentRaw = i < count ? (BigInt(v.tokensRaw) / 3n).toString() : '0')
      );
    input.parent = {
      proposalId: '950',
      votingEndedAt: '2026-10-19T17:00:00Z',
      rule: input.rule,
      hash: await fingerprint(input.rule)
    };
    const review = await executionReview((await buildRuleReview(input)).value);
    if (count === 100) {
      await assert.rejects(executionValues(review), /exceeds governance limits/);
      continue;
    }
    const values = await executionValues(review),
      restored = await readExecutionReview(values);
    assert.ok(Buffer.byteLength(values.summary + '\n\n' + values.body) <= 10000);
    assert.deepEqual(restored.value, review.value);
    assert.deepEqual(restored.messages, review.messages);
    assert.equal(
      restored.value.plan.positions.filter((v) => BigInt(v.currentRaw) > 0n).length,
      count
    );
  }
});
test('original format-1 execution transport remains readable with its exact immutable hash', async () => {
  const legacy = JSON.parse(
    await readFile(new URL('./fixtures/frozen-rebalance-v1.json', import.meta.url), 'utf8')
  );
  const restored = await readExecutionReview(legacy.values);
  assert.equal(restored.hash, legacy.hash);
  await assert.rejects(readExecutionReview({ ...legacy.values, summary: 'Changed approval' }));
});
