# Current state — Cosmoot / NETA DAO

Updated 9 October 2026. This is the public feature/deployment/evidence matrix.
Private operator records are governed by [DOCUMENTATION_PRIVACY](DOCUMENTATION_PRIVACY.md).

## Current architecture

Owner-approved on 8 October: GitHub primary for source/CI; Cloudflare for
`cosmoot.com` and `dao.netareborn.com`; OVH for bounded collectors and active
Faucet/encrypted-backup hosting; GitLab dormant reserve. The owner has retired
Render. See [HANDOFF](../HANDOFF.md) for immediate work.

The return source imports GitLab `b00683c4` onto GitHub main `f5b21a50`, preserving
GitHub history and all newer public snapshots. Dependabot version PRs are paused,
legacy data/bot writers removed, source CI remains complete and a manual protected
Cloudflare release is prepared. PR #257 was merged as `0916bec5` after all 16 CI
jobs passed. GitHub confirms main is protected with `Required repository checks`
and `has_pages=false`. The owner configured the two Cloudflare secrets and release
run `37767439816` successfully published deployment `55e7a408` at 11:13:07 UTC.
Owner/VPS custom-domain acceptance found a persistent static fallback caused by
an unsupported Worker fetch option. PR #259 corrected it and passed all 16 checks;
release `37774069535` published exact main `153f7a8c` as deployment `b9efb912` at
12:14:25 UTC. A later operator check reported the signed-price server marker
on both website origins. All 26 public files subsequently matched across the three origins; controlled fallback acceptance remains open in the
[release evidence](deployments/GITHUB_PRIMARY_2026-10-08.md).
The original 32 Dependabot proposals are recorded in the maintenance inventory,
without applying their package upgrades or dismissing security alerts. All 32
were closed, and no open PR remained at the completion check.

## Deployment evidence

- The Juno Delegation Programme planner and dedicated same-origin snapshot were
  accepted live from release `885beb9ac6adbb175997dd8bf8ae4e00d23e66ef` on 9 October.
  The staged UI was subsequently published from `5d14ce24`; criteria, reserve and
  local draft handoff shipped as `ba65ba30` (manual run 37936517683, all 18 jobs
  successful, 9 October 13:36 UTC). Native governance and Community Tools balances
  shipped as `e5ffabab` in manual run 37946802277, all 18 jobs successful. A live
  claim click then exposed rejection of long DAO validator addresses. Release `ef7873b1` corrected that check and added local feedback and timestamped
  rewards (manual run 37963591472, all 18 jobs successful). Both domains passed
  claim handoff acceptance without submitting a transaction. The next candidate
  adds shared review, third-party submission and native deposit contributions;
  see [review and deposits](JUNO_COMMUNITY_FUNDING.md). See
  [planner status](JUNO_DELEGATION_PROGRAMME.md).

- Daily staking accrual remains unavailable in the live accounting feed, while
  holdings continue to refresh. Historical RPC responses reproduced the retained
  checkpoint and three missing UTC boundaries. A strict height-pinned adapter,
  resumable catch-up and explicit accounting health check are prepared and tested;
  collector installation and live acceptance remain open. No production rewards
  were backfilled by this code review. See [catch-up evidence and limits](STAKING_REWARDS_CATCHUP.md).

- Current release `885beb9ac6adbb175997dd8bf8ae4e00d23e66ef` passed all 18 release jobs
  and was published to both domains; API/CSP and both origins were accepted.
  The earlier confirmed upload was GitHub main `153f7a8c`, release run
  37774069535, deployment `b9efb912`. The publish step passed at 12:14:25 UTC.
  The earlier `55e7a408` deployment returned 200 with `static-fallback` to owner/VPS
  checks, while OVH returned 200 in 0.186 seconds. The previous owner-confirmed
  custom-domain release was GitLab `ec077488`, deployment `d89506f6`, with SSL.
- GitLab pipeline 2925921267 passed bootstrap, backend and Pages packaging for
  `c21183bf` at 09:59:30 UTC. No Pages proxy publication occurred in that run.
- Node-mocked proxy tests missed a real workerd incompatibility: fetch rejects
  `redirect: 'error'` before contacting the origin. The corrected proxy uses
  `manual`, with its existing non-200 rejection preserving redirect safety.
  A regression check now exercises the compiled artifact in real workerd through
  pinned Wrangler's Miniflare, with synthetic origin/assets. Local runtime tests
  and release checks passed. The corrected artifact is published; verify its live
  behavior on both domains; the owner confirmed all-path byte equality. Controlled fallback remains open. Assistant HTTP 403 probes did not prove a public outage.
