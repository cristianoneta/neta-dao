# Dependency maintenance

Dependabot version-update PRs are paused by owner decision; security alerts remain.
Weekly security audits run even without code changes. Review every update through
`Required repository checks`; no automatic merge or automatic major upgrade.

Rust remains pinned to 1.81.0 for contract compatibility and reproducible bytes.
Cargo-audit 0.22.1 uses its separate 1.85.1 host toolchain. The inherited
exception is RUSTSEC-2024-0344: CosmWasm 1.5.11 host-side curve25519-dalek code.
Do not broaden it. Reassess when the supported CosmWasm line changes and reproduce
all shipped WASM checksums before changing compiler/lockfiles or the exception.

RUSTSEC-2026-0387 has a separate, temporary applicability assessment for the
reviewed host/test-only crypto-bigint 0.5.5 dependency. It is not a library fix.
The audit requires unchanged reviewed Rust inputs, a complete inventory and
locked WASM normal/build graphs without the affected dependency. It expires on
24 November 2026 at 00:00 UTC. Any failed guard blocks release; other advisories
remain blocking. See [the evidence, automated guards and limits](SECURITY_REVIEW_2026-10-24.md).

An audit passing means no unaccepted matching known advisory, not that software
is free from vulnerabilities. Accepted exceptions must remain explicit. Contract
locks remain independent; this assessment changes no on-chain binary.

## Maintenance tooling and dependency evidence

The root development package now pins the formatter, ESLint and TypeScript.
The weekly npm audit covers root tooling, Faucet, encrypted backup and CoreCrypto
workspace locks. Root dependencies are development-only; they are not added to the
backend image or browser signing bundles. The existing build comparisons still
require byte-identical signing/pilot outputs and deployed contract WASM.

`python3 scripts/dependency-inventory.py` exports all four npm locks, all seven
Cargo locks and the hashes of shipped WASM binaries. General CI retains this
inventory as an artifact for the reviewed source. It is a resolved dependency and
artifact inventory, not a claim of binary reachability or a complete third-party
SBOM. Native/dev packages in Cargo.lock do not automatically enter deployed WASM;
`check-contracts.mjs audit` independently checks the real locked WASM graph.

CoreCrypto's embedded Rust/WASM dependency stack requires its own pinned upstream
source/build assessment. An npm audit of the package does not inspect Rust inside
the binary. Keep the existing Proteus/MLS scope distinction and do not conclude
that a whole third-party binary is unaffected from the selected API alone.

## Work before 24 November 2026

The source-pinned exception is a bridge, not the long-term solution. Responsibility
stays with the repository maintainer and owner; no automatic deadline extension is
implemented. Work is batched in a reviewed dependency PR, not automatic PR waves.

1. Use the current inventory and advisory to identify a supported CosmWasm/crypto
   dependency combination that contains the upstream correction. The current
   `crypto-bigint 0.5` requirement cannot be repaired by forcing `0.7.6` through
   an override; compatibility must be demonstrated in a disposable branch.
2. For a compatible candidate, run native tests/Clippy, all seven WASM builds,
   exact artifact comparisons and the real Juno execution regression. If the
   affected change can remain host/test-only, prove unchanged deployed bytes.
3. If a supported update changes deployed contract code, prepare an explicit
   version/state/custody migration review. Do not replace existing immutable
   artifact pins or redeploy contracts as part of a frontend cleanup.
4. Separately check the third-party crypto binary's upstream lock/build provenance
   and selected protocol. Upgrade only with backup/restore/crash-recovery evidence
   and preserved pending journals; never refresh a hash solely to pass CI.
5. Before expiry, either remove the dependency/exception through a verified fix,
   or report the remaining blocker and the evidence required for a new assessment.
   Expired or changed evidence continues to fail release. This maintenance branch
   does not claim a patched library or an approved successor exception.
