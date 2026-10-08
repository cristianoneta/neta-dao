import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../service/server.mjs', import.meta.url));
test('maintenance rejects all API work without opening state or loading a signing identity', { timeout: 15000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cosmoot-maintenance-test-'));
  const original = Buffer.from('synthetic state must remain untouched');
  const database = join(directory, 'faucet.sqlite');
  await writeFile(database, original);
  const child = spawn(process.execPath, [entry], {
    cwd: directory,
    env: { PATH: process.env.PATH, COSMOOT_MAINTENANCE: 'true', HOST: '127.0.0.1', PORT: '0',
      FAUCET_ADDRESS: 'invalid-on-purpose', FAUCET_DB: database,
      FAUCET_MNEMONIC_FILE: join(directory, 'missing-key'),
      RELAY_BACKUP_ENABLED: 'true', RELAY_BACKUP_DIRECTORY: join(directory, 'missing-backups') },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const stopped = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  try {
    const port = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(Error('Maintenance readiness timed out')), 5000);
      child.stdout.on('data', data => {
        output += data;
        const match = output.match(/no signing or database access; port (\d+)/);
        if (match) { clearTimeout(timer); resolve(Number(match[1])); }
      });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(Error('Maintenance exited before readiness')); });
    });
    for (const [method, path] of [['GET', '/health'], ['GET', '/status'], ['POST', '/claim'],
      ['POST', '/v1/challenge'], ['PUT', '/v1/backup'], ['OPTIONS', '/v1/backup']]) {
      const response = await fetch('http://127.0.0.1:' + port + path, {
        method, signal: AbortSignal.timeout(2000),
        headers: { origin: 'https://operator.example', 'content-type': 'application/json' },
        ...(['POST', 'PUT'].includes(method) ? { body: '{}' } : {})
      });
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('x-cosmoot-maintenance'), 'true');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), { ok: false, maintenance: true });
    }
    assert.deepEqual(await readFile(database), original);
    assert.deepEqual(await readdir(directory), ['faucet.sqlite']);
    child.kill('SIGTERM');
    assert.deepEqual(await stopped, { code: 0, signal: null });
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await stopped;
    await rm(directory, { recursive: true, force: true });
  }
});

test('ambiguous maintenance flags fail closed before active startup', () => {
  for (const value of ['TRUE', '1', '']) {
    const result = spawnSync(process.execPath, [entry], {
      env: { PATH: process.env.PATH, COSMOOT_MAINTENANCE: value }, encoding: 'utf8', timeout: 3000
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /COSMOOT_MAINTENANCE must be true or false/);
  }
});