- The public snapshot edge is installed. The owner verified all 26 public file
  hashes and four private/unlisted 404 paths. A later manual main collector run
  published a signed NNS price successfully. This does not establish freshness
  of every collector or all historical accounting. Public observations now advance;
  inspect installed timers and receipts before changing them.
- Both production databases were exported while Render remained live. The
  preliminary encrypted copy passed transfer, decryption and database/receipt
  verification. This is not a production restore or an application message test.
- The original NNS price key was installed and checked privately. Its separate
  encrypted backup is not covered by the database archive.
- Faucet/NNS identity backups were verified privately. Synthetic authenticated
  restart/export/restore passed on the target host and inside its hardened image;
  Compose/Caddy validation and image build passed too. Final quiesced export,
  target configuration, DNS/TLS and backend cutover are complete. OVH is the active
  writer; the owner subsequently retired Render. Exact evidence is in the private operator handoff.
  Do not rotate authority, extend expired prices or run a second payout writer.

| Feature | Code | Deployment / activation | Evidence and remaining boundary |
| --- | --- | --- | --- |
| Juno Delegation Programme planner | Shared Community Tools UI; capped equal simulation, exclusions, snapshot collector and rule-draft exports | Native governance handoff/submission published; claim-entry and rewards-display correction pending release | Original live simulation accepted on both domains; on-chain approval verifier and execution adapter remain open. [Scope and rollout](JUNO_DELEGATION_PROGRAMME.md) |
| Community Tools | Project menu for Juno / NETA; Buy NETA on WYND adapted from Rescue NETA | Project menu and all four tools published | Existing Juno routes retained; native/CW20 swap, contract allowlist, $25 cap and pending journal retained. Signing and browser checks passed; desktop/mobile screenshots inspected. The published hub was checked during the original planner release. [Details](COMMUNITY_TOOLS.md) |
| Names | Registry v0.3.1 and profiles v0.1.0 | Mainnet code 5168/5169; purchases active | First registration and fee receipt recorded; mainnet renewal/transfer and live validator E2E remain open. [Receipts](NNS_MAINNET_DEPLOYMENT_2026-10-05.md) |
| Personal messaging | Maintained client, builder, backup and browser suites integrated in cleanup candidate | Code 5170 deployed; separate two-wallet pilot live; public release/deployment pins null | User confirmed send/read/reload; device/consent queried through one provider. Fresh-profile restore/rotation explicitly deferred; reply and hosted durability open. [Pilot evidence](deployments/PERSONAL_PILOT_2026-10-07.md) |
| Backup service | ADR-36, scoped encrypted envelopes, atomic revisions, local snapshot export; isolated admission lanes | Active OVH backend, separate database, unchanged pilot allowlist | OVH activation and API/origin behavior confirmed. Synthetic authenticated process restart/export/restore passed locally, on the target host and in its hardened image; recurring off-host retention remains open. [Service receipt](deployments/RELAY_SHARED_RENDER_2026-10-07.md), [recovery runbook](BACKUP_RECOVERY.md) |
| DAO inbox | Gated components and protocol groundwork | Not mounted; DAO writes disabled in code 5170 | Multi-recipient recovery/history/prekeys are next product work. [Design](DAO_MAILBOX_DESIGN_2026-10-06.md) |
| Proposals | Local drafts, UNI-7 workshops, mainnet history, Operations voting adapter | Existing static workspace | Operations legacy finalization does not create a mainnet proposal. Native Juno voting and general review-to-mainnet adapter disabled. A separate planner-only native submission candidate is prepared; live wallet acceptance remains open. [APIs](../REVIEW_ARCHITECTURE.md) |
| Treasury | DAO/SubDAO/consolidated assets, receipt categories, provisional P&L, Community Tax and daily staking accrual | Cloudflare static release; OVH data edge; collectors and health installed, scheduled-cycle acceptance open | Accounting floor 1 October; explicit partial coverage; missing data is not zero. Claims do not double-count accrued rewards. [Accounting](TREASURY_ACCOUNTING_2026-10-06.md), [cutoff](TREASURY_CUTOFF_2026-10-06.md) |
| RELAY notifications | Browser-local governance/NNS notices, favorites, unread/history | Public workspace | No push/email or cross-device notification sync. NNS notices are Messages, not a separate Names filter. |
| Faucet | 25 JUNOX per wallet per 24h, signature proof, exact-hash payout journal | Active OVH backend, deliberate deploy | Reward/donation evidence recorded; real payout/restart/stake/unstake evidence incomplete. Cheap HTTP traffic no longer consumes persistent claim-work quota in candidate. |
| Juno v31 tracker | Closed-event static archive and boundary tests | Live, monitoring stopped | 22/25, 94.44% saved participation in the five-hour window; first votes/signatures distinct. Three missing-evidence notes, not proof of failed upgrades. [Tracker](JUNO_UPGRADE_AUTOMATION.md) |
| Future upgrade watcher | Tested proposal/lifecycle core | Not scheduled or published | Two-source governance agreement, strict upgrade messages, immutable halt/deadline, all-baseline-signature closure and locked atomic checkpoints implemented. Network capture, runner integration and automatic pages remain open. [Specification](JUNO_UPGRADE_AUTOMATION.md) |
| People / Delivery / payments | Membership reads; contributor/delivery plans | Members live; payment execution absent | Roles, invoices, milestone acceptance and Treasury payment linkage remain future work. |

