# Next-chat handoff — dao.netareborn.com

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

PR #183 contains this continuation. Release evidence is recorded after validation.


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

See [adapter implementation and remaining boundaries](TREASURY_ALL_DAO_ADAPTERS_2026-10-06.md).
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
browser icon. See [cutoff implementation](TREASURY_CUTOFF_2026-10-06.md). Published in [PR #176](https://github.com/cristianoneta/neta-dao/pull/176);
all four PR checks and main frontend CI passed. Both production collectors succeeded.
The main DAO now has one matched NNS movement; coverage remains PARTIAL.
Complete P&L coverage and non-NNS classification/pricing/reconciliation remain open. Native Juno
Community Pool still has no accounting adapter. Preserve existing older exports.


Updated **2026-10-06, after PR #177 publication**. This is the current continuation checkpoint.
Scope: `cristianoneta/neta-dao`, <https://dao.netareborn.com>.

## Read first

1. [AGENTS](../AGENTS.md), [root handoff](../HANDOFF.md) and [CURRENT_STATE](CURRENT_STATE.md).
2. For Treasury: [shared statement](TREASURY_STATEMENT_2026-10-06.md) and
   [receipt accounting](TREASURY_ACCOUNTING_2026-10-06.md).
3. For UI changes: [DESIGN_SYSTEM](DESIGN_SYSTEM.md). Reuse graphite/mint and the
   voxel assembly plaza; the wizard was rejected.
4. For other modules: [documentation index](README.md) and
   [open project priorities](../PROJECT_CHECKPOINT.md).

Fetch current main and inspect relevant open PRs/Actions before editing. Generated
snapshot commits keep advancing main; preserve them. The latest application
release below is a checkpoint, not an instruction to reset to its commit.

## Completed and published: standard Treasury statement

Owner asked for a reusable P&L across DAOs, a cleaner layout, expandable Income,
NETA-only NNS sources and a separate transaction page. All were implemented in
[PR #174](https://github.com/cristianoneta/neta-dao/pull/174), merged as
`735e997eee313e7801347ac072f09ff3b5d970ea` and verified live on 2026-10-06.

- Shared **Income / Expenses / Operating result**, with expandable configured
  accounts. `treasury-accounting-config.mjs` owns mappings; no per-DAO layout forks.
- NNS registrations and renewals appear only for NETA. Other DAOs use the generic
  schema with explicitly unconnected data. Other income is a separate account.
- Removed the duplicate observed-NNS-income card, permanent receipt sidebar and
  redundant unavailable KPI panels. Methodology stays in a compact disclosure.
- Years begin at **2026**, with **2027 and 2028** selectable. Future/empty periods
  do not imply zero activity. Month/full-year filters use UTC accounting boundaries.
- NNS source rows link to the separate [NNS payment register](https://dao.netareborn.com/nns-transactions.html).
  Year/month/payment-type filters, transaction links and immutable payment-time
  conversions are included. Return navigation preserves period and selects NETA.
- Mobile statement values remain visible without horizontal scrolling; the wider
  payment register uses a labelled scroll region and wrapping filters.

Live Treasury: <https://dao.netareborn.com/index.html?dao=neta#treasury>.
The register lists matched revenue payments, not all administrative, commitment or
name-transfer calls. Do not claim an exhaustive log of every NNS contract action.

### Evidence and accounting boundaries

119 root Node tests passed. Final application head
`24879f29e38724bd15d7e3522fd0d03624c76772` passed hosted frontend CI
[37447236498](https://github.com/cristianoneta/neta-dao/actions/runs/37447236498)
and browser suite [37447236381](https://github.com/cristianoneta/neta-dao/actions/runs/37447236381).
Screenshots were inspected at 320/390/768/1440 px. Main CI
[37447675306](https://github.com/cristianoneta/neta-dao/actions/runs/37447675306)
and Pages [37447673895](https://github.com/cristianoneta/neta-dao/actions/runs/37447673895)
passed; all nine changed served assets matched source SHA-256.

The release verification found one real NNS registration payment, **4.755098 NETA**,
displayed **$5.00** at its executed payment-time rate. The synthetic renewal is
only a browser fixture. The collector-owned ledger is
`data/treasury/neta-main-accounting.json`; do not edit its entries manually.
NNS receipt coverage remains **PARTIAL**. Complete income, expenses, operating
result remain unverified. The follow-up below permits labelled provisional zeros
and totals for successfully refreshed, reviewed recorded movements. Main-DAO event coverage was subsequently
connected by #176 from 1 October, with one verified NNS movement and PARTIAL coverage.
Transfers, swaps, funding and price movements are not automatically revenue.
Buyer-paid gas is not a DAO expense. Full accounting is the next data task.

## Names checkpoint — already live

PRs #169, #171 and #172 delivered the simplified purchase flow, lifecycle notices,
compact wallet/name summary and owner-focused Names management. Existing owners
get profile, renewal and transfer actions. Current on-chain tariffs populate the
UI; pending transaction discovery and recovery take precedence over new actions.
Browser-local welcome/renewal/transfer/expiry notices have profile/renewal links.
These are local system notices, not email/push or enabled private mainnet messaging.

Mainnet registry code **5168**, profiles code **5169** and addresses are pinned in
[the deployment manifest](deployments/nns-mainnet.json). Deployment, activation
and the first mainnet registration are complete; **do not repeat them**.
Recorded owner name: `cristiano.neta`, expiry `2027-10-05T18:20:13Z`.
[Deployment and receipt evidence](NNS_MAINNET_DEPLOYMENT_2026-10-05.md) is authoritative
for that historical observation; recheck ownership before a new wallet action.

Upgrade administration for both contracts and registry tariff/pause/price-key
administration remain with `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`.
Fees go to the main NETA DAO. Do not transfer authority without an explicit owner
action. Annual USD tariffs are **99 / 19 / 5** for 3 / 4 / 5–32 characters.
Use the existing Treasury price, 30-minute target refresh and up to 24-hour signed
validity. Keep the existing price key; no separate Render NNS service is needed.
Do not rerun the old paused-state launch verifier unchanged against the active registry.

## Next work and retained open gates

1. **Treasury data:** continue coverage from **1 October 2026** and reviewed income, expense,
   funding and internal-transfer classification; add authoritative payment-time
   prices and reconciliation. Keep the shared schema and explicit coverage states.
   Further source adapters belong in configuration/parser boundaries, not custom
   P&L pages for each DAO. Continue the owner's requested automatic spending
   allocation by implementing verified proposal-execution matching: consume the
   approved `dao_accounting_v1` per-action category, match actual outgoing treasury
   legs, fix payment-time USD, and prevent duplicate posting. Do not turn planned
   categories into actual expenses or enable mainnet writes as a shortcut. Operations and native Juno adapters are connected (#179); native block/module
   income and payout reconstruction remain open.
   NNS registrations/renewals already tag automatically from exact receipts.
2. **Names:** mainnet renewal/transfer and consenting live-validator E2E remain
   unverified; validator testing stays deferred. Existing UNI-7 lifecycle evidence
   must be reused; the separate UNI-7 tariff-update receipt remains outstanding.
   Read [NNS handoff](HANDOFF_NEXT_CHAT_NNS_2026-10-04.md) for the preserved setup.
3. **Faucet:** 25 JUNOX per rolling 24 hours is deployed. Real payout/replay/restart/
   empty-recipient and stake/unstake receipt gates remain open. See
   [faucet handoff](HANDOFF_NEXT_CHAT_FAUCET_2026-10-04.md). Backend deployment is
   manual on Render; application rate limits are not a hard hosting invoice cap.
4. **Delegation programme:** preserve approved criteria. Operator links alone do
   not establish active-set membership or award points. Live operator consent and
   chain-specific evidence are required. Smart Delegation research remains deferred.
5. **Encrypted messaging:** mainnet stays disabled. v0.2 consent/generation,
   prekey refill, coherent backup/anti-rollback and uncertain-outbox reconciliation
   remain release gates; see [implementation plan](RELAY_IMPLEMENTATION_PLAN.md).

No new live wallet transaction, contract deployment, admin change or private RPC
purchase was performed for the Treasury revision or this handoff.

## Working rules

Use branches and PRs. Inspect path-filtered CI and verify deployment when application
files change; ordinary documentation-only edits do not trigger the application suites.
Never hand-edit generated data, force-reset later bot commits, discard local keys,
registration secrets or pending transaction/crypto journals. Preserve Render SQLite/WAL.
Unknown broadcasts require exact-hash reconciliation; never silently resend or clear.
All live wallet writes require explicit wallet confirmation. No seeds/private keys.
The main DAO's write adapters, native Juno submission/voting and Treasury execution
remain unfinished; UNI-7 review finalization does not submit a mainnet proposal.

`netareborn.com` belongs to the separate `neta-website` repository. Its pool-coverage
task is recorded in that repository's handoff; it is not part of DAO accounting work.
Older session chronology is preserved in
[the previous handoff archive](archive/HANDOFF_BEFORE_TREASURY_CHECKPOINT_2026-10-06.md).
Historical next-step wording there does not supersede this checkpoint.


### Treasury follow-up — 2026-10-06 (published in PR #177)

Provisional zeros and Income/Expenses/result now require a successful recent receipt
refresh and exact movement review; partial index coverage remains explicit.
Treasury event tags come from exact NNS receipt matches; unknown legs remain
Unclassified. Proposal actions expose shared spending categories, retained as
`dao_accounting_v1` metadata in local drafts and workshop revisions, bound to the
unchanged action. Mainnet spend execution/matching is still not connected, so a
planned category alone never posts an expense. See [the implementation record](TREASURY_CUTOFF_2026-10-06.md)
for the schema and boundaries. PR #177 evidence is recorded at the top of this document.
