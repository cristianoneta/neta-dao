// Exercise the actual Wrangler bundle with synthetic upstream and static assets.
// This verifies routing/runtime behavior without contacting production or wallets.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const paths = JSON.parse(await readFile(new URL('../deploy/cosmoot/snapshot-paths.json', import.meta.url)));
const staticPaths = new Set(paths.map(path => `/${path}`));
const staticBytes = new TextEncoder().encode('{"observed_at":"2026-10-01T00:00:00Z","source":"static"}');
const upstreamBytes = new Uint8Array([0, 1, 31, 139, 127, 255]);
let mode = 'server';
let calls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  calls++;
  assert.equal(new URL(url).origin, 'https://data.cosmoot.com');
  assert.equal(new URL(url).search, '');
  assert.ok(staticPaths.has(new URL(url).pathname));
  assert.equal(options.headers, undefined);
  assert.equal(options.redirect, 'error');
  assert.equal(options.cf.cacheTtl, 60);
  if (mode === 'offline') throw Error('Synthetic origin failure');
  if (mode === 'unavailable') return new Response(null, { status: 503 });
  return new Response(options.method === 'HEAD' ? null : upstreamBytes, {
    headers: { 'Set-Cookie': 'upstream-private=1', 'X-Private': 'omit' }
  });
};
const env = { ASSETS: { fetch: async request => {
  const path = new URL(request.url).pathname;
  const exists = staticPaths.has(path) || ['/', '/relay-personal-runtime.html'].includes(path);
  return new Response(request.method === 'HEAD' ? null : staticBytes, { status: exists ? 200 : 404 });
} } };
try {
  const { default: worker } = await import(new URL('../dist/static/_worker.js', import.meta.url));
  const request = (origin, path, method = 'GET') => worker.fetch(new Request(`${origin}${path}`, {
    method, headers: { Cookie: 'private=1', Authorization: 'Bearer not-forwarded' }
  }), env, { waitUntil() {} });
  for (const origin of ['https://cosmoot.com', 'https://dao.netareborn.com']) {
    mode = 'server';
    for (const path of paths) {
      for (const method of ['GET', 'HEAD']) {
        const before = calls;
        const response = await request(origin, `/${path}?secret=not-forwarded`, method);
        assert.equal(calls, before + 1);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('X-Cosmoot-Snapshot'), 'server');
        assert.equal(response.headers.get('Set-Cookie'), null);
        assert.equal(response.headers.get('X-Private'), null);
        assert.equal(response.headers.get('Content-Type'), path.endsWith('.gz') ? 'application/gzip' : 'application/json');
        assert.deepEqual(new Uint8Array(await response.arrayBuffer()), method === 'HEAD' ? new Uint8Array() : upstreamBytes);
      }
    }
    for (const failure of ['offline', 'unavailable']) {
      mode = failure;
      const response = await request(origin, `/${paths[0]}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('X-Cosmoot-Snapshot'), 'static-fallback');
      assert.equal(response.headers.get('Cache-Control'), 'no-cache');
      assert.deepEqual(new Uint8Array(await response.arrayBuffer()), staticBytes);
    }
    const before = calls;
    for (const path of ['/receipt.json', '/faucet.sqlite', '/.env', '/data/private.sqlite', '/data/unbekannt.json'])
      assert.equal((await request(origin, path)).status, 404);
    for (const path of ['/', '/relay-personal-runtime.html'])
      assert.equal((await request(origin, path)).status, 200);
    await request(origin, `/${paths[0]}`, 'POST');
    assert.equal(calls, before, 'Static routes, private paths and writes must not contact the origin');
  }
  console.log(`Compiled Pages Worker passed: ${paths.length} GET/HEAD paths on both origins, exact bytes, static fallback and private-path routing.`);
} finally {
  globalThis.fetch = originalFetch;
}
