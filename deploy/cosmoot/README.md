# Cosmoot deployment templates

These files define the intended application layout. Their paths, service users,
resource limits and environment names are public template defaults. Actual host
addresses, access methods, installed versions, provider resource identifiers,
purchase details and private backup records are maintained outside Git.
See the [documentation policy](../../docs/DOCUMENTATION_PRIVACY.md).

## Responsibilities

| Component | Responsibility |
| --- | --- |
| GitHub | Reviewed source, CI and deliberate releases; no production-data commits |
| GitLab | Dormant reserve, not a parallel deployment path |
| Cloudflare Pages | Website assets and the scoped public-snapshot proxy |
| Application host | Bounded collectors, public data edge and eventual backend |
| Independent encrypted backups | Databases, original identities and collector checkpoints |

Current operator-confirmed progress and open gates are summarized in the
[public checkpoint](../../docs/OVH_SETUP_2026-10-08.md). Consult the private handoff
for host actions. Render remains the backend writer until verified migration.

## General installation

Use a maintained Linux host, SSH public-key authentication and security updates.
Install Docker Compose/Caddy, Python with venv and a verified Node 24 distribution.
Pin reviewed image digests. The current templates budget one CPU/1536 MiB for
collectors, 1 GiB for the backend and 256 MiB for the edge; validate real workload
capacity before accepting those defaults for an installation.

1. Follow [BACKEND_MIGRATION](../../BACKEND_MIGRATION.md). Preserve both databases,
   signing identities, payout journals and quotas. Start the API paused and backup
   writes disabled; process readiness alone is not proof of data restoration.
2. Install reviewed source read-only for the runtime. The template collector user
   has no login or Docker-group membership and needs no Git credential. Preserve
   generated data/checkpoints during code updates; never reset live data with Git.
3. Keep the Python environment and executable code administrator-owned. Install
   pinned dependencies from `scripts/requirements-community.txt`. The collector
   should write only its data, state and published snapshot directories.
4. Seed snapshots with `scripts/publish-server-snapshots.py` using the reviewed
   private inventory. Only paths in `snapshot-paths.json` may be published;
   original timestamps and signatures must be preserved.
5. Install the systemd templates but keep timers inactive until acceptance. They
   share a lock and have bounded timeouts. Busy jobs retry at their next interval;
   missed intervals must not replay in a burst. Check data timestamps and failures.
6. Provision the original NNS signing key privately through the credential drop-in.
   Only its signing subprocess receives it. A missing key must leave the old price
   explicit, not rotate authority or extend an expired observation.

## Snapshot publication

`compose.snapshots.yaml` runs only the public data edge during backend migration.
When adopting the final Compose setup, preserve its public-snapshot mount and
certificate volumes; do not start a competing proxy on the same ports. Review
Docker-published ports independently of host firewall assumptions.

The publisher validates allowlisted JSON/gzip, atomically changes the current
snapshot generation and retains two prior generations. Local retention is not an
independent backup. Serve only the exported public paths, never a repository root,
private receipts, databases or credentials.

The website proxy is `functions/data/[[path]].js`. The Pages builder bundles it
with the pinned Wrangler, records source/artifact hashes and scopes routing to
`/data/*`. Only the 26 explicit public paths are proxied. Credentials and query
strings are not forwarded; origin failures preserve the release's static bytes
and timestamps with `X-Cosmoot-Snapshot: static-fallback`.

The manual GitHub release publishes the checked bundle with `--no-bundle`.
Real-workerd tests cover both origins, exact bytes, rejected redirects and static
fallback. Live all-path and controlled-fallback acceptance remain separate gates.
Check both website origins before enabling collectors and retain the approved
24-hour NNS validity. Never re-enable the removed GitHub data writers in parallel.

## Cutover

Complete the private final export, independent backup and synthetic application
restore drill. Coordinate API/origin/CSP settings and manifests in one reviewed
release. Enable exactly one backend writer and retain the old service through
the rollback window. Do not delete old state until the newer target records are
verified and backed up. Documentation changes do not deploy the application.

Do not run untrusted CI jobs beside production keys or expose a host Docker socket
to a runner. Any separate runner arrangement needs reviewed isolation and measured
capacity; these deployment templates do not authorize an additional paid service.
