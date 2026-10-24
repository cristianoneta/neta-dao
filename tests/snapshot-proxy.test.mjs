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
    assert.deepEqual(options.cf, { cacheEverything: true, cacheTtl: 60 });
    return new Response('{"fresh":true}', { headers: { 'Set-Cookie': 'private=1' } });
  });
  const response = await proxy(
    context(
      new Request(`https://cosmoot.com${path}?secret=not-forwarded`, {
        headers: { Cookie: 'private=1', Authorization: 'Bearer secret' }
      })
    )
  );
  assert.equal(response.headers.get('Set-Cookie'), null);
  assert.equal(response.headers.get('X-Cosmoot-Snapshot'), 'server');
  assert.equal(response.headers.get('X-Cosmoot-Upstream-Status'), '200');
  assert.equal(response.headers.get('X-Cosmoot-Upstream-Cache'), 'unknown');
  assert.equal(response.headers.get('X-Cosmoot-Upstream-Age'), null);
  assert.deepEqual(await response.json(), { fresh: true });
});

test('GET and HEAD expose bounded upstream diagnostics on both server and fallback responses', async () => {
  for (const method of ['GET', 'HEAD']) {
    for (const status of [200, 302, 503]) {
      for (const cache of [
        'HIT',
        'MISS',
        'EXPIRED',
        'STALE',
        'UPDATING',
        'REVALIDATED',
        'BYPASS',
        'DYNAMIC'
      ]) {
        const response = await snapshotProxy(
          [path.slice(1)],
          async () =>
            new Response(null, {
              status,
              headers: {
                'CF-Cache-Status': cache,
                Age: '00073',
                'Set-Cookie': 'secret=1',
                Location: 'https://private.invalid/',
                'X-Internal': 'private',
                'X-Cosmoot-Upstream-Status': 'spoofed'
              }
            })
        )(context(new Request(`https://cosmoot.com${path}`, { method })));
        assert.equal(response.headers.get('X-Cosmoot-Upstream-Status'), String(status));
        assert.equal(response.headers.get('X-Cosmoot-Upstream-Cache'), cache);
        assert.equal(response.headers.get('X-Cosmoot-Upstream-Age'), '73');
        assert.equal(
          response.headers.get('X-Cosmoot-Snapshot'),
          status === 200 ? 'server' : 'static-fallback'
        );
        for (const name of ['Set-Cookie', 'Location', 'X-Internal', 'Age', 'CF-Cache-Status'])
          assert.equal(response.headers.get(name), null);
      }
    }
  }
});

test('missing and invalid upstream metadata never becomes fabricated age or arbitrary response text', async () => {
  for (const age of [null, '', '-1', '1.5', 'unknown', '1e3', '1, 2', '12345678901']) {
    const headers = { 'CF-Cache-Status': 'private-debug-value' };
    if (age !== null) headers.Age = age;
    const response = await snapshotProxy(
      [path.slice(1)],
      async () => new Response(null, { headers })
    )(context(new Request(`https://cosmoot.com${path}`)));
    assert.equal(response.headers.get('X-Cosmoot-Upstream-Cache'), 'unknown');
    assert.equal(response.headers.get('X-Cosmoot-Upstream-Age'), null);
    assert.ok(![...response.headers.values()].includes('private-debug-value'));
  }
  const response = await snapshotProxy(
    [path.slice(1)],
    async () =>
      new Response(null, {
        headers: { 'CF-Cache-Status': 'hit', Age: '0' }
      })
  )(context(new Request(`https://cosmoot.com${path}`)));
  assert.equal(response.headers.get('X-Cosmoot-Upstream-Cache'), 'HIT');
  assert.equal(response.headers.get('X-Cosmoot-Upstream-Age'), '0');
});

test('fetch rejection has unavailable status, removes stale asset diagnostics and preserves fallback bytes', async () => {
  for (const error of [
    Error('private network detail'),
    new DOMException('private timeout detail', 'TimeoutError')
  ]) {
    const response = await snapshotProxy([path.slice(1)], async () => {
      throw error;
    })({
      request: new Request(`https://cosmoot.com${path}`),
      next: async () =>
        new Response('original bytes', {
          headers: {
            'X-Cosmoot-Upstream-Status': '200',
            'X-Cosmoot-Upstream-Cache': 'HIT',
            'X-Cosmoot-Upstream-Age': '30'
          }
        })
    });
    assert.equal(await response.text(), 'original bytes');
    assert.equal(response.headers.get('X-Cosmoot-Upstream-Status'), 'unavailable');
    assert.equal(response.headers.get('X-Cosmoot-Upstream-Cache'), 'unknown');
    assert.equal(response.headers.get('X-Cosmoot-Upstream-Age'), null);
    assert.ok(![...response.headers.values()].some((value) => value.includes('private')));
  }
});
test('unlisted paths and write methods cannot contact the upstream', async () => {
  const proxy = snapshotProxy([path.slice(1)], () => assert.fail('Unexpected upstream request'));
  for (const request of [
    new Request('https://cosmoot.com/data/private.sqlite'),
    new Request(`https://cosmoot.com${path}`, { method: 'POST' })
  ]) {
    assert.deepEqual(await (await proxy(context(request))).json(), { static: true });
  }
});
test('failed origin keeps original static data and marks fallback without re-dating it', async () => {
  for (const fetcher of [
    async () => new Response('', { status: 503 }),
    async () => {
      throw Error('Offline');
    }
  ]) {
    const response = await snapshotProxy(
      [path.slice(1)],
      fetcher
    )(context(new Request(`https://cosmoot.com${path}`)));
    assert.deepEqual(await response.json(), { static: true });
    assert.equal(response.headers.get('X-Cosmoot-Snapshot'), 'static-fallback');
    assert.equal(response.headers.get('Cache-Control'), 'no-cache');
  }
});
