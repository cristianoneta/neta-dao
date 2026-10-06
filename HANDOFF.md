# NETA DAO handoff

## Continuation — 2026-10-06, accounting cutoff and favicon

Owner narrowed accounting to **1 October 2026 onward, for every DAO**. No older
backfill. The continuation implements a shared date-bounded receipt collector,
daily delayed-index replay, exact NNS movement cross-reference and a mint voxel N
browser icon. See [cutoff implementation](docs/TREASURY_CUTOFF_2026-10-06.md). Publication checks are pending.
Full P&L and non-NNS classification/pricing/reconciliation remain open. Native Juno
Community Pool still has no accounting adapter. Preserve existing older exports.


Updated **2026-10-06, 13:30 Europe/Berlin**. Current continuation entry point for
<https://dao.netareborn.com> and `cristianoneta/neta-dao`.

## Start here

Read [the new next-chat handoff](docs/HANDOFF_NEXT_CHAT_2026-10-06.md),
[AGENTS](AGENTS.md) and [CURRENT_STATE](docs/CURRENT_STATE.md).
For any UI change also read [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md).
[Documentation index](docs/README.md) and [project priorities](PROJECT_CHECKPOINT.md)
link the owning runbooks. Fetch current main; preserve newer snapshot commits.

## Current checkpoint

The standardized Treasury statement and separate NNS payment register are **live
and verified**: [PR #174](https://github.com/cristianoneta/neta-dao/pull/174), merge
`735e997eee313e7801347ac072f09ff3b5d970ea`. Shared expandable Income / Expenses /
Operating result; NNS sources only for NETA; years 2026–2028; compact layout and
period-preserving payment drilldown. The duplicate income tile and fixed receipt
sidebar are removed. [Implementation and release evidence](docs/TREASURY_STATEMENT_2026-10-06.md).

Full DAO accounting remains unavailable. NNS subtotals are explicitly partial;
next Treasury work is historical coverage and reviewed expense/funding classification.
Do not fabricate zero totals or classify every incoming transfer as revenue.

Names purchase/management UX and local lifecycle notices are published (#169,
#171, #172). Mainnet deployment, activation and first purchase are complete.
Do not repeat them. Mainnet renewal/transfer and live-validator E2E remain open;
validator tests stay deferred. Faucet 25-JUNOX service is live with outstanding
wallet-E2E evidence. Mainnet encrypted messaging remains disabled.

## Preservation rules

- Work through branches/PRs; inspect applicable CI and verify changed deployments.
- Preserve collector-owned data, browser keys/secrets, pending journals and Render SQLite/WAL.
- Unknown broadcasts require reconciliation, not automatic resend or journal deletion.
- Owner wallet retains NNS upgrade and application administration; main NETA DAO receives fees.
  Authority transfers and all live writes need explicit owner wallet actions.
- No duplicate DAO features in `neta-website`; that repo owns `netareborn.com`.

[Detailed next actions and evidence](docs/HANDOFF_NEXT_CHAT_2026-10-06.md) supersede
old session instructions. [Previous handoff](docs/archive/HANDOFF_BEFORE_TREASURY_CHECKPOINT_2026-10-06.md)
is retained as historical evidence.
