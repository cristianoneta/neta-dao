# Treasury valuation correction — 2026-10-03

## Incident and cause

The displayed Operations subtotal fell to about USD 26 with a false roughly
USD 4,000 history outflow. All nine holdings were still in `current.json`.
The exact-denom pricing hardening intentionally stopped assigning market prices
from an untrusted IBC base ticker, but the persisted registry omitted five
legitimate Osmosis routes. Their balances became unpriced and were collapsed
with small assets; the history renderer treated disappearing valuations as flows.
No on-chain transfer or missing custody balance is established by that display.

## Verified identities

Compared Cosmos chain-registry `osmosis/assetlist.json` against live
`/ibc/apps/transfer/v1/denom_traces/{hash}` responses from the configured Osmosis
REST provider on 2026-10-03. Recomputed SHA-256(path + '/' + base_denom) for each
full denom; all matched. Metadata is approved only for its source chain.

| Asset | Osmosis route | Base denom | Price identity |
| --- | --- | --- | --- |
| AKT | transfer/channel-1 | uakt | akash-network |
| JUNO | transfer/channel-42 | ujuno | juno-network |
| USDC.n | transfer/channel-750 | uusdc | usd-coin |
| JKL | transfer/channel-412 | ujkl | jackal-protocol |
| ATONE | transfer/channel-94814 | uatone | atomone |

Full exact-denom hashes live in `data/treasury/token-registry.json` under
`osmosis:ibc/...` keys. Existing unqualified entries apply only to Juno. Unknown
routes, and the same local hash on another chain, cannot borrow those prices.
Sources: <https://github.com/cosmos/chain-registry/blob/master/osmosis/assetlist.json>
and <https://osmosis-api.polkachu.com> (read-only REST queries).

## Changes and validation

- Restore five reviewed Osmosis prices; request all configured market identities.
- Label PARTIAL totals as priced-assets subtotals and keep warnings visible.
- Suppress history comparison/chart when excluded-price coverage changes, instead
  of presenting missing/restored prices as outflows/inflows. Stable unpriced
  assets do not prevent comparison; actual priced-asset disposals remain visible.
- Carry LP underlying pricing into new history points. Historical accounting
  still groups by symbol and is approximate, not a transaction-derived ledger;
  the flow KPI now says estimated holdings flow.
- Trigger the existing collector on main changes to its source or token registry,
  in addition to its scheduled runs. Generated snapshots/history remain bot-owned.
- Six Python history/identity tests and 45 Node tests passed locally. Regression
  cases cover source-chain isolation, unregistered ticker spoofing, all five
  restored assets, lost/restored price coverage and incomplete LP pricing.
- Fresh read-only collection at 2026-10-03T10:38:53Z returned all nine holdings and
  USD 4,037.26032809967178 priced subtotal. Only the unsolicited `testingaten`
  factory token remained unpriced. This is a timestamped valuation, not a fixed
  total or a guarantee of later quotes. No wallet connected or transaction sent.

Integration and live verification are recorded below.
Past daily snapshots were not rewritten, and generated data was not hand-edited.

## Release evidence

PR #110 merged as `081dd9aae0a008ec09fb149a02b6e640fe89349c` after successful
Contract/frontend run 155 (`37117224181`) and RELAY browser run 45 (`37117224194`).
Treasury bot run 940 (`37117535997`) completed all collection/event/commit steps.
Its commit `57b2f960fd201a4c3eb72dee6e0b365c83c8b5f2` deployed via successful Pages run
1043 (`37117549310`); the superseded Pages run for the pre-bot merge was cancelled.
Production `index.html`, `treasury.js`, collector source and token registry matched
the integrated code byte-for-byte. Live snapshot matched the bot JSON exactly.

Snapshot `2026-10-03T10:47:09.430358Z` (12:47 Berlin) retained nine holdings and reported
USD 4040.81154240286529 priced subtotal. The only unpriced position was the
unsolicited factory `testingaten` token, so PARTIAL is intentional. The browser
showed USD 4,040.81, USDC.n USD 3,441.31 and AKT USD 538.43 in the main asset list;
30-day change USD 8.35 and no material holdings outflow. A tiny floating-point
residual currently formats as -$0.00; normalize presentation during the next
Treasury visual refinement. It is not an on-chain debit.

Before/after keys and quantities were identical in the read-only incident check.
All 12 pre-existing daily snapshots remain untouched; today's point is added by
the UI in memory (13 points displayed). No historical data was fabricated.
Remaining limitations: symbol-based estimated attribution, spot-market prices,
configured rather than universal asset coverage and latest rather than globally
height-pinned balance queries. Full per-page responsive/accessibility review is
not claimed by this correction.
