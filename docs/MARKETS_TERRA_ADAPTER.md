# Terra market-source extension

The source adapter adds CAPA, SOLID, canonical ASTRO and Ethereum PAXG. CAPA and SOLID supply comes from exact Terra CW20 contracts; ASTRO supply is the canonical Neutron tokenfactory denomination. Astroport price references use factory-verified, pinned simulations and an independently dated USDC anchor. SOLID keeps its observed market price. PAXG uses a dated external reference and finalized Ethereum contract supply, explicitly scoped to Ethereum.

The collector publishes one current Astroport Terra inventory every five minutes. It preserves large reserves as decimal strings, does not claim underlying source timestamps, and does not create a pool-history archive or new swap index. A failed source read leaves the prior published observation and timestamp intact. The existing BTC/ETH/SOL/ATOM/JUNO pilot, deduplication, history resolution and storage baseline are unchanged.

The public website release and collector activation are separate. The operator package retains accepted-version checks, preflight, the existing backup step, rollback and public endpoint acceptance. Until that package is installed, new price histories are pending and the website can query sources directly.

Validation covers simulation arithmetic, CW20/native supply identity and freshness, exact reserve serialization, source dispatch, existing market collectors and pilot histories. Live probes verified all four price/supply adapters and the Terra pool inventory on 22 November 2026. Production activation still requires the operator's run.
