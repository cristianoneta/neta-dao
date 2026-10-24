import test from 'node:test';
import assert from 'node:assert/strict';
import { governanceQueries } from '../src/governance/queries.mjs';
import { payloadParts, DELIVERABLE_TYPE } from '../src/governance/proposal-content.mjs';

const config = {
  review: () => ({ rests: ['https://node.test'], contract: 'review', address: 'creator' }),
  mainnet: () => ({ rests: ['https://main.test'], proposalModule: 'proposal' })
};
const json = (value) => new Response(JSON.stringify(value));

test('code discovery follows legacy forward pagination and accepts both chain hash encodings', async () => {
  const checksum = 'ab'.repeat(32);
  for (const data_hash of [
    checksum.toUpperCase(),
    Buffer.from(checksum, 'hex').toString('base64')
  ]) {
    const urls = [];
    const reads = governanceQueries({
      ...config,
      fetch: async (url) => {
        urls.push(url);
        return json(
          url.includes('pagination.key=')
            ? {
                code_infos: [{ creator: 'creator', data_hash, code_id: '4047' }],
                pagination: { next_key: null }
              }
            : {
                code_infos: [{ creator: 'another', data_hash, code_id: '999' }],
                pagination: { next_key: '+/=' }
              }
        );
      }
    });
    assert.deepEqual(await reads.findUploadedCode(checksum), { codeId: 4047 });
    assert.equal(urls.length, 2);
    assert.equal(new URL(urls[1]).searchParams.get('pagination.key'), '+/=');
    assert.ok(urls.every((url) => !new URL(url).searchParams.has('pagination.reverse')));
  }
});

test('contract reads preserve scope and pagination must advance', async () => {
  const urls = [];
  const reads = governanceQueries({
    ...config,
    fetch: async (url) => {
      urls.push(url);
      return json({ data: Array.from({ length: 100 }, () => ({ id: 1 })) });
    }
  });
  await assert.rejects(
    reads.queryAll(
      (cursor) => ({ proposals: { start_after: cursor, limit: 100 } }),
      (row) => row.id
    ),
    /DID NOT ADVANCE/
  );
  assert.equal(urls.length, 2);
  assert.ok(
    urls.every((url) => url.startsWith('https://node.test/cosmwasm/wasm/v1/contract/review/smart/'))
  );
});

test('receipt lookup never treats unavailable or different transactions as confirmation', async () => {
  const hash = 'A'.repeat(64);
  for (const response of [
    () => new Response('', { status: 503 }),
    () => json({ tx_response: { txhash: 'B'.repeat(64) } })
  ]) {
    const reads = governanceQueries({ ...config, fetch: async () => response() });
    assert.equal(await reads.transaction(hash), null);
  }
});

test('proposal metadata round trip separates deliverables from executable actions', () => {
  const action = { wasm: { execute: { contract_addr: 'contract', msg: 'e30=', funds: [] } } };
  const deliverable = {
    title: 'Report',
    due_date: '2026-11-01',
    owner: 'author',
    verifier: 'reviewer',
    evidence: 'Public report'
  };
  assert.deepEqual(
    payloadParts(JSON.stringify([action, { type: DELIVERABLE_TYPE, ...deliverable }])),
    { actions: [action], deliverables: [deliverable], accounting: [] }
  );
});
