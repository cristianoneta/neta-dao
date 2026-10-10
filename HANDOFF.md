# Cosmoot public handoff

Updated 9 October 2026. This file contains public project status and development
boundaries. Read [CURRENT_STATE](docs/CURRENT_STATE.md), the
[documentation policy](docs/DOCUMENTATION_PRIVACY.md) and applicable AGENTS.md.
Operator access, private backup locations and exact continuation commands belong
in the owner's private operations handoff, outside this repository.

## Current priority

10 October update: PR #280 was published by successful manual release
38074225057 from `c4c91fdac8883fec10edffe34d89fcf40b65ffe9`. The owner
uploaded and instantiated Juno community review v0.3.1 on mainnet (code 5171).
Independent transaction-byte and two-provider checks confirmed the new address,
code hash, owner/upgrade administrator and **1 delegated JUNO, zero NETA** policy.
The instance was **paused** at verification; no activation was sent by the agent.

The activation candidate pins that instance in the Juno workspace. Historical
unqualified review links stay on UNI-7; new links, drafts, finalized metadata and
transaction records carry their network identity. Operations stays on UNI-7.
The owner activation page prepares one explicit `set_paused: false` transaction
with exact-payload recovery. Website release and owner signature remain manual;
real two-wallet acceptance is still open. See [mainnet review rollout](docs/JUNO_REVIEW_MAINNET.md).

Earlier release notes below are historical and superseded by this update.


PR #278 merged as `6b9eeeb9e6e5d02b1311f59da3b85e054f60474f` after 16 successful
CI jobs, but manual release 38068377663 failed the personal mailbox browser test
with a generation-2 fingerprint mismatch. PR #277 remains the published source.
A new candidate addresses two verified storage-lifetime gaps: the temporary
CoreCrypto constructor handle survives until GC, and relaxed-idb writes can
outlive the crypto call. It explicitly releases that handle and waits for queued
IndexedDB transactions before snapshot, restore and runtime teardown. Write
failures block checkpoints; concurrent disconnects share one cleanup operation.

The real-browser regression fails on the previous source (one retained native
handle) and passes on this candidate (zero). Delayed/aborted IndexedDB writes,
273 Node tests and the full encrypted message backup/restore/rotation browser
flow pass locally. The original intermittent fingerprint stack was not reproduced
verbatim locally. Full CI and manual publication remain required. Public messaging
stays disabled; pending journals, archived messages and fingerprint checks remain.
See [storage lifetime](docs/PERSONAL_STORAGE_LIFETIME.md).

