# Cosmoot public development handoff

Updated 24 October 2026. Read [CURRENT_STATE](docs/CURRENT_STATE.md) for the single
current feature/release inventory and [AGENTS.md](AGENTS.md) before editing.
Private host access, backup locations and installation receipts remain outside Git.

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
3. Publish the reviewed homepage/fallback correction through a manual website
   release. The source now describes available native voting/submission and packages
   the missing public delegation-planner fallback without changing its timestamps.
   [Validation and live boundary](docs/HOME_FALLBACK_2026-10-24.md).
4. Finish the compatible dependency-upgrade work before the exception deadline.
   Keep the real Juno execution, artifact, audit and browser gates. Do not extend
   the exception automatically.
5. Recurring independent backup retention and controlled live snapshot fallback
   remain open. A local export and one reachable snapshot do not close those gates.
6. Install and accept the [collector archive changes](docs/COLLECTOR_ARCHIVING_2026-10-24.md)
   after a fresh read-only inventory. Preserve running state and generated data.
   Verify scheduled cycles, archives and actual RPC savings; independent storage
   and complete governance history remain separate work.

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
