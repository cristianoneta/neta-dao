import test from 'node:test';
import assert from 'node:assert/strict';
import { governanceReadProxy } from '../deploy/cosmoot/governance-read-proxy.mjs';
import {
  CHAIN_READ_PATH,
  governanceFetch,
  governanceReadTarget
} from '../governance-chain-read.mjs';
const path = '/cosmos/gov/v1/params/deposit';
const request = (extra = {}, method = 'GET') =>
  new Request(
    'https://cosmoot.com' +
      CHAIN_READ_PATH +
      '?' +
      new URLSearchParams({ source: 'juno-polkachu', path, height: '123', ...extra }),
    { method, headers: { Cookie: 'private=1', Authorization: 'Bearer private' } }
  );
test('same-origin reads keep the pinned height and never forward user credentials or upstream private headers', async () => {
  const result = await governanceReadProxy(request(), async (url, options) => {
    assert.equal(url, 'https://juno-api.polkachu.com' + path);
    assert.equal(options.headers['x-cosmos-block-height'], '123');
    assert.equal(options.headers.Cookie, undefined);
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.cf.cacheTtl, 0);
    return new Response('{"params":{}}', {
      headers: { 'x-cosmos-block-height': '123', 'Set-Cookie': 'private=1' }
    });
  });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('x-cosmos-block-height'), '123');
  assert.equal(result.headers.get('Set-Cookie'), null);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await result.json(), { params: {} });
});
test('read bridge rejects writes, arbitrary destinations, unbounded queries and redirects without static fallback', async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return new Response(null, { status: 302, headers: { Location: 'https://private.invalid' } });
  };
  for (const extra of [
    { source: 'https://private.invalid' },
    { path: '//private.invalid' },
    { path: '/cosmos/tx/v1beta1/txs' },
    { path: '/cosmos/gov/v1/proposals?pagination.limit=9999' },
    { path: path + '?private=1' },
    { height: 'latest' },
    { path: '/../../private' }
  ])
    assert.equal((await governanceReadProxy(request(extra), fetcher)).status, 400);
  assert.equal((await governanceReadProxy(request({}, 'POST'), fetcher)).status, 405);
  assert.equal(calls, 0);
  assert.equal((await governanceReadProxy(request(), fetcher)).status, 502);
  assert.equal(calls, 1);
  assert.equal(
    (await governanceReadProxy(request(), async () => new Response('not JSON'))).status,
    502
  );
  assert.equal(
    (
      await governanceReadProxy(
        request(),
        async () => new Response('x'.repeat(4 * 1024 * 1024 + 1))
      )
    ).status,
    502
  );
});
test('contract bridge permits only the exact review and programme read methods', () => {
  const prefix =
    '/cosmwasm/wasm/v1/contract/juno18d3mzk3ver06zfr5nf752aycss75vtcqd8fsdcuuzmh5mzj4cm6qrgx3fw/smart/';
  const query = (q) => prefix + encodeURIComponent(btoa(JSON.stringify(q)));
  assert.ok(governanceReadTarget('uni7-stavr', query({ proposal: { proposal_id: 3 } }), '123'));
  assert.ok(
    governanceReadTarget(
      'uni7-nodeshub',
      query({ revisions: { proposal_id: 3, start_after: null, limit: 1 } })
    )
  );
  for (const q of [
    { execute: {} },
    { proposal: { proposal_id: -1 } },
    { revisions: { proposal_id: 3, start_after: null, limit: 1000 } }
  ])
    assert.throws(() => governanceReadTarget('uni7-stavr', query(q)));
  assert.throws(() => governanceReadTarget('juno-stavr', query({ proposal: { proposal_id: 3 } })));
});
test('browser transport avoids provider CORS preflights while retaining provider identity and height', async () => {
  const oldFetch = globalThis.fetch,
    oldLocation = globalThis.location;
  globalThis.location = { origin: 'https://cosmoot.com' };
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url, location.origin);
    assert.equal(parsed.pathname, CHAIN_READ_PATH);
    assert.equal(parsed.searchParams.get('source'), 'juno-polkachu');
    assert.equal(parsed.searchParams.get('height'), '123');
    assert.equal(options.headers, undefined);
    assert.equal(options.credentials, 'omit');
    return new Response('{}');
  };
  try {
    await governanceFetch('https://juno-api.polkachu.com' + path, {
      headers: { 'x-cosmos-block-height': '123' }
    });
  } finally {
    globalThis.fetch = oldFetch;
    if (oldLocation === undefined) delete globalThis.location;
    else globalThis.location = oldLocation;
  }
});

test('mainnet review reads are limited to the pinned instance and code on mainnet providers', async () => {
  const {REVIEW_MAINNET_RELEASE:pin}=await import('../juno-review-mainnet-config.mjs');
  const instance='/cosmwasm/wasm/v1/contract/'+pin.contract,code='/cosmwasm/wasm/v1/code/'+pin.codeId;
  const paths=[instance,code,instance+'/smart/'+btoa(JSON.stringify({config:{}})),instance+'/smart/'+btoa(JSON.stringify({proposal:{proposal_id:1}}))];
  for(const path of paths){assert.ok(governanceReadTarget('juno-stavr',path));assert.throws(()=>governanceReadTarget('uni7-stavr',path));}
  assert.throws(()=>governanceReadTarget('juno-stavr',code+'0'));
  assert.throws(()=>governanceReadTarget('juno-stavr',instance+'/smart/'+btoa(JSON.stringify({set_paused:{paused:false}}))));
});
