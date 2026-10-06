# NETA DAO handoff

## DAO inbox implementation candidate — 2026-10-06

Source implementation and local tests now exist for opt-in DAO mailbox authority,
immutable DAO-name assignment, current CW4 readers, NNS-only senders, blocking,
shared conversation state, multi-recipient Proteus packets and a compact Inbox
selector. **Not deployed or mounted in the main workspace.** Existing v0.1 pins
and mainnet send locks remain unchanged. No real DAO has been opted in.

See [implementation, tests and release gates](docs/DAO_MAILBOX_IMPLEMENTATION_2026-10-06.md).
A real crypto failure test found partial session persistence after callback errors;
the new durable preparation journal keeps such sends locked. Coherent recovery,
a new signed UNI-7 deployment, real-wallet E2E and adapter activation still remain.
No fake DAO inboxes are published. Operations' current name is still directory-only.

## Inbox simplification and DAO mailbox decisions — 2026-10-06

The separate Names inbox filter is removed. Existing NNS system notices appear
under Messages, All and Unread; their verified source, lifecycle links, ownership
boundaries and read state are preserved. They remain locally generated system
notices, not encrypted peer messages. Mainnet messaging is still disabled.

Design decisions for future implementation are recorded in
[DAO mailbox design](docs/DAO_MAILBOX_DESIGN_2026-10-06.md). Shared DAO inboxes,
blocking, NNS-only sending, role subaddresses and milestone payment requests are
not live. Do not expose a working mailbox switcher until its access controls exist.

## DAO structure — 2026-10-06

People opens with DAO structure, ahead of Members and Contributors. The graph
uses the canonical organization/unit directory and explicit parentDaoId links;
Main and every configured SubDAO sit inside the same consolidated-scope frame.
Node selection and the consolidated button use the existing guarded DAO selector,
keeping the header, URL, saved scope and other modules synchronized. Mint and a
Selected label identify the current unit; consolidated selection highlights the
outer frame. Direct Members/Contributors and legacy links keep their behavior.

The approved layout reuses the existing colorful assembly-plaza and contributor
voxel artwork. Branches, multiple roots and deeper parent relationships are supported;
cycles, duplicate identities or out-of-group parents show an unavailable state,
not invented links. Reporting structure grants no on-chain authority. No fictional
units, additional wallet actions or live Delivery functionality are introduced.

Validation: 36 targeted Node tests and the browser hierarchy suite passed, including
both organizations, click/keyboard selection, scope persistence, Members navigation,
320/390/768/1440 px layouts and test-only multi-level branches. Generated Treasury
and member exports are preserved. This section supersedes older People defaults.

## Delivery placeholder for every DAO — 2026-10-06

Owner requested removal of fictional Delivery records. Every DAO and SubDAO now
uses the same UX DRAFT / NOT LIVE DATA header and scoped no-live-data placeholder.
The former Operations sample mandates, budgets, paid amounts, owner, milestones,
evidence and inactive action buttons are removed from HTML, not merely hidden.
Delivery and its Home summary describe planned functionality; there is no live
mandate tracking, acceptance or payment release. DAO switching cannot restore
sample records. Other income is always the last income row in the shared statement,
including consolidated views, while named income sources keep their relative order.
Treasury token quantities (assets, LP underlyings and accrual events) display two
decimal places; USD values remain visible and accounting precision is unchanged.
Existing Treasury exports and transaction flows are unchanged.

## Daily staking accrual, recorded zeros and Home — LIVE, 2026-10-06

