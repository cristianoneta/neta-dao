# Interchain minute references — prepared

A separate collector reads the public Markets observation endpoint for JUNO, BTC, ETH, ATOM, OSMO, ATONE, PHOTON and GNOT. NETA keeps its existing collector. Deployment requires the private host installer and later timer/backup acceptance; source presence does not activate production collection.

Each accepted sample verifies asset/chain/pool identity, block evidence, observation freshness and USD conversion. Sources distinguish on-chain pool prices from the GnoSwap ORACLE reference. Native supply is requested weekly and retains its original date. Osmosis alloy supply refreshes after five minutes. GNOT bank supply is explicitly unpinned; the current chain block is never presented as the supply height. Missing supply does not block price collection.

Per-asset databases preserve the first accepted observation per minute and use the existing durable aggregate implementation. One asset failing does not discard another asset’s accepted data. Existing Treasury, NETA history and wallets are not modified. Daily compressed raw observations use the existing encrypted archive backup boundary. Public output exposes only current and bounded historical JSON; databases and raw archives remain private.

The native weekly snapshot is an explicit approximation for valuation, not a contemporaneous supply at every price point. Historical points carry the basis and reference date. Native total supply differs from circulating supply, and alloy issued supply differs from global BTC/ETH supply.

Validation: seven collector tests cover dated supply reuse, expiry, unavailable supply, wrong identities and USD conversion, GNOT unpinned supply, and first-observation persistence. A public endpoint probe must pass before installation. Later automatic observations and the next encrypted archive backup still require operational acceptance.
