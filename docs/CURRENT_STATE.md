# Current state — NETA DAO

Updated 7 October 2026. This is the current status source. Dated documents are
evidence at their timestamps, not competing next-step lists.
The remediation branch is a source candidate until its PR and deployments are verified.

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
