import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { clientThrottle } from '../service/http-guards.mjs';
import { normalizeAddress, trustedProxyAddresses } from '../service/client-address.mjs';

const request = (peer, client) => ({
  socket: { remoteAddress: peer },
  headers: { 'x-cosmoot-client-ip': client }
});

test('trusted proxy admission separates visitors and retains limits, expiry and capacity', () => {
  let now = 0;
  const admit = clientThrottle({
    trustedProxies: ['172.30.87.2'],
    maximum: 2,
    capacity: 2,
    now: () => now
  });
  const a = request('::ffff:172.30.87.2', '198.51.100.1'),
    b = request('172.30.87.2', '2001:db8::1');
  assert.equal(admit(a), true);
  assert.equal(admit(a), true);
  assert.equal(admit(a), false);
  assert.equal(admit(b), true, 'another visitor has an independent allowance');
  assert.equal(admit(request('172.30.87.2', '203.0.113.3')), false, 'bounded counter storage');
  now = 60000;
  assert.equal(admit(a), true);
});

test('untrusted peers cannot rotate headers to bypass admission; malformed trusted headers fail closed', () => {
  const admit = clientThrottle({ trustedProxies: ['172.30.87.2'], maximum: 1 });
  assert.equal(admit(request('192.0.2.1', '198.51.100.1')), true);
  assert.equal(admit(request('192.0.2.1', '198.51.100.2')), false);
  for (const header of [
    undefined,
    '',
    'unknown',
    '198.51.100.1, 198.51.100.2',
    ['198.51.100.1'],
    'fe80::1%eth0'
  ])
    assert.equal(admit(request('172.30.87.2', header)), false);
  assert.deepEqual(trustedProxyAddresses('127.0.0.1, ::1'), ['127.0.0.1', '::1']);
  for (const value of ['*', '0.0.0.0/0', 'edge', '127.0.0.1,'])
    assert.throws(() => trustedProxyAddresses(value));
  assert.equal(normalizeAddress('::FFFF:C000:201'), '192.0.2.1');
  assert.equal(normalizeAddress('2001:0db8:0:0:0:0:0:1'), '2001:db8::1');
});

async function listen(t, server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      })
  );
  return server.address().port;
}

function get(port, localAddress, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { host: '127.0.0.1', port, localAddress, headers, agent: false },
      (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      }
    );
    req.on('error', reject);
  });
}

test('HTTP proxy preserves independent client limits and overwrites spoofed client headers', async (t) => {
  const admit = clientThrottle({ maximum: 2, trustedProxies: ['127.0.0.1'] });
  const backendPort = await listen(
    t,
    http.createServer((req, res) => {
      res.writeHead(admit(req) ? 200 : 429).end();
    })
  );
  const edgePort = await listen(
    t,
    http.createServer((req, res) => {
      const upstream = http.request(
        {
          host: '127.0.0.1',
          port: backendPort,
          headers: {
            ...req.headers,
            'x-cosmoot-client-ip': req.socket.remoteAddress
          }
        },
        (response) => {
          res.writeHead(response.statusCode);
          response.pipe(res);
        }
      );
      upstream.on('error', () => res.writeHead(502).end());
      req.pipe(upstream);
    })
  );
  assert.equal(await get(edgePort, '127.0.0.2'), 200);
  assert.equal(await get(edgePort, '127.0.0.2'), 200);
  assert.equal(await get(edgePort, '127.0.0.2', { 'x-cosmoot-client-ip': '127.0.0.3' }), 429);
  assert.equal(await get(edgePort, '127.0.0.3'), 200);
  assert.equal(
    await get(backendPort, '127.0.0.1'),
    429,
    'trusted edge must supply a valid address'
  );
});
