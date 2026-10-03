# NETA DAO handoff

Baseline review: **2026-10-02**; security integration rechecked **2026-10-03**. Canonical repository:
`cristianoneta/neta-dao`; site: <https://dao.netareborn.com>.

## Read in this order

1. [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md): exact connected features,
   source files, recorded deployments and limitations.
2. [README.md](README.md): verification commands and project boundary.
3. The relevant specialized document below; then its owning code and tests.
4. [PROJECT_CHECKPOINT.md](PROJECT_CHECKPOINT.md): current continuation priorities.

| Task | Read next | Owning implementation |
| --- | --- | --- |
| UI / new pages | [Design system](docs/DESIGN_SYSTEM.md) | Approved graphite/mint direction and assembly-plaza hero; shared theme/Home rollout; applies across every DAO page |
| Proposals / permissions | [REVIEW_ARCHITECTURE.md](REVIEW_ARCHITECTURE.md) | `neta-governance.js`; Juno v0.3.0 in `contracts/neta-proposal-workshop/`; legacy Operations source in the other repo |
| Treasury | CURRENT_STATE Treasury section | `treasury.js`, `scripts/update_treasury.py`, `scripts/update_treasury_events.py` |
| RELAY notifications / routing | CURRENT_STATE RELAY section | `relay.js`, `ux-draft.js`, `index.html`, `relay.css` |
| Encrypted messaging | [Implementation plan](docs/RELAY_IMPLEMENTATION_PLAN.md), [live test runbook](docs/RELAY_UNI7_E2E_RUNBOOK.md) | `relay-uni7-lab.mjs`, `relay-uni7-client.mjs`, `relay-uni7-archive.mjs`, `spikes/relay-corecrypto/` |
| Recovery | [Recovery decision](docs/RELAY_RECOVERY_DECISION.md) | Product direction only; no automatic backup service |
| Names | [Names design](docs/NETA_NAMES_DESIGN.md) | `names.js`, `contracts/neta-names/src/lib.rs` |
| UNI-7 deployment failure | [UNI7_DEPLOYMENT_RUNBOOK.md](UNI7_DEPLOYMENT_RUNBOOK.md) | Contract identity, checksum and state-based recovery |

## Next concrete task

The owner selected the modern graphite/mint design and voxel assembly plaza on
2026-10-03. The canonical [design system](docs/DESIGN_SYSTEM.md) includes reference
images, tokens, shared components, per-page rules and responsive acceptance criteria.
The shared theme and Home implementation shipped in PR #108; Pages and live asset
verification succeeded (see CURRENT_STATE). `neta-ui.css` owns
foundations/components; existing module colors now refer to its tokens. Home desktop
and 320/768 px layouts were inspected; a small mobile follow-up fixes heading word
separation and chain-selector width. Continue with Proposals, Treasury,
Delivery/Contributors and RELAY/Names on the actual
deployment, including the fixed-width review at `docs/design/responsive-preview.html`.
Full per-page interaction/accessibility verification is still outstanding.
Do not reintroduce the rejected wizard or remove reviewed content to match mockups.

Follow the 2026-10-03 continuation below. Finish the release gates before any
live wallet test: full coherent backup/restore, v0.2 mailbox deployment planning,
consent/replenishment UX and historical generation resolution. Mainnet messaging
remains disabled. The current user's task prohibits live attack transactions and
real wallet keys; all adversarial tests use isolated synthetic fixtures.

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
  This repo has no general docs CI and no root npm package. Contract Markdown
  and the RELAY security document still match existing CI path filters.

## Remaining work

Use [PROJECT_CHECKPOINT.md](PROJECT_CHECKPOINT.md) for the ordered release gates.
Outstanding areas include safe off-device restore, sender-generation history,
prekey consent/refill, legacy pending-state reconciliation, symbol-based Treasury
attribution, unknown-token decimals, incomplete historical queries and missing
RELAY review-revision notifications. The original receive-lock and ID-collision
defects have local fixes; do not confuse those with completed remote recovery.

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
