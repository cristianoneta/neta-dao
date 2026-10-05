# GitHub Actions runner incident and RPC assessment

Observed 2026-10-05 around 19:45–19:55 UTC (21:45–21:55 Europe/Berlin).

## Failed runs

| Workflow | Run | Job |
| --- | --- | --- |
| Main DAO snapshot | 37362732160 | 111940949409 |
| Member snapshot | 37363469994 | 111943206590 |
| Treasury snapshot | 37360487518 | 111933571265 |

The API returned empty `steps` for each job. Job check-run annotations said:
“The job was not acquired by Runner of type hosted even after multiple attempts”.
They waited approximately 15 minutes before failing; scripts and RPC requests
never started. Log fetches returned missing blobs because no worker logs existed.
The Ubuntu image migration notice was informational, not the reported cause.

[GitHub Status](https://www.githubstatus.com/) reported Actions degraded performance
at 19:11 UTC and a hosted-runner assignment delay at 19:15 UTC, still unresolved
at our check. GitHub had not published this incident's root cause. The observations
support an infrastructure scheduling failure, not a repository/account ban or
RPC provider rate limit. Do not infer causes from earlier unrelated incidents.

Do not bulk-rerun old data jobs. After recovery, use fresh main-branch snapshot
runs to avoid generated-file conflicts. Do not bypass release checks to publish
the pending NNS UI. Existing deployments and on-chain name ownership are separate
from these failed scheduled jobs; a sufficiently prolonged price publishing gap
will still exhaust the signed price's 24-hour validity.

## Combining jobs

The current cadence is Treasury every 15 minutes, Main DAO every 30 minutes and
members every 30 minutes: eight scheduled starts per hour. A coordinator can
reuse common chain reads/cache and serialize publishing, but combining YAML jobs
alone does not reduce RPC calls. Preserve independent failure reporting and
price freshness. Treasury changes remain deferred; no consolidation was applied.
Two-provider checks remain deployment/critical verification gates, not a rule for
every ordinary read or refresh.

## Private RPC option (assessment only)

A private `junod` full node does not need validator status or stake. Provision a
Linux server, verify the current mainnet binary/chain, sync, configure RPC and
REST, then add TLS/access controls, monitoring and an upgrade procedure. Keep
private credentials in server-side jobs; a public web app cannot keep an embedded
RPC key secret. A controlled gateway/cache can serve browser requests. Retain an
independent public fallback/check rather than making one private node the only
point of failure. No server was purchased or provisioned.

[Juno's hardware guide](https://docs.junonetwork.io/validators/joining-mainnet)
lists 4 modern cores, 32 GB RAM and 1 TB SSD/NVMe as its validator minimum;
this is a planning reference, not a measured sizing result for our RPC workload.
[Hetzner EX63](https://www.hetzner.com/de/dedicated-rootserver/ex63/) starts at
64 GB RAM and 2 × 1 TB NVMe. Its published
[June 2026 price schedule](https://docs.hetzner.com/de/general/infrastructure-and-availability/price-adjustment/)
lists EX63-1 at EUR 175.29/month plus EUR 88.06 setup; limited EX63-1-LTD at
EUR 115.79/month plus EUR 46.41 setup, conditional on stock. These include
19% VAT and exclude IPv4. Verify actual order availability and price before buying.
A rough single-node planning budget is EUR 120–200/month plus operations, not
a guaranteed minimum or a full-history/high-availability quote.

Engineering estimate: 1–2 working days for initial setup, hardening and tests,
plus variable synchronization time; ongoing monitoring, updates and chain upgrades
remain necessary. [State sync](https://docs.junonetwork.io/validators/joining-mainnet/sync-with-state-sync)
provides recent state, not full transaction history. Full historical Treasury
coverage needs its own storage/indexing/backfill plan. A private RPC alone would
not fix GitHub's inability to assign a runner; self-hosted job execution is a
separate operational decision.
