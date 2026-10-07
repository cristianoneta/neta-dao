# Dependency maintenance

Dependabot proposes weekly small npm, Cargo and pinned GitHub Actions updates.
Weekly security audits run even without code changes. Review every update through
`Required repository checks`; no automatic merge or automatic major upgrade.

Rust remains pinned to 1.81.0 for contract compatibility and reproducible bytes.
Cargo-audit 0.22.1 uses its separate 1.85.1 host toolchain. The only inherited
exception is RUSTSEC-2024-0344: CosmWasm 1.5.11 host-side curve25519-dalek code.
Do not broaden it. Reassess when the supported CosmWasm line changes and reproduce
all shipped WASM checksums before changing compiler/lockfiles or the exception.

An audit passing means no matching known advisory above its threshold, not that
software is free from vulnerabilities. Contract locks remain independent; this
cleanup does not change the Cargo workspace or on-chain binaries.
