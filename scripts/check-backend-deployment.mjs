// Requires Docker Compose. Uses public templates only; never reads operator env/secrets.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../deploy/cosmoot/', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'cosmoot-compose-ci-'));
try {
  for (const file of ['compose.yaml', 'compose.snapshots.yaml', 'Caddyfile', 'Caddyfile.snapshots'])
    await copyFile(join(source, file), join(directory, file));
  await copyFile(join(source, 'cosmoot.env.example'), join(directory, 'cosmoot.env'));
  const config = file => JSON.parse(execFileSync('docker', ['compose', '--profile', 'backend', '-f',
    join(directory, file), 'config', '--format', 'json'], { encoding: 'utf8', env: { PATH: process.env.PATH } }));
  const combined = config('compose.yaml'), snapshots = config('compose.snapshots.yaml');
  const edge = combined.services.edge, previous = snapshots.services.edge;
  assert.equal(combined.name, snapshots.name, 'Preserve the Compose project and certificate volumes');
  assert.equal(edge.image, previous.image, 'Use the previously pinned data-edge image');
  assert.match(edge.image, /@sha256:[0-9a-f]{64}$/);
  assert.ok(!edge.depends_on, 'Public data must survive backend downtime');
  for (const target of ['/snapshots', '/data', '/config']) {
    const next = edge.volumes.find(v => v.target === target), old = previous.volumes.find(v => v.target === target);
    assert.ok(next && old);
    assert.equal(next.source, old.source);
    assert.equal(next.type, old.type);
    if (target === '/snapshots') {
      assert.equal(next.read_only, true);
      assert.equal(next.bind.create_host_path, false);
    }
  }
  assert.equal(combined.services.backend.ports, undefined, 'Expose the API through the edge only');
  assert.equal(combined.services.backend.environment.FAUCET_PAUSED, 'true');
  assert.equal(combined.services.backend.environment.RELAY_BACKUP_ENABLED, 'false');
  assert.deepEqual(combined.services.backend.cap_drop, ['ALL']);
  execFileSync('docker', ['run', '--rm', '--entrypoint', 'caddy', '-v', `${directory}:/etc/caddy:ro`,
    edge.image, 'validate', '--config', '/etc/caddy/Caddyfile'], { stdio: 'inherit' });
  console.log('Combined edge configuration preserves public data and certificate storage.');
} finally { await rm(directory, { recursive: true, force: true }); }
