# Cosmoot handoff

Updated 8 October 2026. Read [CURRENT_STATE](docs/CURRENT_STATE.md) and the
[OVH checkpoint](docs/OVH_SETUP_2026-10-08.md) before changes.

## Owner decision and source of truth

The owner approved GitHub as the primary development/CI platform, Cloudflare for
both website domains, OVH for collectors and the eventual backend, GitLab as a
quiet reserve, and removal of Render only after verified state migration.
Related work belongs in one branch and PR. Automatic version-update PR waves and
scheduled production-data commits are no longer permitted.

The migration source is the complete GitLab branch at `b00683c4`, transferred onto
GitHub main `f5b21a50` without replacing its history. The return branch is
`deployment/github-primary-20261008`. Preserve all imported source and public data.
GitLab MR !2 is the earlier migration record, not a second active development track.
Do not reactivate GitLab releases or copy old GitHub data over newer snapshots.

## Automation changes in this source

- Dependabot version-update limits are zero; security alerts/updates and the weekly
  read-only security audit remain. The [32-PR maintenance inventory](docs/DEPENDENCY_MAINTENANCE_2026-10-08.md)
  preserves proposed updates for deliberate review; none are silently merged.
- The three scheduled data writers and three obsolete bot-writing workflows are
  removed. Collectors live on OVH, where timers remain inactive until acceptance.
- One repository-check workflow runs for PR changes. No duplicate post-merge push
  run. Markdown-only changes report the required result without large builds;
  source/data/manifests keep full checks. WASM jobs have a parallel limit of two.
- Live-chain inspection and historical release tagging are manual only.
- `.github/workflows/cloudflare-release.yml` is manually dispatched with the exact
  main SHA. Packaging defaults to no deploy; publication requires protected main,
  full passing checks, configured Cloudflare secrets and unchanged current main.
- The GitLab pipeline definition in this source is dormant. This does not prove
  GitLab's existing default branch or account settings have already been updated.

## Operational boundaries and next steps

1. Verify the return PR and its exact CI head before merge. Check GitHub Pages is
   retired at the account setting and main requires `Required repository checks`.
   The connector supports code/PRs but not these administrative writes. A GitHub
   browser sign-in is needed if there is no authenticated settings session.
2. Configure the existing Cloudflare deployment credential privately for GitHub;
   it is currently configured in GitLab, not verified in GitHub. Do not display,
   rotate or transfer secrets in chat. Run the deliberate Pages release and check
   `X-Cosmoot-Snapshot: server`, bytes and failure fallback on both website origins.
   The frontend currently still serves the prior static Cloudflare release.
3. Continue SSH one command per reply. Codex has no authenticated VPS SSH access.
   OVH source export `08cc957` and the pinned snapshot-only Caddy edge are installed;
   the owner's 26-file hash and four-private-path checks passed earlier on 8 October.
   No fresh collector run, active timer or backend install is claimed.
4. Keep Render running. Recover the original NNS price key privately, arrange an
   independent encrypted backup, export/restore both existing databases and the
   Faucet identity, and follow [BACKEND_MIGRATION](BACKEND_MIGRATION.md). Preserve
   payout journals and quotas; never initialize empty production state.
5. Resume hosted backup recovery, DAO multi-recipient messaging and payment-request
   work only after infrastructure acceptance. Future Juno upgrade tracking remains
   specified in [JUNO_UPGRADE_AUTOMATION](docs/JUNO_UPGRADE_AUTOMATION.md); v31 is closed.

The earlier GitLab pipeline 2925921267 passed all three check/package jobs for
`c21183bf`; it did not publish the proxy. Read [the reassessment](docs/GITHUB_REOPENING_2026-10-08.md)
for pre-return evidence. A merged source change is not a live deployment.

## Preserved decisions

- Both personal devices are registered; user-confirmed send/read/reload passed.
  Fresh-browser restore/rotation was explicitly deferred. Do not repeatedly request it.
- NNS: 3 characters $99/year, 4 $19, 5+ $5. Owner controls upgrades/tariffs/pause/key
  rotation; fees go to the main DAO. Keep the approved 24-hour signed snapshot policy.
- Never erase pending transaction/crypto journals, silently rotate keys, automatically
  resubmit uncertain transactions, change payout limits or enable public messaging.
- No new paid service or plan upgrade. Separate backup before expanding beyond ten
  pilot wallets, or earlier if contention requires it.
- Do not restart v31 collection or turn missing signatures into software-version claims.

Earlier chronology: [archived handoff](docs/archive/repo-review-2026-10-07/HANDOFF.md).
Update this file in place; put release evidence in its own dated record.