## Deployment identity and custody

- Personal mailbox: `juno1dvmms7su8zfqu4gxxmrkqhzpxr5v3sh8hzfxe8ypsgfegc22lggq5jfjx6`,
  Juno `juno-1`, code 5170. [Verified deployment](deployments/PERSONAL_MAINNET_2026-10-07.md).
- Initial upgrade/admin wallet: `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`.
  Do not transfer custody, make contracts immutable or redeploy to resolve a UI issue.
- OVH is the active backend host; Render has been retired. Resource inventory is private.
  No additional service is authorized by this documentation change.
- Deployment manifests pin exact contract, source, crypto and frontend bytes.
  Static publication does not prove hosted database recovery or on-chain transactions.

## Data ownership and rules

The intended OVH cadence is Operations Treasury every 15 minutes, main DAO and
membership every 30 minutes. Public observations advance. Operator inventory confirms
all three schedules active and enabled. The reviewed runner and receipt/freshness
checks are installed; sequential manual collector runs and the health check passed,
then the health timer was enabled. Two actual scheduled cycles remain to be verified. GitHub's
scheduled snapshot writers have been removed. The browser reads published
snapshots, not the chain; seeded snapshots are not fresh collection evidence.
Community/staking accounting uses its existing bounded collectors. After timer
activation, inspect data timestamps/status instead of promising live freshness.
Preserve prior verified snapshots on source failures and all generated bot updates.
Partial index coverage, unpriced assets and missing historical values stay explicit.

Treasury starts at 1 October 2026 by owner decision; do not backfill earlier periods.
Community Tax is reconstructed from source evidence; delegation rewards accrue from
the recorded baseline on 6 October. Claims transfer assets and do not create revenue
again. Proposal category metadata is not an executed expense.

## Release boundaries

Keep atomic journals, uncertain-broadcast locks, wallet/chain binding, consent,
backup-before-send and read-only restore. Display RPC fallback does not replace
independent verification for signing. NNS requires no new hosting: the approved
signed snapshot has a 24-hour validity without a new TWAP/liquidity gate.
No stale 5-NETA messaging requirement applies: only sending requires `.neta`.

[Next steps](../HANDOFF.md) · [source map](SOURCE_MAP.md) · [historical inventory](archive/repo-review-2026-10-07/CURRENT_STATE.md)

## Completed cutover and remaining operating gates

Faucet and the separate two-wallet pilot target `https://api.cosmoot.com` in the
published frontend and CSP. Both website origins passed CORS/auth-boundary checks.
OVH is the active writer; Render has been retired by the owner. Public messaging
release pins, wallet allowlists and contract authorities are unchanged.

Collector/health installation and manual acceptance are confirmed in the private
operator record. Two scheduled cycles, controlled live data fallback and independent
recurring backups remain open. A current independently held encrypted database copy
is verified; the configured provider backup does not establish application restore
or independent retention. External health notifications are not configured. See
[COLLECTOR_ACCEPTANCE](COLLECTOR_ACCEPTANCE.md).
