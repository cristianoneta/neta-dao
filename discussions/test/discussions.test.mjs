import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { DiscussionStore } from '../store.mjs';
import { DiscussionChain } from '../chain.mjs';
import { discussionServer } from '../server.mjs';
import { discussionSource } from '../../discussion-links.mjs';
import { Secp256k1, sha256 } from '../../relay-backup/node_modules/@cosmjs/crypto/build/index.js';
import {
  encodeSecp256k1Pubkey,
  pubkeyToAddress,
  serializeSignDoc
} from '../../relay-backup/node_modules/@cosmjs/amino/build/index.js';

const secret = new Uint8Array(32);
secret[31] = 42; // Synthetic test key only.
const publicKey = encodeSecp256k1Pubkey(
  Secp256k1.compressPubkey((await Secp256k1.makeKeypair(secret)).pubkey)
);
const wallet = pubkeyToAddress(publicKey, 'juno');
const other = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
const source = discussionSource({ kind: 'native', chainId: 'juno-1', contract: 'gov', id: 384 });
const evidence = {
  stake: {
    status: 'verified',
    amountRaw: '123456789',
    height: 123,
    time: '2026-11-01T12:00:00Z',
    denom: 'ujuno'
  },
  name: { status: 'none' }
};
const thread = (store, key = source, extra = {}) =>
  store.syncThread({
    source: key,
    title: 'A reviewed proposal',
    summary: 'Approve a specific action.',
    created: 1000,
    author: wallet,
    phase: 'voting',
    payload: {},
    url: 'https://cosmoot.com/?proposal=384#governance',
    ...extra
  });
const post = (store, t, extra = {}) =>
  store.addPost({
    thread: t.id,
    wallet,
    body: 'A concrete suggestion.',
    requestId: randomUUID(),
    ...evidence,
    ...extra
  });
