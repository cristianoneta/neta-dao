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
