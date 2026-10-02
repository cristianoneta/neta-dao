# NETA DAO handoff

Code/documentation reviewed: **2026-10-02**. Canonical repository:
`cristianoneta/neta-dao`; site: <https://dao.netareborn.com>.

## Read in this order

1. [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md): exact connected features,
   source files, recorded deployments and limitations.
2. [README.md](README.md): verification commands and project boundary.
3. The relevant specialized document below; then its owning code and tests.
4. [PROJECT_CHECKPOINT.md](PROJECT_CHECKPOINT.md): current continuation priorities.

| Task | Read next | Owning implementation |
| --- | --- | --- |
| Proposals / permissions | [REVIEW_ARCHITECTURE.md](REVIEW_ARCHITECTURE.md) | `neta-governance.js`; Juno v0.3.0 in `contracts/neta-proposal-workshop/`; legacy Operations source in the other repo |
| Treasury | CURRENT_STATE Treasury section | `treasury.js`, `scripts/update_treasury.py`, `scripts/update_treasury_events.py` |
| RELAY notifications / routing | CURRENT_STATE RELAY section | `relay.js`, `ux-draft.js`, `index.html`, `relay.css` |
| Encrypted messaging | [Implementation plan](docs/RELAY_IMPLEMENTATION_PLAN.md), [live test runbook](docs/RELAY_UNI7_E2E_RUNBOOK.md) | `relay-uni7-lab.mjs`, `relay-uni7-client.mjs`, `relay-uni7-archive.mjs`, `spikes/relay-corecrypto/` |
| Recovery | [Recovery decision](docs/RELAY_RECOVERY_DECISION.md) | Product direction only; no automatic backup service |
| Names | [Names design](docs/NETA_NAMES_DESIGN.md) | `names.js`, `contracts/neta-names/src/lib.rs` |
| UNI-7 deployment failure | [UNI7_DEPLOYMENT_RUNBOOK.md](UNI7_DEPLOYMENT_RUNBOOK.md) | Contract identity, checksum and state-based recovery |

## Next concrete task

Complete the **real two-Keplr-wallet UNI-7 encrypted lab test**. The device UI,
GPL CoreCrypto runtime, mailbox adapter and encrypted local archive already
exist. Do not rebuild them based on an older chat. Follow the runbook and record
wallets, registrations, message IDs/sequences, transaction evidence and reload
results without recording text, codes or secrets. No live exchange has been
recorded. Existing CI exchange/reply/reload evidence uses mocked chain and wallets.

After that, address historical sender identity/rotation and crash recovery,
then implement the agreed automatic encrypted backup. Do not activate the main
composer or mainnet from a green lab test alone. Review the security/recovery
gates first. Treasury accounting is the next separate product stream.

## Rules for accurate continuation

- `index.html` is the main application; `relay-uni7-lab.html` is a separate test.
- Native Juno submission/voting is disabled. Operations mainnet voting has an
  existing UI path. Operations review `voting` is not a mainnet proposal.
- Operations legacy and Juno v0.3.0 are different APIs and permission models.
  Never apply v0.3.0 hardening claims to the legacy instance.
- Inbox polls mainnet proposals only; review-revision notifications are not connected.
  Following owns favorites; Inbox has no watchlist sidebar.
- Names is under RELAY; `REGISTRY=null`. Mainnet Names signing code is prepared,
  not active. A requested UNI-7 Names test still needs explicit testnet wiring.
- Delivery/Contributors and Treasury forecasts/commitments/runway are concepts.
- Read timestamp and source for every data claim. A successful snapshot or Pages
  run does not prove a live crypto flow, full accounting or current contract state.
- Never request seeds/private keys. Wallet writes use explicit Keplr confirmation.
- Preserve snapshots and unrelated work. Use branches/PRs; no destructive reset,
  force push or silent transaction retry after an uncertain broadcast.
- Update static asset query versions in `index.html` for JS/CSS changes.
- CI is path-filtered. Inspect `.github/workflows/` for the checks actually triggered.
  This repo has no general docs CI and no root npm package.

## Known work to keep visible

CURRENT_STATE records the actual gaps: Treasury async DAO-switch race, symbol-based
attribution/denom heuristics, legacy proposal completeness limits, RELAY notification
coverage limits, encrypted lab rotation/prekey/crash/backup gaps, and branch-specific
runtime preparation. These are **unfixed observations**, not instructions to enable
new behavior during a documentation task.
