import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { advisory, target, assertReviewedScope, assertWasmTree } from './contract-audit-scope.mjs';
const contracts = JSON.parse(readFileSync(new URL('./contracts.json', import.meta.url)));
const mode = process.argv[2];
if (!['fmt', 'test', 'clippy', 'audit'].includes(mode))
  throw Error('Choose fmt, test, clippy or audit');
if (mode === 'audit') {
  const policy = JSON.parse(readFileSync(new URL('./contract-audit-policy.json', import.meta.url)));
  assertReviewedScope(process.cwd(), contracts, policy);
  // Check every contract before granting the single additional advisory exception.
  for (const contract of contracts) {
    const result = spawnSync(
      'cargo',
      [
        'tree',
        '--locked',
        '--target',
        target,
        '--edges',
        'normal,build',
        '--prefix',
        'none',
        '--format',
        '{p}',
        '--manifest-path',
        `contracts/${contract}/Cargo.toml`
      ],
      { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.stderr.write(result.stderr || 'Dependency resolution failed\n');
      process.exit(result.status || 1);
    }
    assertWasmTree(contract, result.stdout);
    console.log(
      `${contract}: locked WASM normal/build graph excludes the reviewed crypto packages.`
    );
  }
  console.warn(
    `${advisory}: host/test-only applicability exception; crypto-bigint 0.5.5 remains unpatched. Expires ${policy.expiresAt}. See docs/SECURITY_REVIEW_2026-10-24.md.`
  );
}
for (const contract of contracts) {
  const manifest = `contracts/${contract}/Cargo.toml`;
  const command =
    mode === 'audit' ? process.env.CARGO_AUDIT || '.ci-tools/cargo-audit/bin/cargo-audit' : 'cargo';
  const args =
    mode === 'audit'
      ? [
          'audit',
          '--file',
          `contracts/${contract}/Cargo.lock`,
          '--ignore',
          'RUSTSEC-2024-0344',
          '--ignore',
          advisory
        ]
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
  // The inherited dalek exception is unchanged. The new exception requires the guards above.
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
