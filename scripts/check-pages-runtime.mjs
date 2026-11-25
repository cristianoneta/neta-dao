// Run through pinned Wrangler's npm environment so the compiled bundle uses the
// same workerd/Miniflare toolchain, without adding application dependencies.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { delimiter, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GOVERNANCE_DEMO_ORIGIN,
  GOVERNANCE_DEMO_MARKER
} from '../deploy/cosmoot/governance-demo-proxy.mjs';

let runtimeRequire;
for (const directory of (process.env.PATH || '').split(delimiter)) {
  const manifest = resolve(directory, '../wrangler/package.json');
  try {
    const pkg = JSON.parse(await readFile(manifest, 'utf8'));
    if (pkg.name === 'wrangler' && pkg.version === '4.148.0') {
      runtimeRequire = createRequire(manifest);
      break;
    }
  } catch {
    /* Not an npm tool directory. */
  }
}
if (!runtimeRequire)
  throw Error(
    'Run with: npx --yes --package=wrangler@4.148.0 -c "node scripts/check-pages-runtime.mjs"'
  );
const {
  Miniflare,
  convertV4MiniflareOptions,
  Response: HostResponse
} = runtimeRequire('miniflare');
const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(resolve(root, 'wrangler.json'), 'utf8'));
const paths = JSON.parse(
  await readFile(resolve(root, 'deploy/cosmoot/snapshot-paths.json'), 'utf8')
);
const allowed = new Set(paths.map((path) => `/${path}`));
// Use the actual packaged snapshots: a fallback must not substitute fixtures,
// lose gzip bytes, or refresh observation timestamps/signatures.
const staticAssets = new Map(
  await Promise.all(
    paths.map(async (path) => [
      `/${path}`,
      new Uint8Array(await readFile(resolve(root, 'dist/static', path)))
    ])
  )
);
const upstreamBytes = new Uint8Array([0, 1, 31, 139, 127, 255]);
const calls = [];
let mode = 200;
let demoMode = 'ready';
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    scriptPath: resolve(root, 'dist/static/_worker.js'),
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags || [],
    cf: false,
    outboundService: (request) => {
      calls.push({
        url: request.url,
        method: request.method,
        cookie: request.headers.has('Cookie'),
        authorization: request.headers.has('Authorization')
      });
      if (new URL(request.url).origin === GOVERNANCE_DEMO_ORIGIN) {
        if (request.headers.get('Accept') !== '*/*') throw Error('Unexpected demo request headers');
        return new HostResponse(request.method === 'HEAD' ? null : upstreamBytes, {
          status: demoMode === 'redirect' ? 302 : demoMode === 'offline' ? 503 : 200,
          headers: {
            'X-Cosmoot-Governance': demoMode === 'login' ? 'unrecognized' : GOVERNANCE_DEMO_MARKER,
            'Content-Type': 'font/woff',
            'Set-Cookie': 'private=1',
            Location: 'https://login.invalid/'
          }
        });
      }
      if (new URL(request.url).origin === 'https://juno-api.polkachu.com') {
        if (request.headers.get('x-cosmos-block-height') !== '123')
          throw Error('Missing pinned chain height');
        return new HostResponse('{"params":{}}', {
          headers: { 'x-cosmos-block-height': '123', 'Set-Cookie': 'private=1' }
        });
      }
      return new HostResponse(request.method === 'HEAD' ? null : upstreamBytes, {
        status: mode,
        headers: {
          Location: 'https://redirect.invalid/private',
          'Set-Cookie': 'private=1',
          'CF-Cache-Status': mode === 200 ? 'HIT' : 'MISS',
          Age: '73'
        }
      });
    },
    serviceBindings: {
      ASSETS: (request) =>
        new HostResponse(
          request.method === 'HEAD' ? null : staticAssets.get(new URL(request.url).pathname),
          {
            status: allowed.has(new URL(request.url).pathname) ? 200 : 404
          }
        )
    }
  })
);
const request = (origin, path, method) =>
  mf.dispatchFetch(`${origin}/${path}?private=not-forwarded`, {
    method,
    headers: { Cookie: 'client-private=1', Authorization: 'Bearer not-forwarded' }
  });
