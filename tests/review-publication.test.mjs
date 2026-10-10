import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  reconcileReviewTransaction,
  indexingUnavailable,
  publishedReview,
  copyReviewLink
} from '../review-publication.mjs';
const sender = 'fixture';
const key = `neta-pending-tx-v1:uni-7:${sender}`;
const bytes = Buffer.from('signed fixture');
const hash = createHash('sha256').update(bytes).digest('hex').toUpperCase();
const journal = {
  version: 1,
  chain: 'uni-7',
  sender,
  status: 'pending',
  hash,
  bytes: bytes.toString('base64')
};
function setup(row = journal) {
  const map = new Map([[key, JSON.stringify(row)]]);
  const storage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k)
  };
  return {
    storage,
    sender,
    locks: {
      request: async (k, options, fn) => {
        assert.equal(k, key);
        assert.equal(options.ifAvailable, true);
        return fn({});
      }
    },
    fetchTx: async () => ({ tx_response: { txhash: hash, height: '77', code: 0 } })
  };
}
test('exact saved receipt is retained before journal is released', async () => {
  const options = setup();
  let stored = false;
  options.onConfirmed = (r) => {
    assert.equal(r.transactionHash, hash);
    assert.ok(options.storage.getItem(key));
    stored = true;
  };
  const result = await reconcileReviewTransaction(options);
  assert.ok(stored);
  assert.equal(result.height, 77);
  assert.equal(options.storage.getItem(key), null);
});
test('unknown, corrupt, interrupted and mismatched outcomes remain locked', async () => {
  for (const row of [
    { ...journal, status: 'signing' },
    { ...journal, bytes: 'YmFk' },
    { ...journal, sender: 'other' },
    { ...journal, chain: 'juno-1' }
  ]) {
    const options = setup(row);
    await assert.rejects(reconcileReviewTransaction(options));
    assert.ok(options.storage.getItem(key));
  }
  for (const response of [
    null,
    {},
    { tx_response: { txhash: 'A'.repeat(64), height: '77', code: 0 } },
    { tx_response: { txhash: hash, height: '0', code: 0 } },
    { tx_response: { txhash: hash, height: '77', code: '0' } }
  ]) {
    const options = setup();
    options.fetchTx = async () => response;
    await assert.rejects(reconcileReviewTransaction(options));
    assert.ok(options.storage.getItem(key));
  }
});
test('wallet/context changes, another tab, failed persistence or mutated journal cannot unlock', async () => {
  for (const change of [
    (o) =>
      (o.assertCurrent = () => {
        throw Error('changed');
      }),
    (o) =>
      (o.onConfirmed = () => {
        throw Error('storage');
      }),
    (o) =>
      (o.fetchTx = async () => {
        o.storage.setItem(key, 'new');
        return { tx_response: { txhash: hash, height: '77', code: 0 } };
      }),
    (o) => (o.locks.request = async (k, v, fn) => fn(null))
  ]) {
    const o = setup();
    change(o);
    await assert.rejects(reconcileReviewTransaction(o));
    assert.ok(o.storage.getItem(key));
  }
});
test('confirmed failed transaction releases only its exact journal', async () => {
  const o = setup();
  o.fetchTx = async () => ({ tx_response: { txhash: hash, height: '77', code: 5 } });
  assert.equal((await reconcileReviewTransaction(o)).code, 5);
  assert.equal(o.storage.getItem(key), null);
});
test('indexing detection follows non-enumerable error causes', () => {
  assert.ok(
    indexingUnavailable(Error('locked', { cause: Error('transaction indexing is disabled') }))
  );
});
test('publication matching rejects older, changed and ambiguous reviews', () => {
  const values = { title: 't', summary: 's', body: 'b', actions_json: '[]' },
    intent = { author: 'a', after: 2, values };
  const row = { proposal: { id: 3, author: 'a' }, latest_revision: { version: 1, ...values } };
  assert.equal(publishedReview([row], intent), row);
  assert.equal(publishedReview([{ ...row, proposal: { id: 2, author: 'a' } }], intent), null);
  assert.throws(() => publishedReview([row, { ...row, proposal: { id: 4, author: 'a' } }], intent));
});
test('copy success and fallback both give visible feedback', async () => {
  let focused = false,
    selected = false;
  const input = { focus: () => (focused = true), select: () => (selected = true) },
    feedback = {};
  await copyReviewLink('https://example.test/?review=3', {
    clipboard: { writeText: async (url) => assert.match(url, /review=3/) },
    input,
    feedback
  });
  assert.equal(input.hidden, true);
  assert.match(feedback.textContent, /copied/);
  await copyReviewLink('https://example.test/?review=3', {
    clipboard: {
      writeText: async () => {
        throw Error('denied');
      }
    },
    input,
    feedback
  });
  assert.ok(focused && selected);
  assert.equal(input.hidden, false);
  assert.match(input.value, /review=3/);
});
