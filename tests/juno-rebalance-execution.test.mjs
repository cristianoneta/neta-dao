import { junoConsensusHex } from '../juno-consensus-address.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fixture,
  observed,
  activeHistory,
  withParticipation,
  withGovernance
} from './fixtures/delegation-planner.mjs';
import { PROGRAMME, legacyPolicy, defaultPolicy, fingerprint } from '../juno-delegation-core.mjs';
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
  frozenRuleProposal,
  savePlannerProposal,
  readPlannerProposal
} from '../planner-proposal-draft.mjs';
import { governanceReadTarget } from '../governance-chain-read.mjs';
import { readExecutionContent, readExecutionSources } from '../juno-execution-reference-read.mjs';
import { parseExecutionReference } from '../juno-execution-reference.mjs';
import { validateProposalContent } from '../src/governance/proposal-content.mjs';
import { fundingProof } from '../juno-community-governance.mjs';
import { reviewNetwork } from '../juno-review-network.mjs';
import { encodeZ85, decodeZ85 } from '../juno-review-z85.mjs';

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
async function prepared(fixed = false) {
  const snapshot = fixture(),
    rule = fixed ? defaultPolicy() : legacyPolicy();
  if (fixed) {
    snapshot.activeSetHistory = withParticipation(activeHistory(snapshot, 5));
    withGovernance(snapshot);
    const date = snapshot.blockTime.slice(0, 10);
    rule.fixedAllocations = [
      {
        chainId: 'juno-1',
        validator: snapshot.validators[0].address,
        amountRaw: '100000000',
        purpose: 'Operate public infrastructure',
        documentation: '',
        startDate: date,
        endDate: date
      }
    ];
  }
  const hash = await fingerprint(rule);
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
    min_initial_deposit_ratio: '0.1',
    min_deposit_ratio: '0.01',
    burn_vote_veto: true,
    burn_vote_quorum: false,
    burn_proposal_deposit_prevote: false
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
          status: 'BOND_STATUS_BONDED',
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

async function finalize(values, id, version = 1) {
  const digest = Buffer.from(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(values)))
  ).toString('hex');
  const record = {
    id,
    withdrawn: false,
    latest_version: version,
    finalized_version: version,
    finalized_hash: digest
  };
  const revision = { ...values, proposal_id: id, version };
  return { record, revision, final: await finalizedReview(record, revision, 'juno-1') };
}

