# Cosmoot public development handoff

Updated 31 October 2026. Read [CURRENT_STATE](docs/CURRENT_STATE.md) for the single
current feature/release inventory and [AGENTS.md](AGENTS.md) before editing.
Private host access, backup locations and installation receipts remain outside Git.

## Current operations repair — 31 October

The 31 October check found Operations receipt collection stalled at its 29 October success. Both
configured Osmosis providers have pruned its original accounting-floor block.
The source correction adds the official Osmosis archive, propagates child and
statement failures to the collector exit status, and checks Operations events and
accounting in the published-data health check. Existing evidence and all history
checks remain intact. See [cause, regression coverage and acceptance](docs/OPERATIONS_COLLECTOR_2026-10-31.md).
The owner confirmed the source installation; complete collector runs and live recovery
are being checked separately. The collector repair
itself needs no website release; private installation details remain outside Git.

The same PR #330 now implements governance-weighted allocation under new
schema 9, the single voting-power factor up to 3.0, and removal of duplicate
controls. Governance defaults to 100% of a configurable bonus; unavailable
criteria remain disabled at zero. Scores use only complete voting periods in our
own captured history. Fixed allocations are reserved first and remain exempt.
Schemas 2–8 and their frozen reviews retain their original meaning.

The source includes a read-only governance exporter, additive first-entry and
new-event integrity records, exact rational point weights, capped micro-unit
allocation, frozen evidence and compatible approval/Rebalance parsing. Larger
schema-9 envelopes refer to the exact policy already inside their verified frozen
comparison instead of duplicating its JSON. The complete sample stays embedded;
oversize evidence remains blocked. See [implementation and acceptance](docs/DELEGATION_GOVERNANCE_BONUS_2026-10-31.md).

