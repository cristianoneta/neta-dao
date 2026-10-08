# One-server Cosmoot setup

Owner decision, 7 October 2026: remove Render after a verified migration.
Update, 8 October: the owner purchased and bootstrapped the OVH VPS below. These
application configurations are partially installed: the snapshot edge runs and the
source/inactive collector units are installed, but no backend or timers run yet. See the
[operator checkpoint](../../docs/OVH_SETUP_2026-10-08.md).

## Roles and operating cost

| Service | Responsibility | Recurring work |
| --- | --- | --- |
| GitHub | Primary source, reviewed PRs, deliberate Cloudflare releases | No scheduled data commits or automatic version-update PR waves |
| GitLab Free | Dormant recovery copy | No parallel development or active releases |
| Cloudflare Pages | Existing two website domains, static release assets | One deployment per reviewed code release |
| OVH VPS-1, 2 vCPU / 4 GB RAM / 40 GB NVMe, Ubuntu 24.04 | Faucet + encrypted backup DB, Caddy, collectors | Treasury 15 min; main DAO/NNS and members 30 min |
| Independent encrypted backup destination | Original identities, databases, collector checkpoints | Required before deleting the old host; destination not yet chosen |

Use GitHub hosted CI for the public repository after the owner-approved return. Removing the 192 scheduled data runs/day is the first saving.
No extra paid runner or Render cron service is needed for those jobs. Measure
actual release usage before buying CI capacity. The GitHub required check retains browser/Rust/WASM gates. Do not run arbitrary CI code alongside production
keys. If a self-hosted runner becomes necessary, restrict it to this project's
protected reviewed refs, one job, no host Docker socket, no backend/price secrets,
and bounded rootless containers (up to 2 CPU/3 GB); validate isolation first.

Owner-confirmed order, 8 October: VPS-1 in Erith, United Kingdom, EUR 5.34/month
including VAT, no contractual commitment. IPv4 and standard daily OVH backup are
included; no optional storage, snapshot or premium backup was purchased. The
previous VPS-2 choice was unavailable in the required region. Independent encrypted
backup storage, domain renewals and temporary Render overlap remain separate.
Collector limits are initially one CPU, MemoryHigh 1280 MiB / MemoryMax 1536 MiB.
With the existing 1-GiB backend and 256-MiB edge caps this leaves OS headroom on the
4-GB host. This is a starting budget, not evidence of measured workload capacity.

Sources:
- https://www.ovhcloud.com/de/vps/
- https://www.ovhcloud.com/de/vps/configurator/?brick=VPS%2BModel%2B2&planCode=vps-2027-model2&pricing=upfront12&storage=75__SSD__NVMe&vcore=4__vCore
- https://docs.gitlab.com/ci/pipelines/compute_minutes/

## Install after the server is available

Use Ubuntu 24.04 LTS x86, SSH public-key access and automatic OS security updates.
Install Docker Compose/Caddy for the backend, Python 3.12 with venv, and a verified
Node 24 distribution under `/opt/cosmoot/node`. Pin reviewed image digests before
production. Snapshot-only Caddy startup and HTTPS were verified on the VPS through
the owner's terminal output; the backend image has not run there yet.

1. Follow [BACKEND_MIGRATION.md](../../BACKEND_MIGRATION.md). Preserve both SQLite databases and the existing
   signing identity. API starts paused, backups disabled; never initialize empty
   state to make the container start. A TCP health probe only proves the process
   listens; `/health` intentionally remains 503 while backup is disabled.
2. Create system user `cosmoot-collect` with no login and no docker group. Put an
   exact reviewed code export at `/srv/cosmoot/collectors/repo`, owned by root.
   The collector needs no Git token and must never `git pull`/reset its data.
   Only `repo/data`, `/srv/cosmoot/public-snapshots` and its systemd StateDirectory
   are writable by this user. Keep backend state and `/etc/cosmoot` inaccessible.
3. Create `/srv/cosmoot/collectors/venv` as root, install the pinned dependencies
   from `scripts/requirements-community.txt`; use the same Python for all jobs.
   Preserve existing generated JSON, compressed block checkpoints and the original
   1 October accounting cutoff. New code releases must retain these live files.
4. As `cosmoot-collect`, seed the public generation from that export:
   `venv/bin/python repo/scripts/publish-server-snapshots.py /srv/cosmoot/public-snapshots`
   (run from `/srv/cosmoot/collectors`). Only the 26 explicit paths in
   `snapshot-paths.json` are copied; source timestamps/signatures are unchanged.
   Configure directory traversal so Caddy can read these public files only.
5. Install `systemd/*.{service,timer}` into `/etc/systemd/system/`, but do not enable
   timers yet. Units use one CPU/1536 MiB at most, one common lock and finite timeouts.
   The existing workflows had concurrent independent RPC subcollectors; these
   retain their limits. Busy jobs fail visibly and retry at the next scheduled
   time; missed intervals are not replayed in a burst. Inspect unit failures and
   source-status timestamps; a running timer is not proof of fresh source data.
