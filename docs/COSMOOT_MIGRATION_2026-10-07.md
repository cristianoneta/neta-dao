# Cosmoot migration — 7 October 2026

Owner decision: use cosmoot.com, GitLab and a new server. Restore availability
first; visible HTML/brand changes follow. This supersedes the earlier prohibition
on adding a paid server for the repository-cleanup task. Update, 8 October: the owner
purchased and bootstrapped OVH VPS-1; see [the host checkpoint](OVH_SETUP_2026-10-08.md).
The recovery source is now imported into GitLab; the owner uploaded the static
package to Cloudflare Pages. The owner confirmed ownership
of cosmoot.com at 18:18 Berlin; this replaces the earlier cosmoot.zone choice.

## Recovery basis

The source is the independently verified local recovery bundle, at
`5df4907df03e97979a667a7bd59e52235daabb01`, plus the saved release notes and draft
release workflow. The recorded final GitHub merge `f5b21a50c67570a710b2641c8d58c78ec6dfdcbc`
is not present locally. Do not claim an exact clone of the last server-side state.
The original emergency archive remains unchanged. Original Git refs are retained
under `refs/recovery/` in the migration bundle; publish only reviewed branches.

The GitHub account was suspended; the cause is not established. The last direct
checks found both old GitHub Pages domains returning 404 and the existing Render
backend health endpoint returning 200. Historical deployment receipts do not prove
current frontend availability. GitHub issues, settings, secrets, runtime databases
and the separate `neta-website` repository are not included in the code recovery.

## Target and current state

| Component | Target | State |
| --- | --- | --- |
| Domains | cosmoot.com and dao.netareborn.com | Both Active with SSL in the owner's Cloudflare screenshot, 7 October |
| Git | GitLab.com Free, private `cosmoot-gruppe2/cosmoot-Projekt` | Imported at `13e0702`; release MR !1 merged as `ec077488`; one-use import token revoked |
| Website | Cloudflare Pages Direct Upload project `cosmoot` | Initial ZIP restored the homepage; first GitLab release d89506f6 completed. No www redirect configured |
| API | api.cosmoot.com on Linux VPS | Compose/Caddy templates only |
| Server | OVH VPS-1, 2 vCPU / 4 GB / 40 GB NVMe, Ubuntu 24.04, Erith | Base setup and snapshot-only HTTPS edge verified; no backend deployment |
| CI | Manual web pipeline and separate manual Pages deployment | Both production variables configured; pipeline 2923507334 and all three jobs passed |
| Full CI | Browser, Faucet/Backup, Rust, WASM, audits | Port and verify before production release; not yet equivalent |
| Collectors / signed prices | Bounded server jobs and separate public JSON publication | Source and inactive units installed; 26 seeded public files verified; original NNS key still needed |
| Backups | Encrypted independent destination with restore drill | Destination, runtime export and hosted drill pending |

Latest owner decision: remove Render after verified cutover, consolidate backend
and the 192 daily scheduled data runs on one VPS. See the [prepared setup and
confirmed host details](../deploy/cosmoot/README.md). The owner purchased OVH VPS-1
for EUR 5.34/month including VAT, without contractual commitment; standard daily
backup and IPv4 are included. VPS-2 was unavailable in the desired region.
Independent backup storage and temporary Render overlap remain separate costs.
Initial code-release CI uses GitLab's hosted quota; data jobs do not consume it.
Measure usage before adding a self-hosted CI runner. Never expose production keys
or a host Docker socket to CI jobs; full Rust/browser parity is still pending.

## Access needed

1. Domain registration is owner-confirmed: cosmoot.com. Verify the registrant
   email and retain account/DNS access. Keep netareborn.com and its DNS access.
2. Create/sign into GitLab with an independent login, not suspended GitHub SSO.
   Create a private empty `cosmoot` project, without README initialization or
   Auto DevOps. Keep schedules and dependency automation off. Add reviewed SSH
   access through the account UI; no private keys, passwords or tokens in chat.
3. Create/sign into Cloudflare for DNS and Pages. A Direct Upload project can use
   local uploads first and explicit GitLab CI uploads later. It cannot be converted
   to native Git integration in place. Do not connect every push to production.
4. Completed on 8 October: order, key-only SSH, blocked root login and UFW with
   public TCP 22/80/443. No fixed operator-IP allowlist has been configured.
   Keep the tested Windows private key local; do not request it in chat.
