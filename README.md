# NETA DAO Workspace

Static governance workspace at <https://dao.netareborn.com>.
This repository owns the DAO app; `cristianoneta/neta-website` owns the separate
<https://netareborn.com> site.

Start with [current feature/deployment/evidence status](docs/CURRENT_STATE.md),
then [next steps](HANDOFF.md). [Documentation map](docs/README.md) links the runbooks.
Current status is maintained in one matrix, not appended to several histories.

## Develop and verify

Node 24.19.0; Rust is pinned in `rust-toolchain.toml` for reproducible contract bytes.

```sh
npm ci --prefix faucet --ignore-scripts
npm ci --prefix relay-backup --ignore-scripts
node scripts/check-repository.mjs
node scripts/build-personal-pilot.mjs --check
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
npm test --prefix faucet
npm test --prefix relay-backup
node --test names/tests/*.test.mjs
node scripts/check-contracts.mjs fmt
node scripts/check-contracts.mjs test
node scripts/check-contracts.mjs clippy
```

Browser suites: install `spikes/relay-corecrypto` dependencies and Playwright
Chromium; commands are in `.github/workflows/relay-crypto-browser.yml`.
They use simulated wallet/chain actions; passing them is not live-wallet evidence.
`Repository checks` runs every PR and exposes **Required repository checks**.
Generated pilot files must match both their source build and manifest hashes.
See [dependency policy](docs/DEPENDENCIES.md) and [release procedure](docs/RELEASES.md).

## Architecture and boundaries

- Static frontend with feature-specific modules; [source map](docs/SOURCE_MAP.md).
- On-chain contracts in `contracts/`; central inventory in `scripts/contracts.json`.
- Read-only data collectors in `scripts/`, versioned snapshots in `data/`.
- Existing Render service: Faucet plus separately authenticated encrypted backup,
  separate SQLite databases on the retained disk. Shared process is a pilot compromise.
- Personal mainnet messaging is a restricted two-wallet pilot. Public Inbox stays
  gated. Only sending requires an owned active `.neta`; receiving needs no name or stake.
- Names mainnet is active. Current deployment receipts and evidence limits belong
  to CURRENT_STATE. Do not repeat completed wallet deployments.

Use branches and PRs. Preserve generated data, URLs, browser storage keys, wallet
bindings and uncertain transaction/crypto journals. UI work follows
[DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md). Do not delete safety checks for brevity.
