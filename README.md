# NETA DAO Workspace

Static DAO workspace at <https://dao.netareborn.com>, owned by
`cristianoneta/neta-dao`. The separate `cristianoneta/neta-website` repository
owns <https://netareborn.com>.

Start with [HANDOFF.md](HANDOFF.md), then [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md).
The latter is the code-backed feature/deployment inventory, consolidated on 2026-10-04.
Use [docs/README.md](docs/README.md) for the document map and historical evidence.
Recorded deployments are not a fresh on-chain attestation; recheck identity and
state before signing. This documentation review changes no application behavior.

For the current owner test, read [the NNS continuation](docs/HANDOFF_NEXT_CHAT_NNS_2026-10-04.md).
Setup recovery, registration, public contacts, renewal and two-wallet transfer are confirmed on UNI-7.
Validator live tests are deferred. Next is the approved Treasury-based NNS price
snapshot setup using [the browser key page](https://dao.netareborn.com/names-mainnet-setup.html)
and mainnet deployment; see [names/README.md](names/README.md).
No separate Render NNS service is needed.

For UI work and new pages, follow [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).
The 2026-10-03 selected direction is graphite/mint with restrained voxel accents
and an assembly-plaza Home illustration. The shared theme and Home implementation
are live via PR #108, with mobile follow-up #109. Treasury valuation follow-up #110
restores verified Osmosis assets and guards against false history flows; see
[the incident record](docs/TREASURY_VALUATION_FIX_2026-10-03.md), CURRENT_STATE and
HANDOFF for the current continuation.

## What is connected

| Surface | Current behavior | Boundary |
| --- | --- | --- |
| Proposals | Local per-DAO drafts, public UNI-7 revisions/discussion, mainnet proposal reads | Operations uses the legacy workshop; Juno uses v0.3.0 |
| Operations voting | Keplr execute against the mainnet proposal module for open proposals | Existing frontend path; no new live vote demonstrated by this review |
| Native Juno governance | Mainnet history/parameters, UNI-7 community review | Native mainnet deposit, submission and voting are disabled |
| Treasury | Generated Operations Juno/Osmosis, main Neta DAO and Juno Community Pool balances, history and Operations events | Read-only; value-change attribution is an estimate, not a complete cash-flow ledger |
| RELAY Inbox | Local notifications from Operations and native Juno mainnet proposals | No UNI-7 review polling, push or cross-device sync |
| RELAY Composer | Temporary preview and read-only UNI-7 mailbox identity check | Main application cannot send or save plaintext drafts |
| RELAY encrypted lab | Separate UNI-7 device registration, ciphertext send/receive and encrypted local history | Mocked two-profile test passed; real two-wallet E2E still unrecorded |
| Names in RELAY | Directory and network-selectable mainnet/UNI-7 adapters for registration/renewal/transfers/public contacts | Mainnet disabled; adapters use shared Treasury prices after verified deployment and DAO activation |
| Names v2 UNI-7 lab | Separate Keplr setup/lab with verified deployed mock token, registry and profiles; purchases activated | Registration/profile/renewal/transfer post-state checked; separate operator-proof UI, live validator E2E outstanding; mainnet disabled |
| People / Delivery | Chain-backed Members adapters, planned Contributors and structured proposal deliverables | No authoritative contributor assignments, milestone acceptance or payment release |
| UNI-7 faucet | Connected funded Render service, Keplr, donations, staking/rewards and guarded payout requests | Reward/donation receipts verified; payout/restart and stake/unstake E2E evidence remains open |

RELAY directly exposes Inbox, Directory, Contacts, My profile and .neta name.
Directory owns search, follow toggles and a Followed filter; stored favorites are
preserved. There is no separate Following page or nested Names navigation.
`#names`, `#relay/names` and `#relay/following` canonicalize to `#relay/directory`.
The top DAO picker is hidden in RELAY because Inbox spans favorites.

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
- [Names implementation boundary](docs/NETA_NAMES_DESIGN.md)

## Local verification

No root npm package is required for the non-browser frontend tests:

```bash
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
cargo test --locked --manifest-path contracts/neta-proposal-workshop/Cargo.toml
cargo test --locked --manifest-path contracts/workshop-access-mock/Cargo.toml
cargo test --locked --manifest-path contracts/neta-names/Cargo.toml
cargo test --locked --manifest-path contracts/neta-names-v2/Cargo.toml
cargo test --locked --manifest-path contracts/neta-names-test-token/Cargo.toml
cargo test --locked --manifest-path contracts/neta-validator-profiles/Cargo.toml
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
node browser-names-validators.mjs
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
Root README/Handoff and ordinary docs edits alone do not match CI path filters;
`faucet/**`, including its README, triggers faucet CI.
Contract Markdown matches `contracts/**`; `docs/RELAY_SECURITY_ARCHITECTURE.md`
also matches frontend/contract CI. Inspect the changed paths and actual checks for each PR; ordinary documentation
updates do not imply that application CI ran. A successful Pages deployment proves publication,
not wallet transactions or cryptographic security.

## Security and release boundaries

The completed #100–#103 corrections and original release evidence are recorded in
[the security continuation](docs/SECURITY_CONTINUATION_2026-10-03.md).
Mainnet messaging remains disabled. Local receive recovery is shipped; mailbox
v0.2 consent/history is source only. Off-device backup, sender-generation handling,
consent/refill and the full restore matrix remain release gates. Never discard
pending crypto or transaction records to unblock the UI.

Latest repository/CI/data review: [maintenance checkpoint](docs/MAINTENANCE_CHECKPOINT_2026-10-04.md).

## Adding DAOs

Use [DAO_ONBOARDING_CHECKLIST.md](docs/DAO_ONBOARDING_CHECKLIST.md) and the DAO
onboarding issue template. `data/dao-directory.json` owns shared identity,
capability and data-source mapping; generate `dao-directory.js` after changes.
See [main DAO integration evidence](docs/DAO_ONBOARDING_2026-10-03.md) for known
coverage limits and deployment status. `python scripts/update_main_dao.py` runs
isolated, bounded main DAO reads; its status file must be checked alongside the
underlying snapshot timestamps. It does not change Operations exports.


NNS validator-profile protocol and programme decisions: see
[scope and remaining gates](docs/NNS_VALIDATOR_PROFILES_2026-10-04.md).
The separate UNI-7 deployment and validator UI are live through PR #145. Mainnet
purchases and main-workspace profile publishing remain disabled.