5. Arrange secure Render database/secret export and a separate backup destination.
   GitHub signing secrets cannot be read back through Git; the owner needs the
   saved NNS signing key. If unavailable, rotation is separate reviewed on-chain work.

## Local commands / first import

The supplied bundle contains the migration branch and recovery refs:

```sh
git clone cosmoot-migration.bundle cosmoot
cd cosmoot
git switch migration/cosmoot
# Add the actual empty project URL after account setup, then push this branch only.
# git remote set-url origin git@gitlab.com:OWNER/cosmoot.git
# git push -u origin migration/cosmoot
node scripts/build-static.mjs
```

The first GitLab import does not run CI: workflow rules accept only manual web
pipelines. No cron jobs, automatic merges, dependency requests or deployments are
configured. Set the first imported branch as default until a reviewed `main` exists;
protect the default branch, prohibit force-push and use merge requests thereafter.

`dist/static` contains only tracked public files, required browser modules and the
two public NNS deployment manifests. It excludes runtime databases, backend code,
Git metadata, node_modules and private configuration. Existing frontend bytes and
crypto artifact hashes stay unchanged. The separate manifest records their hashes.
This is portable static output, usable on Pages or a conventional static web server.

## Bring the website back

1. Upload `dist/static` as a preview. Check home, Treasury, governance, Names,
   community tools, assets and the same-origin encryption runtime. No real signing
   or new device registration during a preview check.
2. Restore `dao.netareborn.com` on the new static host as soon as its DNS is
   accessible. This preserves the existing browser origin and the Render allowlist.
   A new host with the SAME domain does not itself move browser storage.
3. Keep the existing pilot on that old origin initially. `cosmoot.com` is a NEW
   browser origin: IndexedDB, local drafts and transaction/device journals do not
   transfer automatically. Do not globally redirect the old domain, clear storage,
   or register replacement messaging keys as a deployment shortcut.
4. Prepare the target-domain API origin, frontend endpoint and CSP together. The
   initial export deliberately retains existing API pins. Faucet and encrypted
   backup do not yet work from cosmoot.com until their allowed origin is migrated.
   Public personal messaging remains gated as before.
5. Re-enable signed NNS price publication only with the matching existing key and
   fresh collector input. An expired price stays expired; never re-date old data.
6. After the functional migration, update visible brand, titles, links and metadata.
   Legacy links inside the export still reference dao.netareborn.com. New brand
   approval does not authorize changes to contracts, NETA fee destinations or keys.

## Deliberate GitLab website releases

The existing Direct Upload project is reused by Wrangler; do not recreate it or
try to convert it to native Git integration. `.gitlab-ci.yml` starts only when an
operator chooses **Build > Pipelines > New pipeline**. Pushes, merges and schedules
start nothing. Tests and packaging precede the separate `deploy-cloudflare` Play
button, available only on the protected default branch. Its production resource
group serializes uploads; an old commit is rejected if main has advanced.

One-time setup in the existing project:

1. Keep `main` as the protected GitLab default branch and the Cloudflare Pages
   production branch. Verify the Pages production branch before the first upload.
2. Create a Cloudflare API token with **Account > Cloudflare Pages > Edit**, scoped
   to the account containing `cosmoot`. This permission covers Pages in that
   account; it is not a project-only token. No DNS or general account-admin scope.
3. In GitLab **Settings > CI/CD > Variables**, save `CLOUDFLARE_ACCOUNT_ID` and
   `CLOUDFLARE_API_TOKEN`, protected and scoped to environment `production`.
   Set the token to masked and hidden; disable variable expansion. Enter values
   directly there, never in chat, source files or the manual pipeline form.
4. Start one pipeline on `main`. After checks and packaging pass, choose Play on
   `deploy-cloudflare`. It publishes the checked artifact using pinned Wrangler
   4.148.0 to project `cosmoot`, with the pipeline commit recorded in Cloudflare.
5. Check the resulting production deployment and both custom domains. If a build
   fails, the current website remains in place. An expired artifact needs a fresh
   pipeline. For rollback, use Cloudflare's retained prior production deployment;
   do not force-reset the GitLab branch or touch browser storage/backend state.