6. Recover the existing NNS signing key privately from the owner's backup. Install
   it root-only as `/etc/cosmoot/nns-price-key` and the `@main.service.d` drop-in.
   Only the NNS signing subprocess receives it, not generic collectors or CI.
   Without it, the main job reports failure and keeps the old signed price. No
   key rotation, extending expiry or re-dating stale observations is performed.

## Data publication without rebuilding the website

The current frontend fetches relative `/data/...` URLs. Merely running collectors
or updating GitLab would not update the public website. The current path is:

- During the Render overlap, `compose.snapshots.yaml` now runs just the data edge
  with `Caddyfile.snapshots`, without backend state or secrets. Its Caddy digest
  was reported by the owner after pulling the official `caddy:2-alpine` image on
  the VPS. On-host Compose/Caddy validation passed, and the owner verified HTTPS
  bytes for all 26 files plus four expected 404 responses. It uses
  project `cosmoot`, service `edge` and the same certificate-volume names as the
  final backend Compose file. At cutover, update that existing edge through the
  final Compose configuration; do not start another proxy on ports 80/443. Retain
  the snapshot mount/site and the pinned image when merging the final configuration.
  Public listeners are TCP 80/443 and UDP 443 (HTTP/3); no backend port is published.
- Publisher validates all allowlisted JSON/gzip files and atomically changes the
  `current` generation symlink. Two prior generations are retained locally. This
  is not an independent backup. The common collector lock covers publication.
- Mount `/srv/cosmoot/public-snapshots:/snapshots:ro` in Caddy's edge container,
  merge `Caddyfile.snapshots`, and configure `data.cosmoot.com` DNS/HTTPS. That
  virtual host serves only `/data/` below the exported generation, never the repo,
  backend state, databases or private credentials. Verify actual responses first.
- `functions/data/[[path]].js` is prepared for the next reviewed release.
  `scripts/build-pages.mjs` uses Wrangler 4.148.0 to bundle the function into
  `dist/static/_worker.js`; it proxies only the 26 exact
  public paths and uses 60-second caching. Cookies, auth tokens and query strings
  are not forwarded. An origin error falls back to the release's original static
  snapshot with `X-Cosmoot-Snapshot: static-fallback`; original timestamps remain.
- The Pages manifest records function/helper/allowlist/config and compiled hashes.
  `check-pages-worker.mjs` exercises the real bundle with synthetic upstream and
  static responses on both origins, including GET/HEAD, exact bytes and failure
  fallback. `_routes.json` is scoped to `/data/*` so other routes stay static.
  The manual GitLab release deploys the checked bundle with `--no-bundle`.
  `wrangler.json` pins the compatibility date; no extra bindings are configured.
  Do not use dashboard ZIP upload for this function. No frontend URL/CSP/crypto
  bytes were changed for data. Live Pages verification remains pending.
- Test both website origins for a known changed snapshot, static fallback and
  absence of private files; then enable the three timers. Check old GitHub schedules
  cannot run in parallel. NNS validity remains 24 hours from the original observation.

The server exists, and the function is compiled/tested locally but not deployed.
No extra R2, Redis, database or queue service is needed.

Cloudflare references:
- https://developers.cloudflare.com/pages/functions/get-started/
- https://developers.cloudflare.com/pages/functions/routing/
- https://developers.cloudflare.com/pages/get-started/direct-upload/

## Cutover and acceptance

Keep Render until a private final export, independent backup and synthetic restore
drill succeed. Coordinate API endpoint/CSP and pinned application manifests in one
reviewed release; both allowed web origins are supported in the prepared backend.
Enable a single writer, verify existing limits/pending journals, then stop the old
service. Delete the old service/disk only after the agreed rollback window and
verification of the newer target state. Do not roll back onto an older payout DB.

Prepared validation: 89 Node backend/export/origin/proxy tests plus two Python
publication tests passed. The snapshot edge and compiled Pages bundle have the
additional evidence above. No backend install, production export, live RPC
collector run, live Pages proxy, CI runner isolation or cutover is claimed.
Owner-confirmed host preparation now includes key-only SSH, UFW, Docker 29.8.2,
Compose 5.6.0, a successful hello-world container, Python 3.12.3 and verified
Node 24.21.0. Remaining prerequisites:
Pages integration/release, private Render export, existing NNS key and independent
backup destination. The prepared batch is pushed in GitLab MR !2; deliberate
verification pipeline 2925921267 passed for `c21183bf`, without deployment.
See [the GitHub reopening review](../../docs/GITHUB_REOPENING_2026-10-08.md) before
changing repository roles. There are no assistant-held VPS credentials.
