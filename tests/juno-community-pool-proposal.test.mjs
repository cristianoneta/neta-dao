import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  communityPoolProposal,
  communityPoolMessages,
  assertCommunityPoolSpend,
  verifyCommunityPoolState,
  COMMUNITY_POOL_KIND,
  COMMUNITY_POOL_PATH,
  DAI_DENOM_PATH,
  DAI_AMOUNT,
  DAI_DENOM
} from '../juno-community-pool-proposal.mjs';
import { savePlannerProposal, readPlannerProposal } from '../planner-proposal-draft.mjs';
import {
  proposalContent,
  preflight,
  GOVERNANCE,
  assertProgrammeExecutionAvailable
} from '../juno-governance-core.mjs';
import { finalizedReview, reviewKind, readCommunityPool } from '../juno-community-governance.mjs';
import { governanceReadTarget } from '../governance-chain-read.mjs';
const evidence = () => ({
  account: { account: { name: 'gov', base_account: { address: GOVERNANCE } } },
  pool: { pool: [{ denom: DAI_DENOM, amount: DAI_AMOUNT + '.000000000000000000' }] },
  denom: { denom: { base: 'dai-wei', trace: [{ port_id: 'transfer', channel_id: 'channel-71' }] } }
});
test('DAI template uses exact integer amount and isolates its saved draft from delegation and existing drafts', () => {
  assert.equal(
    'ibc/' + createHash('sha256').update('transfer/channel-71/dai-wei').digest('hex').toUpperCase(),
    DAI_DENOM
  );
  const existing = JSON.stringify({ title: 'Keep my draft' }),
    rows = new Map([['neta-governance-local-draft:juno', existing]]);
  const storage = { getItem: (k) => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, v) };
  const url = new URL(savePlannerProposal(storage, communityPoolProposal()), 'https://cosmoot.com');
  assert.equal(url.searchParams.get('subdao'), null);
  assert.equal(rows.get('neta-governance-local-draft:juno'), existing);
  const restored = readPlannerProposal(storage, url.searchParams, 'juno');
  assert.equal(restored.kind, COMMUNITY_POOL_KIND);
  assert.equal(reviewKind(restored.values), COMMUNITY_POOL_KIND);
  assert.deepEqual(
    proposalContent(restored.kind, restored.values).messages,
    communityPoolMessages()
  );
  assert.throws(
    () => readPlannerProposal(storage, url.searchParams, 'juno-delegation'),
    /different treasury/
  );
  assert.throws(
    () => savePlannerProposal({ getItem: () => null, setItem: () => {} }, communityPoolProposal()),
    /could not save/
  );
});
test('altered recipient, authority, denomination, amount, extra message and extra fields never qualify', () => {
  for (const mutate of [
    (m) => (m[0].recipient = GOVERNANCE),
    (m) => (m[0].authority = m[0].recipient),
    (m) => (m[0].amount[0].denom = 'ujuno'),
    (m) => (m[0].amount[0].amount = '461000000000000000000'),
    (m) => m.push(m[0]),
    (m) => (m[0].funds = []),
    (m) => m[0].amount.push({ denom: 'ujuno', amount: '1' })
  ]) {
    const messages = communityPoolMessages();
    mutate(messages);
    assert.throws(() => assertCommunityPoolSpend(messages));
    const v = { ...communityPoolProposal().values, actions_json: JSON.stringify(messages) };
    assert.throws(() => reviewKind(v));
    assert.throws(() => proposalContent(COMMUNITY_POOL_KIND, v));
  }
  // Funding unrelated chain proposals remains separate from our template allowlist.
  const other = communityPoolMessages();
  other[0].amount[0].amount = '1';
  assert.doesNotThrow(() => assertProgrammeExecutionAvailable(other));
});
test('mainnet balance and denomination checks reject missing, low, malformed and mismatched evidence', () => {
  verifyCommunityPoolState(evidence(), communityPoolMessages());
  for (const mutate of [
    (e) => (e.account.account.base_account.address = 'wrong'),
    (e) => (e.pool.pool = []),
    (e) => (e.pool.pool[0].amount = '460899999999999999999.999999999999999999'),
    (e) => (e.pool.pool[0].amount = '4.609e20'),
    (e) => e.pool.pool.push(e.pool.pool[0]),
    (e) => (e.denom.denom.trace[0].channel_id = 'channel-0'),
    (e) => (e.denom.denom.base = 'uusdc')
  ]) {
    const e = evidence();
    mutate(e);
    assert.throws(() => verifyCommunityPoolState(e, communityPoolMessages()));
  }
});
function source(mode = '') {
  return async (url) => {
    const u = new URL(url),
      e = evidence();
    if (mode === 'low') e.pool.pool[0].amount = '1';
    if (mode === 'disagree' && u.host === 'b.example')
      e.pool.pool[0].amount = '460900000000000000001';
    if (mode === 'down' && u.host === 'b.example') return new Response('', { status: 503 });
    let body;
    if (u.pathname.endsWith('/blocks/latest'))
      body = {
        block: {
          header: {
            chain_id: mode === 'wrong-chain' ? 'uni-7' : 'juno-1',
            height: '123',
            time: new Date(mode === 'stale' ? 0 : Date.now()).toISOString()
          }
        }
      };
    else if (u.pathname.endsWith('/module_accounts/gov')) body = e.account;
    else if (u.pathname === COMMUNITY_POOL_PATH) body = e.pool;
    else if (u.pathname === DAI_DENOM_PATH) body = e.denom;
    else if (u.pathname.endsWith('/params/deposit'))
      body = {
        params: {
          min_deposit: [{ denom: 'ujuno', amount: '5000000000' }],
          min_initial_deposit_ratio: '0.2'
        }
      };
    else if (u.pathname.includes('/spendable_balances/'))
      body = { balance: { denom: 'ujuno', amount: '6000000000' } };
    else throw Error('Unexpected query: ' + url);
    return new Response(JSON.stringify(body), {
      headers:
        mode === 'no-height' ? {} : { 'x-cosmos-block-height': mode === 'height' ? '124' : '123' }
    });
  };
}
test('publication proof and submission preflight verify two fresh sources without touching DAO contracts', async () => {
  const endpoints = ['https://a.example', 'https://b.example'],
    content = proposalContent(COMMUNITY_POOL_KIND, communityPoolProposal().values);
  await readCommunityPool(endpoints, content.messages, { fetcher: source() });
  const p = await preflight(endpoints, content, GOVERNANCE, { fetcher: source() });
  assert.equal(p.terms.initial, '1000000000');
  for (const mode of ['low', 'down', 'stale', 'wrong-chain', 'height', 'no-height']) {
    await assert.rejects(readCommunityPool(endpoints, content.messages, { fetcher: source(mode) }));
    await assert.rejects(preflight(endpoints, content, GOVERNANCE, { fetcher: source(mode) }));
  }
  await assert.rejects(
    readCommunityPool(endpoints, content.messages, { fetcher: source('disagree') }),
    /disagree/
  );
  await assert.rejects(
    readCommunityPool([endpoints[0], endpoints[0]], content.messages, { fetcher: source() }),
    /independent/
  );
  for (const path of [COMMUNITY_POOL_PATH, DAI_DENOM_PATH]) {
    assert.ok(governanceReadTarget('juno-stavr', path));
    assert.throws(() => governanceReadTarget('uni7-stavr', path));
    assert.throws(() => governanceReadTarget('juno-stavr', path + '?arbitrary=true'));
  }
});
test('finalized DAI reviews bind the exact text and transfer for another wallet to submit', async () => {
  const values = communityPoolProposal().values;
  const hash = createHash('sha256').update(JSON.stringify(values)).digest('hex');
  const proposal = {
    id: 77,
    latest_version: 1,
    finalized_version: 1,
    finalized_hash: hash,
    author: GOVERNANCE
  };
  const revision = { ...values, proposal_id: 77, version: 1 };
  const review = await finalizedReview(proposal, revision, 'juno-1');
  assert.equal(review.kind, COMMUNITY_POOL_KIND);
  assert.deepEqual(review.content.messages, communityPoolMessages());
  await assert.rejects(
    finalizedReview(proposal, { ...revision, body: 'changed' }, 'juno-1'),
    /hash/
  );
});
