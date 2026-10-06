# Treasury collection from 1 October 2026

Owner decision, 2026-10-06: start accounting for all DAOs on **2026-10-01**;
retain future transactions, avoid older backfill. Boundaries use the existing UTC
accounting convention: `2026-10-01T00:00:00Z`.

## Implementation

- Shared statement and NNS register exclude pre-cutoff receipts. January–September
  2026 are disabled; the 2026 annual choice means October–December. Earlier
  comparisons remain unavailable. Existing archived records are preserved.
- Main NETA and Operations (Juno core plus Osmosis proxy) use a shared REST receipt
  adapter. Empty native-transfer results no longer disqualify a working CW20 index.
  Every configured query is required to succeed before advancing its watermark.
- The first run verifies a recent block before the cutoff, scans from that safe
  floor and filters by exact receipt time. The floor is not claimed to be the
  first October block. Chain identity, tip freshness, bounded pagination, duplicate
  pages, unchanged receipts and block anchors are checked. Failed refreshes preserve
  prior exports. Writes are atomic. No wallet actions or new cron are introduced.
- Routine refreshes resume with a 100-block overlap, 20 blocks behind the tip.
  Daily replay from the accounting floor catches delayed indexing beyond the
  overlap. Page/time limits fail explicitly instead of silently skipping results.
- Failed transaction attempts stay activity only. Native transfers and CW20-shaped
  events are retained; unknown contracts have raw units and unverified identity,
  never guessed decimals or prices. Movement direction does not imply revenue.
- After the main DAO tasks finish, exact NNS Treasury legs are cross-referenced
  against the existing validated payment ledger using chain/hash/message, token,
  counterparty, amount and direction. The receipt is counted once. Other observed
  movements remain unreviewed with no USD value. This cross-reference is **not**
  opening/closing balance reconciliation.

## Boundaries

Full P&L, expenses/funding classification, payment-time prices for non-NNS movements
and opening/closing reconciliation remain unavailable. Public transaction indexes
cannot guarantee every economic movement; block-level/module distributions, omitted
provider events and unsupported token actions are not silently claimed as covered.
Native Juno Community Pool accounting still requires its own adapter. The common
start date applies to it, but this change does not invent a connected transaction
feed or an accounting total. All adapters should use this date when connected.

Main DAO collection remains in its existing 30-minute job, Operations in its
existing 15-minute job; actual freshness depends on successful workflow/provider
runs. A failed source must remain visibly unavailable, including retained records.

## Browser icon

The new mint voxel N favicon follows the graphite/mint design. A generated 512px
source, 16/32px PNGs, 16/32/48px ICO and 180px Apple touch icon live in the repository.
All root HTML pages reference the same assets. No layout or wallet flow changes.
Image prompt: a bold geometric N built from chunky architectural voxel strokes,
mint faces on graphite, strong silhouette readable at 16px, no extra text or imagery.
Generated with the built-in image generation tool; resized only for browser formats.

## Validation and publication

Local validation: 120 Node tests and 43 targeted Python tests passed. Regression
coverage includes the October boundary, empty native versus populated CW20 index,
truncated/duplicate pages, missing known transactions, daily replay, failed receipts,
changed amounts and exact NNS cross-reference. Existing browser tests now verify
that pre-start periods cannot be selected. A read-only local live scan via Polkachu found the real NNS receipt at block
42400450; provider coverage through block 42425219 remained explicitly PARTIAL.
Published in [PR #176](https://github.com/cristianoneta/neta-dao/pull/176), merge
`31f727db5dbc00340640c5b183ce4aab054e0d9c`. Final application head
`26f8387147e566439d1362597066722eed5d3408` passed frontend/contract
[37460531506](https://github.com/cristianoneta/neta-dao/actions/runs/37460531506),
browser [37460531435](https://github.com/cristianoneta/neta-dao/actions/runs/37460531435),
NNS pricing [37460531499](https://github.com/cristianoneta/neta-dao/actions/runs/37460531499)
and faucet [37460531589](https://github.com/cristianoneta/neta-dao/actions/runs/37460531589).
Statement and register screenshots at 320/390/768/1440 px were inspected. The
renewal in browser screenshots is a synthetic fixture, never production income.
The initial browser failure was the Playwright disabled-state helper on an option;
native option.disabled and actual period behavior pass in the final suite.

Production main frontend [37460896776](https://github.com/cristianoneta/neta-dao/actions/runs/37460896776),
main collector [37460896833](https://github.com/cristianoneta/neta-dao/actions/runs/37460896833),
Operations collector [37460897042](https://github.com/cristianoneta/neta-dao/actions/runs/37460897042)
and Pages [37460967256](https://github.com/cristianoneta/neta-dao/actions/runs/37460967256)
passed. Earlier Pages runs were superseded by the collector commits, not failed deployments.

At 12:06 UTC the main collector completed all three tasks, recorded one NNS event,
and linked it once to 4.755098 NETA / USD 5.000000976594010594. Coverage through Juno
42425427 remains PARTIAL. Operations successfully scanned Juno through 42425432 and
Osmosis through 72011274, preserving 57 older records; no new indexed receipts were
returned in those date-bounded scans. No complete zero-activity claim is made.
Separate local read-only scans also succeeded for all three configured accounts.

Nine served assets matched repository SHA-256 after Pages completed: index.html,
Treasury P&L UI/core/report modules, NNS register HTML/module, favicon.ico, 32px
favicon PNG and Apple touch icon. No generated ledgers were manually edited.


## Follow-up: provisional totals and spending categories

Owner requested provisional zeros/sums for reviewed, recorded activity and categories
on Treasury events and spending proposals. The follow-up adds:

- Provisional Income / Expenses / result when the receipt refresh succeeded and
  every observed selected-period movement has an exact receipt match. Empty accounts
  then show $0. Failed or stale current-period refreshes, unmatched receipts and
  unreviewed movements block totals. Index coverage and balance reconciliation
  remain partial/unavailable. A current snapshot older than two hours is stale.
- Receipt-backed event tags (`Income · NNS registrations`, `Income · NNS renewals`);
  unmatched legs display `Unclassified`, including mixed-transfer events. Direction
  alone never establishes income, expense or an internal transfer.
- One spending-category dropdown per action, using the shared expense account IDs;
  `not_expense` identifies treasury transfers. Known bank/CW20 payment shapes require
  a category. Other action shapes expose an optional category; arbitrary contract
  effects cannot be inferred from their JSON.
- `dao_accounting_v1` revision metadata contains allocations with zero-based
  `action_index`, canonical `action_key` and `category`. This is review metadata,
  separate from executable messages. Category bindings survive JSON formatting,
  but edits/reordering invalidate affected bindings. Local drafts, workshop
  publications and revisions retain it; read-only proposals disable the controls.

Mainnet spend submission and execution matching are still not connected. These
categories capture intent; they do not create ledger expenses. A future execution
adapter must remove review metadata from executable messages, bind the approved
revision/action to verified outgoing treasury legs, avoid duplicate payments and
provide payment-time USD valuation before posting an expense. No category may be
inferred from a proposal title or merely from its `proposal_id`.


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