test('referenced points rules with a fixed target reach native preflight and funding; date boundaries still block', async () => {
  const { review, snapshot, approval } = await prepared(true);
  const ruleReview = await buildRuleReview({
    rule: approval.rule,
    snapshot,
    evidence: observed(snapshot),
    activeHistory: snapshot.activeSetHistory,
    budgetRaw: '3000000000'
  });
  const rules = await finalize(
    (await frozenRuleProposal(ruleReview, { referenced: true })).values,
    17
  );
  const values = (await rebalanceProposal(review)).values;
  validateProposalContent(values, { native: true });
  const execution = await finalize(values, 18, 101);
  assert.equal(execution.final.kind, 'ALLOCATION_EXECUTION');
  assert.match(
    values.summary,
    /Authorize.*redelegate.*liquid funds.*fixed targets.*Rules stay unchanged/
  );
  assert.ok(Buffer.byteLength(execution.final.content.summary) < 2000);
  assert.doesNotMatch(execution.final.content.summary, /```cosmoot-rebalance/);
  assert.deepEqual(execution.final.content.messages, review.messages);
  assert.throws(() => proposalContent('ALLOCATION_EXECUTION', values), /finalized/);
  const records = new Map([
    [17, rules],
    [18, execution]
  ]);
  let mode = '',
    pending = false;
  const native = {
    ...execution.final.content,
    id: '951',
    status: 'PROPOSAL_STATUS_DEPOSIT_PERIOD',
    total_deposit: [{ denom: 'ujuno', amount: '10000000' }],
    deposit_end_time: new Date(Date.now() + 86400000).toISOString()
  };
  const endpoints = ['https://one.example', 'https://two.example'];
  const source = chainFixture(snapshot, approval);
  const fetcher = async (url, options) => {
    const path = new URL(url).pathname;
    let data;
    if (path.includes(`/contract/${reviewNetwork('juno-1').contract}/smart/`)) {
      const q = JSON.parse(atob(decodeURIComponent(path.split('/smart/')[1])));
      const item = records.get((q.proposal || q.revisions).proposal_id);
      if (q.revisions)
        assert.equal(q.revisions.start_after, item.revision.version === 101 ? 100 : null);
      data = { data: structuredClone(q.proposal ? item.record : [item.revision]) };
      if (mode === 'missing') data = { data: null };
      if (mode === 'disagree' && url.startsWith(endpoints[1]) && q.revisions)
        data.data[0].summary += ' changed';
    } else if (path === '/cosmos/gov/v1/proposals/951') data = { proposal: native };
    else {
      const response = await source(url, options);
      data = await response.json();
      if (data.proposals) {
        data.proposals[0] = { ...data.proposals[0], ...rules.final.content };
        if (pending) data.proposals.push(native);
      }
      if (data.block && mode === 'expired')
        data.block.header.time = new Date(Date.parse(snapshot.blockTime) + 86400000).toISOString();
    }
    return new Response(JSON.stringify(data), { headers: { 'x-cosmos-block-height': '42500000' } });
  };
  const options = () => ({
    endpoints,
    fetcher,
    ...(mode === 'expired' ? { now: Date.parse(snapshot.blockTime) + 86400000 } : {})
  });
  const content = execution.final.content;
  assert.equal((await checkRebalance(review, options())).length, 2);
  assert.equal((await preflight(endpoints, content, GOVERNANCE, options())).sources.length, 2);
  pending = true;
  await assert.rejects(preflight(endpoints, content, GOVERNANCE, options()), /pending/);
  assert.equal((await fundingProof(endpoints, '951', GOVERNANCE, options())).terms.open, true);
  assert.equal(
    (await readExecutionSources(native, { ...options(), requireNative: true })).hash,
    review.hash
  );
  pending = false;
  for (const failure of ['missing', 'disagree', 'expired']) {
    mode = failure;
    await assert.rejects(
      preflight(endpoints, content, GOVERNANCE, options()),
      failure === 'expired' ? /period changed/ : /review|evidence/i
    );
  }
  mode = '';
  // Historical withdrawal keeps already stored native evidence readable, but
  // never authorizes a new submission of the withdrawn review.
  execution.record.withdrawn = true;
  await assert.rejects(finalizedReview(execution.record, execution.revision, 'juno-1'), /Finalize/);
  assert.equal(
    (await readExecutionSources(native, { ...options(), requireNative: true })).hash,
    review.hash
  );
  const get = async (path) => (await fetcher(endpoints[0] + path, { headers: {} })).json();
  const ref = parseExecutionReference(content);
  for (const key of Object.keys(ref)) {
    const changed = structuredClone(ref);
    changed[key] = key === 'schema' ? 2 : key.endsWith('Hash') ? 'f'.repeat(64) : 'invalid';
    await assert.rejects(
      readExecutionContent(
        {
          ...content,
          summary: content.summary.replace(JSON.stringify(ref), JSON.stringify(changed))
        },
        { get }
      )
    );
  }
  for (const changed of [
    { ...content, summary: content.summary.replace('Authorize', 'Do not authorize') },
    {
      ...content,
      summary: content.summary.replace('https://cosmoot.com/', 'https://example.org/')
    },
    { ...content, messages: [] },
    { ...content, metadata: '' },
    { ...content, messages: [...content.messages, content.messages[0]] }
  ])
    await assert.rejects(readExecutionContent(changed, { get }), /differs/);
});

test('Z85 transport matches the published vector and rejects invalid length, overflow and nonzero padding', () => {
  const bytes = Uint8Array.from([0x86, 0x4f, 0xd2, 0x6f, 0xb5, 0x59, 0xf7, 0x5b]);
  assert.equal(encodeZ85(bytes), '8:HelloWorld');
  for (let n = 1; n < 256; n++) {
    const sample = Uint8Array.from({ length: n }, (_, i) => (i * 73 + n) % 256);
    assert.deepEqual(decodeZ85(encodeZ85(sample)), sample);
  }
  for (const text of [
    '0:',
    '01:00000',
    '4:#####',
    '4:0000~',
    '1:00001',
    '5:00000',
    '750001:' + '0'.repeat(937505)
  ])
    assert.throws(() => decodeZ85(text));
});

test('new 37/55/58-position points executions fit both workshop fields; complete evidence and legacy text survive', async () => {
  for (const count of [37, 55, 58, 100]) {
    const input = reviewSizeInput({ count: 100, points: true });
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
      await assert.rejects(rebalanceProposal(review), /exceeds governance limits/);
      continue;
    }
    const { values } = await rebalanceProposal(review);
    validateProposalContent(values, { native: true });
    assert.deepEqual((await readExecutionReview(values)).value, review.value);
    assert.ok(values.actions_json.length < 20000);
    const { final } = await finalize(values, 18);
    assert.deepEqual(final.content.messages, review.messages);
    assert.ok(Buffer.byteLength(final.content.summary) < 2000);
    await assert.rejects(
      readExecutionReview({ ...values, summary: values.summary.replace('Authorize', 'Reject') })
    );
    const pretty = { ...values, actions_json: JSON.stringify(review.messages, null, 2) };
    if (pretty.actions_json.length > 20000)
      assert.throws(() => validateProposalContent(pretty, { native: true }), /20000/);
    if (count === 37) {
      const legacy = await executionValues(review);
      const oldFinal = (await finalize(legacy, 18)).final;
      assert.equal(oldFinal.content.summary, legacy.summary + '\n\n' + legacy.body);
      assert.equal((await readExecutionReview(legacy)).hash, review.hash);
    }
  }
});

test('SDK redelegation responses preserve wrapped completion entries and staking locks', async () => {
  const { snapshot, approval } = await prepared();
  const normal = chainFixture(snapshot, approval);
  let rows = [
    {
      redelegation: {
        delegator_address: PROGRAMME,
        validator_src_address: addresses[4],
        validator_dst_address: addresses[0],
        entries: []
      },
      entries: [
        {
          redelegation_entry: {
            creation_height: '42500000',
            completion_time: '2026-11-22T00:00:00Z',
            initial_balance: '800',
            shares_dst: '800.000000000000000000'
          },
          balance: '800'
        }
      ]
    }
  ];
  const get = async (path) =>
    path.includes('/redelegations?')
      ? { redelegation_responses: rows, pagination: { next_key: null } }
      : (await normal('https://a.example' + path)).json();
  const actual = await stakingState(get, '42500000');
  assert.deepEqual(actual.redelegations, [
    {
      source: addresses[4],
      destination: addresses[0],
      entries: [{ completionTime: '2026-11-22T00:00:00Z' }]
    }
  ]);
  assert.match(
    checkMovementState(plan, { ...state(), redelegations: actual.redelegations }).join(' '),
    /incoming redelegation/
  );
  rows[0].redelegation.validator_src_address = addresses[0];
  rows[0].redelegation.validator_dst_address = addresses[1];
  rows[0].entries = Array.from({ length: 7 }, () => structuredClone(rows[0].entries[0]));
  const full = await stakingState(get, '42500000');
  assert.match(
    checkMovementState(plan, { ...state(), redelegations: full.redelegations }).join(' '),
    /entry limit/
  );
  for (const invalid of [
    undefined,
    null,
    [{}],
    [{ redelegation_entry: { completion_time: 'invalid' } }]
  ]) {
    rows[0].entries = invalid;
    await assert.rejects(stakingState(get, '42500000'), /completion evidence/);
  }
});

test('full redemption of an unbonded validator is blocked without changing approved targets', () => {
  const full = movementPlan([row(0, 900, 0), row(1, 0, 400), row(2, 0, 500)]);
  const current = { ...state(), positions: full.positions };
  Object.assign(current.validators[0], { tokensRaw: '900', bondStatus: 'BOND_STATUS_UNBONDED' });
  assert.match(
    checkMovementState(full, current).join(' '),
    /remove all stake from unbonded validator/
  );
  current.validators[0].tokensRaw = '901';
  assert.deepEqual(checkMovementState(full, current), []);
  current.validators[0].tokensRaw = '900';
  current.validators[0].bondStatus = 'BOND_STATUS_BONDED';
  assert.deepEqual(checkMovementState(full, current), []);
  current.validators[0].bondStatus = 'BOND_STATUS_UNBONDED';
  const unbond = movementPlan([row(0, 900, 0)]);
  assert.deepEqual(checkMovementState(unbond, { ...current, positions: unbond.positions }), []);
});