PR #277 is now published from `d9954bccf217af11ea57857228a6212123433b6d`
in successful manual release [38065296076](https://github.com/cristianoneta/neta-dao/actions/runs/38065296076).
The owner then encountered HTTP 502 while checking prior native submissions.
Read-only diagnosis reproduced HTTP 500 / nil-pointer errors on the second
reverse-paginated governance page at both Polkachu and Stavr. Forward cursor
pagination through the published proxy returned the same complete 147 proposal
IDs at height 42562163 from both providers.

A new correction uses complete forward traversal for duplicate detection and
claim numbering; numbering also preserves provider URL path prefixes. Two-source
agreement, pinned submission checks and incomplete-history failure remain.
Local 269 Node tests, repository/static checks and the full synthetic planner /
review / submission / funding browser flow pass. PR #278 CI passed; its manual release is blocked as described above. No real signature, deposit or contract change occurred.
The earlier implementation notes below describe the now-published PR #277.

PR #276 was published from `e30336128fc1c6f2e3afa549d4a79694a6e00242` by manual
release [38037267610](https://github.com/cristianoneta/neta-dao/actions/runs/38037267610),
with all 18 jobs successful. The owner finalized a review and then encountered a
source-verification error before native submission.

The new candidate moves submission to the bottom of the finalized review. Two
buttons use the verified chain minimum and full voting deposit (currently 1,000
and 5,000 JUNO). A click verifies content, duplicate submissions, authority,
balance and fee, then asks for Keplr confirmation without another form step.
The author can withdraw READY reviews on UNI-7 before native submission;
existing history, journals and status-only recovery remain intact.

Pinned governance reads now use an allowlisted, read-only same-origin Pages
route. Provider identities, block heights, freshness and two-source agreement
remain checked. Browser preflight rejection of the custom height header no
longer blocks these reads. The route cannot sign, broadcast, accept arbitrary
upstream URLs, follow redirects, or fall back to static chain data. Read errors
are displayed beside the deposit buttons. See [review and deposits](docs/JUNO_COMMUNITY_FUNDING.md).

Local validation: 268 Node tests, complete synthetic planner/review/funding browser
flow at four widths, source/static checks, and real workerd transport tests pass.
Full PR CI and a separate manual production release remain required. No real
wallet signature, withdrawal, native proposal or deposit was performed by the agent.
A genuine testnet governance lifecycle through execution, then production-domain
acceptance, remains necessary before declaring the whole flow mainnet-ready.

Stricter standby selection, verified rule approval, allocation execution and native
voting remain separate work. No live signing or deposit is claimed for this candidate.

The current development priority is the Juno **Delegation Programme** planner,
placed under Community Tools → Juno. Its first implementation adds capped equal
allocation, explicit v31 evidence review, manual exclusions, current-versus-target
comparison and downloadable rule drafts using the shared UI. The collector and
snapshot path are live from release `885beb9a`. The owner-approved three-stage
UI revision is live from `5d14ce24`: rules, searchable distribution review and a
proposal preview, with detailed evidence and exact values available on demand.
On-chain approval verification and execution proposals remain the next stage.
See [JUNO_DELEGATION_PROGRAMME](docs/JUNO_DELEGATION_PROGRAMME.md) for the current
V1 decisions, inactive V2 scope, arithmetic and rollout requirements.

The owner requested project sections in Community Tools: Juno owns the existing
Faucet and Validator Upgrade Status; NETA adds **Buy NETA on WYND**. The
released site contains the menu and a port of the old Rescue NETA functionality
in the shared graphite/mint style. The criteria and reserve revisions are live; native planner proposal submission is published; the shared-review and deposit flow is the new candidate.
See [COMMUNITY_TOOLS](docs/COMMUNITY_TOOLS.md) for provenance and remaining checks.

Juno Delegation Programme holdings refresh, but daily staking accrual is stalled:
the historical REST query at height 42442228 reports pruned state. The existing RPC
reproduced the retained checkpoint and three missing daily boundaries. A reviewed
historical adapter, bounded resumable catch-up and accounting health check are
prepared; they are not installed on the collector and no live backfill is claimed.
See [STAKING_REWARDS_CATCHUP](docs/STAKING_REWARDS_CATCHUP.md). Preserve verified
intervals; do not replace missing daily evidence with current unclaimed rewards.

The backend is active on OVH. Final source quiescence, verified database transfer,
original identities, admission settings and target activation are confirmed in the
private operator record. The owner has retired Render; it is no longer a rollback
reserve. Any future host recovery must preserve the latest OVH state.

The website release from `885beb9ac6adbb175997dd8bf8ae4e00d23e66ef` passed all 18
release jobs and was published on both domains. The original planner and its
same-origin data source passed live acceptance on 9 October. The stable API endpoint and CORS for
both website origins were accepted. Public mainnet messaging remains disabled.

Independent recurring backups and controlled live data fallback remain open. The
operator confirmed all three collector schedules active and enabled. The reviewed
receipt/freshness checks are installed, sequential manual collector runs passed,
and the health service passed before its timer was enabled. Two actual scheduled
cycles still require acceptance. Follow
[COLLECTOR_ACCEPTANCE](docs/COLLECTOR_ACCEPTANCE.md). The original identities are
already independently backed up; do not repeat those transfers or rotate keys.

## Source and release status

- GitHub is primary for source/CI. Cloudflare serves `cosmoot.com` and
  `dao.netareborn.com`; OVH provides public snapshots and the active backend.
  GitLab is a dormant reserve. Render has been retired by the owner. A current
  encrypted database copy is held independently; recurring retention is still open.
- PR #257 imported the newer GitLab source without replacing GitHub history.
  PR #259 fixed the real-workerd proxy incompatibility. Exact source `153f7a8c`
  was published successfully; see [release evidence](docs/deployments/GITHUB_PRIMARY_2026-10-08.md).
- The old scheduled data/bot writers are removed. Dependabot version-update PRs
  are paused; security alerts/updates and the weekly security audit remain.
  Use one branch/PR for related changes and deliberate releases only.
- Main requires `Required repository checks`. Code/manifest changes retain the
  full CI gates; Markdown-only changes still report the required result.
  A documentation merge does not authorize an application deployment.

## Development boundaries

1. Follow [BACKEND_MIGRATION](BACKEND_MIGRATION.md). Preserve both databases,
   the existing Faucet identity, payout journals, quotas and admission settings.
   A fresh final export must follow quiescence of all source writes. Never start
   a second production writer or silently initialize empty production state.
2. Runtime configuration, synthetic application restore and independent identity
   backups are confirmed. Complete recurring independent database retention.
   A process health check is not proof of application recovery.
3. Continue personal-message durability, DAO multi-recipient messaging and payment
   requests after infrastructure acceptance. Both personal devices are registered;
   user-confirmed send/read/reload passed. Fresh-browser restore/rotation remains
   explicitly deferred and must not be repeatedly requested.
4. NNS prices: 3 characters $99/year, 4 $19, 5+ $5. The owner controls initial
   upgrades/tariffs/pause/key rotation; fees go to the main DAO. Receiving/reading
   messages does not require `.neta`; sending does.
5. Preserve pending transaction/crypto journals and wallet/chain binding. Do not
   silently rotate keys, resubmit uncertain transactions, change live payout limits
   or enable public messaging. No new paid service or plan upgrade is authorized.
6. Juno v31 observation is closed. A tested future-upgrade lifecycle core now implements proposal identity, plan reconciliation, fixed halt windows and immutable closure. Network collection, persistent scheduling and automatic publication remain open in
   [JUNO_UPGRADE_AUTOMATION](docs/JUNO_UPGRADE_AUTOMATION.md); missing signatures
   are not proof of a failed software upgrade.

Historical development evidence is in [the archive](docs/archive/repo-review-2026-10-07/HANDOFF.md).
It does not override the current handoff or the private operator record.