The first release published static files only. The 8 October local preparation now
adds a compiled /data/* Pages proxy, exact build/source hashes and bundle tests;
GitLab integration, deployment and both-origin live verification remain pending.
Browser and contract CI parity remains open; bootstrap success is not evidence of
a complete application migration.

## Backend cutover

The Compose file is a template, not a verified deployment. It starts no services
without the explicit `backend` profile. No host Docker daemon is available in the
preparation workspace. The snapshot-only edge has since passed on-host validation,
startup and HTTPS/hash/404 checks with a pinned Caddy image. Backend image build and
runtime behavior still need checking. Retain that digest and snapshot site when
updating the same edge for backend cutover; do not start a second proxy on 80/443.

1. Install maintained Docker/Compose on the server and stage the reviewed checkout.
   Keep the checkout and builds separate from `/srv/cosmoot/state` and `/etc/cosmoot`.
2. Back up the existing service before any change. Follow [the backend operator
   procedure](../BACKEND_MIGRATION.md). `scripts/backend-state.mjs` exports both
   databases through SQLite backup, preserves pending journals and verifies a
   private checksum/count receipt. Never copy live main files while ignoring WAL.
3. Before the final export, pause payouts and quiesce ALL writes to both old databases.
   Keep the old service/data intact for rollback. Copy databases privately; verify
   SQLite integrity, file checksums, row counts and pending payout hashes offline.
4. Restore under `/srv/cosmoot/state/faucet.sqlite` and
   `/srv/cosmoot/state/relay-backup/relay-backup.sqlite`. State directories must be
   private and writable by the image's node UID 1000. Put the EXISTING mnemonic at
   `/etc/cosmoot/faucet-mnemonic`, readable only by the service UID/operator. Never
   display its contents. Confirm the same public Faucet address.
5. Copy `deploy/cosmoot/cosmoot.env.example` to the ignored `cosmoot.env` on the
   host. Copy any stricter live limits. Initially retain `FAUCET_PAUSED=true` and
   `RELAY_BACKUP_ENABLED=false`. The example contains public config, no secrets.
6. Validate `docker compose -f deploy/cosmoot/compose.yaml --profile backend config -q`.
   Start the reviewed backend, then check health, identity, CORS and origin-bound
   challenge verification. Health alone does not establish backup readiness.
7. Verify restored encrypted envelopes with an isolated test identity and measured
   off-server restore. Keep the real-user fresh-browser test deferred as requested.
8. Move API DNS and update/rebuild reviewed frontend endpoint/CSP/artifact manifests
   together. Do not silently alter the pinned pilot bundle. Resume one writer only
   after migration checks. A pending payout is reconciled by its saved hash, never
   blindly re-signed. Test preflight and authentication at the real target origin.
9. Render is cancelled only after application/data/backup verification and an agreed
   rollback window. If new writes occurred, do not roll back to an older database.

The application currently treats proxy peers conservatively for IP limits. Review
this behavior before widening access; do not blindly trust X-Forwarded-For.

## Automation after recovery

Port the complete CI contract from the retained GitHub workflows before treating
the GitLab bootstrap as a release gate. Use affected-change rules and bounded
concurrency; audit updates are reviewed in small batches. No updater is activated
by this migration. Confirm old collection schedules have stopped before starting
replacement jobs, and use a single-writer lock. Treasury/accounting starts at the
existing October cutoff; preserve snapshots, coverage warnings and 24-hour price
validity. Future Juno upgrade tracking stays planned, and v31 stays closed.

## References

- https://docs.gitlab.com/ci/yaml/workflow/
- https://developers.cloudflare.com/pages/get-started/direct-upload/
- https://docs.hetzner.com/de/general/infrastructure-and-availability/price-adjustment/
- https://docs.docker.com/reference/compose-file/services/
- [Existing backup recovery procedure](BACKUP_RECOVERY.md)

## Preparation evidence

Local preparation checks passed: 228 JavaScript/Names tests and 84 Python tests;
repository syntax, pinned pilot hashes and the seven-contract inventory; YAML
parsing and selected Compose/CI invariants; 194 exported public files with exact
source bytes, local import/link completeness and exclusion of backend data.
The header policy preserves same-origin crypto framing and blocks foreign frames.
Compose image/runtime validation and GitLab server-side CI lint remain pending.
Subsequent evidence: GitLab import was verified against the exact SHA above; the
owner's screenshots show the Pages homepage and both domains Active with SSL.
Subsequent CI release: pipeline 2923507334 and deployment d89506f6 succeeded for
ec077488. No backend cutover or full migration completion is implied.

Backend preparation follow-up: the Dockerfile now includes the transfer-fee runtime
module imported by the Faucet. A local packaging check covers relative imports.
Four focused tests cover packaging and paired state export/verification, including
live WAL writes, pending/signing locks, quotas, encrypted revisions, no-overwrite,
wrong-source, tampering and permissions. Synthetic data only; no production export.
