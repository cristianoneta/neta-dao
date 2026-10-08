# Current state — Cosmoot / NETA DAO

Updated 8 October 2026. This is the current feature/deployment/evidence matrix.

## Current architecture

Owner-approved on 8 October: GitHub primary for source/CI; Cloudflare for
`cosmoot.com` and `dao.netareborn.com`; OVH for bounded collectors and eventual
Faucet/encrypted-backup hosting; GitLab dormant reserve; Render retained until
verified state migration. See [HANDOFF](../HANDOFF.md) for immediate work.

The return source imports GitLab `b00683c4` onto GitHub main `f5b21a50`, preserving
GitHub history and all newer public snapshots. Dependabot version PRs are paused,
legacy data/bot writers removed, source CI remains complete and a manual protected
Cloudflare release is prepared. Admin setting changes and Cloudflare credential
configuration require separate verification; code does not configure them.
The original 32 Dependabot proposals are recorded in the maintenance inventory,
without applying their package upgrades or dismissing security alerts.

## Deployment evidence

- Cloudflare's last verified production release is GitLab main `ec077488`, pipeline
  2923507334, deployment d89506f6. Both domains were owner-confirmed active with SSL.
- GitLab pipeline 2925921267 passed bootstrap, backend and Pages packaging for
  `c21183bf` at 09:59:30 UTC. No Pages proxy publication occurred in that run.
- The compiled allowlisted proxy and 196-file artifact passed synthetic GET/HEAD,
  credential stripping and static-fallback checks. Live both-domain acceptance is
  still pending. Direct assistant HTTP requests returned 403 without proving a
  public outage; verify from the owner's normal connection or VPS.
- OVH VPS-1 costs EUR 5.34/month per the owner's order: 2 vCPU, 4 GB RAM, 40 GB NVMe,
  Ubuntu 24.04 in Erith. Key-only SSH, firewall, Docker, Python and Node were checked.
  Source `08cc957`, a seeded public generation and inactive systemd units are
  installed. The snapshot-only Caddy edge serves `data.cosmoot.com`.
- The owner verified all 26 public file hashes and four private/unlisted 404 paths.
  A later assistant check matched 18 files with eight timeouts; no mismatch was seen.
  Seeded snapshots are not evidence of fresh collection. Timers remain inactive.
- Render `/health` returned 200 with `{"ok":true}` on 8 October. Last deployment
  evidence remains `f5b21a5`; current branch/auto-deploy settings were not rechecked.
  No production database export, hosted restore or backend cutover has occurred.
- The original NNS price key and independent encrypted backup remain missing.
  Do not rotate authority, extend expired prices or run a second payout writer.

| Feature | Code | Deployment / activation | Evidence and remaining boundary |
| --- | --- | --- | --- |
| Names | Registry v0.3.1 and profiles v0.1.0 | Mainnet code 5168/5169; purchases active | First registration and fee receipt recorded; mainnet renewal/transfer and live validator E2E remain open. [Receipts](NNS_MAINNET_DEPLOYMENT_2026-10-05.md) |
| Personal messaging | Maintained client, builder, backup and browser suites integrated in cleanup candidate | Code 5170 deployed; separate two-wallet pilot live; public release/deployment pins null | User confirmed send/read/reload; device/consent queried through one provider. Fresh-profile restore/rotation explicitly deferred; reply and hosted durability open. [Pilot evidence](deployments/PERSONAL_PILOT_2026-10-07.md) |
| Backup service | ADR-36, scoped encrypted envelopes, atomic revisions, local snapshot export; isolated admission lanes in cleanup candidate | Existing Faucet Render host, separate database, owner/Faucet allowlist | Last recorded deployed backend `052e736`; replacement pending successful release. No demonstrated off-service hosted recovery. [Service receipt](deployments/RELAY_SHARED_RENDER_2026-10-07.md), [recovery runbook](BACKUP_RECOVERY.md) |
| DAO inbox | Gated components and protocol groundwork | Not mounted; DAO writes disabled in code 5170 | Multi-recipient recovery/history/prekeys are next product work. [Design](DAO_MAILBOX_DESIGN_2026-10-06.md) |
| Proposals | Local drafts, UNI-7 workshops, mainnet history, Operations voting adapter | Existing static workspace | Operations legacy finalization does not create a mainnet proposal. Native Juno submission/voting and review-to-mainnet adapter disabled. [APIs](../REVIEW_ARCHITECTURE.md) |
| Treasury | DAO/SubDAO/consolidated assets, receipt categories, provisional P&L, Community Tax and daily staking accrual | Static Pages plus scheduled collectors | Accounting floor 1 October; explicit partial coverage; missing data is not zero. Claims do not double-count accrued rewards. [Accounting](TREASURY_ACCOUNTING_2026-10-06.md), [cutoff](TREASURY_CUTOFF_2026-10-06.md) |
| RELAY notifications | Browser-local governance/NNS notices, favorites, unread/history | Public workspace | No push/email or cross-device notification sync. NNS notices are Messages, not a separate Names filter. |
| Faucet | 25 JUNOX per wallet per 24h, signature proof, exact-hash payout journal | Existing Render service, manual deploy | Reward/donation evidence recorded; real payout/restart/stake/unstake evidence incomplete. Cheap HTTP traffic no longer consumes persistent claim-work quota in candidate. |
| Juno v31 tracker | Closed-event static archive and boundary tests | Live, monitoring stopped | 22/25, 94.44% saved participation in the five-hour window; first votes/signatures distinct. Three missing-evidence notes, not proof of failed upgrades. [Tracker](JUNO_UPGRADE_AUTOMATION.md) |
| Future upgrade watcher | Requirements only | Not scheduled or implemented | Proposal/plan validation, permanent pages, halt-anchored five-hour window and all-validator early closure. [Specification](JUNO_UPGRADE_AUTOMATION.md) |
| People / Delivery / payments | Membership reads; contributor/delivery plans | Members live; payment execution absent | Roles, invoices, milestone acceptance and Treasury payment linkage remain future work. |

## Deployment identity and custody

- Personal mailbox: `juno1dvmms7su8zfqu4gxxmrkqhzpxr5v3sh8hzfxe8ypsgfegc22lggq5jfjx6`,
  Juno `juno-1`, code 5170. [Verified deployment](deployments/PERSONAL_MAINNET_2026-10-07.md).
- Initial upgrade/admin wallet: `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`.
  Do not transfer custody, make contracts immutable or redeploy to resolve a UI issue.
- Render: `srv-db10ddc9v7es73dbg45g`, Frankfurt, one instance, existing 1-GB
  `/var/data` disk. No additional service is authorized by this cleanup.
- Deployment manifests pin exact contract, source, crypto and frontend bytes.
  Static publication does not prove hosted database recovery or on-chain transactions.

## Data ownership and rules

Operations Treasury refresh is scheduled every 15 minutes; main DAO and membership
jobs every 30 minutes. The browser refreshes committed snapshots, not the chain.
Community/staking accounting uses its existing bounded collectors. Scheduling can
be delayed; inspect data timestamps/status instead of promising live freshness.
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
