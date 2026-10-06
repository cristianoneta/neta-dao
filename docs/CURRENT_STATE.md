# NETA DAO code-backed current state

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

See [block accounting implementation](COMMUNITY_POOL_BLOCK_ACCOUNTING_2026-10-06.md).

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

Implementation and source boundaries: [Juno Treasury onboarding](JUNO_DELEGATION_TREASURY_2026-10-06.md).
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


## Treasury statement revision — 2026-10-06

Published and verified in PR #174: shared Income / Expenses / Operating result rows
with configured child accounts. NNS appears only for NETA, and its filtered payment
register is a separate page. Removed the repeated observed-income card, fixed
receipt sidebar and redundant unavailable KPI cards. Years begin at 2026 with
2027/2028 available. Full DAO accounting remains unavailable; receipt subtotals
are explicitly partial. [Implementation and release tracking](TREASURY_STATEMENT_2026-10-06.md).


Updated **2026-10-06** after publishing and verifying the standard Treasury statement (#174), following the Names releases (#169/#171/#172). Source-tested work and live deployments are distinguished below. This file owns the feature inventory;
[HANDOFF](../HANDOFF.md) owns the next action and working rules. Observed chain,
service and data states are timestamped evidence, not guarantees of future state.
The previous append-only inventory is retained in the [archive](archive/CURRENT_STATE_BEFORE_CLEANUP_2026-10-04.md).

## Repository and shared UI

This repository owns `dao.netareborn.com`; `cristianoneta/neta-website` owns
`netareborn.com` and legacy Operations workshop source. Do not duplicate the DAO
frontend there. `index.html` loads governance, Treasury, RELAY notifications, Names workspace/profile
controls and shared navigation. Names signing loads only on a deliberate
wallet action; the CoreCrypto runtime and separate wallet lab are not embedded.

The approved graphite/mint design uses shared `neta-ui.css`, the assembly-plaza
Home hero and existing voxel module artwork. Follow [DESIGN_SYSTEM](DESIGN_SYSTEM.md).
PRs #108/#109/#117 shipped shared styling, mobile fixes and module illustrations.
Full per-page interaction/accessibility coverage remains incomplete.
Wallet controls display the connected address and expose Disconnect; disconnect
preserves drafts, keys and transaction journals. Tests cover late connection replies.

## DAO directory and People

`data/dao-directory.json` owns identity/capability/source mapping; generated
`dao-directory.js` serves Operations, the main Neta DAO and native Juno Governance.
Use [DAO_ONBOARDING_CHECKLIST](DAO_ONBOARDING_CHECKLIST.md) for additions.
The main DAO has read-only proposals, Treasury, staking participants and following;
its writes remain disabled. `.dao.neta` directory labels are not registered names.
Main DAO events from 1 October are connected with PARTIAL provider-index coverage
(PR #176); one NNS payment movement is verified. Its separate NNS accounting ledger
matches registry payments, exact NETA forwarding
and the executed price snapshot. Full historical accounting remains unavailable.

People/Members uses Operations cw4 membership, main DAO staked NETA and the native
Juno bonded-delegation adapter. Native Juno participation is explained rather than
shown as a fabricated DAO member list. Contributors is a shared planned state;
there is no authoritative contributor assignment/role/payment service.
See [People evidence](PEOPLE_MEMBERS_CONTRIBUTORS_2026-10-03.md).

## Names task-focused UX — 2026-10-06

This revision separates owner management from registration and renewal forms;
shows pending local transactions before a Names signing connection; distinguishes
active, grace and released names; and loads the public profile automatically.
Profile edits survive route/wallet switches in memory without late reads replacing
user input. Reloading the browser still discards unpublished profile edits.
Expired-name lookup uses verified local hints, with manual lookup for fresh browsers
because `name_of` returns active names only. Current on-chain tariffs populate the
price rules. Payment reviews expose the debit, Treasury, price age and expiry in
readable rows, retaining full details. No contract or signing protocol changed.
See [HANDOFF](../HANDOFF.md) for release tracking and remaining real-wallet checks.

## Compact Names panel — 2026-10-06 follow-up

Implemented in [PR #171](https://github.com/cristianoneta/neta-dao/pull/171)
(see its checks and release evidence for publication status): an automatic,
read-only summary shows the connected wallet's name and expiry. Edit profile and
Renew name fill the existing forms after rechecking ownership; confirmations stay
explicit. A compact network selector stays visible. Optional refresh controls and
technical pricing details are collapsed. Wallet/network changes invalidate old
reads, failures offer retry, and automatic reads preserve form drafts and journals.

## Names: main workspace versus UNI-7 lab

| Surface | Implemented and connected | Boundary |
| --- | --- | --- |
| Main RELAY Names | Directory/DAO reads and follows; network-selectable mainnet/UNI-7 lookup, registration, renewal, transfer, public contact reads/updates and validator preview | Mainnet purchases opened and first registration verified on 2026-10-05; UNI-7 purchases use the original local key |
| `names-mainnet-deploy.html` | Four owner-confirmed mainnet upload/instantiate actions with pinned public key and owner-wallet upgrade admin, persisted recovery and two-provider receipt export | Four deployment receipts recorded; subsequent activation and first purchase recorded separately |
| `names-v2-setup.html` | Explicit Keplr upload/instantiate/activation, local test quote key, manifest export and receipt recovery | Existing owner deployment is already complete; do not repeat setup |
| `names-v2-lab.html` | Verified manifest, mock-NETA registration/renewal, recipient-accepted transfer and public contacts | UNI-7 only; quote rate is fictional USD 2/mock NETA |
| Independent validator observation | Wallet-free entered-pair check; stored-link refresh checks both validator records and UNI-7 consensus keys at a displayed block | Public provider observations, latest staking records, no uptime or programme points; unavailable data stay unresolved |
| Validator ownership section | Exact contract-matched challenge, separate juno-1/uni-7 ADR-36 signatures, reviewed publication, owner unlink, unilateral revocation | Live consenting-validator E2E outstanding; no points or active-set attestation |

`names.js` retains inactive v1 with `REGISTRY=null`; `NAMES_V2_DEPLOYMENT` and
`PROFILE_DEPLOYMENT` are also null for production. These legacy constants do **not** disable or identify the manifest-driven deployments.
Mainnet uses `docs/deployments/nns-mainnet.json`; UNI-7 retains its own manifest. Codes 122/123/124 and the
registry/profile/token identities are in the [public manifest](deployments/nns-uni7-owner-2026-10-04.json).

My profile's validator preview has a labelled Network selector, currently Juno
only. Its network entry supplies the mainnet/testnet labels, chain IDs, address
prefix and validation. Unknown networks are rejected; selection edits invalidate
the preview. Future networks need their own verified adapters and contract support.
The current lab and ownership proof protocol remain pinned to `juno-1` / `uni-7`.

**UNI-7** owner-signed registration, contacts, renewal and transfer were checked through
latest-state reads on 2026-10-04. Current observed owner of `cristiano.neta` is
`juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`, generation 1, ownership revision 2,
expiry 2028-10-03T19:15:41Z. Old owner mapping/offer are cleared; visible contacts
are empty after transfer. See [NNS handoff](HANDOFF_NEXT_CHAT_NNS_2026-10-04.md) for
receipt limits, setup receipts and release verification through PR #145.

`names-v2-validator-status.mjs` separately checks fresh `juno-1`/`uni-7` block
identity, exact operator records, and the full paginated UNI-7 consensus set at
one recorded height. Latest staking records are not height-pinned; this is a
read-only diagnostic, not an eligibility snapshot or light-client verification.
Input/manifest changes cancel observations and prevent late result replacement.

`names-v2-workspace.mjs` integrates mainnet and existing UNI-7 adapters into the main
RELAY name/profile panels using the shared header wallet, pinned public manifests,
explicit reviews and chain-scoped persisted transaction journals. It does not deploy
new contracts or activate a public/mainnet quote service. Browser quote creation
still needs the original setup browser. See [integration](NAMES_MAIN_PAGE_INTEGRATION.md).

`names-v2-reader.mjs` verifies deployment and fresh data on the selected chain;
`names-v2-client.mjs` coordinates reviewed intents and exact receipt recovery;
`names-v2-wallet.mjs` bridges Keplr and the existing origin transaction journal.
`names-v2-validator-proofs.mjs` keeps unpublished proofs in tab memory across
deliberate wallet switches, with expiry/revision/identity checks;
`names-v2-validator-ui.mjs` handles the distinct signature/publication reviews.
Lost/unknown submissions stay locked until reconciled; no automatic resend occurs.
The published PR #169 purchase UI combines registry verification with Check availability,
and local preparation with Start registration. Buy name / Buy and confirm in Keplr
explicitly label payment; renewals use corresponding renewal labels. Load my name
verifies the registry on demand. Commitments are non-exclusive and valid for one
hour; the matching on-chain deadline is displayed and checked before purchase.

The accepted annual tariff is USD 99/19/5 for 3/4/5–32 characters, for both
registration and renewal, 1–5-year terms, 365-day years and 30-day grace. Mainnet
fees target the main NETA DAO, not Operations. The owner subsequently approved reusing the existing Treasury WYND NETA price,
with scheduled 30-minute refresh and up to 24 hours of signed validity. Registry
source v0.3.1 accepts shared-price hooks in addition to legacy individual quotes;
its new WASM is pinned separately under `assets/names-mainnet/`. Existing deployed
UNI-7 code and historical artifacts are unchanged. `names/publish-snapshot.mjs`
signs the collector's explicit `nns_price` offline in the main DAO job; no new
market polling or Render service is needed. `snapshot-client.mjs`, shared core
validation and `NamesV2Client.snapshotQuote` support reviewed snapshot payments
and existing recovery. The normal page/reader/wallet now supports both chains; UNI-7 retains
its old local individual-quote flow. Mainnet adapters and browser price-key setup
are implemented and synthetically tested. The owner supplied the public price key, now pinned in the separate deployment page.
Owner decision: registry/profile upgrade rights initially belong to
`juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`, transferable to the DAO later.
The owner wallet also controls tariffs, purchase pause and price-key rotation;
the main DAO is the fee recipient. Registry v0.3.1 makes application admin
independent of that recipient and starts with USD 99/19/5 while paused. Upgrade
authority is set separately in the outer instantiate message. A synthetic
migration test verifies authority, state preservation and subsequent DAO transfer.
The owner completed four mainnet transactions and exported matching two-provider
paused observations at 13:54 Berlin. Registry code 5168 and profile code 5169 are
recorded in `deployments/nns-mainnet.json`; exact receipts and verification procedure
are in [deployment evidence](NNS_MAINNET_DEPLOYMENT_2026-10-05.md). PR #161 is merged with
all four checks passed, including live verification run `37307194424`. The owner corrected the PEM delimiters in the existing Actions secret at 19:38 Berlin.
Fresh Main DAO run `37350238171` published the first signed price; Pages run
`37350292762` passed and the served file matched. Signature, deployment binding,
source rate and 24-hour observation-based validity were independently verified.
The two-provider check passed via GitHub Actions at 19:49:53 (run `37307194424`,
job `111902537250`): Polkachu and STAVR agreed on code/config and paused state.
Use that read-only workflow if direct assistant requests are blocked; normal
page reads use one verified provider with fallback. See the recovery section in
[deployment evidence](NNS_MAINNET_DEPLOYMENT_2026-10-05.md).
PR [#158](https://github.com/cristianoneta/neta-dao/pull/158), merge
`62f12f1a0c672a776a5f3500ab4e8e8a09b93e42`, passed all 11 final PR checks,
three main checks and Pages `37302003843`; 15 served assets matched SHA-256.
The [targeted review](NNS_SECURITY_REVIEW_2026-10-05.md) records 210 passing
Rust/Node tests and browser evidence, with remaining trust/launch gates.
The main Names page now provides owner-only reviewed purchase opening/pausing
using the existing exact-transaction journal and Keplr bridge. Opening requires
a valid signed price; review/config/wallet are rechecked before signing and after
wallet return before broadcast. Tariff editing has no dedicated mainnet panel yet.
Owner-confirmed activation (18:17:20 UTC) and first mainnet registration
(18:20:13 UTC) are now recorded. `cristiano.neta` belongs to the approved owner,
generation/revision 1, expiry 2027-10-05T18:20:13Z. Successful STAVR REST receipts
show 4.755098 NETA debited to the registry and forwarded to the main NETA DAO;
fresh identity/resolve reads agree. See [launch evidence](NNS_MAINNET_DEPLOYMENT_2026-10-05.md)
for hashes and the single-provider verification boundary. Mainnet renewal/transfer
and validator E2E are still unverified; Treasury receipt accounting is published with partial coverage.
See [runbook](../names/README.md) and [historical snapshot evidence](NNS_SNAPSHOT_RELEASE_2026-10-05.md).
The earlier continuous WYND server is deferred, not hosted. Its stricter policy
is not the policy of the approved snapshot system.
The existing UNI-7 registry needs an explicit admin `set_tariff` transaction via
the lab Annual pricing section; source/UI changes do not alter deployed config.
Its activation remains unverified until that wallet receipt/config is checked.
`names/mainnet-plan.mjs` prepares unsigned mainnet deployment and admin-wallet tariff
review material. The approved owner wallet can set the mainnet tariff or purchase availability. Deployment transactions are
separately recorded in the production manifest and receipt bundle.
Original WASM/bootstrap tariff and signed historical fixtures remain unchanged;
new installations also apply the approved tariff before purchasing. Quotes read
the current on-chain tariff/version.
Free DAO namespaces, verified receiving addresses, private contacts and
DAO-authorized profile proposals remain later work. Browser-local lifecycle
notifications are published in PR #169; hosted checks, Pages and served files were verified on 2026-10-06.

## UNI-7 faucet

`juno-faucet.html` is a separate tool linked from the common footer. It supports
Keplr, validators/commission, balances/delegations/unbonding/rewards, reviewed
stake/unstake/reward transactions, whole-JUNOX donations and 25-JUNOX requests (PR #147; Pages assets and Render `/status` verified 2026-10-05).
The public API/address are pinned in `juno-faucet-config.mjs` and the HTML CSP.

Render uses durable SQLite, ADR-36 ownership proofs, rolling 24-hour per-wallet
cooldown and aggregate request/payout/concurrency limits. The frontend requires
`usage-guards-v1`, `uni7-exact-hash-v1` and `bank-send-gas-v1`. These are application
limits, not a hard hosting invoice cap. Render auto-deploy is off; backend changes
need a manual deploy, while static Pages changes do not.

Reward and 15-JUNOX donation receipts were verified. Real payout/repeated-request/
restart/fresh-empty-wallet checks and stake/unstake evidence remain unrecorded.
Fresh service readiness alone does not close these gates. Read [faucet handoff](HANDOFF_NEXT_CHAT_FAUCET_2026-10-04.md)
for current observations and [faucet README](../faucet/README.md) for operation.

## Governance: two different APIs

| Item | Operations | Juno community review |
| --- | --- | --- |
| Workshop network | UNI-7 | UNI-7 |
| Configured address | `juno1d2xdlvy23am07twe046zzxxndjtccgpwwl3pyu5g98u07qu3nyqqkaz65h` | `juno18d3mzk3ver06zfr5nf752aycss75vtcqd8fsdcuuzmh5mzj4cm6qrgx3fw` |
| Source | Other repo: `contracts/neta-governance/` (legacy) | This repo: `contracts/neta-proposal-workshop/` v0.3.0 |
| Publish / revise / finalize | Positive configured voting power | At least 1 delegated JUNOX and 1 staked test NETA via access mock |
| Comments | Strictly greater than 10 active NETA threshold | Same dual gate; 30-second comment cooldown |
| Finalization | `finalize_and_submit` sets UNI-7 status `voting` only | `finalize` records latest version/hash, closes discussion |
| Withdrawal UI | Discussion author must also be config owner; `set_status: declined` | Discussion author may `withdraw`; contract allows broader pre-submission withdrawal than UI |
| Thread encoding | Body markers `[[NETA_THREAD:…]]` / `[[NETA_REPLY:…]]` | Native title/parent/version fields |

Recorded Juno code ID 114, access mock
`juno10739807rjqkf4kmtvpu5ll5e67dkch82xzgph83cmn5h8n0fxmnszasg86`,
review checksum `6eb604c255d01414880bdcb9cc1d1df69dc2507f25ffc6e6d51388945ff63f22`.
The canonical Juno address is in `neta-governance.js`, not just localStorage.
No new on-chain deployment/state verification was performed in this docs review.

Mainnet Operations history comes from
`juno1m9skms04ymmhsyc2q9cguja47d07mljsfnvm8f584dc645urxvjsjc9ep0`.
For an open, non-native proposal, `selectChain` exposes vote buttons and
`mainnetSigner` requests `juno-1` before a module `vote` execute. Native Juno
history/parameters use `x/gov`; its vote buttons are hidden and native deposit/
submission is absent. No review-to-mainnet submission adapter exists.

Drafts are stored per DAO in browser localStorage. Published revisions/comments
are chain records. `dao_deliverable_v1` records in `actions_json` are plans, not
executable Cosmos messages; future adapters must separate them.

Completeness and implementation limits: Operations mainnet history stops after
20 pages of 30; workshop pagination stops after 100 pages of 100. Legacy revision queries ignore cursors; the frontend now queries them once and
shows an explicit potential truncation warning at 100 records. Recovery queries for some writes inspect only 100
records. Do not promise unlimited/full history without these qualifications.
The legacy contract has no v0.3.0 hash/JSON-array/cooldown/withdraw hardening, and
converts failed access reads to zero. Frontend checks are not contract guarantees.

## Treasury: live snapshots, limited accounting

The [accepted P&L draft](TREASURY_PNL_DRAFT_2026-10-05.md) remains the design reference.
The [2026-10-06 receipt-accounting implementation](TREASURY_ACCOUNTING_2026-10-06.md)
adds period/category views and an isolated NNS receipt collector in the existing
main DAO job. NNS subtotals use the transaction’s accepted conversion rate;
complete income, paid-expense and result coverage and reconciliation remain unavailable.
The follow-up below adds explicitly provisional totals for reviewed recorded activity.
The old fictional Treasury forecasts, allocations and payments are removed from
the live page source. Publication status belongs to the implementation record.

| Owner | Inputs / outputs |
| --- | --- |
| `scripts/update_treasury.py` | Operations Juno DAO core `juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl`, Osmosis proxy `osmo1xjfyz4f7da2yu43c0ptlswyln50wqyj53495sesaq40ja5megq4qms9f80`, native Juno Community Pool; writes `current.json`, `history.json`, `juno-community-pool.json`, `juno-community-history.json` |
| `scripts/update_treasury_events.py` | Juno core/Osmosis proxy TX indexes; writes `events.json` |
| `data/treasury/token-registry.json` | Versioned input mapping, not an output staged by the scheduled workflow |
| `treasury.js` | Refetches committed JSON on load, Refresh and every 60 seconds; renders assets, history and Operations events |

The 15-minute workflow publishes only after balances and event collection
succeed. Event collection and push each retry three times; pushes rebase with
`-X theirs`. Preserve collector ownership and review overlapping-file changes
rather than assuming this conflict strategy is a general safe merge.

Daily history is captured during Berlin hour 21 with `TREASURY_DAILY_SNAPSHOT=auto`,
replacing the entry for the same UTC date on each successful run in that hour.
It retains at most 730 records; no backfill guarantees a missed day. The frontend
replaces today's history point with the current snapshot in memory.

Assets include native/IBC coins, configured CW20s and eight configured WYND LPs
including direct/staked/claim shares. LP USD value is counted once via underlying
reserves. Unpriced assets and sub-USD-50 assets/warnings remain inspectable.
Core balance failures fail collection; unresolved asset prices can yield a
`PARTIAL` snapshot and are excluded from the USD total. The UI labels this a
priced-assets subtotal and groups valuation warnings inside the collapsed small/unpriced
asset details (owner UI decision, 2026-10-05).

History market effect revalues opening quantities at closing implied prices;
the remainder is labeled net flow. `economicAssets` groups by **symbol**, not a
verified universal asset ID. It can consolidate internal transfers but is not
transaction-derived cash flow and can be distorted by symbol collisions,
LP composition and changing coverage not captured by the available records.
History metrics/chart are withheld when excluded-price coverage changes across
the selected range; missing prices must never be interpreted as a cash outflow. Balances are fetched at latest endpoints;
the recorded Juno height is context, not height-pinning of every query/chain.
Native metadata uses a persisted exact-denom registry and traces. Unknown IBC
base names no longer inherit USDC/DAI/ATOM prices; they remain unpriced until
reviewed. Unreviewed native/IBC decimals now remain unknown and quantities display raw units. Unpriced LP underlying
assets now also make the snapshot PARTIAL. Registry changes are not automatically persisted.
The five reviewed Osmosis routes are explicitly chain-scoped in the registry; see
[Treasury valuation correction](TREASURY_VALUATION_FIX_2026-10-03.md) for dated
incident evidence. Current data timestamps/status belong to the exported JSON.

Event ledger: schema v2, chain/hash deduplication and optional proposal-title
metadata. Main NETA and Operations Juno/Osmosis now use REST receipt queries with
fresh chain identity, exact receipt timestamps, anchored watermarks, 100-block
overlap and 20-block tip delay. Daily replay starts at a verified recent floor
before 1 October and filters by the exact UTC cutoff; no older backfill. Existing
older records stay intact. Empty native indexes no longer prevent CW20 discovery.
Missing known receipts, changed amounts/identity, corrupt prior JSON and truncated
pages fail without replacing valid exports. `TREASURY_EVENTS_FULL_REPLAY=1` replays
from this accounting floor, not chain inception. Atomic writes preserve collector
ownership. Supported native/CW20-shaped movements are observations; unknown token
contracts retain raw units without guessed prices/decimals. Failed attempts do not
become payments. This is not a complete CW20/LP or module-distribution ledger.
The 2026-10-06 release runs retained all 57 older Operations records and found one
main NNS payment; no new Operations receipts were returned in the scanned range.
That empty result is not a proof of zero economic activity. The exact NNS Treasury
leg is cross-referenced to its payment-time ledger entry once; remaining movements
stay unreviewed. Full P&L, balance reconciliation and native Community Pool
accounting remain unavailable. See [release evidence](TREASURY_CUTOFF_2026-10-06.md).

`treasury.js` now aborts superseded requests, bounds fetch time to 15 seconds and
checks a request epoch before changing shared state or the UI. Late responses
cannot overwrite a newly selected DAO snapshot. See the security audit for tests.
Recurring cash flow, obligations, milestone payments and runway remain future work.

Main DAO snapshots use a separate 30-minute workflow and collector
`scripts/update_main_dao.py`; `data/daos/neta-status.json` must be read alongside
underlying snapshot timestamps. Membership has its own 30-minute workflow.
Neither replaces Operations exports. Scheduled cadence is not a freshness guarantee;
check latest timestamps and actual runs. The maintenance checkpoint records the
observed data lag and successful latest collector runs without claiming live data.


## RELAY: main inbox versus encrypted lab

PR #169 (published and verified on 2026-10-06) gives NNS system notices a Names filter, unread state and identity-scoped
history: first-registration welcome, renewal confirmation, outgoing and incoming
transfer notices, 6/3/1 calendar-month and 14/7/1-day reminders, expiry and grace-end
notices. Links open the correct profile/renewal menu without signing. Each observation
verifies registry/name identity; renewal supersedes previous expiry reminders and
transfer stops the old owner's reminders. Browser-local storage is scoped to
wallet, chain and registry. Updates occur with a connected wallet, on confirmed
actions and every 15 visible minutes; there is no offline push/email delivery.
Missed reminders catch up to the current stage. See [release evidence](NNS_FLOW_NOTIFICATIONS_2026-10-05.md)
for tested behavior and publication status. This is separate from private messaging.


Main `relay.js` polls followed, configured DAO proposal modules (at most 4 × 30 records each) and
native Juno proposals (latest 100) at most every 60 seconds while visible.
Visibility restoration respects that interval; fetch timeouts now abort the request.
It does **not** poll the UNI-7 workshops. Change detection can report new/status/
content updates from those sources; a `NEW REVISION` branch is not proof of a
connected workshop revision feed. First load seeds up to eight already-read
current notices, not an unread flood. Up to 200 events, favorites, baselines and
read state stay browser-local. No push, service worker or cross-device sync.

Inbox has feed and reader with current summary/activity. Favorites are managed
in Directory using Follow buttons and the Followed filter. RELAY has one navigation
level: Inbox, Directory, Contacts, My profile and .neta name. The old Names and
Following links redirect to Directory; browser Back/Forward restores destinations.
Operations and Juno Governance subscriptions use the existing browser-local storage
key, with synchronized follow controls in the Operations profile. There is **no
watchlist sidebar** in `index.html`. Zero unread badges
are hidden. Composer input lives temporarily in DOM; submit only prevents default,
Discard clears/closes, and SEND is disabled. Main UI contains no private messages.

Recorded mailbox identity: UNI-7,
`juno13uft9dl34x9wdzcxnm80q8m8sh5cw04lkskzknm9vc0wduxchdxsrnr4pa`,
creator `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`, label
`NETA RELAY mailbox v0.1 · UNI-7`, code hash
`e02c7918d1f8da0f662a0720fc3668765d79ededce8e9e9dcccff9aae2b9e64a`.
The pinned deployed mailbox is v0.1: hardcoded UNI-7,
no funds, no stake gate, one current device, max 16 prekeys, max 4096 ciphertext
bytes, 10-second sender cooldown and inbox pages up to 50. There is no historical
device registry, mainnet network configuration or mainnet 5-NETA implementation.

| Page / module | Actual capability |
| --- | --- |
| `relay-mailbox-status.js` | Read-only identity check when main composer opens |
| `relay-testnet-setup.html` | Admin Keplr upload/instantiate helper; existing deployment recorded |
| `relay-uni7-readiness.html` | Public two-address identity/device/inbox-header diagnostic; no register/decrypt/send |
| `relay-uni7-client.mjs` | Identity and wallet binding, public queries, prepared-device registration; loaded by lab, not main index |
| `relay-uni7-lab.html` / `.mjs` | Separate real Keplr-capable lab: create/unlock, register, encrypted send/receive, local archive/reload |
| `relay-uni7-archive.mjs` | Wallet-scoped AES-GCM readable-history archive, separately HKDF-derived key |
| `spikes/relay-corecrypto/` | Native/browser fixtures, key vault, DB backup experiment, lock/outbox/envelope/transport, mocked integrated lab |

Lab uses Wire CoreCrypto 10.5.3 Proteus, GPL runtime/license in `assets/relay-crypto/`,
eight initial prekeys and 1800 UTF-8 bytes of text. It persists registration,
outbox and inbound intents before sensitive state changes; incomplete state
blocks continuation. No silent rotation or automatic off-device backup exists.
Current receive queries need the sender's **current** generation; messages from
rotated generations fail closed. The lab does not expose revoke/block/add-prekey
or rotation UX. Inbox fetch is one page per check; repeated checks can advance.
Legacy/uncertain outgoing intents still lack complete user-facing reconciliation.
PR #101 adds transactional local receive rollback and invalid-ciphertext quarantine;
storage failures preserve the journal and lock. It is not remote backup.
Follow-up sends in an established current-generation session no longer require
an unused recipient prekey. First contact still requires one.

Two mocked browser profiles exchanged/replied and reloaded successfully in PR #97.
No real two-Keplr UNI-7 E2E evidence is recorded. The older DB backup fixture
restores an unread message in a fresh profile; the integrated lab restores local
already-read archive after reload. Neither implements automatic remote recovery.
GPL was chosen for the isolated lab; production distribution/security review is
still a separate gate. `spikes/relay-corecrypto/package.json` is private/UNLICENSED;
do not infer a blanket repository license from the vendor license.

## Remaining release gates and evidence

Mailbox v0.2 consent/historical-identity source is tested, but the deployed v0.1
artifact/address above remains pinned. Sender-generation history, consent/refill
integration, coherent off-device backup/anti-rollback and rotation/exhaustion/restore
coverage remain open. Keep mainnet messaging and the main composer disabled.
See [security continuation](SECURITY_CONTINUATION_2026-10-03.md),
[security audit](SECURITY_EFFICIENCY_AUDIT_2026-10-02.md) and
[recovery decision](RELAY_RECOVERY_DECISION.md). Delivery records are plans, not
executable payment instructions. AtomOne remains research, with no active adapter.

PR #145 passed 84 root Node tests and applicable contract/frontend, faucet and
browser checks. Browser tests use synthetic chain/wallet adapters, not live operator
consent. Screenshots were inspected at 320/390/768/1440 px. Main and Pages passed;
eight changed public assets matched after deployment. Exact run IDs are in the
NNS handoff and PR. No full repository security re-audit is claimed by this cleanup.

CI is path-filtered; ordinary README/HANDOFF/docs edits do not trigger application
suites. Contract Markdown and the RELAY security document do match some filters;
`faucet/**` also triggers faucet CI. See `.github/workflows/` and actual checks.
`relay-client-assets.yml` is a branch-specific preparation writer, not a recurring
main publisher. Follow the local verification commands in [README](../README.md).

## Owner mainnet preparation

`names-mainnet-setup.html` creates/restores an owner-controlled Ed25519 price key
locally, downloads a private PEM backup and a public deployment plan, and links
to the repository Actions-secret form. It stores only the public key and has
`connect-src 'none'`. Private-key export/copy requires an explicit click. It does
not install the secret, deploy contracts or enable purchases. Public-key continuity
and matching backup restoration avoid silently replacing an existing authority.


### Treasury follow-up — 2026-10-06 (published in PR #177)

Provisional zeros and Income/Expenses/result now require a successful recent receipt
refresh and exact movement review; partial index coverage remains explicit.
Treasury event tags come from exact NNS receipt matches; unknown legs remain
Unclassified. Proposal actions expose shared spending categories, retained as
`dao_accounting_v1` metadata in local drafts and workshop revisions, bound to the
unchanged action. Mainnet spend execution/matching is still not connected, so a
planned category alone never posts an expense. See [the implementation record](TREASURY_CUTOFF_2026-10-06.md)
for the schema and boundaries. PR #177 evidence is recorded at the top of this document.