async function signature(message) {
  const doc = {
    chain_id: '',
    account_number: '0',
    sequence: '0',
    fee: { gas: '0', amount: [] },
    msgs: [
      {
        type: 'sign/MsgSignData',
        value: { signer: wallet, data: Buffer.from(message).toString('base64') }
      }
    ],
    memo: ''
  };
  const signed = await Secp256k1.createSignature(sha256(serializeSignDoc(doc)), secret);
  return {
    pub_key: publicKey,
    signature: Buffer.from(new Uint8Array([...signed.r(32), ...signed.s(32)])).toString('base64')
  };
}
test('durable reply idempotency, fixed evidence, limits and hidden placeholders', async () => {
  const directory = await mkdtemp(tmpdir() + '/cosmoot-discussion-');
  let now = 1000000;
  let store = new DiscussionStore(directory + '/discussion.sqlite', { now: () => now });
  try {
    const t = thread(store),
      requestId = randomUUID();
    const first = post(store, t, { requestId });
    assert.deepEqual(post(store, t, { requestId }), { ...first, replayed: true });
    assert.throws(() => post(store, t, { requestId, body: 'Different text' }), /another reply/);
    assert.throws(() => post(store, t), /wait/);
    store.close();
    store = new DiscussionStore(directory + '/discussion.sqlite', { now: () => now });
    assert.equal(store.request(wallet, requestId).id, first.id);
    now += 30001;
    const second = post(store, t, { body: 'A response', reply: first.id, quote: first.id });
    assert.equal(store.posts(t.id).posts[0].stake.amountRaw, '123456789');
    store.moderate(other, { action: 'hide', target: first.id, reason: 'Personal data' });
    const hidden = store.posts(t.id).posts[0];
    assert.equal(hidden.body, null);
    assert.equal(hidden.position, 2);
    assert.equal(store.posts(t.id, { anchor: second.id }).posts[0].id, second.id);
    now += 30001;
    assert.throws(() => post(store, t, { quote: first.id }), /unavailable/);
    store.moderate(other, { action: 'restore', target: first.id, reason: 'Reviewed correction' });
    assert.equal(store.posts(t.id).posts[0].body, 'A concrete suggestion.');
    store.moderate(other, { action: 'lock', target: t.id, reason: 'Spam incident' });
    assert.throws(() => post(store, t), /locked/);
    assert.equal(store.audit().length, 3);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test('review/native merge preserves post IDs, reply receipts, revisions and imported moderation', () => {
  const store = new DiscussionStore(':memory:', { now: () => 1000000 });
  try {
    const reviewKey = discussionSource({
      kind: 'review',
      chainId: 'juno-1',
      contract: 'juno15wwr9dezyfp86p4px5p664gguargukml3wa9pctw9nutfn2rzk9qwf45gq',
      id: 4
    });
    const revision = { version: 1, summary: 'Original decision' };
    const review = thread(store, reviewKey, { revisions: [revision] }),
      native = thread(store);
    const requestId = randomUUID(),
      reply = post(store, native, { requestId });
    const c = {
      id: 1,
      parent_id: null,
      body: 'Earlier on-chain comment',
      author: other,
      created_time: 10,
      moderation: { hidden: true, reason: 'Original moderation' }
    };
    const legacy = store.importComment(reviewKey, c);
    assert.equal(store.importComment(reviewKey, c), legacy);
    store.link(reviewKey, source);
    assert.equal(store.thread(native.id).id, review.id);
    assert.equal(store.resolve(source).id, review.id);
    assert.equal(store.posts(review.id).total, 2);
    assert.equal(post(store, native, { requestId }).id, reply.id);
    assert.equal(store.posts(review.id).posts[0].stake.status, 'unavailable');
    store.moderate(other, {
      action: 'restore',
      target: legacy,
      reason: 'Cannot override chain moderation'
    });
    assert.equal(store.posts(review.id).posts[0].body, null);
    assert.throws(
      () => thread(store, reviewKey, { revisions: [{ ...revision, summary: 'Rewritten' }] }),
      /revision changed/
    );
    assert.equal(store.revisions(review.id)[0].payload.summary, 'Original decision');
  } finally {
    store.close();
  }
});
test('history cursors retain every proposal with the same date', () => {
  const store = new DiscussionStore(':memory:');
  try {
    for (let id = 1; id <= 35; id++)
      thread(store, discussionSource({ kind: 'native', chainId: 'juno-1', contract: 'gov', id }));
    const first = store.list(),
      last = first.at(-1),
      next = store.list({ before: { created: last.created, id: last.id } });
    assert.equal(new Set([...first, ...next].map((t) => t.id)).size, 35);
    assert.throws(() => store.list({ before: NaN }), /cursor/);
  } finally {
    store.close();
  }
});
test('real ADR-36 login, origin isolation, revoked sessions, no topic creation and duplicate-safe posts', async () => {
  let now = 1793534400000;
  const store = new DiscussionStore(':memory:', { now: () => now }),
    t = thread(store);
  store.syncStatus('native:juno-1:gov');
  store.syncStatus(source);
  const server = discussionServer({
    store,
    chain: { identity: async () => evidence },
    origins: ['https://cosmoot.com', 'https://dao.netareborn.com'],
    moderators: [other],
    now: () => now
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, body, token, origin = 'https://cosmoot.com') => {
    const r = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        origin,
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: 'Bearer ' + token } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: r.status, value: await r.json() };
  };
  try {
    const c = (await call('/v1/challenge', { wallet })).value;
    const proof = await signature(c.message);
    assert.equal(
      (
        await call(
          '/v1/auth',
          { nonce: c.nonce, signature: proof },
          null,
          'https://dao.netareborn.com'
        )
      ).status,
      401
    );
    const signed = await call('/v1/auth', { nonce: c.nonce, signature: proof });
    assert.equal(signed.status, 200);
    const token = signed.value.accessToken;
    assert.equal((await call('/v1/auth', { nonce: c.nonce, signature: proof })).status, 401);
    assert.equal(
      (await call('/v1/session', null, token, 'https://dao.netareborn.com')).status,
      401
    );
    assert.equal((await call('/v1/threads', { title: 'Forged' }, token)).status, 404);
    const body = { body: 'First actual authenticated reply', requestId: randomUUID() };
    const saved = await call(`/v1/threads/${t.id}/posts`, body, token);
    assert.equal(saved.status, 200, JSON.stringify(saved));
    assert.equal((await call(`/v1/threads/${t.id}/posts`, body, token)).value.id, saved.value.id);
    assert.equal(
      (await call('/v1/requests/' + body.requestId, null, token)).value.post.id,
      saved.value.id
    );
    assert.equal(
      (
        await call(
          '/v1/moderation',
          { action: 'hide', target: saved.value.id, reason: 'Unauthorized' },
          token
        )
      ).status,
      403
    );
    assert.equal(
      (await call(`/v1/threads/${t.id}/posts`)).value.posts[0].stake.amountRaw,
      '123456789'
    );
    await call('/v1/logout', {}, token);
    assert.equal((await call('/v1/session', null, token)).status, 401);
    const expired = (await call('/v1/challenge', { wallet })).value;
    now += 120001;
    assert.equal(
      (
        await call('/v1/auth', {
          nonce: expired.nonce,
          signature: await signature(expired.message)
        })
      ).status,
      401
    );
    assert.equal((await call('/v1/threads', null, null, 'https://evil.example')).status, 403);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    store.close();
  }
});
test('source snapshots reject disagreement, missing height and stale blocks', async () => {
  const now = 1793534400000,
    time = new Date(now).toISOString();
  let mode = 'ok';
  const fetcher = async (url, options) => {
    const height = options.headers?.['x-cosmos-block-height'];
    const block = {
      block: {
        header: {
          chain_id: 'juno-1',
          height: '10',
          time: mode === 'stale' ? '2026-01-01T00:00:00Z' : time
        }
      }
    };
    const body = url.includes('blocks')
      ? block
      : { value: mode === 'disagree' && url.includes('second') ? 'wrong' : 'right' };
    return new Response(JSON.stringify(body), {
      headers: height && mode !== 'height' ? { 'x-cosmos-block-height': height } : {}
    });
  };
  const chain = new DiscussionChain({
    endpoints: ['https://first.example', 'https://second.example'],
    fetcher,
    now: () => now
  });
  assert.equal((await chain.snapshot()).height, 10);
  mode = 'disagree';
  await assert.rejects((await chain.snapshot()).get('/test'), /disagree/);
  mode = 'height';
  await assert.rejects(chain.snapshot(), /Height-pinned/);
  mode = 'stale';
  await assert.rejects(chain.snapshot(), /Fresh Juno/);
});
test('clamped contract pages are followed until empty and repetition fails closed', async () => {
  const chain = new DiscussionChain();
  let calls = 0;
  chain.smart = async (_g, _c, q) => {
    calls++;
    return q.list.start_after === null
      ? [{ id: 1 }, { id: 2 }]
      : q.list.start_after === 2
        ? [{ id: 3 }]
        : [];
  };
  assert.equal(
    (
      await chain.contractPages(
        null,
        'contract',
        (start_after) => ({ list: { start_after } }),
        null,
        'id'
      )
    ).length,
    3
  );
  assert.equal(calls, 3);
  chain.smart = async () => [{ id: 1 }];
  await assert.rejects(
    chain.contractPages(null, 'contract', (start_after) => ({ list: { start_after } }), null, 'id'),
    /ordering/
  );
});

test('current name ownership and bonded JUNO are independently verified; unknown is never zero', async () => {
  const { readFileSync } = await import('node:fs');
  const manifest = JSON.parse(
    readFileSync(new URL('../../docs/deployments/nns-mainnet.json', import.meta.url))
  );
  const now = 1793534400000,
    chain = new DiscussionChain({ now: () => now });
  let mode = 'ok';
  const get = async (path) => {
    if (path.includes('/code/'))
      return { code_info: { data_hash: manifest.contracts.registry.sha256 } };
    if (path.endsWith('/' + manifest.registry))
      return { contract_info: { code_id: manifest.contracts.registry.code_id } };
    if (path.includes('/smart/')) {
      const q = JSON.parse(
        Buffer.from(decodeURIComponent(path.split('/smart/')[1]), 'base64').toString()
      );
      if (q.name_of)
        return { data: { address: wallet, name: mode === 'none' ? null : 'cosmoot-test.neta' } };
      return {
        data: {
          name: 'cosmoot-test.neta',
          owner: mode === 'transfer' ? other : wallet,
          expires_at: Math.floor(now / 1000) + (mode === 'expired' ? -1 : 3600)
        }
      };
    }
    if (path.includes('/delegations/')) {
      if (mode === 'missing') throw Error('unavailable');
      return {
        delegation_responses:
          mode === 'empty'
            ? []
            : [
                {
                  delegation: { delegator_address: wallet, validator_address: 'bonded' },
                  balance: { denom: 'ujuno', amount: '123456789' }
                },
                {
                  delegation: { delegator_address: wallet, validator_address: 'inactive' },
                  balance: { denom: 'ujuno', amount: '9000000' }
                }
              ],
        pagination: { next_key: null }
      };
    }
    if (path.includes('/validators'))
      return {
        validators: [
          { operator_address: 'bonded', status: 'BOND_STATUS_BONDED' },
          {
            operator_address: mode === 'duplicate' ? 'bonded' : 'inactive',
            status: 'BOND_STATUS_UNBONDED'
          }
        ],
        pagination: { next_key: null }
      };
    throw Error('Unexpected query');
  };
  chain.snapshot = async () => ({ get, height: 100, time: new Date(now).toISOString() });
  const initial = await chain.identity(wallet, { stake: true });
  assert.equal(initial.name.name, 'cosmoot-test.neta');
  assert.equal(initial.name.owner, wallet);
  assert.equal(initial.stake.amountRaw, '123456789');
  for (mode of ['transfer', 'expired'])
    assert.equal((await chain.identity(wallet, { stake: true })).name.status, 'unavailable');
  for (mode of ['missing', 'duplicate'])
    assert.equal((await chain.identity(wallet, { stake: true })).stake.status, 'unavailable');
  mode = 'empty';
  assert.equal((await chain.identity(wallet, { stake: true })).stake.amountRaw, '0');
  mode = 'none';
  assert.equal((await chain.identity(wallet, { stake: true })).name.status, 'none');
  await assert.rejects(chain.identity('https://evil.example'), /Invalid Juno/);
});

test('published reviews become topics, revisions and legacy comments survive, exact native matches join once', async () => {
  const { createHash } = await import('node:crypto');
  const { legacyClaimDraft } = await import('../../tests/fixtures/legacy-claim.mjs');
  const { fixture } = await import('../../tests/fixtures/delegation-planner.mjs');
  const { finalizedReview } = await import('../../juno-community-governance.mjs');
  const { REVIEW_MAINNET_RELEASE } = await import('../../juno-review-mainnet-config.mjs');
  const values = legacyClaimDraft(fixture()).values;
  const review = {
    id: 17,
    author: wallet,
    latest_version: 1,
    finalized_version: null,
    finalized_hash: null,
    withdrawn: false,
    created_time: 100
  };
  const revision = { ...values, version: 1, proposal_id: 17 };
  const reviewSource = {
    kind: 'review',
    chainId: 'juno-1',
    contract: REVIEW_MAINNET_RELEASE.contract
  };
  const nativeSource = { kind: 'native', chainId: 'juno-1', contract: 'gov' };
  let native = [],
    failComments = false;
  const store = new DiscussionStore(':memory:'),
    chain = new DiscussionChain();
  chain.snapshot = async () => ({ get: async () => ({}) });
  chain.pages = async () => native;
  chain.smart = async (_get, _contract, q) => {
    if (q.proposals) return q.proposals.start_after ? [] : [structuredClone(review)];
    if (q.revisions) return q.revisions.start_after ? [] : [revision];
    if (q.comments) {
      if (failComments) throw Error('comments unavailable');
      return q.comments.start_after
        ? []
        : [
            { id: 1, author: other, body: 'Original feedback', created_time: 101, moderation: null }
          ];
    }
    throw Error('Unexpected query');
  };
  const key = discussionSource({ ...reviewSource, id: 17 });
  try {
    failComments = true;
    await chain.sync(store, [nativeSource, reviewSource]);
    assert.ok(store.resolve(key));
    assert.equal(store.ready(key), false, 'do not hide original comments until import completes');
    failComments = false;
    await chain.sync(store, [nativeSource, reviewSource]);
    const t = store.resolve(key);
    assert.equal(store.ready(key), true);
    assert.equal(store.posts(t.id).total, 1);
    review.finalized_version = 1;
    review.finalized_hash = createHash('sha256').update(JSON.stringify(values)).digest('hex');
    const { content } = await finalizedReview(review, revision, 'juno-1', { readOnly: true });
    const proposal = {
      ...content,
      id: '999',
      status: 'PROPOSAL_STATUS_VOTING_PERIOD',
      submit_time: '2026-11-01T10:00:00Z',
      expedited: false
    };
    native = [{ ...proposal, summary: 'Copied metadata, different text' }];
    await chain.sync(store, [nativeSource, reviewSource]);
    const nativeKey = discussionSource({ ...nativeSource, id: 999 });
    assert.notEqual(store.resolve(nativeKey).id, t.id);
    native = [proposal, { ...proposal, id: '1000' }];
    await chain.sync(store, [nativeSource, reviewSource]);
    assert.notEqual(store.resolve(nativeKey).id, t.id, 'ambiguous matches remain separate');
    native = [proposal];
    await chain.sync(store, [nativeSource, reviewSource]);
    assert.equal(store.resolve(nativeKey).id, t.id);
    assert.equal(store.posts(t.id).total, 1);
    assert.equal(store.thread(t.id).phase, 'PROPOSAL_STATUS_VOTING_PERIOD');
    assert.equal(store.thread(t.id).aliases.length, 1);
    assert.equal(store.revisions(t.id).length, 1);
  } finally {
    store.close();
  }
});
