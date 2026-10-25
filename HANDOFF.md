# Cosmoot public development handoff

Updated 25 October 2026. Read [CURRENT_STATE](docs/CURRENT_STATE.md) for the single
current feature/release inventory and [AGENTS.md](AGENTS.md) before editing.
Private host access, backup locations and installation receipts remain outside Git.

## Current delegation workspace candidate

The owner approved bringing the separate design lab into the real application.
See [scope, proposal capabilities and remaining boundaries](docs/DELEGATION_WORKSPACE_2026-10-25.md).
The candidate adds the Rebalance view without authorizing staking transactions.
Preserve exact approved rule versions; local policy edits must never alter a
Rebalance calculation. Rule and reward-claim proposals keep their existing flow.
Verify the required repository gates and use the deliberate manual website release;
no host installation or backup changes are required for this UI work.

## Completed maintenance

The owner requested the code-review improvements followed by a documentation
revision. They were implemented in [PR #304](https://github.com/cristianoneta/neta-dao/pull/304)
(`refactor/cosmoot-maintenance-20261024`):

- Explicit proxy trust and independent visitor admission, with spoofing and real
  Caddy integration regressions; existing payout quotas and databases remain intact.
- Separate governance editor/content, read adapters, review-context/receipt handling
  and typed review permission decisions. Native authority and execution checks remain.
- On-demand native/legacy signing bundles, shared concurrent loading and explicit retry.
- Behavior tests in place of misleading review-lock/code-discovery source searches;
  isolated Playwright cases and failure traces complement the full workflow tests.
- Automatic JavaScript formatting, correctness linting, incremental type checking and
  `npm run verify`; cached pinned WASM checker and no duplicated root suite in Rust CI.
- Lockfile/WASM inventory and an explicit dependency-upgrade work plan before the
  temporary crypto-bigint applicability exception expires.

See [implementation, validation and limits](docs/MAINTENANCE_2026-10-24.md) and
[deployment acceptance](docs/DEPLOYMENT_ACCEPTANCE_2026-10-24.md). PR #304 is
integrated. Its exact source was published in manual release 40086798887; the
owner separately installed the tested backend image and proxy configuration.
The current published source is recorded only in CURRENT_STATE.

## Next work

1. Do not repeat the completed host installation, export/import or website release.
   Exact installation and rollback records are in the private operator handoff.
   A future code rollback must preserve the latest production databases.
2. Complete the remaining manual desktop/mobile and wallet acceptance when needed.
   Existing browser CI is synthetic evidence; the fresh-browser encrypted-message
   restore remains deferred. No live quota-exhaustion test was performed.
3. The homepage/fallback correction and compact-header follow-up are published;
   the latest release is recorded in CURRENT_STATE. Controlled single-file failure
   exercises restored the original configuration, but both websites continued
   returning prior server bytes: packaged live fallback remains unproven.
   The snapshot proxy now adds bounded upstream status/cache/age diagnostics in
   the published website. Inspect normal
   responses first; do not repeat an unchanged failure exercise or infer origin
   freshness from a successful cached fetch. [Evidence and header contract](docs/HOME_FALLBACK_2026-10-24.md).
4. Finish the compatible dependency-upgrade work before the exception deadline.
   Keep the real Juno execution, artifact, audit and browser gates. Do not extend
   the exception automatically.
5. The owner confirmed infrastructure-backup installation, the first encrypted R2
   backup with verified fresh download, and a separate full repository data check
   on 24 October. The daily timer is enabled by explicit owner decision while
   another-machine application recovery is deferred. Do not repeat installation
   or repository initialization. Verify two unattended cycles and complete the
   deferred recovery drill; retention remains preview-only. Exact receipts stay
   in the private operator handoff. See [backup status and limits](docs/INFRASTRUCTURE_BACKUPS.md#operational-checkpoint--24-october-2026).
   Controlled live snapshot fallback remains open.
6. Collector archive installation and the manual collector/archive check were accepted
   by the owner on 24 October; do not repeat them. Private operational evidence is
   outside Git. Verify two regular scheduled cycles, multi-day archive growth and
   measured RPC savings; complete governance history remains separate work.

## Preservation and open product boundaries

- Read [governance execution semantics](docs/GOVERNANCE_EXECUTION_SEMANTICS.md)
  for every governance/staking/transaction change. A submitted or passed proposal
  does not guarantee later execution. Preserve old reviews and recovery paths.
- Programme rule approval and executable redistribution remain distinct. V2/V3
  scoring and allocation execution are not activated by this maintenance work.
- Do not enable public messaging, change custody, rotate keys, repeat uncertain
  transactions, initialize fresh production databases or revive Render.
- Keep GitHub primary, production collection on OVH and Cloudflare releases manual.
  Batch dependency maintenance; do not restart automatic version-update PR waves.
- The exception deadline is 24 November 2026 00:00 UTC. It is not a patch, and
  an expiry or changed Rust graph must remain a release failure.
- Follow [documentation privacy](docs/DOCUMENTATION_PRIVACY.md). Historical
  observations and synthetic tests do not establish current host health.

The previous long handoff is preserved in the
[24 October archive](docs/archive/HANDOFF_2026-10-24_before-maintenance.md).
It is historical evidence, not a second current task list.