Owner requested daily accrued staking income, no duplicate revenue on claims, and
zero values/sums for accounts without recorded movements, including consolidation.
[PR #187](https://github.com/cristianoneta/neta-dao/pull/187), merged as
`2fcf43c8ba236f2feeb609e199864a11afa5c41c`, adds a daily, claim-adjusted ledger:
closing withdrawable rewards minus opening rewards plus intervening withdrawals.
Both explicit claims and automatic withdrawals during staking changes are captured
from SDK events. Exact matched claim transfers are settlements, outside revenue.
Unknown movements, unexplained decreases, stale sources and missing USD quotes
block recorded totals. The normal 15-minute holdings/receipt refresh is retained;
reward sampling advances once per UTC day to the previous day's closing block.

Historical state at 1 October was unavailable from the inspected public providers.
The earliest existing pinned reward snapshot is **6 October 13:57:10 UTC**.
The first recorded accrual ends **15:21:23 UTC**: **454.025905 JUNO / $4.19**.
Opening stock is not income. Earlier October staking revenue remains unavailable;
it must not be described as zero. Daily periods use historical opening USD quotes,
never current repricing. The archive and quote cache are new collector-owned files.

Community Pool outflows were checked against matching SDK withdrawal events by
transaction message and denomination. No unmatched outflow was found in the
current archive. Recorded zero expense accounts and recorded surplus can therefore
be shown provisionally. Zero Other income means no other *recorded* income;
unmeasured withdrawal dust and validator-removal remainders remain excluded.
Consolidated sums require every unit's recorded review to pass; missing/failed
sources or unknown payments must not silently become zero. No complete module
balance reconciliation or full October staking P&L is claimed.

Validation: **144 Node tests and 65 targeted Python tests passed**. Final PR #187
head `163a32e756b1c3f65702a6b688ba9705324133bd` passed
[frontend/contract CI 37490902889](https://github.com/cristianoneta/neta-dao/actions/runs/37490902889),
[browser CI 37490903045](https://github.com/cristianoneta/neta-dao/actions/runs/37490903045)
and onboarding check 37490902854. Browser coverage includes Community Pool,
Delegation Programme and consolidated statements; mobile and desktop screenshots
were inspected. [Production Treasury run 37491282504](https://github.com/cristianoneta/neta-dao/actions/runs/37491282504)
succeeded, including the dedicated Delegation collector. Production frontend CI
37491282485 and [Pages deployment 37491472688](https://github.com/cristianoneta/neta-dao/actions/runs/37491472688)
succeeded. Deployed data/code commit at verification: `516af0cc8047da7dda5fa903ef30c779351fad38`.
Live browser checks confirmed **Delegation income/result $4.19, expenses $0.00**,
and **Juno consolidated income/result $168.03, expenses $0.00**, as a dated,
provisional checkpoint. Existing bot exports and holdings history are preserved.

Home copy is updated to 6 October: DAO/SubDAO navigation, Community Tax, daily
staking accrual and recorded-total limitations. The Home element/attribute sequence
(except article dates), layout, CSS and artwork are unchanged and checked live.
A verification follow-up corrects the consolidated event label: non-transaction
staking accrual and SDK reward settlements are not labelled internal treasury
transfers merely because the distribution module also holds Community Pool assets.
The existing internal cash-transfer accounting logic is unchanged.

Daily accrual failures retain existing entries and block provisional totals. If a
later receipt replay changes claims in a recorded interval, collection stops for
reconciliation rather than silently rewriting income. Missing historical state or
missed UTC boundaries need source recovery; never move the opening baseline forward
or count existing claimable holdings as new revenue.

## Community Pool October tax accounting — LIVE, 2026-10-06 15:25 UTC

[PR #185](https://github.com/cristianoneta/neta-dao/pull/185) is merged as
`7ca484404c6a8e30a4cd68cda271abc9c7e6ce80`. Community Tax now appears in the
shared Income statement and Treasury events on the live Community Pool page.
The initial October backfill is complete through the first production checkpoint:
**185,121 consecutive blocks**, 42,244,897–42,430,017, through
**2026-10-06 15:21:10 UTC**. The 188 tax entries total approximately
**18,135.997553 JUNO / $163.17**, using historical daily-opening USD references.
All observed tax allocations across six UTC dates have a quote. These figures
are a dated checkpoint; preserve newer bot exports. Full Pool accounting remains
partial, including other module income, expenses and operating result.

Validation and publication evidence:

- Local: **140 Node tests and 58 targeted Python tests passed**.
- Final application head `90a2d8a3b26f6adefaf51a911b2684681ab78312`:
  [frontend/contract CI 37486227103](https://github.com/cristianoneta/neta-dao/actions/runs/37486227103)
  and [browser CI 37486226828](https://github.com/cristianoneta/neta-dao/actions/runs/37486226828) passed.
  Community Pool browser coverage includes 320, 390, 768 and 1440 px, statement
  filters, explicit historical valuation and block-linked events.
- Production [Treasury run 37486842132](https://github.com/cristianoneta/neta-dao/actions/runs/37486842132)
  completed successfully. Its incremental scan added **382 blocks in four seconds**,
  and all three receipt/statement refreshes completed. The earlier local Operations
  refresh failure did not recur in this run. Bot data commit: `59403333ea1be8bcf0e89d972aeaa2d43dd15e0a`.
- [Production frontend CI 37486841987](https://github.com/cristianoneta/neta-dao/actions/runs/37486841987)
  and [data deployment 37486960908](https://github.com/cristianoneta/neta-dao/actions/runs/37486960908) passed.
- Live browser verification confirmed **Community Tax $163.17**, October 2026,
  “Historical daily USD references”, block-linked Treasury events and unavailable
  expense/result totals. The served accounting export is schema 3 with CURRENT
  block coverage through the height above. The provider warning about unavailable
  older governance pages remains visible; it is not silently removed.

Update cadence: Operations, Community Pool and Delegation Programme collectors
are scheduled every **15 minutes**; NETA Main every **30 minutes** at :07 and :37.
An open Treasury page reloads published exports every **60 seconds**. Collector,
GitHub scheduling and deployment latency apply; Refresh does not trigger a chain
collector. Existing holdings snapshots and published functionality are preserved.

- Community Tax is derived from each block's fee-collector transfer minus emitted
  validator rewards, using exact decimal arithmetic. It includes allocation
  rounding; the current 10% parameter and pool-balance differences are not used.
- The single existing Treasury workflow resumes the scan at the last checked block.
  The initial October backfill is the expensive step; normal runs read only new
  blocks. Checkpoints survive individual provider failures.
- Tax entries populate the shared Income / Community Tax row and Treasury events.
  They link to blocks, with explicit ranges, never invented transaction hashes.
- USD values use a cached historical UTC daily-opening market reference, explicitly
  indicative rather than an executed payment rate. Missing quotes stay unpriced.
- Full expenses/result remain unavailable: withdrawal rounding, validator-removal
  remainders, generic payment classification and balance reconciliation are open.
  A passed proposal does not establish a paid expense.
- Existing allocations survive a failed subsequent funding/price refresh. Duplicate
  denominations, overlapping ranges and mismatched coverage fail validation.

Owner asked whether tax could be estimated between snapshots. This is possible as
an explicitly labelled estimate only after correcting for payouts and other inflows.
The current saved daily snapshots do not align to UTC month boundaries; historical
state queries attempted here failed. No estimate is silently substituted into the
verified tax ledger. A future estimate must remain separate from evidenced actuals.

See [block accounting implementation](docs/COMMUNITY_POOL_BLOCK_ACCOUNTING_2026-10-06.md).

## Juno Delegation Programme and Community Tax — 2026-10-06

Owner named Juno's main reporting unit **Community Pool** and added
**Delegation Programme** under Juno. The supplied core is
`juno1nmezpepv3lx45mndyctz2lzqxa6d9xzd2xumkxf7a6r4nxt0y95qypm6c0`.
Public chain config identifies **Secondary Community Pool** (code 4047; original
contract label Council). Keep the requested display name separate from identity
checks. Organizational reporting does not confer contract authority.

The dedicated collector includes height-pinned bank balances, native delegated
stake, unbonding, per-validator truncated claimable rewards and DAO-listed CW20s.
Redelegations are already counted in delegated stake. This treasury contains small
non-JUNO bank assets as well; do not hardcode a JUNO-only portfolio. Other DeFi
positions/unlisted contracts are outside discovery coverage. Separate event and
accounting files begin at the shared 1 October cutoff. Staking classification,
slashing and payment-time pricing remain incomplete; accrued rewards are holdings,
not automatically booked revenue. Juno consolidated assets include both units;
incomplete Community Pool/module accounting still blocks consolidated P&L totals.

Community Pool income now has **Community Tax** (`community_tax`) and **Other
income**, shared into Juno consolidation but not other DAOs. The live parameter
read on 2026-10-06 was **10%**. Distribution rewards include minted inflation and
transaction fees. The collector records the current rate/source/date separately
from revenue; never apply today's rate retroactively or infer tax from balance
changes. Historical block-level accruals and payment-time prices remain open.

Implementation and source boundaries: [Juno Treasury onboarding](docs/JUNO_DELEGATION_TREASURY_2026-10-06.md).
Release PR: [#183](https://github.com/cristianoneta/neta-dao/pull/183).
Application `a1930ed4ef5605e00392dd05f880e56f51466ee7` passed contract/frontend
[37475015127](https://github.com/cristianoneta/neta-dao/actions/runs/37475015127),
browser [37475015023](https://github.com/cristianoneta/neta-dao/actions/runs/37475015023)
and live collector [37475015072](https://github.com/cristianoneta/neta-dao/actions/runs/37475015072).
136 JavaScript and 62 targeted Python tests passed locally. Browser screenshots for
both Juno units and consolidation were reviewed at 320/390/768/1440px.

### Published checkpoint — 2026-10-06, 16:10 Europe/Berlin (14:10 UTC)

PR #183 is merged as `33ef6db9da688c75be1dd323dcab94b96735ffd4`.
This is the current checkpoint; older sections below are historical context and do
not supersede the connected adapters or the remaining coverage gaps described here.

- Main contract/frontend CI [37475921659](https://github.com/cristianoneta/neta-dao/actions/runs/37475921659)
  and NNS CI [37475921688](https://github.com/cristianoneta/neta-dao/actions/runs/37475921688) passed.
- Production Treasury workflow [37475921767](https://github.com/cristianoneta/neta-dao/actions/runs/37475921767)
  passed every collection step, including Delegation Programme. Its LIVE snapshot
  is pinned to height **42,428,202**, observed **2026-10-06 14:03:56 UTC**.
- Pages [37476007738](https://github.com/cristianoneta/neta-dao/actions/runs/37476007738)
  successfully deployed bot snapshot commit `3d54ccd0fd54ecb0c17321c5637f26d083ea279a`,
  which includes the release. Preserve this and newer generated data when continuing.
- Ten served HTML/JavaScript/module files matched reviewed source byte-for-byte.
  Production browser inspection confirmed both unit names, **2/2 units** in Juno
  consolidation, separate liquid/delegated/reward positions, and the Community
  Pool's **Community Tax / Other income** rows. Its accounting basis displays the
  observed **10%** rate and the historical-coverage limitation. No wallet action.

Verified production entry points:
[Community Pool](https://dao.netareborn.com/index.html?dao=juno&chain=juno&subdao=main#treasury),
[Delegation Programme](https://dao.netareborn.com/index.html?dao=juno&chain=juno&subdao=juno-delegation#treasury),
[Juno consolidated Treasury](https://dao.netareborn.com/index.html?dao=juno#treasury).

At that production snapshot, Delegation Programme held **2,916,586.371620 JUNO
available**, **14,999,522.938953 JUNO delegated**, **3,830,019.995514 JUNO claimable**,
and no unbonding JUNO. Other assets: **2.096638 ATOM available + 0.140151 ATOM
claimable**, **686.021124 BTSG** and **0.001403 USDC**. These are dated observations;
subsequent generated snapshots supersede them.

### Next continuation

1. Start from fresh `origin/main`; preserve bot snapshots and use a branch/PR.
2. If continuing Treasury accounting, reconstruct Community Pool block/module
   accruals and payouts from **1 October 2026 UTC** and attach historical USD prices.
   Do not use today's Community Tax rate retroactively or infer revenue from
   changes in the pool balance. Do not restart pre-cutoff backfills.
3. Delegation Programme still needs staking-receipt/slashing classification,
   payment-time valuation and reconciliation; claimable holdings are not cash income.
   Generic proposal-category-to-executed-payment matching also remains open.
4. Keep Community Pool and consolidated P&L totals unavailable until the missing
   evidence is covered. Daily history will grow through the existing workflow;
   there is no need to initialize this DAO again or add another scheduled collector.


## DAO hierarchy and consolidated Treasury — 2026-10-06

Owner approved Chain → DAO → SubDAO. NETA is the organization; Main and Operations
are its units. **Operations is formally a SubDAO of NETA without an asserted
on-chain parent link.** The canonical directory stores this organizational
relationship separately from contract identities and signing capabilities.

- DAO selection defaults to Consolidated overview; Main is first in the unit
  group, remaining SubDAOs alphabetical. `?dao=neta` is the organization overview;
  `?dao=neta&subdao=main` selects Main. Old `?dao=neta-operations` links still select
  Operations. Scope is persisted separately; drafts and journals keep their IDs.
- Consolidated assets include each configured custody account once, including
  Operations' Osmosis proxy. Unit cards show source times, addresses and direct
  links. Missing/stale units remain explicit; unpriced assets remain partial.
- Consolidated P&L requires reviewed data from every included unit for period
  totals. An expandable unit breakdown preserves attribution. Exact reciprocal
  same-chain transfer legs can be eliminated only from the group view; unmatched,
  ambiguous or IBC legs without packet linkage remain unresolved. External gas
  and unknown movements are not silently eliminated. Source ledgers are unchanged.
- History uses common UTC snapshot dates only; no missing-unit forward filling.
  Snapshots may have different observation times. This remains estimated holdings
  attribution, not transaction-derived P&L or balance reconciliation.
- Other workspace sections continue to show the selected unit (Main in overview),
  with an explicit scope note. There is no combined governance authority or vote.
- Owner removed the network/testnet badge entirely from **Treasury**. Actual
  testnet areas retain their contextual indicator and transaction protections.

Remaining: generic expense execution/pricing and native Community Pool block/module
coverage stay incomplete as documented below. Consolidation does not close them.
Local validation: 135 JavaScript tests and 8 DAO onboarding tests; hosted browser
checks cover 320/390/768/1440 px, missing ledgers, race handling and scope navigation.
Release CI/deployment evidence belongs to the hierarchy PR.


## Treasury header refinement — 2026-10-06

Owner requested removal of USD/NETA buttons and the right-side “Live assets /
Partial accounting” badge on every Treasury page. The shared header now omits
both, moves the snapshot timestamp/source into its introduction and removes
the separate controls row. USD and coverage labels remain at the P&L.
Accounting adapters and the remaining native-module boundaries below are unchanged.

## Latest continuation — all-DAO accounting adapters (2026-10-06)

Owner asked to connect the remaining DAOs. Operations now has its own generated
accounting review for Juno core + Osmosis proxy. Native Juno has a separate direct
funding/governance adapter. Both are configured in the shared DAO directory and
loaded by the shared Treasury UI, with strict source identity and failure handling.

**Connected does not mean complete:** Operations can show provisional zeros only
for fresh reviewed recorded movements. Community Pool totals remain unavailable
because block allocations and drip/module payouts are not reconstructed. Approved
proposal-category-to-execution matching and historical USD pricing remain open.
The native adapter never books a passed proposal as a payment. Older Juno governance
pagination currently returns a provider server error; retained recent reads carry
an explicit partial-coverage warning. No live wallet write was performed.

See [adapter implementation and remaining boundaries](docs/TREASURY_ALL_DAO_ADAPTERS_2026-10-06.md).
Published in [PR #179](https://github.com/cristianoneta/neta-dao/pull/179), merged as
`15f53ebc99bffbe2c897878797671644d8a6384d`. Application head
`275f849d054471ffce297cbb3ad32ba55b71f16f` passed frontend/contract CI
[37466866330](https://github.com/cristianoneta/neta-dao/actions/runs/37466866330)
and browser CI [37466866353](https://github.com/cristianoneta/neta-dao/actions/runs/37466866353).
Main CI [37467182865](https://github.com/cristianoneta/neta-dao/actions/runs/37467182865)
and Pages [37467476267](https://github.com/cristianoneta/neta-dao/actions/runs/37467476267) passed.
Production Treasury collector
[37467182835](https://github.com/cristianoneta/neta-dao/actions/runs/37467182835)
completed both new adapters: Operations at **12:58:44 UTC**, native Juno at
**12:58:42 UTC**, with zero observed direct post-cutoff movements. This is not a
claim of zero native module income. Main collector
[37467182948](https://github.com/cristianoneta/neta-dao/actions/runs/37467182948)
also succeeded. Preserve newer generated snapshots on main.

Ten served application assets matched local SHA-256. Production browser inspection
confirmed Operations' provisional zero income/expenses/result and Juno's connected,
incomplete state without leaked NNS rows or fabricated zero totals. The hosted
browser suite covers 320/390/768/1440 px for both new adapters. No new wallet action.


## Latest checkpoint — 2026-10-06, Treasury categories and provisional totals

[PR #177](https://github.com/cristianoneta/neta-dao/pull/177) is merged as
`ca7160eb13aacbb1937b83e4c3e8abefe290c3dd`. It follows the cutoff/favicon release
[#176](https://github.com/cristianoneta/neta-dao/pull/176).

- Accounting starts **1 October 2026 UTC for every DAO**. Preserve earlier exports;
  do not restart pre-October backfills. Connected collectors continue on schedule.
- NETA's successfully refreshed, reviewed recorded activity can show **$5.00 income,
  $0.00 expenses and $5.00 provisional surplus**, plus zeros in empty accounts.
  These are snapshot totals, not a full coverage/reconciled-balance claim. Failures,
  stale current snapshots and unresolved movements block provisional totals.
- Treasury events show **Income · NNS registrations/renewals** when exact receipt
  evidence matches. Unknown legs remain **Unclassified**. Mixed transfers are visible.
- Each proposal action has a shared spending-category dropdown. Categories persist
  in local drafts and review revisions; changing a payment invalidates its category
  binding. Internal transfers have a separate non-expense option. No wallet write
  was performed to test this feature.
- **Still open:** automatic expense posting from executed mainnet proposals. The
  category is planned-purpose metadata; the execution adapter must match approved
  actions to actual treasury legs and payment-time prices before booking. Native
  Juno Community Pool and generic Operations accounting still need adapters.
- The mint voxel-N favicon/apple-touch icon from #176 is live.

Validation: **126 JavaScript + 43 targeted Python tests** pass. Final application
head `63d91447c2915f026cedb11ca3c9f1219e50a3b0` passed frontend/contract CI
[37462995391](https://github.com/cristianoneta/neta-dao/actions/runs/37462995391)
and browser CI [37462995304](https://github.com/cristianoneta/neta-dao/actions/runs/37462995304).
Treasury/proposal screenshots were inspected at **320, 390, 768 and 1440 px**;
browser checks cover category persistence/invalidation, zero/result display,
NNS tags, DAO isolation, identity/fetch failures and keyboard interaction.
Pages [37463261077](https://github.com/cristianoneta/neta-dao/actions/runs/37463261077)
succeeded. All **13 checked served files matched source SHA-256**, including
HTML, category/event/P&L modules, shared CSS, the NNS register and favicon.
Main frontend/contract CI [37463249064](https://github.com/cristianoneta/neta-dao/actions/runs/37463249064) also passed.

Fresh collector evidence: NETA receipt refresh **2026-10-06 12:23:42 UTC** succeeded,
with **1 matched receipt, 0 unreviewed observed movements** and PARTIAL index coverage.
Main collector [37462915165](https://github.com/cristianoneta/neta-dao/actions/runs/37462915165)
and Operations collector [37463193815](https://github.com/cristianoneta/neta-dao/actions/runs/37463193815)
succeeded. Preserve their newer main-branch snapshot commits when continuing.


## Continuation — 2026-10-06, accounting cutoff and favicon

Owner narrowed accounting to **1 October 2026 onward, for every DAO**. No older
backfill. The continuation implements a shared date-bounded receipt collector,
daily delayed-index replay, exact NNS movement cross-reference and a mint voxel N
browser icon. See [cutoff implementation](docs/TREASURY_CUTOFF_2026-10-06.md). Published in [PR #176](https://github.com/cristianoneta/neta-dao/pull/176);
all four PR checks and main frontend CI passed. Both production collectors succeeded.
The main DAO now has one matched NNS movement; coverage remains PARTIAL.
Complete P&L coverage and non-NNS classification/pricing/reconciliation remain open. Native Juno
Community Pool still has no accounting adapter. Preserve existing older exports.


Updated **2026-10-06, after PR #177 publication**. Current continuation entry point for
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
next Treasury work is reviewed expense/funding classification, payment-time prices
and balance reconciliation from 1 October onward; no older backfill.
Provisional zeros require successful refresh and exact movement review (see below);
never classify every incoming transfer as revenue.

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


### Treasury follow-up — 2026-10-06 (published in PR #177)

Provisional zeros and Income/Expenses/result now require a successful recent receipt
refresh and exact movement review; partial index coverage remains explicit.
Treasury event tags come from exact NNS receipt matches; unknown legs remain
Unclassified. Proposal actions expose shared spending categories, retained as
`dao_accounting_v1` metadata in local drafts and workshop revisions, bound to the
unchanged action. Mainnet spend execution/matching is still not connected, so a
planned category alone never posts an expense. See [the implementation record](docs/TREASURY_CUTOFF_2026-10-06.md)
for the schema and boundaries. PR #177 evidence is recorded at the top of this document.
