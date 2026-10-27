import test from 'node:test';
import assert from 'node:assert/strict';
import {
  previousVoteHashes,
  replacementReceipt,
  confirmedVoteReceipt
} from '../native-vote-receipts.mjs';

const endpoints = ['https://one.example', 'https://two.example'];
const oldHash = 'A'.repeat(64),
  hash = 'B'.repeat(64),
  nextHash = 'C'.repeat(64);
const receipt = replacementReceipt({ hash: oldHash, gasRejected: true }, hash);
function lookup(rows) {
  return async (url) => {
    const txhash = url.split('/').at(-1),
      code = rows[txhash];
    return {
      ok: code !== undefined,
      json: async () => ({ tx_response: { txhash, height: '100', code } })
    };
  };
}
test('replacement receipts preserve bounded, unique attempt history', () => {
  assert.deepEqual(previousVoteHashes(receipt), [oldHash]);
  assert.equal(receipt.gasRejected, false);
  assert.deepEqual(previousVoteHashes(replacementReceipt(receipt, nextHash)), [hash, oldHash]);
  for (const previousHashes of [
    'invalid',
    ['bad'],
    [hash],
    [oldHash, oldHash],
    Array(17).fill(oldHash)
  ]) {
    assert.throws(() => previousVoteHashes({ hash, previousHashes }));
  }
  assert.throws(() => replacementReceipt(receipt, oldHash));
});
test('an independently confirmed successful predecessor resolves an unknown replacement', async () => {
  const result = await confirmedVoteReceipt(endpoints, receipt, {
    fetcher: lookup({ [oldHash]: 0 })
  });
  assert.equal(result.hash, oldHash);
  assert.equal(result.state, 'included');
  // Multiple gas increases retain the original successful attempt as evidence.
  assert.equal(
    (
      await confirmedVoteReceipt(endpoints, replacementReceipt(receipt, nextHash), {
        fetcher: lookup({ [oldHash]: 0 })
      })
    ).hash,
    oldHash
  );
});
test('an included failed predecessor or a single-source success cannot resolve the replacement', async () => {
  await assert.rejects(
    confirmedVoteReceipt(endpoints, receipt, { fetcher: lookup({ [oldHash]: 11 }) }),
    /unconfirmed/
  );
  await assert.rejects(
    confirmedVoteReceipt(endpoints, receipt, {
      fetcher: (url) => lookup(url.startsWith(endpoints[0]) ? { [oldHash]: 0 } : {})(url)
    }),
    /unconfirmed/
  );
});
test('the current attempt receipt takes precedence and malformed history blocks lookup', async () => {
  for (const code of [0, 11]) {
    const result = await confirmedVoteReceipt(endpoints, receipt, {
      fetcher: lookup({ [hash]: code, [oldHash]: 0 })
    });
    assert.equal(result.hash, hash);
    assert.equal(result.code, code);
  }
  await assert.rejects(
    confirmedVoteReceipt(
      endpoints,
      { hash, previousHashes: ['bad'] },
      {
        fetcher: () => assert.fail('Malformed history must not query')
      }
    ),
    /unreadable/
  );
});
