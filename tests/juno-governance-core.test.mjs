import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOVERNANCE,
  rewardMessages,
  claimValidators,
  proposalContent,
  depositTerms,
  parseDeposit,
  verifyProgramme,
  preflight,
  submissionReceipt
} from '../juno-governance-core.mjs';
import { PROGRAMME } from '../juno-delegation-core.mjs';
import { fixture } from './fixtures/delegation-planner.mjs';
import {
  claimProposal,
  readPlannerProposal,
  PLANNER_DRAFT_PREFIX
} from '../planner-proposal-draft.mjs';
const validators = fixture()
  .validators.map((v) => v.address)
  .sort();
const messages = rewardMessages(validators);
const evidence = () => ({
  account: { account: { name: 'gov', base_account: { address: GOVERNANCE } } },
  info: { contract_info: { code_id: '4047' } },
  admin: { data: GOVERNANCE },
  paused: { data: { unpaused: {} } },
  withdraw: { withdraw_address: PROGRAMME },
  delegations: validators.map((validator_address) => ({
    delegation: { delegator_address: PROGRAMME, validator_address },
    balance: { denom: 'ujuno', amount: '123' }
  }))
});
const params = {
  min_deposit: [{ denom: 'ujuno', amount: '1000000001' }],
  min_initial_deposit_ratio: '0.100000000000000000'
};
test('native claim authority and payload reject other senders, withdrawals, funds and extra fields', () => {
  verifyProgramme(evidence(), messages);
  for (const edit of [
    (v) => (v[0].sender = PROGRAMME),
    (v) => v[0].funds.push({ denom: 'ujuno', amount: '1' }),
    (v) =>
      (v[0].msg.execute_admin_msgs.msgs[0].distribution.set_withdraw_address = {
        address: GOVERNANCE
      }),
    (v) => v.push(v[0]),
    (v) => (v[0].msg.extra = {})
  ]) {
    const modified = structuredClone(messages);
    edit(modified);
    assert.throws(() => claimValidators(modified));
  }
  for (const edit of [
    (v) => (v.admin.data = PROGRAMME),
    (v) => (v.account.account.name = 'bank'),
    (v) => (v.info.contract_info.code_id = '1'),
    (v) => (v.paused.data = { paused: { expiration: { at_height: 99999999 } } }),
    (v) => delete v.paused,
    (v) => (v.withdraw.withdraw_address = GOVERNANCE),
    (v) => v.delegations.pop(),
    (v) => (v.delegations[0].balance.amount = '0')
  ]) {
    const modified = evidence();
    edit(modified);
    assert.throws(() => verifyProgramme(modified, messages));
  }
});
test('native proposal includes the full reviewed text and text decisions cannot execute', () => {
  const draft = claimProposal(fixture()),
    content = proposalContent(draft.kind, draft.values);
  assert.equal(content.summary, draft.values.summary + '\n\n' + draft.values.body);
  assert.equal(content.messages[0].sender, GOVERNANCE);
  assert.throws(() => proposalContent('RULE_APPROVAL', draft.values));
  assert.throws(() =>
    proposalContent('CLAIM_REWARDS', { ...draft.values, body: 'x'.repeat(10001) })
  );
});
test('initial deposit uses exact integer ceiling and rejects unsupported assets/ratios', () => {
  assert.deepEqual(depositTerms(params), { total: '1000000001', initial: '100000001' });
  assert.equal(parseDeposit('100.000001'), '100000001');
  assert.throws(() => parseDeposit('1e3'));
  assert.throws(() => parseDeposit('1.0000001'));
  assert.throws(() => depositTerms({ ...params, min_initial_deposit_ratio: '1.1' }));
  assert.throws(() =>
    depositTerms({ ...params, min_deposit: [{ denom: 'ujunox', amount: '100' }] })
  );
});
test('legacy handoff is upgraded without changing its original stored content', () => {
  const draft = claimProposal(fixture());
  draft.schema = 1;
  draft.values.actions_json = JSON.stringify(messages[0].msg.execute_admin_msgs.msgs);
  const original = JSON.stringify(draft),
    id = '11111111-1111-4111-8111-111111111111';
  const restored = readPlannerProposal(
    { getItem: (k) => (k === PLANNER_DRAFT_PREFIX + id ? original : null) },
    new URLSearchParams({ plannerDraft: id }),
    'juno-delegation'
  );
  assert.equal(restored.schema, 2);
  assert.equal(restored.legacy, true);
  assert.deepEqual(JSON.parse(restored.values.actions_json), messages);
  assert.equal(draft.schema, 1);
});
test('preflight pins all evidence to a fresh mainnet height and reads every delegation page', async () => {
  const data = evidence(),
    seen = [],
    now = Date.now();
  const fetcher = async (url, options) => {
    seen.push({ url, options });
    let body;
    if (url.endsWith('/latest'))
      body = {
        block: {
          header: { chain_id: 'juno-1', height: '424242', time: new Date(now).toISOString() }
        }
      };
    else if (url.includes('/params/')) body = { params };
    else if (url.includes('/spendable_balances/'))
      body = { balance: { denom: 'ujuno', amount: '2000000000' } };
    else if (url.includes('/module_accounts/')) body = data.account;
    else if (url.includes('/smart/'))
      body = url.endsWith(btoa('{"pause_info":{}}')) ? data.paused : data.admin;
    else if (url.includes('/contract/')) body = data.info;
    else if (url.includes('/withdraw_address')) body = data.withdraw;
    else
      body = url.includes('pagination.key=')
        ? { delegation_responses: data.delegations.slice(10), pagination: {} }
        : { delegation_responses: data.delegations.slice(0, 10), pagination: { next_key: 'a+/=' } };
    return new Response(JSON.stringify(body), { headers: { 'x-cosmos-block-height': '424242' } });
  };
  const nodes = ['https://one.example', 'https://two.example'];
  const result = await preflight(nodes, { messages }, GOVERNANCE, {
    fetcher,
    now
  });
  assert.equal(result.height, '424242');
  assert.equal(seen.length, 20);
  assert.ok(
    seen
      .filter((row) => !row.url.endsWith('/latest'))
      .every((row) => row.options.headers['x-cosmos-block-height'] === '424242')
  );
  assert.ok(seen.at(-1).url.includes('pagination.key=a%2B%2F%3D'));
  assert.equal(result.sources.length, 2);
  await assert.rejects(
    preflight([nodes[0], nodes[0] + '/'], { messages }, GOVERNANCE, { fetcher, now }),
    /Two independent/
  );
  await assert.rejects(
    preflight(nodes, { messages }, GOVERNANCE, {
      now,
      fetcher: async (url, options) => {
        const response = await fetcher(url, options);
        if (url.startsWith(nodes[1]) && url.includes('/params/'))
          return new Response(
            JSON.stringify({ params: { ...params, min_initial_deposit_ratio: '0.2' } })
          );
        return response;
      }
    }),
    /disagree/
  );
  await assert.rejects(
    preflight(nodes, { messages }, GOVERNANCE, { fetcher, now: now + 120001 }),
    /Fresh Juno/
  );
  data.withdraw.withdraw_address = GOVERNANCE;
  await assert.rejects(preflight(nodes, { messages }, GOVERNANCE, { fetcher, now }), /destination/);
});
test('unknown submissions need two matching inclusion receipts; status lookup never submits', async () => {
  const hash = 'A'.repeat(64),
    nodes = ['https://one.example', 'https://two.example', 'https://three.example'];
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ tx_response: { txhash: hash, height: '42', code: 0 } }));
  };
  assert.deepEqual(await submissionReceipt(nodes, hash, { fetcher }), {
    hash,
    height: '42',
    code: 0,
    state: 'included'
  });
  assert.ok(
    calls.every(
      ({ url, options }) =>
        url.endsWith('/cosmos/tx/v1beta1/txs/' + hash) && !options.body && !options.method
    )
  );
  for (const change of [
    (tx) => (tx.txhash = 'B'.repeat(64)),
    (tx) => (tx.height = '0'),
    (tx) => (tx.code = '0')
  ])
    await assert.rejects(
      submissionReceipt(nodes, hash, {
        fetcher: async () => {
          const tx = { txhash: hash, height: '42', code: 0 };
          change(tx);
          return new Response(JSON.stringify({ tx_response: tx }));
        }
      }),
      /unconfirmed/
    );
  await assert.rejects(
    submissionReceipt([nodes[0], nodes[0] + '/'], hash, { fetcher }),
    /unconfirmed/
  );
  await assert.rejects(
    submissionReceipt(nodes, hash, {
      fetcher: async (url) => {
        if (url.startsWith(nodes[1]))
          return new Response(
            JSON.stringify({ tx_response: { txhash: hash, height: '42', code: 12 } })
          );
        return fetcher(url, {});
      }
    }),
    /unconfirmed/
  );
  const failed = await submissionReceipt(nodes, hash, {
    fetcher: async () =>
      new Response(JSON.stringify({ tx_response: { txhash: hash, height: '42', code: 12 } }))
  });
  assert.equal(failed.state, 'failed');
});
