# NETA DAO handoff

## Latest continuation — faucet, 2026-10-03

Read [the next-chat faucet handoff](docs/HANDOFF_NEXT_CHAT_FAUCET_2026-10-03.md) first.
PR #123 adds the separate English faucet page and bottom footer link. The owner
asks to review this page now and continue in a new chat. Payout/donation backend
activation remains pending hosting and a privately provisioned, funded UNI-7
account. Do not claim actual payouts or real signed wallet E2E are verified.

## People update — 2026-10-03

Read [People / Members / Contributors](docs/PEOPLE_MEMBERS_CONTRIBUTORS_2026-10-03.md).
The owner approved one shared People navigation for every DAO. Members is backed
by verified governance data; Contributors stays planned pending a later product
decision. Do not resurrect sample contributor profiles as live assignments.


## Main DAO continuation — 2026-10-03

Read [the integration record](docs/DAO_ONBOARDING_2026-10-03.md) for current release
status and source limitations. The [original handoff](docs/HANDOFF_NEXT_CHAT_2026-10-03.md)
is a historical WIP snapshot; its code defects have been addressed in PR #118.
[DAO onboarding checklist](docs/DAO_ONBOARDING_CHECKLIST.md) and the GitHub issue
template define the repeatable process. Main DAO events need a verified historical
index; directory labels still need the planned NNS v2 registry and DAO adapters.
Check the integration record's release evidence before assuming this branch is live.

## Latest maintenance checkpoint — 2026-10-03

Read [the maintenance checkpoint](docs/MAINTENANCE_CHECKPOINT_2026-10-03.md)
first for current UI scope, refreshed data, CI changes and remaining work.
Older dated sections below retain their historical evidence.


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
| Names | [Accepted v2 plan](docs/NETA_NAMES_V2_PLAN.md), [implementation boundary](docs/NETA_NAMES_DESIGN.md) | `names-workspace.js`; inactive legacy `names.js` and `contracts/neta-names/src/lib.rs` |
| UNI-7 deployment failure | [UNI7_DEPLOYMENT_RUNBOOK.md](UNI7_DEPLOYMENT_RUNBOOK.md) | Contract identity, checksum and state-based recovery |

## Evening checkpoint — 2026-10-03

- Owner wants page-by-page publication. Shared graphite/mint theme and assembly
  plaza shipped in #108; #109 mobile heading/selector corrections are live and
  inspected. Design rules remain canonical in `docs/DESIGN_SYSTEM.md`.
- Treasury #110 restores five verified, chain-scoped Osmosis price identities;
  missing-price coverage no longer becomes a false history outflow. Read
  `docs/TREASURY_VALUATION_FIX_2026-10-03.md` for incident, tests and live evidence.
  Both PR checks, bot run 940 and Pages run 1043 succeeded; the 12:47 Berlin
  snapshot showed USD 4,040.81 across nine holdings (one unpriced factory token).
- Home was inspected at desktop and 320/768 px frames. Proposals list/filter and
  existing-proposal selection worked on desktop; its narrow page had no document
  overflow. Full per-page interaction/accessibility checks are still outstanding.
- Historical UI review queue: Proposals detail/dialog/keyboard states and other
  module accessibility checks remain incomplete. Current product priority is the
  small functional Names slice described below.
- Mainnet messaging remains disabled. No real keys or live attack transactions
  were used. Preserve bot updates and pending crypto/transaction journals.
- Fetch fresh GitHub main/open PRs and workflow state before continuing; recorded
  totals and deployment hashes are timestamped evidence.

## Next concrete task

The owner wants small functional Names slices next. Keep the integrated RELAY
navigation and shared masthead; there is no separate preview mode. Read the
[accepted v2 plan](docs/NETA_NAMES_V2_PLAN.md), then implement/test normalization,
tariff and term/expiry rules plus the quote interface using synthetic fixtures.
The JUNO/NETA pool remains the chosen price reference. Do not deploy the legacy
v1 contract as the accepted v2 product or enable registry writes before its gates.

Desktop introductions reuse existing Home voxel artwork; mobile hides decoration.
Remaining per-page keyboard/dialog/accessibility review is still useful, but is
not a replacement for the owner's selected functional Names work. Mainnet messaging
remains disabled; preserve transaction and crypto journals.

## Rules for accurate continuation

- `index.html` is the main application; `relay-uni7-lab.html` is a separate test.
- Native Juno submission/voting is disabled. Operations mainnet voting has an
  existing UI path. Operations review `voting` is not a mainnet proposal.
- Operations legacy and Juno v0.3.0 are different APIs and permission models.
  Never apply v0.3.0 hardening claims to the legacy instance.
- Inbox polls mainnet proposals only; review-revision notifications are not connected.
  Directory owns follow controls; Inbox has no watchlist sidebar. RELAY directly
  exposes Inbox, Directory, Contacts, My profile and .neta name; no nested Names tabs.
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




### Juno testnet faucet continuation — 2026-10-03

New independent English `juno-faucet.html`, footer link opens a separate tab.
Current UNI-7 validators, stake, commission, unstaking and rewards share the
NETA theme. Source/build/test instructions and deployment gates: `faucet/README.md`.
The payout backend is prepared with persistent 10 JUNOX / rolling 24h limits,
ADR-36 authentication and durable transaction reconciliation, but **is not hosted
or funded**. API/address remain null; payout/donation controls explain this.
Operator needs to provision a dedicated testnet key privately and provide backend
hosting. Never substitute a browser-only daily limit or silently activate a
third-party faucet. No real signed staking/payout transaction was performed.
