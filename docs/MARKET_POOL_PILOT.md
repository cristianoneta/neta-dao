# Direct prices and Cosmos pool pilot

## Osmosis inventory normalization — prepared, 24 November 2026

Filtered SQS bank balances omitted tiny GAMM holdings and both assets of empty
concentrated pools. The former target-denomination check stopped the remaining
inventory at the first such pool. Native pool models now establish constituent
identity; GAMM reserves come from their explicit model amounts, and absent CL
amounts remain unknown. Wrong or malformed pool rows are reported as partial
without hiding later valid rows. Redemption/backing exclusions remain intact.

A retained native pool can gain only model-proven missing constituents; removed
or substituted denominations still fail validation. Earlier observations,
first-seen times, trade valuations, archive offsets and scanner cursors are
preserved. The already activated known-USD-subtotal fields are included in source.

A live read-only check completed all five inventories with 961 unique Osmosis
trading pools after the existing exclusions. All 799 matching published token/pool
views passed retained-identity checks, including nine verified completions.
Nineteen inventory regressions and the existing pool/history/indexer checks pass.
Host installation and subsequent scheduled publication remain separate pending
steps; operator continuation is kept in the private handoff.

## Source boundary

`collect_cosmos_markets.py` calls `market_direct_sources.py` locally. Price adapters read the same verified source identities as the previous Markets observation API: pinned Cosmos pool state, GnoSwap oracle references, and identified external USD references. JUNO reuses the independent local Treasury USD anchor. Supply is dated separately, including finalized ERC20/Solana evidence, daily GNS and the existing weekly native schedules. No Markets website request or AI call is required. The existing NETA collector remains unchanged.

The Markets frontend reads archived prices first and accepts the five new pool outputs. Legacy observation endpoints remain available for rollback during migration. Other tokens' pool inventories and orderbooks retain their existing on-demand implementation; this pilot does not migrate every frontend data request.

## Pool coverage

The configured assets are BTC, ETH, SOL, ATOM and JUNO. One `chain_id:pool` identity is stored once and projected into each relevant asset view. Coverage combines verified Osmosis routing representations, 74 registered JUNO contracts and six reviewed DojoSwap contracts. Inventory may change; it is not an exhaustive Cosmos census. Alloy backing/redemption, unregistered legacy contracts, orderbooks and native Ethereum/Solana venues are excluded. Existing NETA collection can overlap with a pilot pool and is intentionally preserved.

SQS provides Osmosis balances/liquidity without a verified chain height, explicitly labelled `routing-indexer-latest`. JUNO/Dojo reserves use pinned queries and exact denomination checks. Values require dated token references; constant-product JUNO pairs can use twice the JUNO-side value as an explicit implied estimate. Unknown and measured zero remain different.

## Trade evidence and volume

The collector follows Cosmos transaction indexes incrementally, with retained heights/hashes, a safety lag, overlap, pagination/count checks, selector controls and immutable transaction/event keys. It retains the previous cursor on inconsistent totals, truncated pages, index errors or changed block anchors. Some Osmosis and Injective forks count matching event entries and deduplicate transactions after pagination. This mode is accepted only when the sum of matching events equals the reported total and two adjacent single-entry page positions prove the expected duplicate transaction. Otherwise the cursor stays unchanged. The preferred Osmosis LCD reports unique transaction totals. Index coverage is provider-reported, not a locally verified full node or a proof of index exhaustiveness.

Only successful transactions and selected pool events count. A routed trade counts once per actual pool execution, not both legs; an overview summed across pools can still count several hops of one user route. Ambiguous legacy swap directions mark coverage incomplete. No fabricated zero is returned when decoding or USD valuation is unavailable.

