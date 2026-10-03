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

## Known work to keep visible

CURRENT_STATE and [the security audit](docs/SECURITY_EFFICIENCY_AUDIT_2026-10-02.md)
record the remaining gaps: symbol-based attribution, unknown-token display decimals,
legacy proposal completeness limits, RELAY notification
coverage limits, encrypted lab rotation/prekey/crash/backup gaps, and branch-specific
runtime preparation. The audit distinguishes fixes from open findings. Treat the RELAY receive-lock
and prekey-exhaustion issues as blockers before any Mainnet messaging release.

## Security audit continuation — 2026-10-03 Berlin

Audit changes are published in PR #100, branch `audit/security-efficiency-20261002`; code checkpoint `32b784a7862c69573e866f39d4a2927a18ef0ed0`. Cross-project PRs: https://github.com/cristianoneta/neta-dao/pull/100 and https://github.com/cristianoneta/neta-website/pull/137. At handoff, website tests and DAO RELAY browser tests passed; DAO contract/frontend CI was still running and website production-data CI pending. PRs were not merged. Check current results before integration.

The isolated adversarial browser test reproduced the persistent RELAY receive lock after malformed ciphertext and reload. Mainnet messaging remains blocked. Read `docs/SECURITY_EFFICIENCY_AUDIT_2026-10-02.md`; prioritize authenticated transactional receive/recovery, sender-scoped archive identity, prekey abuse and ambiguous mainnet broadcast retries. Preserve unrelated changes/data-bot updates. Local audit worktrees contain commits, while the original worktrees have documentation edits already published in the earlier documentation PRs; do not discard these blindly.

## Checked continuation — 2026-10-03

* PR #100 merged as `c99ac99419d50ff35042fe71aec4c0ceed070572` after contract/frontend
  run 137 and RELAY browser run 32 passed. Mainnet signing fee, Treasury epoch,
  exact-denom pricing and Names pinning are shipped; served bytes were verified.
* PR #101 merged as `bc7fb520cbb9626684ba04262b7a42835b497681` after RELAY browser
  run 34 passed. Receive checkpoints restore interrupted ratchet/archive writes;
  invalid ciphertext is quarantined and does not persist a device-wide lock.
  New archive IDs bind the sender/generations/message ID. Legacy readable records
  stay readable; unresolved legacy intents without a checkpoint still fail closed.
* PR #102 adds v0.2 **source only**: recipient-granted generation-bound consent,
  one initial per sender/generation pair, immutable historical identities. Contract/frontend run 139 and WASM run 22 passed; PR #102 merged as
  `0bc53fb93fe95b07cb05e93563f6705624d9558d`. The live pinned v0.1 artifact/address
  is unchanged: neither new consent nor historical queries exist there.
* Website PR #138 adds a browser-local signed-transaction journal. Check its current
  CI and deployment; The shared Socials signing bundle is synchronized here from the website
  implementation after website browser/bundle CI run 311 passed; the additional
  production-data check and this PR's tests must still finish before integration. It has no auto reset/rebroadcast.
* This follow-up implements moderation-hidden placeholders, invalid-parent/cycle
  protection, depth limits, a one-shot legacy revision query with truncation warning,
  and anchored incremental Treasury event scans. Reorg/partial-index errors preserve
  existing data and fail publication. Never hand-edit generated JSON snapshots.

Still blocked: automatic off-device backup and fresh-profile coherent restore of
ratchet + archive + outbox + descriptor; historical sender generation in the lab;
consent/replenishment integration on a new verified UNI-7 deployment; full adversarial
rotation/exhaustion/recovery matrix. No mainnet messaging activation or wallet writes.

2026-10-03 RPC compatibility check: the public Juno gateway rejects height-range
queries with an explicit strict-equality policy. Collector selection now probes
range capability, prefers a compatible archive and falls back to full replay when
none is reachable. The optimization is conditional on node support, not a guarantee
of incremental scans on every endpoint. Snapshot ownership/data remain unchanged.

The shared generated bundle contains the same broadcast journal as Website #138.
A browser regression checks its actual execute path, including mainnet fee denom
and persisted retry blocking after reload. The guarantee is per origin/browser,
not coordination across domains/devices or manually cleared storage. Interrupted
signatures and permanently rejected broadcasts need manual investigation.

Known optional Osmosis legacy index gaps preserve all cached events and emit an
explicit coverage warning; they do not block fresh balances. Required Juno history
gaps still fail publication. Seven independent address queries run with a bound
of three workers; capability probes have five-second timeouts.
