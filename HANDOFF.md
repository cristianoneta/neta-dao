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

GitHub return PR #257 is merged as `0916bec559c9522642d184ef5eb51737bb75fdd1`.
Its exact reviewed tree passed all 16 required CI jobs. GitHub confirms Pages is
disabled and main requires `Required repository checks`. All 32 old Dependabot
version PRs were closed without applying their upgrades; no open PR remained at
the completion check. See [release evidence](docs/deployments/GITHUB_PRIMARY_2026-10-08.md).

At 14:02 Berlin the owner shared GitHub Support's explanation: content in an
unspecified PR resembled scam-related asset-retrieval language. PR volume is not
the confirmed cause. Follow the publication guidance in AGENTS.md and the
[support clarification](docs/GITHUB_REOPENING_2026-10-08.md). The specific PR and
passage remain unknown; account App/token/2FA review remains an owner-side step.

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

1. Corrected Cloudflare release run `37774069535` successfully published exact
   main `153f7a8c74fced500110cffef7e468c0b04e24a6` as deployment `b9efb912` at
   12:14:25 UTC / 14:14 Berlin. All release checks and the actual publish step
   passed, including the new real-workerd regression. The owner configured
   `CLOUDFLARE_ACCOUNT_ID` and a dedicated Pages-edit `CLOUDFLARE_API_TOKEN`
   privately in GitHub; the releases verified their use. This supersedes
   deployment `55e7a408`, whose Worker always returned the static fallback.
   The connector can inspect runs but cannot start new workflow dispatches. Use
   the owner's normal browser for the start button; do not repeat failed cloud
   browser sign-in attempts or request credentials in chat.
2. Owner/VPS HEAD and GET checks reached `cosmoot.com` with HTTP 200 but
   `X-Cosmoot-Snapshot: static-fallback`; direct `data.cosmoot.com` returned 200
   in 0.186 seconds. Real workerd reproduced the cause: `redirect: 'error'` is
   unsupported and fails before the origin request. The correction uses `manual`
   and still rejects every non-200 response. Its new real-runtime regression check
   runs in PR CI and before release. PR #259 was merged after all 16 checks passed
   and the corrected artifact is now published. Next: one read-only GET from the
   owner's VPS to `https://cosmoot.com/data/treasury/neta-main.json`, displaying
   headers. Require `server`, then verify bytes and fallback on both website origins.
   Live acceptance is still open; keep OVH timers inactive. See the release record
   for the local baseline failure and corrected-runtime evidence.
3. Continue SSH one command per reply. Codex has no authenticated VPS SSH access.
   OVH source export `08cc957` and the pinned snapshot-only Caddy edge are installed;
   the owner's 26-file hash and four-private-path checks passed earlier on 8 October.
   No fresh collector run, active timer or backend install is claimed.
4. Keep Render running. The owner's GitHub settings screenshot confirms a secret
   named `NNS_PRICE_SIGNING_KEY` exists; its value and identity have not been read
   or verified and it is not installed on OVH. Preserve it. Recover the original
   NNS price key privately, arrange an
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
