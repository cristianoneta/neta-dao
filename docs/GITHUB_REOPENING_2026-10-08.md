# Setup reassessment after GitHub reinstatement

Review date: 8 October 2026. The owner subsequently approved the recommendation
and requested implementation at 12:11 Berlin time. HANDOFF.md owns the current
execution state; this document preserves the preceding assessment. The owner asked to continue MR !2, reconsider the setup
after GitHub reopened, and keep SSH instructions to one command at a time.

## Verified evidence

- GitHub repository access works again. `cristianoneta/neta-dao` is public;
  `main` is `f5b21a50c67570a710b2641c8d58c78ec6dfdcbc` and is unprotected.
- GitLab authenticated `ls-remote` returned main
  `ec07748860f201f4a63c0f7c0869603b46055360` and migration branch
  `c21183bfd517600611fe8c807f0e7daaf2d8189d`. MR !2 was open/draft with two
  commits, 41 changed files and no pipeline before this continuation.
- GitHub's direct open-PR collection returned 32 Dependabot PRs, #225 through
  #256. Search returned no matches and was therefore not authoritative.
  `.github/dependabot.yml` has eleven update entries with a limit of three each:
  up to 33 version-update PRs, not a repository-wide cap of three.
  This explains the PR volume; it does not establish the reason for suspension.
- The three GitHub snapshot workflows and the legacy Pages workflow are registered
  `active`. Latest observed scheduled runs are from 7 October at 13:45–13:54 UTC.
  Active registration is not evidence of a fresh run, nor of safe disablement.
- A comparison of tracked trees found 59 differing paths between GitHub main and
  the GitLab migration head, including nine public data files. GitHub has 519 files;
  the migration head has 556. These are independent imported histories; do not
  force-push either history or replace newer data with GitHub's older snapshots.
- `data.cosmoot.com/data/treasury/neta-main.json` returned HTTPS 200 and matched
  the current local snapshot SHA-256. This is seeded data, not live collection.
  A wider check matched 18 of 26 public files; eight timed out without a byte
  comparison. `receipt.json` and `faucet.sqlite` returned 404; the `.env` and
  unlisted-path checks timed out. This partial review does not replace the
  owner's earlier successful on-host 26-file and four-private-path verification.
- Render `/health` returned HTTP 200 with `{"ok":true}`. This does not verify the
  deployed branch, auto-deploy configuration, wallet operations or hosted recovery.
  Render administration was not inspected: its connector requires a confirmed
  workspace and no prior workspace selection was found. No settings were changed.
- Direct HTTP requests from this environment to both website domains returned
  403. The review cannot distinguish an environment restriction from an edge
  response and does not treat this as proof of a public outage. Fresh served-byte
  verification on both origins remains required before deployment acceptance.

## Recommendation

Keep the independent operating architecture: Cloudflare serves both web origins;
OVH runs bounded data collectors and, after verified state migration, Faucet and
encrypted backup storage. Keep Render until the original databases/identity,
independent encrypted backup, restore drill and rollback gates pass. OVH's
owner-confirmed EUR 5.34/month remains useful even when GitHub is available.
Do not place untrusted CI jobs on the same production VPS.

GitHub is again a reasonable primary development/CI provider: the connector works
and existing CI includes browser, Rust and WASM checks missing from the temporary
GitLab pipeline. Standard hosted Actions runners for public repositories have no
execution-minute charge; GitLab Free namespaces have a 400-minute monthly quota.
Artifact/cache limits and any nonstandard runner charges are separate.

First finish validating the existing migration branch. Then, if the owner chooses
GitHub as primary, reconcile the complete latest source and public data into one
reviewed GitHub change preserving its history. Use GitLab as a secondary code
copy/recovery path, with one-way synchronization and no second active development
or automatic deployment pipeline. A source mirror does not back up production
databases, secrets, issues or all release artifacts.

Before that return, bound Dependabot across the whole project through grouped
updates and few active maintenance batches; review breaking contract upgrades
separately. Preserve security alerts and security-update handling. Pause/retire
the three legacy GitHub data writers before activating OVH collection, prevent
legacy Pages from reclaiming website delivery, and establish branch protection
and an explicit manual production release gate. Do not infer that fewer PRs
guarantee protection against account suspension.

## Next implementation boundary

One deliberate GitLab verification pipeline was started for `c21183bf`:
[pipeline 2925921267](https://gitlab.com/cosmoot-gruppe2/cosmoot-Projekt/-/pipelines/2925921267).
All three jobs passed, finishing at 09:59:30 UTC: bootstrap checks, backend checks
and Pages packaging. The feature branch had no production deploy job. This evidence
belongs to `c21183bf`; the following documentation-only update is not a new release.
Local repository checks, eight focused Node tests and two Python publication tests
passed again. No contracts, production state, timers, DNS or GitHub PRs changed.

After successful integration and deliberate Pages release, verify the
`X-Cosmoot-Snapshot` marker, current bytes, failure fallback and private paths on
both domains. Keep the original NNS price-key recovery and independent backup as
open gates. Continue remote commands individually in the owner's SSH session.

## References

- https://github.com/cristianoneta/neta-dao/pulls
- https://gitlab.com/cosmoot-gruppe2/cosmoot-Projekt/-/merge_requests/2
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows
- https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.gitlab.com/ci/pipelines/compute_minutes/
