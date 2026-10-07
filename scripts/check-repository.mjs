import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
for (const path of files) {
  if (/\.(mjs|js)$/.test(path) && !path.startsWith('assets/'))
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
}
const manifest = JSON.parse(
  readFileSync('docs/deployments/personal-pilot-artifacts-2026-10-07.json')
);
for (const [path, expected] of Object.entries({
  ...manifest.artifacts,
  ...manifest.existingCryptoArtifacts
})) {
  const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (hash !== expected) throw Error(`Pilot manifest mismatch: ${path}`);
}
const contracts = JSON.parse(readFileSync('scripts/contracts.json'));
const tracked = files
  .filter((p) => /^contracts\/[^/]+\/Cargo.toml$/.test(p))
  .map((p) => p.split('/')[1])
  .sort();
if (JSON.stringify([...contracts].sort()) !== JSON.stringify(tracked))
  throw Error('Contract inventory is incomplete');
for (const contract of contracts)
  if (!existsSync(`contracts/${contract}/Cargo.lock`)) throw Error('Missing contract lockfile');
console.log('Executable syntax, pilot hashes and contract inventory verified.');
