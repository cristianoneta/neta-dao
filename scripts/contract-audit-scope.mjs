import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// This is an applicability assessment, not a patch to crypto-bigint.
// See docs/SECURITY_REVIEW_2026-10-24.md before changing the reviewed inputs.
export const advisory = 'RUSTSEC-2026-0387';
export const target = 'wasm32-unknown-unknown';

export function contractInputsDigest(root) {
  const paths = [];
  function visit(relative) {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      if (entry.name === 'target') continue;
      const path = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) throw Error(`Unreviewed contract symlink: ${path}`);
      if (entry.isDirectory()) visit(path);
      else if (/\.(rs|toml)$/.test(path) || entry.name === 'Cargo.lock') paths.push(path);
    }
  }
  visit('contracts');
  paths.push('rust-toolchain.toml', '.cargo/config.toml', 'scripts/build-wasm.sh');
  const hash = createHash('sha256');
  for (const path of paths.sort())
    hash
      .update(path)
      .update('\0')
      .update(readFileSync(join(root, path)))
      .update('\0');
  return hash.digest('hex');
}

export function assertReviewedScope(root, contracts, policy, now = new Date()) {
  const expires = Date.parse(policy.expiresAt);
  if (!Number.isFinite(expires) || !Number.isFinite(now.getTime()) || now.getTime() >= expires)
    throw Error(`${advisory}: applicability review expired; reassess before release`);
  const inventory = readdirSync(join(root, 'contracts'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (
    JSON.stringify(inventory) !== JSON.stringify([...contracts].sort()) ||
    JSON.stringify(inventory) !== JSON.stringify([...policy.contracts].sort())
  )
    throw Error(`${advisory}: contract inventory changed; reassessment required`);
  if (contractInputsDigest(root) !== policy.inputsSha256)
    throw Error(`${advisory}: reviewed Rust inputs changed; reassessment required`);
}

export function assertWasmTree(contract, output) {
  const lines = output.trim().split(/\r?\n/);
  if (
    !lines[0]?.startsWith(`${contract} v`) ||
    !lines.some((line) => /^cosmwasm-std v1\.5\.11(?: |$)/.test(line)) ||
    lines.some((line) => !/^[a-zA-Z0-9_-]+ v\d+\.\d+\.\d+(?:[ +(-]|$)/.test(line))
  )
    throw Error(`${contract}: missing or malformed ${target} dependency evidence`);
  if (lines.some((line) => /^(crypto-bigint|cosmwasm-crypto|k256|elliptic-curve) v/.test(line)))
    throw Error(`${contract}: cryptographic dependency entered the WASM build; exception denied`);
}
