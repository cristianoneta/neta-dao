// Host-independent static export. Only tracked, explicitly public files are copied.
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile, lstat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist/static');
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(Boolean);
const browserNames = new Set([
  'mainnet-artifacts.mjs', 'mainnet-config.mjs', 'mainnet-deploy.mjs',
  'mainnet-deploy-core.mjs', 'mainnet-setup.mjs', 'networks.mjs',
  'plan-core.mjs', 'price-key.mjs', 'snapshot-client.mjs', 'snapshot-deployment.mjs',
  'service/constants.mjs'
].map(name => `names/${name}`));
const manifests = new Set([
  'docs/deployments/nns-mainnet.json',
  'docs/deployments/nns-uni7-owner-2026-10-04.json'
]);
const browserSpikeModules = new Set([
  'browser-device-lock.mjs', 'browser-envelope.mjs', 'browser-key-vault.mjs',
  'browser-outbox.mjs', 'mailbox-transport.mjs'
].map(name => `spikes/relay-corecrypto/${name}`));
const publicSuffixes = new Set(['.html', '.css', '.js', '.mjs', '.ico']);
function isPublic(path) {
  if (path.split('/').some(part => part.startsWith('.'))) return false;
  if (!path.includes('/')) return publicSuffixes.has(extname(path));
  if (browserNames.has(path) || manifests.has(path) || browserSpikeModules.has(path)) return true;
  if (path.startsWith('assets/'))
    return ['.js', '.wasm', '.sha256', '.png', '.webp', '.svg', '.ico'].includes(extname(path))
      || /\/(LICENSE|SHA256SUMS)$/.test(path);
  if (path.startsWith('data/')) return ['.json', '.gz'].includes(extname(path));
  if (path.startsWith('community-tools/')) return publicSuffixes.has(extname(path));
  return path.startsWith('src/') && ['.js', '.mjs'].includes(extname(path));
}
const selected = files.filter(isPublic).sort();
if (!selected.includes('index.html')) throw Error('No tracked public entry point');
// Validate before deleting the previous generated output. Never follow source symlinks.
for (const path of selected) {
  const stat = await lstat(resolve(root, path));
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error(`Not a regular public file: ${path}`);
  if (stat.size > 25 * 1024 * 1024) throw Error(`Pages asset exceeds 25 MiB: ${path}`);
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const hashes = {};
for (const path of selected) {
  await mkdir(dirname(resolve(output, path)), { recursive: true });
  await cp(resolve(root, path), resolve(output, path));
  hashes[path] = createHash('sha256').update(await readFile(resolve(output, path))).digest('hex');
}
// Preserve the application's existing CSP. This additional policy prevents foreign
// framing while allowing the existing same-origin encryption runtime iframe.
await cp(resolve(root, 'deploy/cosmoot/pages-headers'), resolve(output, '_headers'));
hashes._headers = createHash('sha256').update(await readFile(resolve(output, '_headers'))).digest('hex');
await writeFile(resolve(root, 'dist/static-manifest.json'), JSON.stringify({
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTree: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()
    ? 'modified' : 'clean',
  files: hashes
}, null, 2) + '\n');
console.log(`Exported ${Object.keys(hashes).length} public files to dist/static; no backend data or credentials.`);
