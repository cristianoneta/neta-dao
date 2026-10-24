// Real pinned Caddy, loopback-only listeners and synthetic requests. No production state.
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clientThrottle } from '../service/http-guards.mjs';

const image = process.argv[2];
assert.match(image || '', /^caddy@sha256:[a-f0-9]{64}$/);
const directory = await mkdtemp(join(tmpdir(), 'cosmoot-proxy-ci-'));
const name = `cosmoot-proxy-ci-${process.pid}`;
const admit = clientThrottle({ maximum: 2, trustedProxies: ['127.0.0.1'] });
const backend = http.createServer((req, res) => {
  if (req.url === '/ready') return res.writeHead(204).end();
  res.writeHead(admit(req) ? 200 : 429).end();
});
const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const get = (port, source, headers = {}, path = '/') =>
  new Promise((resolve, reject) => {
    const request = http.get(
      { host: '127.0.0.1', port, path, localAddress: source, headers, agent: false },
      (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      }
    );
    request.setTimeout(2000, () => request.destroy(Error('Proxy request timed out')));
    request.on('error', reject);
  });
let child,
  logs = '';
try {
  await listen(backend);
  const reservation = http.createServer();
  await listen(reservation);
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const config = (await readFile('deploy/cosmoot/Caddyfile', 'utf8'))
    .replace('import /etc/caddy/Caddyfile.snapshots', '')
    .replace('api.cosmoot.com', `http://127.0.0.1:${port}`)
    .replace('backend:8787', `127.0.0.1:${backend.address().port}`);
  await writeFile(join(directory, 'Caddyfile'), `{\n  admin off\n}\n${config}`);
  child = spawn(
    'docker',
    [
      'run',
      '--rm',
      '--name',
      name,
      '--network',
      'host',
      '--entrypoint',
      'caddy',
      '-v',
      `${directory}:/etc/caddy:ro`,
      image,
      'run',
      '--config',
      '/etc/caddy/Caddyfile'
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  child.stdout.on('data', (data) => {
    logs = (logs + data).slice(-4000);
  });
  child.stderr.on('data', (data) => {
    logs = (logs + data).slice(-4000);
  });
  child.on('error', (error) => {
    logs = error.message;
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      ready = (await get(port, '127.0.0.1', {}, '/ready')) === 204;
    } catch {
      /* Wait for the isolated proxy. */
    }
    if (ready || child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Isolated Caddy did not start: ${logs}`);
  assert.equal(await get(port, '127.0.0.2'), 200);
  assert.equal(await get(port, '127.0.0.2'), 200);
  assert.equal(
    await get(port, '127.0.0.2', {
      'x-cosmoot-client-ip': '127.0.0.3',
      'x-forwarded-for': '127.0.0.3'
    }),
    429
  );
  assert.equal(
    await get(port, '127.0.0.3'),
    200,
    'Different visitors retain independent limits through the real proxy'
  );
  console.log('Pinned Caddy separates visitor limits and overwrites untrusted client headers.');
} finally {
  if (child) {
    try {
      execFileSync('docker', ['rm', '--force', name], { stdio: 'pipe' });
    } catch {}
    child.kill();
  }
  backend.closeAllConnections();
  await new Promise((resolve) => backend.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
