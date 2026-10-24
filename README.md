# Cosmoot

Governance and community tools at <https://cosmoot.com>; the legacy
<https://dao.netareborn.com> address remains supported. This repository owns the
application, its contracts and collectors. The separate NETA homepage remains in
`cristianoneta/neta-website`.

Read [current feature and release status](docs/CURRENT_STATE.md), then
[the development handoff](HANDOFF.md). [Documentation map](docs/README.md).
Current status is updated in place; historical checkpoints live in the archive.

## Develop and verify

Use Node 24 (CI baseline 24.19.0), Python 3.11+ and the pinned Rust toolchain.

```sh
npm ci --ignore-scripts
npm ci --prefix faucet --ignore-scripts
npm ci --prefix relay-backup --ignore-scripts
npm run verify
npm test --prefix faucet
npm test --prefix relay-backup
node --test names/tests/*.test.mjs
```

`npm run verify` checks source formatting, ESLint correctness rules, explicitly
annotated governance types, all root Node tests, executable syntax, the pinned
pilot artifacts, generated DAO directory and Python tests. `npm run format`
formats hand-written JavaScript automatically, excluding generated or
manifest-pinned release artifacts. Type checking is incremental, not repo-wide.

Additional mandatory CI gates cover Rust format/tests/Clippy/audit, byte-for-byte
WASM builds, real local Juno governance execution, Docker/Caddy, signing bundles,
browser flows and the Cloudflare Worker. Browser setup and commands are in
`.github/workflows/relay-crypto-browser.yml` and `faucet-ci.yml`; the isolated
maintenance suite uses Playwright Test with failure traces. Synthetic wallet
responses do not establish live-wallet or future mainnet execution success.

`python3 scripts/dependency-inventory.py` exports lockfile dependencies and exact
WASM identities to `dist/dependency-inventory.json`. Its coverage limits distinguish
contract test dependencies from deployed WASM and third-party embedded binaries.
See [dependency maintenance](docs/DEPENDENCIES.md) and [releases](docs/RELEASES.md).

## Architecture and boundaries

- Static frontend with feature modules; [source and responsibility map](docs/SOURCE_MAP.md).
- Seven contract packages, inventoried in `scripts/contracts.json`.
- Read-only collectors and published snapshots; production collection runs on OVH.
- OVH hosts Faucet and the encrypted-message backup service with separate databases
  and authentication. Their shared process remains a documented pilot compromise.
  Render is retired; historical Render templates are not active deployment instructions.
- Names is active on mainnet. Personal messaging remains a separate two-wallet
  pilot; public Inbox activation is still gated in source.
- Juno review, native submission and later DAO/chain execution are different
  authorities and stages. Read [the mandatory semantics](docs/GOVERNANCE_EXECUTION_SEMANTICS.md).

Use one branch/PR for related work. Preserve URLs, generated data, browser storage
keys, contract identities and pending transaction/crypto journals. Website releases
are manual and commit-bound. Backend installation is a separate host operation;
a Cloudflare release does not update the backend. UI work follows
[DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md). Private operator information stays outside Git.
