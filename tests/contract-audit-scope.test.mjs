import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertReviewedScope,
  assertWasmTree,
  contractInputsDigest
} from '../scripts/contract-audit-scope.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const contracts = JSON.parse(readFileSync(join(root, 'scripts/contracts.json')));
const policy = JSON.parse(readFileSync(join(root, 'scripts/contract-audit-policy.json')));
const reviewDate = new Date('2026-10-24T12:00:00Z');

test('the reviewed repository inputs match the bounded applicability assessment', () => {
  assertReviewedScope(root, contracts, policy, reviewDate);
});

test('expiry, invalid clocks and incomplete inventories cannot authorize an exception', () => {
  for (const date of [policy.expiresAt, '2027-01-01', 'invalid'])
    assert.throws(() => assertReviewedScope(root, contracts, policy, new Date(date)), /expired/);
  assert.throws(
    () => assertReviewedScope(root, contracts.slice(1), policy, reviewDate),
    /inventory/
  );
  assert.throws(
    () => assertReviewedScope(root, contracts, { ...policy, contracts: [] }, reviewDate),
    /inventory/
  );
});

test('changed source, lockfiles, build configuration and symlinks invalidate the review', (t) => {
  const copy = mkdtempSync(join(tmpdir(), 'contract-audit-'));
  t.after(() => rmSync(copy, { recursive: true, force: true }));
  cpSync(join(root, 'contracts'), join(copy, 'contracts'), {
    recursive: true,
    filter: (path) => !path.split('/').includes('target')
  });
  for (const path of ['rust-toolchain.toml', '.cargo/config.toml', 'scripts/build-wasm.sh']) {
    mkdirSync(join(copy, path, '..'), { recursive: true });
    cpSync(join(root, path), join(copy, path));
  }
  assertReviewedScope(copy, contracts, policy, reviewDate);
  for (const path of [
    'contracts/neta-validator-profiles/src/tests.rs',
    'contracts/neta-proposal-workshop/Cargo.lock',
    'contracts/neta-proposal-workshop/Cargo.toml',
    '.cargo/config.toml',
    'scripts/build-wasm.sh'
  ]) {
    const original = readFileSync(join(copy, path));
    writeFileSync(join(copy, path), Buffer.concat([original, Buffer.from('\n// changed\n')]));
    assert.throws(() => assertReviewedScope(copy, contracts, policy, reviewDate), /inputs changed/);
    writeFileSync(join(copy, path), original);
  }
  writeFileSync(join(copy, 'contracts/neta-proposal-workshop/build.rs'), 'fn main() {}');
  assert.throws(() => assertReviewedScope(copy, contracts, policy, reviewDate), /inputs changed/);
  rmSync(join(copy, 'contracts/neta-proposal-workshop/build.rs'));
  symlinkSync('src/lib.rs', join(copy, 'contracts/neta-proposal-workshop/linked.rs'));
  assert.throws(() => contractInputsDigest(copy), /symlink/);
});

const wasmTree =
  'neta-proposal-workshop v0.3.1 (/repo/contracts/neta-proposal-workshop)\ncosmwasm-std v1.5.11\nserde v1.0.229\nserde_derive v1.0.229 (proc-macro)\nserde v1.0.229 (*)\n';
test('normal and build dependencies must exclude every reviewed crypto package', () => {
  assertWasmTree('neta-proposal-workshop', wasmTree);
  for (const dependency of [
    'crypto-bigint v0.5.5',
    'crypto-bigint v0.7.6',
    'cosmwasm-crypto v1.5.11',
    'k256 v0.13.4',
    'elliptic-curve v0.13.8'
  ])
    assert.throws(
      () => assertWasmTree('neta-proposal-workshop', wasmTree + dependency + '\n'),
      /exception denied/
    );
});

test('empty, incomplete, different-contract and malformed Cargo evidence fails closed', () => {
  for (const output of [
    '',
    'neta-proposal-workshop v0.3.1\n',
    wasmTree.replace('neta-proposal-workshop', 'other'),
    wasmTree + 'error: resolver failed\n'
  ])
    assert.throws(() => assertWasmTree('neta-proposal-workshop', output), /dependency evidence/);
});
