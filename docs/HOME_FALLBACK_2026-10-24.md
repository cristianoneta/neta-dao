# Homepage copy and packaged snapshot fallback — 24 October 2026

The homepage now describes Juno mainnet community review, native submission with
the required deposit, and native voting. NETA Operations eligibility and historical
UNI-7 reviews remain distinct. The status date is 24 October. Public messaging,
Delivery and transaction permissions are unchanged.

Testing the actual release files exposed a missing fallback: the delegation-planner
path was allowlisted, but its JSON was not tracked or packaged. The public data
server's snapshot collected at 11:07:23 UTC on 24 October is now retained unchanged
in the release. This is observed public data, not a synthetic current snapshot.
Its original height, block time and collection time remain intact. Collection
continues on the data server; a static fallback does not establish fresh authority,
current balances, eligible validators or transaction safety.

The static artifact check now requires every allowlisted snapshot in the manifest.
The real workerd test uses actual packaged files for all 27 paths on both website
origins, including GET/HEAD, gzip and signed-price bytes. It checks upstream success,
503 fallback with `no-cache`, byte-for-byte preservation and return to the upstream
in the same worker instance. Redirect rejection and credential stripping remain
covered. The previous synthetic asset binding could not detect the missing file.

Local snapshot-proxy unit tests, artifact/hash checks, compiled-worker tests and
the expanded workerd test pass. Browser CI captures the homepage at 1440, 768, 390
and 320 pixels and checks overflow, proposal navigation and absence of wallet access.
The required repository workflow remains the integration gate.

Publication remains a deliberate manual Cloudflare release. These isolated tests
do not prove a live origin failure. The separate controlled host exercise must
temporarily fail only one public data route, preserve the API, allow for caching,
verify exact release fallback bytes on both domains, and verify recovery. An
independent automatic rollback must be armed and tested first; see
[collector acceptance](COLLECTOR_ACCEPTANCE.md#controlled-fallback-boundary).