try {
  for (const origin of ['https://cosmoot.com', 'https://dao.netareborn.com']) {
    mode = 200;
    for (const path of paths) {
      for (const method of ['GET', 'HEAD']) {
        const before = calls.length;
        const response = await request(origin, path, method);
        assert.equal(
          response.headers.get('X-Cosmoot-Snapshot'),
          'server',
          `${method} ${origin}/${path}`
        );
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('X-Cosmoot-Upstream-Status'), '200');
        assert.equal(response.headers.get('X-Cosmoot-Upstream-Cache'), 'HIT');
        assert.equal(response.headers.get('X-Cosmoot-Upstream-Age'), '73');
        assert.equal(response.headers.get('Set-Cookie'), null);
        assert.equal(response.headers.get('Location'), null);
        assert.deepEqual(
          new Uint8Array(await response.arrayBuffer()),
          method === 'HEAD' ? new Uint8Array() : upstreamBytes
        );
        assert.deepEqual(calls.slice(before), [
          { url: `https://data.cosmoot.com/${path}`, method, cookie: false, authorization: false }
        ]);
      }
    }
    for (const status of [301, 302, 303, 307, 308, 503]) {
      mode = status;
      for (const method of ['GET', 'HEAD']) {
        const before = calls.length;
        const response = await request(origin, paths[0], method);
        assert.equal(response.headers.get('X-Cosmoot-Snapshot'), 'static-fallback');
        assert.equal(response.headers.get('Cache-Control'), 'no-cache');
        assert.equal(response.headers.get('X-Cosmoot-Upstream-Status'), String(status));
        assert.equal(response.headers.get('X-Cosmoot-Upstream-Cache'), 'MISS');
        assert.equal(response.headers.get('X-Cosmoot-Upstream-Age'), '73');
        assert.equal(response.status, 200);
        assert.deepEqual(
          new Uint8Array(await response.arrayBuffer()),
          method === 'HEAD' ? new Uint8Array() : staticAssets.get(`/${paths[0]}`)
        );
        assert.equal(calls.length, before + 1, `Must not follow HTTP ${status}`);
        assert.equal(calls.at(-1).url, `https://data.cosmoot.com/${paths[0]}`);
      }
    }
    // Exhaust the real release inventory, including the compressed dataset.
    // This covers success -> outage -> recovery in the same worker instance.
    mode = 503;
    for (const path of paths) {
      for (const method of ['GET', 'HEAD']) {
        const response = await request(origin, path, method);
        assert.equal(response.status, 200, `Fallback asset missing: ${path}`);
        assert.equal(response.headers.get('X-Cosmoot-Snapshot'), 'static-fallback');
        assert.equal(response.headers.get('Cache-Control'), 'no-cache');
        assert.deepEqual(
          new Uint8Array(await response.arrayBuffer()),
          method === 'HEAD' ? new Uint8Array() : staticAssets.get(`/${path}`)
        );
      }
    }
    mode = 200;
    for (const path of paths) {
      const response = await request(origin, path, 'GET');
      assert.equal(response.headers.get('X-Cosmoot-Snapshot'), 'server');
      assert.deepEqual(new Uint8Array(await response.arrayBuffer()), upstreamBytes);
    }
    const before = calls.length;
    for (const path of [
      'receipt.json',
      '.env',
      'faucet.sqlite',
      'data/private.sqlite',
      'data/unbekannt.json'
    ]) {
      const response = await request(origin, path, 'GET');
      assert.equal(response.status, 404);
      await response.arrayBuffer();
    }
    await (await request(origin, paths[0], 'POST')).arrayBuffer();
    assert.equal(calls.length, before, 'Private paths and writes must not contact the origin');
  }
  const chainResponse = await mf.dispatchFetch(
    'https://cosmoot.com/data/governance-read?' +
      new URLSearchParams({
        source: 'juno-polkachu',
        path: '/cosmos/gov/v1/params/deposit',
        height: '123'
      }),
    { headers: { Cookie: 'private=1', Authorization: 'Bearer private' } }
  );
  assert.equal(chainResponse.status, 200);
  assert.equal(chainResponse.headers.get('x-cosmos-block-height'), '123');
  assert.equal(chainResponse.headers.get('Cache-Control'), 'no-store');
  assert.equal(chainResponse.headers.get('Set-Cookie'), null);
  assert.deepEqual(await chainResponse.json(), { params: {} });
  assert.equal(calls.at(-1).cookie, false);
  assert.equal(calls.at(-1).authorization, false);
  for (const origin of ['https://cosmoot.com', 'https://dao.netareborn.com']) {
    const before = calls.length;
    const canonical = await mf.dispatchFetch(origin + '/demo', { redirect: 'manual' });
    assert.equal(canonical.status, 302);
    assert.equal(canonical.headers.get('Location'), '/demo/');
    assert.equal(calls.length, before);
    for (const path of [
      '/demo/',
      '/demo/fonts/manrope-400.woff',
      '/demo/api/governance?scope=gno&op=status'
    ]) {
      for (const method of ['GET', 'HEAD']) {
        const start = calls.length;
        const response = await mf.dispatchFetch(origin + path, {
          method,
          headers: { Cookie: 'private=1', Authorization: 'Bearer private' }
        });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('X-Cosmoot-Governance'), GOVERNANCE_DEMO_MARKER);
        assert.equal(response.headers.get('Set-Cookie'), null);
        assert.equal(response.headers.get('Location'), null);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.deepEqual(
          new Uint8Array(await response.arrayBuffer()),
          method === 'HEAD' ? new Uint8Array() : upstreamBytes
        );
        assert.deepEqual(calls.slice(start), [
          { url: GOVERNANCE_DEMO_ORIGIN + path, method, cookie: false, authorization: false }
        ]);
      }
    }
    const start = calls.length;
    assert.equal(
      (await mf.dispatchFetch(origin + '/demo/api/governance', { method: 'POST' })).status,
      405
    );
    assert.equal(calls.length, start);
    for (const rejected of ['redirect', 'login', 'offline']) {
      demoMode = rejected;
      const count = calls.length;
      const response = await mf.dispatchFetch(origin + '/demo/');
      assert.equal(response.status, 503);
      assert.match(await response.text(), /temporarily unavailable/);
      assert.equal(calls.length, count + 1, 'Demo redirects must never be followed');
    }
    demoMode = 'ready';
    assert.equal((await mf.dispatchFetch(origin + '/demo/')).status, 200);
  }
  console.log(
    `workerd passed: ${paths.length} snapshot paths and isolated /demo proxy on both domains; exact bytes, recovery, credential isolation and redirect/login/error rejection.`
  );
} finally {
  await mf.dispose();
}
