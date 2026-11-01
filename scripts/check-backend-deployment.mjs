// Requires Docker Compose. Uses public templates only; never reads operator env/secrets.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../deploy/cosmoot/', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'cosmoot-compose-ci-'));
try {
  for (const file of ['compose.yaml', 'compose.snapshots.yaml', 'Caddyfile', 'Caddyfile.snapshots'])
    await copyFile(join(source, file), join(directory, file));
  await copyFile(join(source, 'cosmoot.env.example'), join(directory, 'cosmoot.env'));
  const config = (file) =>
    JSON.parse(
      execFileSync(
        'docker',
        [
          'compose',
          '--profile',
          'backend',
          '-f',
          join(directory, file),
          'config',
          '--format',
          'json'
        ],
        { encoding: 'utf8', env: { PATH: process.env.PATH } }
      )
    );
  await copyFile(
    join(source, 'compose.discussions.yaml'),
    join(directory, 'compose.discussions.yaml')
  );
  await copyFile(join(source, 'discussions.env.example'), join(directory, 'discussions.env'));
  const withDiscussions = JSON.parse(
    execFileSync(
      'docker',
      [
        'compose',
        '--profile',
        'backend',
        '--profile',
        'discussions',
        '-f',
        join(directory, 'compose.yaml'),
        '-f',
        join(directory, 'compose.discussions.yaml'),
        'config',
        '--format',
        'json'
      ],
      { encoding: 'utf8', env: { PATH: process.env.PATH } }
    )
  );
  const combined = config('compose.yaml'),
    snapshots = config('compose.snapshots.yaml');
  const edge = combined.services.edge,
    previous = snapshots.services.edge;
  assert.equal(
    combined.name,
    snapshots.name,
    'Preserve the Compose project and certificate volumes'
  );
  assert.equal(edge.image, previous.image, 'Use the previously pinned data-edge image');
  assert.match(edge.image, /@sha256:[0-9a-f]{64}$/);
  assert.ok(!edge.depends_on, 'Public data must survive backend downtime');
  for (const target of ['/snapshots', '/data', '/config']) {
    const next = edge.volumes.find((v) => v.target === target),
      old = previous.volumes.find((v) => v.target === target);
    assert.ok(next && old);
    assert.equal(next.source, old.source);
    assert.equal(next.type, old.type);
    if (target === '/snapshots') {
      assert.equal(next.read_only, true);
      // Compose's normalized JSON omits false-valued fields.
      assert.notEqual(next.bind?.create_host_path, true);
    }
  }
  assert.deepEqual(
    withDiscussions.services.edge,
    combined.services.edge,
    'Optional discussion service must preserve the edge'
  );
  assert.deepEqual(
    withDiscussions.services.backend,
    combined.services.backend,
    'Optional discussion service must preserve the existing backend'
  );
  const discussions = withDiscussions.services.discussions;
  assert.equal(discussions.ports, undefined);
  assert.equal(discussions.secrets, undefined, 'No faucet key or message-backup secret');
  assert.deepEqual(Object.keys(discussions.networks), ['api']);
  assert.equal(discussions.environment.COSMOOT_TRUSTED_PROXY_IPS, edge.networks.api.ipv4_address);
  assert.equal(discussions.read_only, true);
  assert.deepEqual(discussions.cap_drop, ['ALL']);
  assert.deepEqual(discussions.tmpfs, ['/tmp:size=16m,mode=1777']);
  assert.equal(discussions.volumes.length, 1);
  assert.equal(discussions.volumes[0].target, '/data');
  assert.notEqual(discussions.volumes[0].source, combined.services.backend.volumes[0].source);
  assert.notEqual(discussions.volumes[0].bind?.create_host_path, true);
  assert.equal(combined.services.backend.ports, undefined, 'Expose the API through the edge only');
  assert.equal(
    combined.services.backend.environment.COSMOOT_TRUSTED_PROXY_IPS,
    edge.networks.api.ipv4_address,
    'Only the edge address on the dedicated API network may identify visitors'
  );
  assert.deepEqual(Object.keys(combined.services.backend.networks), ['api']);
  assert.equal(combined.networks.api.ipam.config[0].subnet, '172.30.87.0/29');
  assert.equal(combined.services.backend.environment.FAUCET_PAUSED, 'true');
  assert.equal(combined.services.backend.environment.RELAY_BACKUP_ENABLED, 'false');
  assert.deepEqual(combined.services.backend.cap_drop, ['ALL']);
  // A comma in an unquoted YAML flow item becomes a second, invalid mount.
  const backendTmpfs = combined.services.backend.tmpfs;
  assert.deepEqual(
    backendTmpfs,
    ['/tmp:size=16m,mode=1777'],
    'Keep backend tmpfs options in one absolute mount specification'
  );
  execFileSync(
    'docker',
    [
      'run',
      '--rm',
      '--entrypoint',
      'caddy',
      '-v',
      `${directory}:/etc/caddy:ro`,
      edge.image,
      'validate',
      '--config',
      '/etc/caddy/Caddyfile'
    ],
    { stdio: 'inherit' }
  );
  const original = await readFile(join(source, 'Caddyfile'), 'utf8');
  const proxy =
    '    reverse_proxy backend:8787 {\n        header_up X-Cosmoot-Client-IP {remote_host}\n    }';
  assert.ok(
    original.includes(proxy),
    'Review the discussion route when the base Caddy template changes'
  );
  const fragment = await readFile(join(source, 'Caddyfile.discussions.example'), 'utf8');
  await writeFile(
    join(directory, 'Caddyfile.discussions'),
    original.replace(proxy, fragment + '\n    handle {\n' + proxy + '\n    }')
  );
  execFileSync(
    'docker',
    [
      'run',
      '--rm',
      '--entrypoint',
      'caddy',
      '-v',
      `${directory}:/etc/caddy:ro`,
      edge.image,
      'validate',
      '--config',
      '/etc/caddy/Caddyfile.discussions'
    ],
    { stdio: 'inherit' }
  );
  // Validate mounts with Docker itself; Compose config alone accepts relative targets.
  execFileSync(
    'docker',
    [
      'run',
      '--rm',
      '--network',
      'none',
      '--read-only',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--entrypoint',
      '/bin/true',
      ...backendTmpfs.flatMap((mount) => ['--tmpfs', mount]),
      edge.image
    ],
    { stdio: 'inherit' }
  );
  execFileSync(process.execPath, ['scripts/check-proxy-admission.mjs', edge.image], {
    stdio: 'inherit'
  });
  console.log('Combined edge configuration preserves public data and certificate storage.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
