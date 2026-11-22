# Direct prices and Cosmos pool pilot

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
