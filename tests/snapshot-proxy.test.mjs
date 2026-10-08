import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotProxy } from '../service/snapshot-proxy.mjs';

const path = '/data/nns/price.json';
const context = (request) => ({ request, next: async () => new Response('{"static":true}') });
test('snapshot proxy bounds destination and strips user credentials, query and response cookies', async () => {
  const proxy = snapshotProxy([path.slice(1)], async (url, options) => {
    assert.equal(url, `https://data.cosmoot.com${path}`);
    assert.equal(options.headers, undefined);
    assert.equal(options.redirect, 'manual');
    return new Response('{"fresh":true}', { headers: { 'Set-Cookie': 'private=1' } });
  });
  const response = await proxy(context(new Request(`https://cosmoot.com${path}?secret=not-forwarded`, {
    headers: { Cookie: 'private=1', Authorization: 'Bearer secret' }
  })));
  assert.equal(response.headers.get('Set-Cookie'), null);
  assert.equal(response.headers.get('X-Cosmoot-Snapshot'), 'server');
  assert.deepEqual(await response.json(), { fresh: true });
});
test('unlisted paths and write methods cannot contact the upstream', async () => {
  const proxy = snapshotProxy([path.slice(1)], () => assert.fail('Unexpected upstream request'));
  for (const request of [new Request('https://cosmoot.com/data/private.sqlite'),
    new Request(`https://cosmoot.com${path}`, { method: 'POST' })]) {
    assert.deepEqual(await (await proxy(context(request))).json(), { static: true });
  }
});
test('failed origin keeps original static data and marks fallback without re-dating it', async () => {
  for (const fetcher of [async () => new Response('', { status: 503 }), async () => { throw Error('Offline'); }]) {
    const response = await snapshotProxy([path.slice(1)], fetcher)(context(new Request(`https://cosmoot.com${path}`)));
    assert.deepEqual(await response.json(), { static: true });
    assert.equal(response.headers.get('X-Cosmoot-Snapshot'), 'static-fallback');
    assert.equal(response.headers.get('Cache-Control'), 'no-cache');
  }
});
