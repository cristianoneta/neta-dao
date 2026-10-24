# Cosmoot public development handoff

Updated 24 October 2026. Read [CURRENT_STATE](docs/CURRENT_STATE.md) for the single
current feature/release inventory and [AGENTS.md](AGENTS.md) before editing.
Private host access, backup locations and installation receipts remain outside Git.

## Current work

The owner requested the code-review improvements followed by a documentation
revision. They are grouped in [PR #304](https://github.com/cristianoneta/neta-dao/pull/304)
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

See [implementation, validation and limits](docs/MAINTENANCE_2026-10-24.md).
PR CI must pass on the final source. Integration, manual website publication and
backend installation are separate states; do not mark a source change live merely
because tests passed. The current published source is recorded only in CURRENT_STATE.

## Release continuation

1. Inspect the one maintenance PR and all required final-head checks. Preserve
   the real Juno execution regression and all artifact/audit/browser gates.
2. After integration, the owner runs the deliberate Cloudflare release from `main`
   with `deploy=true` and that exact merge SHA as `expected_commit`.
3. The admission fix additionally requires the reviewed backend image and Caddy/
   Compose configuration on OVH. Follow the private operator procedure and public
   [template guidance](deploy/cosmoot/README.md); preserve the latest databases,
   identities, quotas, allowlist and pending journals. No host installation is
   claimed by this development handoff.
4. Verify the released page and backend behavior separately, then update
   CURRENT_STATE in place with the actual evidence.

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