Volume is available as soon as a fresh indexed interval exists after both pool discovery and scan startup. During the first day, only swaps inside that observed interval count and the status remains building; after 86,400 seconds the window rolls over the latest day. Zero means an observed interval without swaps. Incomplete and delayed indexes still return no volume. The UI keeps the 24h heading and exposes the building duration in pool details. Raw executed amounts remain stored. The activated update stores an immutable USD valuation for each transaction/event. It values one executed side using the latest recorded token reference at or before the trade, at most 30 minutes old. Existing minute archives can supply the reference without additional polling. Future references and stale references are rejected. Missing valuation stays unavailable and later prices do not rewrite recorded valuations. This remains an estimate rather than an exact historical USD execution price; wrapped-asset basis risk remains. The existing NETA collector retains its separate valuation method.

## Osmosis bounded catch-up repair — active, 23 November 2026

The original scanner could read at most 12 pages of 50 results. A verified LCD
query for blocks 75,911,004–75,911,450 returned 983 results; page 12 still contained
50 transactions. The old all-or-nothing scan retained its cursor at 75,911,104,
so its growing unprocessed range could no longer fit inside the limit. This is
a demonstrated catch-up blocker; the initial production exception was hidden by
the old class-only provider-error summary and is not independently established.

The repair bounds and adaptively divides block ranges, validates complete pages,
counts, receipts and anchors, and commits each accepted chunk before the next
network read. A failed later chunk never advances coverage across its unread
range. Historical anchors are allowed only as part of catch-up from a retained
cursor after checking a fresh chain head. The original first-coverage boundary,
trade identities, USD valuations and storage baseline are retained. An additive `scan_checkpoints` table preserves distinct Osmosis checkpoints
within the same second and exports them with immutable cycle archives. Existing
tables, row identities, export positions and per-second legacy scan samples
remain intact; rolling the code back does not delete the added evidence. Provider
errors include bounded operation details. An overfull single block fails
explicitly instead of skipping receipts. Other chains keep their existing scan.

Validation: 43 market/source/contention tests, 36 pool/history/publication tests
and 15 recovery regressions passed. Cases include more than 600 receipts,
interrupted overlap, durable restarts, two-provider fallback, hash changes,
stale heads, within-second checkpoint export and additive schema preservation.

The owner confirmed installation at 15:29 UTC on 23 November. The retained
cursor advanced from 75,911,104 to its target 75,916,905. Public automatic cycles
then reached 75,917,084 at 15:30:54 UTC and 75,917,716 at 15:40:54 UTC, with
`catching_up: false` and no chain index errors. The 15:30 pool snapshot contained
228 unique Osmosis pools: 186 with complete 24-hour coverage and 42 building their
own shorter observed windows. USD volume was available for 224 pools; four lacked
complete trade valuation. The independent BTC inventory request remained
unavailable and can keep the aggregate service exit status nonzero. This is
separate from recovered swap indexing. The next scheduled backup remains unverified.

## USD reference repair and ROAR archive — active, 23 November 2026

ROAR activation stopped during its read-only preflight before any host changes.
A live diagnostic verified its Terra pool, factory registration and simulation,
then received HTTP 403 from the shared Osmosis CoinGecko proxy. Existing LUNA,
SOLID, CAPA, BTC and ATOM price observations had also stopped updating.

The adapter now reads CoinGecko directly, with the previous proxy as fallback.
It retains exact asset IDs, positive finite prices, dated source timestamps and
freshness checks. Parallel assets share one batch per provider per minute;
failures are cached too, avoiding repeated requests to a rejected endpoint.
Errors retain bounded provider/status context without response bodies or headers.
No fixed dollar price or fabricated observation fills the interruption.

