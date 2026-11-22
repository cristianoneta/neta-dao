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

A full fresh 86,400-second indexed window must exist after both pool discovery and scan startup. The UI exposes building/incomplete/delayed states. Raw executed amounts remain stored. USD volume values one executed side at the current dated reference, so it is an estimate rather than historical USD execution value; wrapped-asset basis risk remains.

## Storage, cadence and activation

Prices retain the minute archive format. Pool observations run every five minutes; new swaps are collected from the retained cursor. No whole-day trade history is repeatedly downloaded. SQLite keeps observations and deduplicated receipts; immutable compressed cycle files and content-addressed registries sit under the existing archive scope. Export checkpoints allow a later cycle to catch up after a busy backup lock. No retention deletion is added.

The public pilot status separates state, compressed archive and current-output byte counts and a first-cycle baseline. These are local file sizes, not backup-provider billed bytes. The exact source/service bundle is also retained in the existing encrypted archive scope by the private installer. The next completed backup must be verified separately after activation; no full off-server application recovery was performed.

New source and timers are prepared. Host activation is performed using the private operator installer with source checks, preflight reads, the existing encrypted backup, targeted service changes and rollback on failed acceptance. Website fallback compatibility is preserved until that activation. No wallet signing, paid provider enrollment or hosting migration is involved.
