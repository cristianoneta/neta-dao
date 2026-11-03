import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('malformed HTTP targets are rejected without terminating the discussion process', () => {
  // Use a child process so an uncaught async handler rejection really fails the
  // test. fetch() would normalize this target before it reaches the service.
  const script = `
    import assert from 'node:assert/strict';
    import http from 'node:http';
    import { once } from 'node:events';
    import { discussionServer } from ${JSON.stringify(new URL('../server.mjs', import.meta.url).href)};
    const server = discussionServer({
      store: { health: () => [] }, chain: {}, origins: ['https://cosmoot.com']
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const request = (path) => new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port: server.address().port, path }, res => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      }).on('error', reject);
    });
    try {
      assert.equal(await request('//['), 400);
      assert.equal(await request('/health'), 200);
      assert.equal(await request('/discussions/health'), 200);
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  `;
  const result = spawnSync(
    process.execPath,
    ['--unhandled-rejections=strict', '--input-type=module', '-e', script],
    {
      encoding: 'utf8',
      timeout: 10000
    }
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});
