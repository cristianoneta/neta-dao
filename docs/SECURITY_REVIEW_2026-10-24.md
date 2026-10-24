# crypto-bigint applicability review — 24 October 2026

## Finding and scope

Manual release [40073942022](https://github.com/cristianoneta/neta-dao/actions/runs/40073942022)
of source `789aa2195a42a68b181e73a5ba9ca6373a349863` stopped at the contract
dependency audit. No publication occurred. RustSec advisory
[RUSTSEC-2026-0387](https://rustsec.org/advisories/RUSTSEC-2026-0387.html)
describes secret-dependent timing in big-integer operations. Exploitability
requires affected operations on secret values and an observable side channel.
The upstream patched range is >=0.7.6. Our 0.5.5 dependency remains unpatched.

All seven contract lockfiles contain the same path: cosmwasm-std 1.5.11,
cosmwasm-crypto 1.5.11, k256 0.13.4, elliptic-curve 0.13.8, crypto-bigint 0.5.5.
The profiles contract additionally uses k256 as a dev-dependency. This assessment
covers these repository contracts and their local/CI tests. It does not certify
Juno validator/node binaries, external wallets or unrelated cryptographic packages.

## Why the shipped contract path is not affected by this finding

- CosmWasm 1.5.11 declares cosmwasm-crypto under
  `cfg(not(target_arch = "wasm32"))`, not its WASM dependencies. The seven locked
  `wasm32-unknown-unknown` normal/build graphs are checked before every audit.
  crypto-bigint, cosmwasm-crypto, k256 and elliptic-curve must all be absent.
- Native CosmWasm mocks verify signatures/recover public keys using public inputs.
  In our Rust source, direct k256 signing is confined to
  `contracts/neta-validator-profiles/src/tests.rs`, loaded under `#[cfg(test)]`.
  Keys are public, deterministic fixtures (`SigningKey::from_slice(&[n; 32])`).
  No production signing key is processed by this Rust test path.
- Production profiles call `Api::secp256k1_verify`; Names calls
  `Api::ed25519_verify`. The WASM implementation imports the chain host API.
  The chain host implementation/version is a separate scope, not replaced or
  certified by a website release.
- The backend Dockerfile installs npm packages and Node service files. The Pages
  build packages JavaScript and reviewed static assets. These contract Cargo
  lockfiles do not install a native Rust signing service in either deployment.

This establishes non-applicability to the reviewed shipped contract dependency
path, not a repair of the library or a general absence of vulnerabilities.

## Enforced, temporary exception

`scripts/check-contracts.mjs audit` still audits all seven complete Cargo.lock
files with current RustSec data. It grants the additional advisory ID only after:

1. The complete contract inventory matches the reviewed seven entries.
2. A SHA-256 fingerprint matches all contract Rust sources, manifests, lockfiles,
   local Cargo configuration, the pinned Rust toolchain and WASM build script.
   Changes require a new source and dependency assessment, not automatic repinning.
3. Cargo successfully resolves every locked WASM normal/build graph and confirms
   the four packages are absent. Missing, malformed or failed evidence blocks.
4. The assessment has not expired: **24 November 2026 at 00:00 UTC**.

The audit prints the exception and its expiry visibly. Every other security
advisory remains blocking, subject to the already documented, unchanged
RUSTSEC-2024-0344 exception. A new production dependency, Rust source change,
inventory change or expiry restores the block. Weekly security audits remain
enabled. This is not a global `continue-on-error` or a blanket advisory disable.

The guard has regressions for production-graph exposure, failed evidence,
changed source/lock/build inputs, incomplete inventory, symlinks and expiry.
Existing required CI still rebuilds contracts, compares shipped artifact bytes,
executes the real Juno governance regression and exercises the browser flows.
No contract source, lockfile, compiler, shipped WASM or on-chain state is changed.

## Upstream follow-up

elliptic-curve 0.13.8 requires crypto-bigint 0.5; 0.7.6 is not a compatible
lockfile-only update. Do not relabel an old version, apply an unreviewed local
cryptographic patch or migrate CosmWasm/compiler versions merely to silence the
scanner. Reassess a supported compatible upstream fix before the expiry; any
upgrade needs the existing contract/artifact compatibility checks. Remove this
exception when the old dependency is removed or upgraded safely.

Primary implementation references:

- [CosmWasm 1.5.11 dependencies](https://github.com/CosmWasm/cosmwasm/blob/v1.5.11/packages/std/Cargo.toml)
- [Native mock API](https://github.com/CosmWasm/cosmwasm/blob/v1.5.11/packages/std/src/testing/mock.rs)
- [WASM host imports](https://github.com/CosmWasm/cosmwasm/blob/v1.5.11/packages/std/src/imports.rs)
- [Crypto API](https://github.com/CosmWasm/cosmwasm/blob/v1.5.11/packages/crypto/src/lib.rs)
- [Upstream 0.7.6 changes](https://github.com/RustCrypto/crypto-bigint/pull/1365)
