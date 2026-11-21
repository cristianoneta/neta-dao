# Interchain minute references

A separate collector reads the public Markets observation endpoint for JUNO, BTC, ETH, ATOM, OSMO, ATONE, PHOTON, GNOT and GNS. NETA keeps its existing collector. The operator confirmed installation of these nine archives and a subsequent automatic observation on 21 November. A later encrypted archive backup remains an acceptance item. Source presence alone does not establish live activation.

Each accepted sample verifies asset/chain/pool identity, block evidence, observation freshness and USD conversion. Sources distinguish on-chain pool prices from the GnoSwap ORACLE reference. Native supply is requested weekly and retains its original date. GNS issued supply uses a daily GRC-20 TotalSupply() reference; its maximum cap is never used as issued supply. Osmosis alloy supply refreshes after five minutes. GNOT bank supply is explicitly unpinned; the current chain block is never presented as the supply height. Missing supply does not block price collection.

Per-asset databases preserve the first accepted observation per minute and use the existing durable aggregate implementation. One asset failing does not discard another asset’s accepted data. Existing Treasury, NETA history and wallets are not modified. Daily compressed raw observations use the existing encrypted archive backup boundary. Public output exposes only current and bounded historical JSON; databases and raw archives remain private.

The native weekly snapshot is an explicit approximation for valuation, not a contemporaneous supply at every price point. Historical points carry the basis and reference date. Native total supply differs from circulating supply, and alloy issued supply differs from global BTC/ETH supply.

Validation: fifteen collector tests cover dated supply reuse, expiry, unavailable supply, wrong identities and USD conversion, GNOT unpinned supply, and first-observation persistence. A public endpoint probe must pass before installation. Later automatic observations and the next encrypted archive backup still require operational acceptance.


## Seven additional assets: prepared, activation deferred

The source configuration also includes TIA (Celestia, utia, 6 decimals) and INJ (Injective, inj, 18 decimals). Their canonical
Osmosis IBC denoms and reference pool IDs are retained in the JSON configuration.
The selected allUSDC reference pools are 3539 and 3536 respectively.
Native total supply is read at a pinned height on each origin chain and reused
weekly. AKT was removed from the website and prepared collector configuration
at the owner’s request before its archive was activated. INJ bank total is not a hardcoded cap
or a circulating-supply estimate.

The operator requested preparation only for these seven additional archives. A separate
private expansion package updates the accepted source configuration and exact
public route allowlist while preserving earlier histories. Activation, a later
automatic sample and a post-archive backup are still pending. The live website
can show current prices, native supply and pools before archival activation.

Injective spot orderbook depth and selected DojoSwap reserves are now separate
live website feeds. These are not archived by this minute-price collector.
Pool swap history and complete rolling 24-hour volumes remain future work.


AXL uses pinned Osmosis AXL/allUSDC pool 3563 with weekly native Axelar bank supply.
LINK, SOL, BABY and UNI use timestamped CoinGecko USD references via the public Osmosis price proxy. Provider identity, exact asset ID, USD quote consistency and freshness are validated. These external prices have no invented block height, block hash, pool reserves or pool TVL. Missing or stale external prices are rejected. Their historical points are labeled `external-reference`.

LINK supply is the Ethereum ERC20 totalSupply at a finalized block. UNI uses the same issued-supply getter minus the balance at the documented dead address; exact raw issued, burned and net amounts are retained. It is not circulating supply. SOL uses finalized getSupply, its actual slot, genesis identity and exact raw lamport total; a slot is never relabeled as a Cosmos height. BABY uses pinned native Babylon bank supply. These native supply references refresh weekly and retain their own date independently of price observations.

The website counts only verified Cosmos trading pools. Alloy backing and sumtree orderbook code 885 are excluded from AMM totals. A successful fresh empty inventory can show zero; an unavailable source or unknown valuation cannot. Small BABY pools contribute to totals and are visible when no pool reaches the main display threshold. UNI stable pool 2531 is read directly from chain state because SQS omits it; its USD total remains unavailable until all reserves have fresh valuations. Inactive UNI pool 2213 is excluded. Stale LINK/UNI Injective books remain visibly separate and are never used as price references or pool TVL. An unverified DojoSwap SOL decimal mapping is omitted.

Validation also covers external references without blocks, fabricated evidence rejection, exact ERC20 burn arithmetic, native SOL slot/genesis evidence and unchanged strict pool validation. Installing the prepared package, validating subsequent automatic samples and accepting the next encrypted backup remain operator steps.
