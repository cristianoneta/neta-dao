# Interchain minute references

A separate collector reads the public Markets observation endpoint for JUNO, BTC, ETH, ATOM, OSMO, ATONE, PHOTON, GNOT and GNS. NETA keeps its existing collector. The operator confirmed installation of these nine archives and a subsequent automatic observation on 21 November. A later encrypted archive backup remains an acceptance item. Source presence alone does not establish live activation.

Each accepted sample verifies asset/chain/pool identity, block evidence, observation freshness and USD conversion. Sources distinguish on-chain pool prices from the GnoSwap ORACLE reference. Native supply is requested weekly and retains its original date. GNS issued supply uses a daily GRC-20 TotalSupply() reference; its maximum cap is never used as issued supply. Osmosis alloy supply refreshes after five minutes. GNOT bank supply is explicitly unpinned; the current chain block is never presented as the supply height. Missing supply does not block price collection.

Per-asset databases preserve the first accepted observation per minute and use the existing durable aggregate implementation. One asset failing does not discard another asset’s accepted data. Existing Treasury, NETA history and wallets are not modified. Daily compressed raw observations use the existing encrypted archive backup boundary. Public output exposes only current and bounded historical JSON; databases and raw archives remain private.

The native weekly snapshot is an explicit approximation for valuation, not a contemporaneous supply at every price point. Historical points carry the basis and reference date. Native total supply differs from circulating supply, and alloy issued supply differs from global BTC/ETH supply.

Validation: eight collector tests cover dated supply reuse, expiry, unavailable supply, wrong identities and USD conversion, GNOT unpinned supply, and first-observation persistence. A public endpoint probe must pass before installation. Later automatic observations and the next encrypted archive backup still require operational acceptance.


## TIA and INJ: prepared, activation deferred

The source configuration also includes TIA (Celestia, utia, 6 decimals) and INJ (Injective, inj, 18 decimals). Their canonical
Osmosis IBC denoms and reference pool IDs are retained in the JSON configuration.
The selected allUSDC reference pools are 3539 and 3536 respectively.
Native total supply is read at a pinned height on each origin chain and reused
weekly. AKT was removed from the website and prepared collector configuration
at the owner’s request before its archive was activated. INJ bank total is not a hardcoded cap
or a circulating-supply estimate.

The operator requested preparation only for these two collectors. A separate
private expansion package updates the accepted source configuration and exact
public route allowlist while preserving earlier histories. Activation, a later
automatic sample and a post-archive backup are still pending. The live website
can show current prices, native supply and pools before archival activation.

Injective spot orderbook depth and selected DojoSwap reserves are now separate
live website feeds. These are not archived by this minute-price collector.
Pool swap history and complete rolling 24-hour volumes remain future work.
