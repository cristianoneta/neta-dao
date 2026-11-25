import test from 'node:test';
import assert from 'node:assert/strict';
import {
  governanceDemoProxy,
  GOVERNANCE_DEMO_ORIGIN,
  GOVERNANCE_DEMO_MARKER
} from '../deploy/cosmoot/governance-demo-proxy.mjs';

const request = (path, method = 'GET') =>
  new Request('https://cosmoot.com' + path, {
    method,
    headers: {
      Cookie: 'session=private',
      Authorization: 'Bearer private',
      Referer: 'https://private.invalid/'
    }
  });
const upstream = (body = 'independent app', options = {}) =>
  new Response(body, {
    ...options,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Cosmoot-Governance': GOVERNANCE_DEMO_MARKER,
      ...options.headers
    }
  });
test('only the demo path reaches the fixed upstream, without credentials or caller-controlled origins', async () => {
  let calls = 0;
  const result = await governanceDemoProxy(
    request('/demo/api/governance?scope=gno&op=status&url=https://evil.invalid'),
    async (url, options) => {
      calls++;
      assert.equal(new URL(url).origin, GOVERNANCE_DEMO_ORIGIN);
      assert.equal(new URL(url).pathname, '/demo/api/governance');
      assert.equal(new URL(url).searchParams.get('scope'), 'gno');
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'manual');
      assert.deepEqual(options.headers, { Accept: '*/*' });
      assert.equal(options.signal instanceof AbortSignal, true);
      assert.deepEqual(options.cf, { cacheEverything: false, cacheTtl: 0 });
      return upstream('{"result":1}', {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'private=1',
          'X-Private': 'omit',
          Location: 'https://evil.invalid'
        }
      });
    }
  );
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('Content-Type'), 'application/json');
  assert.equal(result.headers.get('Set-Cookie'), null);
  assert.equal(result.headers.get('X-Private'), null);
  assert.equal(result.headers.get('Location'), null);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.equal(result.headers.get('X-Frame-Options'), 'SAMEORIGIN');
  assert.equal(result.headers.get('X-Cosmoot-Governance'), GOVERNANCE_DEMO_MARKER);
  assert.deepEqual(await result.json(), { result: 1 });
  for (const path of ['/', '/democracy/', '/data/main.json', '/demo/../outside'])
    assert.equal(
      await governanceDemoProxy(request(path), () => {
        calls++;
      }),
      null
    );
  for (const path of ['/demo//evil', '/demo/%2f%2fevil', '/demo/%61pp.mjs'])
    assert.equal(
      (
        await governanceDemoProxy(request(path), () => {
          calls++;
        })
      ).status,
      404
    );
  assert.equal(calls, 1);
});
test('canonical demo redirect stays on the current origin and writes never reach the upstream', async () => {
  let calls = 0;
  const fetcher = () => {
    calls++;
    throw Error('must not fetch');
  };
  for (const method of ['GET', 'HEAD']) {
    const response = await governanceDemoProxy(request('/demo?view=1', method), fetcher);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), '/demo/?view=1');
    assert.equal(await response.text(), '');
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const response = await governanceDemoProxy(request('/demo/api/governance', method), fetcher);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'GET, HEAD');
  }
  assert.equal(
    (await governanceDemoProxy(request('/demo/?q=' + 'x'.repeat(4094)), fetcher)).status,
    400
  );
  assert.equal(calls, 0);
});
test('missing markers, login HTML, redirects, failed reads and upstream errors become clear 503 responses', async () => {
  for (const fetcher of [
    async () => new Response('<html>Sign in</html>'),
    async () => upstream('login', { headers: { 'X-Cosmoot-Governance': 'other' } }),
    ...[301, 302, 303, 307, 308, 401, 403, 500, 503].map(
      (status) => async () =>
        upstream(null, { status, headers: { Location: 'https://login.invalid/' } })
    ),
    async () => {
      throw Error('timeout');
    }
  ]) {
    const response = await governanceDemoProxy(request('/demo/'), fetcher);
    assert.equal(response.status, 503);
    assert.match(await response.text(), /temporarily unavailable/);
    assert.equal(response.headers.get('Location'), null);
    assert.equal(response.headers.get('X-Cosmoot-Governance'), null);
  }
});
test('body bounds apply to declared and streamed bytes, and legitimate API errors retain status', async () => {
  for (const response of [
    upstream('small', { headers: { 'Content-Length': String(4 * 1024 * 1024 + 1) } }),
    upstream(new Uint8Array(4 * 1024 * 1024 + 1)),
    upstream(
      new ReadableStream({
        start(controller) {
          controller.error(Error('stream stopped'));
        }
      })
    )
  ])
    assert.equal(
      (await governanceDemoProxy(request('/demo/app.mjs'), async () => response)).status,
      503
    );
  for (const status of [400, 404, 405, 429]) {
    const response = await governanceDemoProxy(request('/demo/api/governance'), async () =>
      upstream('{"error":"invalid read"}', {
        status,
        headers: { 'Content-Type': 'application/json', Allow: 'GET' }
      })
    );
    assert.equal(response.status, status);
    if (status === 405) assert.equal(response.headers.get('Allow'), 'GET');
    assert.deepEqual(await response.json(), { error: 'invalid read' });
  }
});
test('HEAD preserves validated metadata and binary GET bytes remain exact', async () => {
  const bytes = new Uint8Array([0, 255, 31, 139, 128]);
  for (const method of ['GET', 'HEAD']) {
    const response = await governanceDemoProxy(
      request('/demo/fonts/manrope-400.woff', method),
      async (_, options) => {
        assert.equal(options.method, method);
        return upstream(method === 'HEAD' ? null : bytes, {
          headers: { 'Content-Type': 'font/woff' }
        });
      }
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'font/woff');
    assert.deepEqual(
      new Uint8Array(await response.arrayBuffer()),
      method === 'HEAD' ? new Uint8Array() : bytes
    );
  }
});
