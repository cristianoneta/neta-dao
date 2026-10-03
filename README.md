# NETA DAO Workspace

Static DAO workspace at <https://dao.netareborn.com>, owned by
`cristianoneta/neta-dao`. The separate `cristianoneta/neta-website` repository
owns <https://netareborn.com>.

Start with [HANDOFF.md](HANDOFF.md), then [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md).
The latter is the code-backed feature/deployment inventory. Review date: 2026-10-02.
Recorded deployments are not a fresh on-chain attestation; recheck identity and
state before signing. This documentation review changes no application behavior.

## What is connected

| Surface | Current behavior | Boundary |
| --- | --- | --- |
| Proposals | Local per-DAO drafts, public UNI-7 revisions/discussion, mainnet proposal reads | Operations uses the legacy workshop; Juno uses v0.3.0 |
| Operations voting | Keplr execute against the mainnet proposal module for open proposals | Existing frontend path; no new live vote demonstrated by this review |
| Native Juno governance | Mainnet history/parameters, UNI-7 community review | Native mainnet deposit, submission and voting are disabled |
| Treasury | Generated Operations Juno/Osmosis balances, Juno Community Pool, daily history and Operations event ledger | Read-only; value-change attribution is an estimate, not a complete cash-flow ledger |
| RELAY Inbox | Local notifications from Operations and native Juno mainnet proposals | No UNI-7 review polling, push or cross-device sync |
| RELAY Composer | Temporary preview and read-only UNI-7 mailbox identity check | Main application cannot send or save plaintext drafts |
| RELAY encrypted lab | Separate UNI-7 device registration, ciphertext send/receive and encrypted local history | Mocked two-profile test passed; real two-wallet E2E still unrecorded |
| Names & Contacts | UI and prepared commit/reveal/renewal handlers | `names.js` has `REGISTRY=null`; registry writes are disabled |
| Delivery / Contributors | Visual concepts and structured proposal deliverables | No authoritative contributor records, milestone acceptance or payment release |

RELAY groups Inbox, Following and Names & Contacts. Favorites are managed in
Following; there is no Inbox watchlist sidebar. `#names` canonicalizes to
`#relay/names`. The top DAO picker is hidden in RELAY because Inbox spans favorites.

## Important governance distinction

The Operations button still says `FINALIZE + SUBMIT ON-CHAIN`. Its UNI-7
`finalize_and_submit` call changes the legacy review status to `voting`; it does
not create a mainnet DAO proposal. Juno v0.3.0 finalization stores the latest
revision hash and closes discussion. Its `MarkSubmitted` operation is blocked.
See [REVIEW_ARCHITECTURE.md](REVIEW_ARCHITECTURE.md) for the two APIs and access rules.

## RELAY test and recovery status

The recorded UNI-7 mailbox is
`juno13uft9dl34x9wdzcxnm80q8m8sh5cw04lkskzknm9vc0wduxchdxsrnr4pa`.
[relay-uni7-lab.html](relay-uni7-lab.html) loads pinned Wire CoreCrypto 10.5.3
(GPL-3.0) and the actual Keplr/mailbox adapter. It is separate from `index.html`.
Its generated code unlocks this browser's device; it does not recover erased
browser data or provide an off-device backup.

The agreed automatic encrypted backup of ratchet state plus readable-history
archive, unlocked with a generated recovery code, remains unimplemented.
Provider and synchronization are undecided. Keplr proves wallet control and
cannot recreate separate messaging keys. Main RELAY sending and mainnet DMs
remain disabled. The shipped mailbox is hardcoded to UNI-7 and has no mainnet
5-NETA stake policy; that policy requires new reviewed implementation.

- [Live UNI-7 test procedure](docs/RELAY_UNI7_E2E_RUNBOOK.md)
- [Implementation inventory and remaining work](docs/RELAY_IMPLEMENTATION_PLAN.md)
- [Security requirements](docs/RELAY_SECURITY_ARCHITECTURE.md)
- [Agreed recovery direction](docs/RELAY_RECOVERY_DECISION.md)
- [Names design and activation](docs/NETA_NAMES_DESIGN.md)

## Local verification

No root npm package is required for the non-browser frontend tests:

```bash
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
cargo test --locked --manifest-path contracts/neta-proposal-workshop/Cargo.toml
cargo test --locked --manifest-path contracts/workshop-access-mock/Cargo.toml
cargo test --locked --manifest-path contracts/neta-names/Cargo.toml
cargo test --locked --manifest-path contracts/neta-relay-mailbox/Cargo.toml
```

Rust is pinned in `rust-toolchain.toml`; use the formatting, Clippy and audit
commands in `.github/workflows/contract-ci.yml` for contract changes. Build via
`bash scripts/build-wasm.sh <contract>`; the workshop build is compared with its
shipped checksum by `.github/workflows/build-testnet-wasm.yml`.

For the mocked encrypted browser lab:

```bash
npm ci --prefix spikes/relay-corecrypto
cd spikes/relay-corecrypto
npm run test:transport
npx playwright install --with-deps chromium
npm run test:browser
node browser-uni7-lab.mjs
```

These browser tests mock Keplr and chain responses. They cannot prove live E2E.
The native `npm test` spike is a library experiment, not the website test suite.

## Data and deployment workflow

Treasury collection runs on a 15-minute UTC cron; GitHub scheduling may delay it.
The workflow stages five current/history/event JSON files only after balance and
event collection succeed, then commits changes to `main`. During Berlin hour 21,
daily records are replaced for that UTC date; this is not an exact 21:00 capture.
Frontend Refresh refetches committed JSON, not the chain or a server collector.
See [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) for data ownership and limitations.

Use a branch/PR, preserve generated snapshots and inspect checks before merging.
Root README/Handoff and ordinary docs edits alone do not match CI path filters.
Contract Markdown matches `contracts/**`; `docs/RELAY_SECURITY_ARCHITECTURE.md`
also matches frontend/contract CI. Inspect the changed paths and actual checks for each PR; ordinary documentation
updates do not imply that application CI ran. A successful Pages deployment proves publication,
not wallet transactions or cryptographic security.

## Current security checkpoint — 2026-10-03

DAO #100–#103 and Website #137/#138 are merged after their relevant final CI
checks passed. Documentation PRs DAO #104 and Website #139 are also merged.
The resumed verification confirmed the exact PR-head checks and compared 23
production files with GitHub, including both shared signing bundles and the
published Treasury event ledger. See [the evidence](docs/SECURITY_CONTINUATION_2026-10-03.md).

Treasury run 934 successfully executed the final collector source and retained all
57 cached events. Both selected public RPCs required full replay; three historical
Osmosis transactions remain absent from the index and are retained from cache.
Unpriced assets still yield PARTIAL balance snapshots. Successful collection is
not proof of complete accounting. Preserve the subsequent bot commits.

Mainnet messaging remains disabled. Local receive recovery and sender-scoped
archive identities are shipped; v0.2 consent/historical identities are tested
source only. The pinned UNI-7 v0.1 address/artifact has not changed. Automatic
off-device recovery, historical sender resolution, consent/refill integration and
the full rotation/exhaustion/restore matrix remain release blockers. Never discard
pending ratchet/archive/outbox or transaction-journal state to unblock the UI.
