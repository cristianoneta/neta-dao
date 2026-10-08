# GitHub primary and Cloudflare release — 8 October 2026

## Later acceptance update — 8 October 2026

The operator subsequently reported a successful manual main collector run and
HTTP 200 with the server snapshot marker for the signed NNS price on both website
origins. All 26 public files subsequently matched across the three origins.
Original Faucet/NNS identities were backed up privately. The controlled live
fallback drill remains open; timers stay inactive. A preliminary encrypted database
copy was verified, and synthetic application restore passed on the target host and
in its hardened image. No production cutover is confirmed. Exact operator evidence is retained
privately. The sections below describe their respective release-time checkpoints;
use [CURRENT_STATE](../CURRENT_STATE.md) for current migration status.

## Source integration completed

- Owner approved GitHub primary, Cloudflare websites, OVH collectors/eventual
  backend, GitLab passive reserve and Render removal only after state migration.
- PR [#257](https://github.com/cristianoneta/neta-dao/pull/257) imported GitLab
  `b00683c4` without rewriting GitHub history. Merge: `0916bec559c9522642d184ef5eb51737bb75fdd1`.
  Reviewed tree: `77b73be131caa62309334982a600f29cd85eb9f3`.
- [CI run 37763827061](https://github.com/cristianoneta/neta-dao/actions/runs/37763827061)
  passed all 16 jobs for head `08af63cc74119c95b29cf3317cf2a89e4148fe42`.
  The main merge tree exactly matches that reviewed tree.
- Repository API confirms `has_pages=false`, protected main and required GitHub
  Actions check `Required repository checks`. Full administration-rule details
  are inaccessible to the integration; enforcement is reported for non-admins.
- Dependabot version limits are zero in all 11 entries. The 32 inventoried PRs
  #225–#256 were closed without applying their upgrades. No open PR remained at
  verification; security alerts were not dismissed. The six obsolete data/bot
  writers are absent from main and the registered-workflow inventory. Weekly
  read-only security audit remains. No workflow ran for the merge SHA on push.

## Cloudflare release completed; custom-domain acceptance pending

The owner confirmed adding `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as
GitHub repository secrets. The dedicated token was requested with Account /
Cloudflare Pages / Edit for the relevant account. No secret value was received
in chat. The successful publish step verifies their use for this release.

The owner started [run 37767439816](https://github.com/cristianoneta/neta-dao/actions/runs/37767439816)
at 11:02:26 UTC (13:02 Berlin), selecting main `0916bec5` and publication enabled.
All release jobs passed, including the actual publish step. Cloudflare reported
deployment complete at 11:13:07 UTC (13:13 Berlin), with immutable deployment URL
`https://55e7a408.cosmoot.pages.dev`.
The workflow builds a scoped 26-path Worker, checks source/artifact hashes and
synthetic proxy/fallback behavior, then publishes the exact artifact to project
`cosmoot` only if current main still matches and required configuration exists.

The 196-file artifact passed source/build hashes and compiled Worker checks for
all 26 GET/HEAD paths on both origins, exact bytes, private-path routing and
synthetic outage/503 fallback. Its GitHub artifact ID is `11545707856`, ZIP SHA-256
`d447cdc0be8bffdd114a57f2326f7b0fbf5bbb8d18524e49e4f85f1ffbaf03a3`.

During release, the public OVH edge served `/data/treasury/neta-main.json` with
HTTP 200, 3,438 bytes and SHA-256
`1544dda3cd51c245602398ee7280645f69e6aea37fc5c0cdfb0c38cc34b0d5da`.
This verifies reachability of seeded data, not fresh collection.
After publication, assistant GET probes of that path on both custom domains
returned HTTP 403, `Server: cloudflare`, text/plain and no `X-Cosmoot-Snapshot`.
No public-client outage or bot-block cause is established by those responses.

## Owner/VPS acceptance found a Worker runtime defect

The owner's subsequent terminal output established:

- At 11:19:21 UTC, HEAD on cosmoot.com returned 200 with
  `X-Cosmoot-Snapshot: static-fallback`.
- At 11:20:22 UTC, direct HEAD on data.cosmoot.com returned 200 from Caddy,
  3,438 bytes and total time 0.185872 seconds.
- At 11:21:47 UTC, a normal GET on cosmoot.com returned 200, 3,438 bytes and
  `static-fallback` in 0.230678 seconds. Fast fallback alone did not prove its cause.

The compiled Worker was then exercised in actual workerd, using Miniflare bundled
with the pinned Wrangler 4.148.0 and synthetic origin/assets. workerd rejected
`redirect: 'error'`: it accepts only `follow` and `manual`. The rejection occurred
before outbound I/O, and the proxy's catch returned the static asset. The existing
Node fetch mocks accepted the unsupported option, so the original CI missed it.

The correction changes the option to `manual`; the existing exact-200 condition
continues to reject redirects without following their destinations. The new
`scripts/check-pages-runtime.mjs` runs the compiled artifact in workerd, exercises
all 26 GET/HEAD paths on both domains, exact bytes and credential/query stripping,
and verifies original static fallback for 301/302/303/307/308/503 responses without
following redirects. Private/unlisted paths and writes must make no origin calls.
The test uses synthetic assets; their 404 results are not live Pages 404 evidence.
Both PR checks and the release workflow now run this runtime check.

The new regression check failed on the old bundle with `static-fallback` instead
of `server`, then passed all cases after rebuilding with the correction. The
three focused Node tests, compiled Node Worker check, 196-file artifact integrity
check and repository syntax/pilot inventory checks also passed locally.

## Corrected Worker published at 14:14 Berlin

- PR [#259](https://github.com/cristianoneta/neta-dao/pull/259) merged as
  `153f7a8c74fced500110cffef7e468c0b04e24a6` after all 16 required jobs passed in
  [run 37770846965](https://github.com/cristianoneta/neta-dao/actions/runs/37770846965).
  Reviewed head: `00c24cafb06783532e254228d2559e2a3b37e483`; reviewed/merged tree:
  `6e1d498aa34690c30f064ef1d71b30b8e5f9ef26`.
- The owner started [release 37774069535](https://github.com/cristianoneta/neta-dao/actions/runs/37774069535)
  at 12:02:16 UTC, selecting exact main `153f7a8c` and publication enabled.
  The admission log confirms both inputs. Main remained unchanged through upload.
- All release jobs passed. The release job ran the new real-workerd check on the
  exact compiled artifact, as well as Node bundle and artifact-integrity checks.
  The actual publish step succeeded at 12:14:25 UTC / 14:14 Berlin:
  `https://b9efb912.cosmoot.pages.dev`.
- Artifact ID: `11549542515`; ZIP SHA-256:
  `5102c85718b4ddd90cbf6de910899120683d483123d1b2a5e6dc7860045a25ae`.
  The Pages workflow used `--no-bundle` to publish the checked artifact.

At release time, the corrected upload superseded `55e7a408`. The following
paragraph and operational boundaries record that historical checkpoint; the later
acceptance update at the top is authoritative. Live both-domain server-marker/byte
acceptance and a controlled fallback check remain open; seeded data is still not
fresh collection evidence. Next: owner/VPS GET with response headers for the
known treasury path on cosmoot.com, then complete acceptance one command per reply.

## Operational boundaries

- Before this release, owner-confirmed custom-domain production was GitLab
  `ec077488`, deployment `d89506f6`. The new upload is confirmed by the publish
  logs; no corrected custom-domain live acceptance or live fallback drill is claimed yet.
- Verify both `cosmoot.com` and `dao.netareborn.com`: server snapshot marker,
  exact public bytes, private/unlisted behavior and fallback. Synthetic Worker
  tests are not a live failure drill. Assistant HTTP 403 responses previously did
  not prove a public outage; the owner's normal connection/VPS can supply evidence.
- OVH uses source export `08cc957`, seeded snapshots and an active Caddy data edge.
  Timers remain inactive. No SSH command, backend cutover or database change was
  performed during GitHub integration. Continue SSH one command per reply.
- GitHub settings show `NNS_PRICE_SIGNING_KEY` exists, last updated three days
  before the owner's screenshot. This is metadata evidence, not proof of key
  identity or a completed recovery. Do not expose, replace or rotate it. It has
  not been installed on OVH.
- Keep Render running and preserve both databases, Faucet identity, payout
  journals and quotas. Independent encrypted backup and private state transfer
  remain open. GitLab is a passive historical reserve; no automatic mirror or
  second deployment path has been configured.
