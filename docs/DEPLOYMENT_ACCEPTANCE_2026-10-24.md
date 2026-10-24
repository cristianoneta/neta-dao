# Maintenance deployment acceptance — 24 October 2026

## Source and website publication

PR [#304](https://github.com/cristianoneta/neta-dao/pull/304) was merged as
`828059b4734530f237507700655f8b80e69f9986`. Its tree matches the tested PR head.
The [final PR checks](https://github.com/cristianoneta/neta-dao/actions/runs/40081744920)
passed all 17 jobs. The owner subsequently ran
[manual release 40086798887](https://github.com/cristianoneta/neta-dao/actions/runs/40086798887)
from that source; all jobs and the publication step succeeded.

On both production website origins, the downloaded `browser-signing.mjs`
matches the reviewed source byte for byte (Git blob
`9a2d6d4facca21b2184bf4a9daf9ccf17cde280b`).
The main site's home initialization, enabled connection control after
initialization, and navigation to real NETA mainnet proposals were observed.
No wallet was connected and no proposal or transaction was submitted.

## Separate backend installation

The owner supplied successful isolated host and image test output: authenticated
synthetic restore, conflict and unresolved-journal preservation, process restart,
old-token rejection, real pinned-Caddy visitor/header tests, application image
build and both maintenance tests.

After preserving current state and configuration through the private operator
procedure, the owner supplied the replacement container status: the backend from
the reviewed source is healthy and the edge was recreated. Existing state,
identity and certificate mounts were retained. No database migration or fresh
ledger was introduced. Actual host paths, image inventory and export receipts
remain in the private operator record.

## Independent public probes

Checks on 24 October 2026 after the installation:

| Probe | Observed result |
| --- | --- |
| API `/status` | HTTP 200; ready, unpaused, original Faucet identity, UNI-7, 25 JUNOX per 86,400 seconds |
| API `/health` | HTTP 200 and `ok=true` |
| Unauthenticated `/v1/backup`, each production website Origin | HTTP 401 with the matching CORS origin |
| Unauthenticated `/v1/backup`, unrelated Origin | HTTP 403 without a CORS grant |
| Public delegation planner on the data origin and both websites | HTTP 200 and identical response bytes; both websites report `X-Cosmoot-Snapshot: server` |
| Signing-loader module on both websites | Exact reviewed bytes |

These checks validate the observed endpoints and snapshot delivery. They do not
establish all collector health, source freshness, complete accounting coverage or
an exhaustive all-path snapshot comparison.

## Remaining acceptance boundaries

- Full manual desktop/mobile and wallet flows were not rerun. Existing browser CI
  remains synthetic evidence; the real fresh-browser backup restore stays deferred.
- Independent visitor separation and spoof rejection passed isolated real-Caddy
  tests. Production visitor quotas were not deliberately exhausted.
- Controlled live snapshot fallback and recurring independent backup retention
  remain open. A local export is not an off-host recovery proof.
- Homepage status copy still includes older 10 October descriptions of native
  voting and review-to-mainnet development; update that copy separately.
- The crypto-bigint exception remains unpatched and expires on
  24 November 2026 at 00:00 UTC. This deployment does not extend it.