The owner confirmed successful installation and a successful price-service cycle.
The repaired adapter, two ROAR configurations and six archive routes are active;
the installed Osmosis scanner, service units and histories are preserved.
Independent public checks confirm ROAR price and dated CW20 supply, all six archive
routes, and later automatic observations at 16:24:19 and 16:25:18 UTC. Its one-day
history contains the installation observation and both subsequent samples.
LUNA, CAPA, SOLID, ASTRO, PAXG, BTC and ATOM also have fresh price observations.
Eighty-one focused collector/source tests and eleven installer tests passed.
The source repair passed [repository checks](https://github.com/cristianoneta/neta-dao/actions/runs/45213854381).
The next scheduled encrypted backup remains unverified. Earlier price gaps and
incomplete trade USD valuations are retained rather than filled with later prices;
the independent BTC pool-inventory error remains a separate limitation.

## Storage, cadence and activation

Prices retain the minute archive format. Pool observations run every five minutes; new swaps are collected from the retained cursor. No whole-day trade history is repeatedly downloaded. SQLite keeps observations and deduplicated receipts; immutable compressed cycle files and content-addressed registries sit under the existing archive scope. Export checkpoints allow a later cycle to catch up after a busy backup lock. No retention deletion is added.

The price and pool collectors wait up to 60 seconds for the shared archive lock
after recording observations. They keep the same exclusive lock and never remove
or replace its file. Individual collector locks still prevent overlapping runs.
Both service start budgets allow this additional wait. If contention persists,
publication fails explicitly and the previous public output remains available;
the next successful cycle exports retained records without duplicate swaps or a
new storage baseline. Collection and source timestamps are not refreshed merely
because publication waited. The initial Terra activation encountered this race
and rolled back; subsequent existing collectors recovered. The owner subsequently
confirmed corrected activation. Public price observations and a 267-of-267 pool
publication after installer completion confirm continued collection with complete
inventories and no index errors. All five new LUNA/CAPA/SOLID/ASTRO/PAXG price
archives and the current Astroport Terra inventory are publicly readable. The next
encrypted backup after activation remains a separate acceptance item.

Derived charts use the existing observations and recorded swaps: five-minute bins for 24 hours and hourly bins for seven days. Each exported file has at most 289 or 169 points; exports stream one pool at a time. Volume bins are unavailable when the index has not covered the entire interval, a decoder problem exists, or any trade lacks a USD valuation. A zero is published only for a covered interval without swaps. No polling or pilot asset scope is added. The derived public files are bounded views; the underlying retained records are not deleted.

The public pilot status separates state, compressed archive, current-output and derived-public-history byte counts and preserves the original first-cycle baseline. The new history category starts from zero when absent from that old baseline. These are local file sizes, not backup-provider billed bytes. The exact source/service bundle is also retained in the existing encrypted archive scope by the private installer. The next completed backup must be verified separately after activation; no full off-server application recovery was performed.

The direct sources and five-asset pilot are installed and a subsequent automatic cycle was independently observed. The owner confirmed the first-day-volume follow-up succeeded. The history and frozen-valuation follow-up is now operator-confirmed installed using the private operator installer with source checks, preflight reads, the existing encrypted backup, targeted service changes and rollback on failed acceptance. Website fallback compatibility is retained. No wallet signing, paid provider enrollment or hosting migration is involved.

The first history activation rolled back after HTTP 403 while preserving observed
data. Under the production `UMask=0077`, recursive directory creation left the
intermediate history directory at 0700; adjusting only the final directory was
insufficient for the edge. Publication now explicitly prepares each directory
below the public output root, including existing retained history directories.
Symlink directories and paths escaping that root are rejected. The service mask,
private databases and archives keep their existing permissions. Regression tests
cover both first publication and repair, private sibling preservation and path
rejection. The corrected installer checks local public readability before HTTP
acceptance and includes the failed endpoint in HTTP error messages. The operator
confirmed corrected activation. Public output at 2026-11-22T13:25:54Z confirms a
subsequent cycle with 262 of 262 pools observed, complete five-asset inventories
and no errors in any of the three chain indexes. One sampled 24-hour history per
pilot asset was publicly readable with the prior-recorded-reference volume basis.
The next scheduled encrypted backup and next-day storage comparison remain open.
