# Shared Treasury statement and NNS payment register

Status: published and verified on 2026-10-06 in
[PR #174](https://github.com/cristianoneta/neta-dao/pull/174), merge
`735e997eee313e7801347ac072f09ff3b5d970ea`. 119 root Node tests passed; hosted
frontend (37447236498), browser (37447236381), main frontend (37447675306) and
Pages (37447673895) passed. Screenshots at 320/390/768/1440 px were inspected;
nine changed public assets matched source SHA-256. No generated ledger or chain
state changed. Exact release evidence is in the PR and
[next-chat checkpoint](HANDOFF_NEXT_CHAT_2026-10-06.md).

## Owner revision

Use the same financial statement for every DAO, with Income first and expandable
sources beneath. Remove the separate observed-NNS-income tile (screenshot I) and
permanent receipt sidebar (screenshot II). The statement also removes repeated
unavailable KPIs and unconnected commitments/bridge panels, retaining accounting
exclusions in a compact methodology disclosure. Years start at 2026; 2027/2028 are
selectable, explicitly future periods rather than zero actuals.

## Extension contract

`treasury-accounting-config.mjs` maps DAO IDs to source accounts. All accounts have
an id, label and income/expenses section; a source can optionally provide a detail
page and filter. Shared expense accounts and Other income form the fallback. Only
NETA adds NNS registrations/renewals. The shared renderer and subtotal logic do not
need per-DAO layouts. To add a source, supply its account mapping and a reviewed
receipt adapter bound to its DAO/asset/chain identity; do not feed unchecked raw
transfers into the statement. Only the existing NETA NNS adapter is connected today.

The current adapter establishes observed receipt subtotals, never complete income,
expenses or operating result. Partial labels accompany numeric subtotals; missing
amounts are dashes with an unavailable explanation. No fabricated change percentage.
This is a reusable cash statement schema, not an assertion of GAAP/IFRS compliance.

## NNS register

`nns-transactions.html` is a read-only NETA Treasury page. Links from account names
and amounts preserve year/month and preselect registration or renewal. All payments
removes the type filter. Every matched entry in that selection is listed, newest
first, with name/term, UTC date, type, exact NETA amount, payment-time USD, explorer
link and expandable conversion evidence. Return to Treasury preserves year/month and explicitly selects the NETA DAO,
including when opening the register directly from another DAO context.
No wallet, chain request or new background service. Refresh reads the committed
collector ledger, applies the same strict identity/arithmetic/duplicate validation,
and clears stale rows on failure. The public-index coverage warning remains.
This register tracks revenue payments, not administrative/commitment/name-transfer
calls; those do not create income. Existing collector refresh cadence is unchanged.

## Research informing the layout (checked 2026-10-06)

- [Xero Profit and Loss](https://central.xero.com/0/article/Profit-and-Loss-New):
  reporting periods, income/expense accounts and transaction drilldown.
- [Xero General Ledger Detail](https://central.xero.com/0/article/General-Ledger-Detail-report):
  separate transaction register with account/date/source filtering.
- [Stripe income statement](https://docs.stripe.com/revenue-recognition/reports/income-statement):
  mapped ledger accounts, period columns and optional comparisons.

Design inference: use a restrained hierarchical statement and move source-specific
receipt detail into a filtered register. Their accrual-recognition rules are not
copied into this cash receipt implementation.

Mobile statements stack both period values below each account, keeping them
visible without horizontal scrolling. The wider transaction register retains a
labelled scroll region and wrapping filters.

## Validation

119 Node tests pass, including DAO account isolation, alternative source mappings,
expense exclusion from income, fixed-point valuation and UTC boundaries. Hosted
browser coverage exercises disclosures, keyboard focus, 2026–2028 controls, type
and period filters, source/fetch failures, return navigation and 320–1440 px layouts.
The register test uses an explicitly synthetic renewal alongside the pinned real
first-receipt fixture; no synthetic payment is published to production data.
