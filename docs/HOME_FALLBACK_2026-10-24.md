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

## Upstream diagnostics

The published homepage and packaged snapshot correction are in the latest release
listed in CURRENT_STATE. Controlled single-file origin failures subsequently kept
both websites available with prior server bytes, including observations beyond the
configured 60-second fetch TTL. Restoration of the original configuration and normal
responses was confirmed; the packaged live fallback was **not** demonstrated. An
internal cache is a hypothesis, not an established root cause. Exact operational
evidence remains in the private operator handoff.

The diagnostic follow-up adds these response headers in source; it still requires
checks and a manual release:

| Header | Meaning |
| --- | --- |
| `X-Cosmoot-Upstream-Status` | HTTP status returned to the Worker's fetch, including a non-200 status that triggered static fallback. `unavailable` means no usable HTTP status was available, including fetch rejection or timeout; it does not identify the network cause. |
| `X-Cosmoot-Upstream-Cache` | Allowlisted upstream `CF-Cache-Status`: HIT, MISS, EXPIRED, STALE, UPDATING, REVALIDATED, BYPASS or DYNAMIC. Missing or unrecognized values become `unknown`, not MISS. |
| `X-Cosmoot-Upstream-Age` | Upstream `Age` in seconds, accepted only as 1–10 decimal digits and normalized. Absent or malformed values are omitted, not replaced with zero. This is cache age, not snapshot observation age. |

For example, `X-Cosmoot-Snapshot: server` with upstream status `200`, cache `HIT`
and age `73` reports a successful cached fetch. It does not establish that the
origin was contacted or that its data is current. The outer `CF-Cache-Status`
describes a different response layer. Diagnostic values can themselves accompany
a cached response; missing upstream metadata cannot prove that caching was absent.
An upstream `503` can coexist with an outer HTTP `200` and `static-fallback` when
the packaged file is served successfully.

No extra request, cache bypass, query forwarding, request credentials, error text
or arbitrary upstream headers are introduced. The 60-second fetch cache, public
GET/HEAD allowlist, four-second timeout, redirect rejection, static bytes and
fallback `no-cache` behavior are unchanged. Diagnostics are HTTP headers only;
they do not add UI controls or affect governance/transaction decisions.

After publication, inspect an ordinary public snapshot GET on both website
domains and record all three headers alongside `X-Cosmoot-Snapshot`. Start with
normal operation; another failure exercise needs a specific diagnostic purpose
and the existing independently verified rollback boundary. Node tests cover
metadata validation, unavailable values and stale fallback-header replacement;
compiled-worker/workerd checks cover GET/HEAD and unchanged packaged bytes on both
domains. Those tests do not simulate Cloudflare's production cache hierarchy.
