# Juno RPC and runner assessment

Reviewed 2026-10-05. No hosting purchase or server deployment has been made.

## Current failure and request load

GitHub reported an Actions runner-assignment incident at 19:11 UTC (21:11 Berlin).
The prior session recorded `The job was not acquired by Runner of type hosted
even after multiple attempts`. This continuation checked Treasury run
37364078559: collect job 111945070066 was cancelled with no executed steps.
Main DAO 37365720213 and membership 37366215262 were queued at inspection.
This does not establish an RPC rate limit. A private RPC cannot supply a missing
GitHub runner. Source: https://www.githubstatus.com/ (incident ongoing at inspection).

The repository schedules Operations Treasury every 15 minutes, main DAO and
membership every 30 minutes. Combining job names alone does not reduce their
chain queries. Actual savings require shared reads/caches or fewer collections.
The NNS signed price already reuses the main DAO collector's price with no new
market request. Preserve its 30-minute cadence and accepted 24-hour price validity.

This change pauses RELAY polling in hidden tabs, avoids immediate repeat polls
on focus, aborts timed-out governance fetches and checks NNS notices every 15
visible minutes plus wallet/confirmed-action updates. NNS notices require no
new Actions runner. Snapshot collectors and their outputs are unchanged; Treasury
work remains deferred. A future collector consolidation must retain independent
source errors, timestamps, last good data, history and signing-secret isolation.

## Private Juno node

An owned non-validator full node can serve current Juno RPC/REST queries and
broadcast already signed transactions. No stake or owner wallet seed is needed.
It follows the public network; it is not an independent/private blockchain.

Implementation would provision a Linux server, install the current reviewed
`junod`, initialize `juno-1`, sync from a trusted snapshot/state-sync, configure
pruning and transaction indexing, run under a supervised service, then expose
TLS RPC/REST behind access controls/rate limits. Monitor block lag, storage,
service health and upgrades. Validate identity, freshness, CORS and relevant
CosmWasm queries before switching the application, keeping independent fallback.

Private server credentials belong in backend jobs, never static JavaScript.
For browser access use a bounded public application proxy or a deliberately
public rate-limited endpoint. CORS alone does not make an endpoint private.
Juno mainnet does not replace Osmosis or UNI-7 nodes. A pruned/state-synced node
does not supply complete historic transactions; existing historical collectors
may still need an archival/indexed provider.

Juno's published validator baseline is 4 modern cores, 32 GB RAM and 1 TB SSD/NVMe.
This is a conservative planning reference, not measured sizing for our RPC load.
Prefer disk headroom and measure current database/index growth before ordering.
Polkachu publishes a much smaller pruned snapshot; compressed snapshot size is
not an all-history RPC storage estimate.

## Costs and effort

Current published examples including 19% German VAT, excluding IPv4:

| Example | Hardware | Monthly | Setup | Qualification |
| --- | --- | ---: | ---: | --- |
| Hetzner AX42-1 | 64 GB, 2 × 512 GB NVMe | €115.79 | €58.31 | Mirroring leaves about 512 GB, below the cited 1 TB baseline; storage changes need a fresh quote |
| Hetzner EX63-1 | 64 GB, 2 × 1 TB NVMe | €175.29 | €88.06 | About 1 TB mirrored before overhead; growth/headroom still needs validation |

Planning estimate: roughly €180–220/month including small ancillary costs for
the EX63-class option, excluding paid administration and any larger disk upgrade.
This is an estimate, not a checkout quote or cheapest-market claim. Budget about
half to one working day for setup/verification plus sync time, then routine
maintenance and urgent upgrade/outage work; timing depends on sync and provider.
Use a small cached/protected access layer first if request sharing is the goal;
an owned node makes sense when control/reliability justifies ongoing operations.

## Sources

- Juno setup and published baseline: https://docs.junonetwork.io/validators/joining-mainnet
- Snapshot service/pruning: https://polkachu.com/tendermint_snapshots/juno
- Hetzner current published prices: https://docs.hetzner.com/de/general/infrastructure-and-availability/price-adjustment/
- AX42 hardware: https://www.hetzner.com/de/dedicated-rootserver/ax42/
- EX63 hardware: https://www.hetzner.com/de/dedicated-rootserver/ex63/

Verify live binary, snapshot, database size and checkout price when provisioning;
some Juno documentation examples describe historical network versions.