The working validator history retains 180 days. Older blocks, events and integrity
records require verified archiving before deletion; first observed entries survive
exit/re-entry and pruning. Archive bundles and R2 backups gain no expiry.
Local checks cover 443 JavaScript tests and 242 Python tests (14 environment skips).
The points implementation and browser acceptance passed all 18 jobs in
[CI 41199076122](https://github.com/cristianoneta/neta-dao/actions/runs/41199076122),
feature head `ed0bac062b76b8a1b057d270a511064991630348`. This readiness update is
documentation-only. Collector installation is confirmed; fresh feed acceptance and
the manual website release remain pending.
Do not label the new scoring live before the own-history feed is installed and verified.

## Current continuation: Delegation Programme

The owner returned to the Delegation Programme on 29 October. The latest verified
website release is [40589638063](https://github.com/cristianoneta/neta-dao/actions/runs/40589638063),
source `65f48c5bff863eea44c99cd6516984cd7c37a074`, including PR #327. Its publication
step succeeded; the served native-submission module matches the source. Do not
repeat this release or either completed gas repair.

Read the [29 October evidence checkpoint](docs/DELEGATION_CHECKPOINT_2026-10-29.md):

- Corrected review 3 was successfully submitted as native **proposal #384** with
  a 5,000 JUNO deposit, fee 0.231942 JUNO and 2,255,995 of 3,092,554 gas consumed.
  Two independent RPC sources confirm the receipt and corrected 37-withdrawal
  envelope. It is still voting; scheduled end is **1 November, 21:53 UTC / 22:53
  Europe/Berlin**. Check the eventual outcome; submission is not reward execution.
- No native proposal matching Cosmoot's supported allocation-rule format exists
  in the complete current proposal enumeration. Historical programme decisions
  are not a new structured approval. Review/submit initial rules as the next
  product step; keep any private draft and frozen community review intact.
- The public planner now contains approximately **15.03 days** of continuous
  available history with reconciled participation counts, through 29 October
  20:06:37 UTC. Production evidence validation succeeds for that interval. It is
  still collecting toward 90 days and remains provider-observed evidence.
- Rebalance preparation is published but requires an actual approved rule revision
  and no pending programme treasury proposal. Resolve #384, then refresh balances,
  evidence and staking locks before preparing a separately voted redistribution.
- At this historical checkpoint, bonus scoring and historical no-jail evidence were unimplemented. The current source changes above add governance scoring; historical no-jail evidence remains unimplemented. Current
  jail exclusion and configurable observed commit-signature minimum are separate.

The checkpoint above was documentation-only. The owner subsequently approved
[fixed additional allocations](docs/FIXED_DELEGATIONS_2026-10-29.md): schema 7 reserves
explicit obligations-based targets before allocating the regular remainder. Fixed
portions bypass programme eligibility and cap rules, while technical execution
checks remain. No recipient is preconfigured. Source implementation and validation
are separate from the still-manual website release; no wallet action, custody
change or production-data mutation is involved.

## Resolved native vote transmission

PR #326 was published in release 40586044487 at source
`11b07d9958ffa486be8b38a456022cf624dbe9ef`. The owner confirmed the reviewed
higher-gas vote in Keplr; a read-only mainnet lookup verified code 0, the Yes ballot,
and the consumed account sequence. Preserve the separate vote gas floor, original
sequence binding, predecessor archives and pending journals. See
[scope, evidence and validation](docs/NATIVE_VOTE_TRANSMISSION_2026-10-27.md).
The exact original pre-#325 RPC error was not retained.

## Published five-pool WYND swap; live acceptance still open

The owner requested five pools with current USD liquidity, clickable asset menus,
the original flickering WYND mascot and a 50-USD cap. Continue from the
[scope and validation checkpoint](docs/WYND_SWAP_2026-10-25.md). Preserve the
existing transaction review, chain/asset checks and pending-broadcast journal.
PR #321 and the rule-approval correction below were published in release
40223522400 at source `71b0dd2d51cadebb51f6cef6294916a85b9d18e0`.
The owner's follow-up adds missing token logos, compatible receive-only choices,
individual pool token prices and a larger original mascot. Continue from the
refinement section of the same checkpoint; PR #322 was published in release
40225307377 at source `2f15eee46c2b6460788424ab62ab0747e794170a`.
The subsequent Keplr acceptance attempt stopped before broadcast because the
wallet returned a different fee. The follow-up passes the reviewed-fee/memo
preferences to the swap signer while preserving exact signed-byte validation.
PR #323's correction was published in release 40227248631 at source
`c573f21d7a304948197fd7eb29012cbac83a9683`; successful live wallet acceptance is
still unconfirmed. The requested `/wynd` short link is implemented. PR #324's
Pages redirects for `/wynd` and `/wynd/` were published in
release 40378998268 at source `8b7da376e5c942e7cdf3e2544e636b9d9fbef339`.

## Published rule-approval discovery

PR #319 is integrated and published in deliberate release 40219239387.
A subsequent lifecycle check found that compact rule proposal text omitted the
identity lines needed for approval discovery. PR #320, merged at
`de1fa55c5ada9848f09c933b61083eed25223db0` with all 18 checks passing, restores them in new
drafts and verifies immutable older compact envelopes through their frozen
comparison. See [correction and validation](docs/REBALANCE_EXECUTION_2026-10-25.md#compact-rule-approval-correction).
Do not equate a submitted rule proposal with an approved rulebook or a deployed
rule-enforcement contract. The correction is published in the subsequent five-pool release 40223522400.

## Published checked Rebalance preparation

The owner clarified that the Delegation Programme is an independent product,
integrated with Cosmoot and bringing users into it, not Cosmoot's product core.
Continue with the [checked execution specification](docs/REBALANCE_EXECUTION_2026-10-25.md).
Preserve rule approval versus fund execution and the exploratory status of bonus
points. PR #319's checked execution is live in manual release 40219239387 at
source ae29770b07bfa09b092b87bb69c6d336ae816e5e, retaining PR #318's compact
criteria, monetary sorting and unified Review. The rule-discovery correction above was subsequently published in the
five-pool release 40223522400.
No host installation, contract deployment or custody change is involved.

## Current delegation workspace refinement

The owner approved bringing the separate design lab into the real application.
PR #316 only partially transferred it; PR #317 restored its composition and was
published in release 40196047184. The current refinement responds to the owner's
remaining screenshot feedback: compact aligned criteria, sortable current/target/
change columns, and a single Review instead of duplicate Compare and Review pages.
The published navigation is Eligibility → Distribution → Review → Rebalance.
Programme overview remains a secondary link; legacy #simulation links reach Review.
See [scope, proposal capabilities and remaining boundaries](docs/DELEGATION_WORKSPACE_2026-10-25.md).
Preserve exact approved rule versions; local policy edits must never alter a
Rebalance calculation. Rule and reward-claim proposals keep their existing flow.
Verify required repository gates and use the deliberate manual website release;
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
