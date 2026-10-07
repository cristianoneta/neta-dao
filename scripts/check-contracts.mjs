import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const contracts = JSON.parse(readFileSync(new URL('./contracts.json', import.meta.url)));
const mode = process.argv[2];
if (!['fmt', 'test', 'clippy', 'audit'].includes(mode))
  throw Error('Choose fmt, test, clippy or audit');
for (const contract of contracts) {
  const manifest = `contracts/${contract}/Cargo.toml`;
  const command =
    mode === 'audit' ? process.env.CARGO_AUDIT || '.ci-tools/cargo-audit/bin/cargo-audit' : 'cargo';
  const args =
    mode === 'audit'
      ? ['audit', '--file', `contracts/${contract}/Cargo.lock`, '--ignore', 'RUSTSEC-2024-0344']
      : mode === 'fmt'
        ? ['fmt', '--manifest-path', manifest, '--check']
        : [
            mode,
            '--locked',
            ...(mode === 'clippy' ? ['--all-targets'] : []),
            '--manifest-path',
            manifest,
            ...(mode === 'clippy' ? ['--', '-D', 'warnings'] : [])
          ];
  // RUSTSEC exception is unchanged: see docs/DEPENDENCIES.md, host-only CosmWasm crypto.
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
