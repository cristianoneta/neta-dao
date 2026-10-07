# Next-chat handoff — dao.netareborn.com — 7 October 2026

## Shared Render backup deployed — 7 October 2026, 13:15 Berlin

The existing `neta-junox-faucet` service now runs candidate commit
`052e736a87d44bbe3743524b1a547822bc6dbf81`, first verified disabled and then enabled
for the owner wallet only. The original service/plan/disk and Faucet identity,
balance and 25-JUNOX/day policy are retained. Hosted HTTPS health, exact-origin
CORS, admission checks and invalid-authentication rejection passed. No real
backup was uploaded and no mainnet messaging transaction was made.

Read [the hosted deployment record](deployments/RELAY_SHARED_RENDER_2026-10-07.md) for exact settings, deploy IDs and
public HTTP evidence. Render is connected; workspace `netadao` is already
confirmed. Environment updates automatically deploy, despite automatic Git
push deployments being off. No further browser login is needed for MCP-supported
operations. Do not recreate or upgrade the service.

Next: obtain the second consenting Juno wallet, prepare a reviewed restricted
pilot client, then valid wallet authentication, encrypted backup/restart/off-service
restore and the real two-wallet messaging/recovery lifecycle. Both public release
pins remain null and PR #195 remains draft/unmerged. Backend deployment is not
public messaging activation. Older missing-Render instructions below are history.

## Owner deployment completed — next step is the shared Render backup

This section supersedes the earlier missing-receipt and owner-upload instructions.
The owner supplied the successful public receipt export. The two transactions,
raw signed intents, downloaded code bytes, contract identity, administrator and
policy were independently verified through **both PolkaChu and STAVR**.

- Code ID: **5170**.
- Contract: `juno1dvmms7su8zfqu4gxxmrkqhzpxr5v3sh8hzfxe8ypsgfegc22lggq5jfjx6`.
- Creator/upgrade admin: `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`.
- WASM: `835323a60b0d418d0ef88e1fe12c02f8d65cc5c84fcf593135fdb18977f86708`.
- Store transaction: `9282A17189A199D7EAC4F07F99D00B3654287D83F361A932E84842A6ABB59385`, height 42,454,656.
- Instantiate transaction: `198BFC83E6056EB285ECE3F9C5B19C3B54F68A91468592F1A32BBC65C488ECC9`, height 42,454,685.
- Policy: `juno-1`, reviewed NNS registry, `dao_enabled:false`.

Read [the deployment record](deployments/PERSONAL_MAINNET_2026-10-07.md) for the
unmodified receipt JSON, independent checks and exact candidate Render settings.
**Do not ask the owner to upload or instantiate again.** Preserve existing journals.
PR #195 stays draft at `052e736a87d44bbe3743524b1a547822bc6dbf81`, with its five
successful application workflows. Both application pins remain null pending the
reviewed service/release setup; recording a real contract is not public activation.

The user installed Render during this continuation; installation was confirmed.
Its management tools were not exposed inside the already-running turn. Discover
the newly connected capabilities on the next turn; do not request reinstallation.
No dashboard configuration was inspected/changed and no Render deploy was started.
Read-only `/status` was ready at 10:41 UTC; `/health` returned 404.

Next: inspect the **existing** `neta-junox-faucet` service, preserve its plan/disk,
mnemonic secret configuration and payout data, then apply the reviewed root/build/
start settings with RELAY disabled first. The implementation is on PR #195, not
main; select a deliberate reviewed candidate commit for the service deployment.
Use this verified mailbox for configuration. Obtain the second consenting pilot
wallet before the two-wallet test. Verify actual origin/authentication/quotas,
Faucet continuity, restart persistence and off-service exports before release.
Continue DAO inbox/recovery and payment requests only after personal messaging.

## Personal messaging continuation — integration and preflight complete

This section supersedes the earlier PR-head and next-step status below. The owner
authorized continuation after reviewing the plan. PR #195 remains **draft and
unmerged**, now at `052e736a87d44bbe3743524b1a547822bc6dbf81`.

- Integrated main through `65da24148d215f96ab7dd682418f204dd6d0b2b9` (PR #213).
  Resolved the two conflicts by preserving both the shared-backup and Community
  Tools CI triggers, and both sets of design guidance. The merged generated-data
  tree exactly matched that main checkpoint. Later scheduled data commits must
  still be preserved at final integration; do not repeatedly chase them as code changes.
- All five hosted workflows passed for this application head: browser
  `37606695121`, frontend/contracts `37606695238`, Faucet/signing `37606695132`,
  reproducible WASM `37606695050`, encrypted backup `37606695257`.
  Local validation: 200 root Node tests, 66 Faucet/signing tests and ten backup
  tests passed; both signing bundles rebuilt byte-identically. The local Chromium
  download was unusable, so complete browser regression evidence is the successful
  hosted workflow, including personal recovery, UX, deployment and crash tests.
- Read-only provider probes at 10:18 UTC (12:18 Berlin) returned fresh `juno-1`
  blocks from both configured verification REST providers. PolkaChu RPC was
  synchronized; WhisperNode RPC returned HTTP 502. No endpoint configuration changed.
  Follow-up at 10:23 UTC returned matching height **42,454,404**, block time
  `2026-10-07T10:22:59.346290381Z`, from PolkaChu and STAVR, both with
  `Access-Control-Allow-Origin: *`. An intervening probe returned a transient 403;
  these successful observations are dated evidence, not a permanent availability guarantee.
- At 10:20 UTC, all seven checked public deployment files matched main exactly:
  the HTML/controller/core, network policy, Names networks, signing bundle and
  v0.4 WASM. The WASM remains
  `835323a60b0d418d0ef88e1fe12c02f8d65cc5c84fcf593135fdb18977f86708`.
  The public owner page was also inspected in a desktop browser. No owner wallet
  was connected and no local transaction journal was inspected in that browser.

**Next owner action:** open the existing
[deployment page](https://dao.netareborn.com/relay-personal-deploy.html) in the
same browser/profile used for the earlier attempt, reload, connect the agreed
owner wallet and use **Check pending transaction** if a saved attempt is present.
Recovery never resubmits. A proven not-broadcast/no-pending state permits the
next reviewed upload; an unknown outcome remains locked. Upload and creation
still require separate explicit Keplr confirmations. Export the real public
receipt JSON, then independently verify it before setting any deployment pin.

Both personal deployment/release pins remain null. Actual owner receipts, live
shared Render backup/persistence, off-service exports, the consenting two-wallet
pilot and remaining release/security gates are still outstanding. No mainnet
activation, Render configuration or fee-bearing transaction occurred here.
Continue with personal messaging, then DAO shared inbox/recovery, then payment
requests/invoices and Treasury linkage. The broader Faucet-header follow-up and
issue #119 remain separate; neither was completed by this integration.

## Verified continuation checkpoint — 7 October 2026, 12:10 Berlin

The owner requested another handoff refresh after the chat became unusable and
attached the preceding conversation. The existing PR #212 handoff already included
the later Stakeflow/POSTHUMAN follow-up; preserve that newer evidence rather than
reverting to the attachment's earlier snapshot. This continuation changes docs only.

GitHub was rechecked at 12:10 Berlin: PR #195 is still the only open PR, still
draft at `39feff397f600a25057087285e7710d032326aca`; issue #119 remains open.
The latest archived scan and successful scheduled publication are recorded below.
No new owner deployment receipt, live backup verification or two-wallet pilot
evidence was supplied. Continue the personal-messaging release steps below.

**Header scope to retain:** the owner's wording was the Faucet header on “allen
Unterseiten”. Verified implementation covers the four Community Tools pages.
A domain-wide check of the other standalone pages/workspace remains a UI follow-up;
do not silently treat Community Tools coverage as proof of a site-wide rollout.

### Live navigation and display

- Hub: https://dao.netareborn.com/community-tools/
- Faucet: https://dao.netareborn.com/community-tools/juno-faucet/
- Upgrade list: https://dao.netareborn.com/community-tools/validator-upgrades/
- Juno v31: https://dao.netareborn.com/community-tools/validator-upgrades/juno-v31/
- All Community Tools pages share the Faucet-style header. Read-only pages have
  their own network label and no wallet action. The workspace footer says
  Community Tools; old root faucet/tracker URLs redirect while retaining query/hash.
- The default **First participation evidence** column chooses the earliest saved
  consensus vote or canonical block signature. It labels the evidence type, local
  clock time and ≤ delay from the halt: participating **by** this time, possibly
  ready earlier. Missing prevotes no longer hide known signature evidence.
  The optional **First block signature** view remains separate.
- Current status, signed-block count and voting power use the last five canonical
  blocks, one block behind the tip, with source agreement/fallback labels.
  Missing current votes/signatures or failed RPC calls never establish failed upgrades.

### Timing evidence and its limits

The halt reference is height 42,452,000 at 08:56:31 Berlin (06:56:31 UTC).
The first resumed block, 42,452,001, has signatures around 09:53:30 Berlin.
Its stale header time must never be substituted for the signature time.

| Validator | First included block signature, 7 October, Berlin | Height |
| --- | --- | ---: |
| BlueStake | 09:53:30 — first resumed block | 42,452,001 |
| GATA HUB | 10:11:49 | 42,452,230 |
| Polkachu | 10:23:19 | 42,452,371 |
| Stakeflow | 11:15:14 | 42,453,157 |
| POSTHUMAN | 11:22:06 | 42,453,271 |
| Shutting down - REDELEGATE ASAP | 11:22:06 | 42,453,271 |

Source: `data/validator-upgrades/juno-v31.json`, collected at
`2026-10-07T09:57:31.825652Z`: contiguous coverage through **42,453,915**,
**20/25 first signatures**. The two matching RPC observers are PublicNode and
STAVR. This count is historical evidence coverage, not a current signing count.
The five still without an archived first signature at that checkpoint were
Stake&Relax, 0base.vc, Validatus, Shutting Down - Redelegate and Secure Secrets.
Later automatic collections may supersede this dated list.

BlueStake participated in the first resumed commit. GATA HUB, Polkachu,
Stakeflow and POSTHUMAN first appear later; restart quorum was achieved without
their included signatures. This alone does **not** establish installation time
or prove those validators upgraded after restart. The owner reports Stakeflow
acknowledged a late upgrade; no operator-post URL was independently verified.

Preserve the recovered 09:32 Berlin two-source consensus snapshot:
`data/validator-upgrades/juno-v31-readiness.json`. It establishes 14 prevoters,
64.53% participating power and 54.77% agreement on one block at height 42,452,001,
round 0, without precommit quorum. Kintsugi's archived prevote is 09:08:04 Berlin,
+11m33s; The_Cybernetics is +10s. Nil counts as participation, not block agreement.
These validator-reported vote times are earlier evidence than restart signatures.
Coverage is partial: missing intervals, validator clocks and commit inclusion
prevent a definitive responsiveness ranking. Do not merge power across rounds
or infer exact readiness from an absent vote. No earlier public operator evidence
was recovered for the missing times during the follow-up research.

### Automatic updates — confirmed with the owner

- Current status, blocks and voting power refresh every **30 seconds while the
  page is visible and Auto is enabled**. Manual refresh is available.
- `.github/workflows/validator-upgrades.yml` collects first signatures every
  **ten minutes**, whether or not anyone has the page open. It scans a contiguous
  sequence using matching canonical commits, with a 120-second / 1,000-block cap.
- The browser reloads saved signature/readiness history at most every **five
  minutes** during refresh. New historical timestamps therefore appear later than
  live status; scheduler, node and Pages delays can extend the wait.
- First evidence is retained permanently when a validator later stops signing.
  Unknown is never a fabricated zero. No manual entry is needed for later arrivals.
- For future upgrades, create the registry/detail entry and configure an explicit
  UTC `readinessWindow` of at most 24 hours **before** the halt. The separate
  pre-quorum observer schedules every five minutes and samples every 20 seconds
  for up to 250 seconds in that window. v31 has no active window; enabling one now
  cannot reconstruct the lost interval. Before a later upgrade, stop/freeze the
  previous collector and deliberately freeze/relabel its live panel.

### Publication and validation

- PR #210 merged as `93dd8a27dd240f7cc7714913c30f0186c8649874`; Pages
  `37599340713` succeeded (shared header, recovered votes, future capture support).
- PR #211 merged as `5ad9fb14bf72daf1ec65341c41d75c687e22cfac`. All five checks
  passed for head `75df611aeec0728012b787dc35793b8c84670a33`:
  browser `37601087695`, frontend `37601087674`, Faucet `37601087715`,
  pre-restart votes `37601087705`, signature history `37601087728`.
  Tests cover earliest-evidence selection, unknown records and missing sources;
  the browser regression checks Stakeflow's fallback link, preserved early votes,
  live failure states and layouts from 320 to 1440 px using mocked RPC data.
- Production collector `37601407504` succeeded and published
  `ad4bdb481f861f14f64707d5277d0ae125dd2791`, including POSTHUMAN and the additional
  returning validator. Pages **`37601479514` succeeded** for that data commit.
  The preceding Pages run `37601406309` was cancelled/superseded, not the final
  publication result.
- Fresh 12:10 Berlin repository check: scheduled history run `37603987812`
  succeeded and published `bfcc2afb210fbd763c19e7bd31d7ca9080dcc377`;
  its Pages run `37604149174` succeeded. The latest inspected main head was
  `592beb63251a070afea4b1d04aa3a1bd50f0e069`, with successful Pages
  `37604415482`. The archive still has 20 observed first signatures, with the
  same five unknown records, now scanned through 42,453,915.
- Publication/evidence was verified through GitHub Actions and the committed
  archive. No fresh production-browser or independent cryptographic signature
  audit was performed during this documentation refresh.

### Still-open work

Draft PR **#195** remains open at
`39feff397f600a25057087285e7710d032326aca`; continue its personal RELAY
recovery, shared Faucet backup and real mainnet pilot work. Its previous five
checks passed, but that does not establish actual owner deployment or live Render
recovery. Integrate newer main changes deliberately before continuing.

Issue **#119** remains partly relevant for incomplete Treasury/expense coverage,
unknown IBC decimals and DAO-write/validator-E2E follow-ups. Its unactivated-NNS
wording predates the verified launch and October-only accounting scope. Do not
close it wholesale or merge PR #195 as part of the tracker. A later issue-maintenance
pass should replace the stale NNS wording with the remaining concrete acceptance
criteria; this documentation refresh does not edit the issue itself. PR #209 was
closed as superseded; #208, #210, #211 and the previous handoff PR #212 are merged.

This is the current continuation entry point. It supersedes the status and next-step
instructions in the [6 October handoff](HANDOFF_NEXT_CHAT_2026-10-06.md), which is
retained as history. The owner requested this checkpoint because the previous chat
had become unusable. This update changes documentation only.

## Start here

- Repository: https://github.com/cristianoneta/neta-dao
- Live workspace: https://dao.netareborn.com/
- **Juno upgrade status:** https://dao.netareborn.com/community-tools/validator-upgrades/juno-v31/
- **Owner mailbox deployment:** https://dao.netareborn.com/relay-personal-deploy.html
- **Continue personal messaging in draft [PR #195](https://github.com/cristianoneta/neta-dao/pull/195)**,
  branch `codex/personal-messaging-recovery-mainnet`, verified application head
  `39feff397f600a25057087285e7710d032326aca`.

Read `AGENTS.md`, this file and [CURRENT_STATE.md](CURRENT_STATE.md). Before UI
changes also read [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). Fetch current branches and
inspect worktrees before editing; do not recreate the personal runtime from main.
The application head above includes main through PR #205, but predates PR #206.
Integrate newer main changes deliberately before further application work, preserving
generated Treasury/member snapshots and all existing candidate changes.

## Verified release state

| Work | State at this checkpoint |
| --- | --- |
| Owner-only v0.4 deployment helper | Published in PR #200 |
| Large-WASM HTTP 400 correction | PR #204 merged as `1ef796b54c1302407bf2478b2f6301b8b3ce1d46` |
| Visible wallet/network errors and bounded RPC connection | PR #205 merged as `69f6241c743374927f2eb3c3047c10434d2dba1e`; Pages run `37588644835` succeeded |
| Read-only Juno validator consensus tracker | PR #206 merged as `8a58a1b7813beef265f6627bdb31806b361e76a8`; Pages run `37589754547` succeeded |
| Community Tools, compact participation tracker and signature history | PR #208 merged as `d8172c1d383761ac069d328388ca99127194b933`; four PR checks passed, Pages `37596259987` succeeded; live UI and first automated archive publication verified |
| Recovered pre-quorum evidence and shared Community Tools header | PR #210 merged; Pages `37599340713` succeeded |
| Combined participation evidence and ten-minute archive updates | PR #211 merged; five checks passed, production collector and Pages `37601479514` succeeded |
| Full personal messaging and shared Faucet backup integration | PR #195 is **open, draft and unmerged**; all five workflows pass at the application head above |
| Real personal-mailbox upload/instantiate receipts | Still unrecorded; do not invent a code ID, address or successful owner transaction |
| Live shared Render backup deployment and two-wallet pilot | Still unverified; source implementation is not live-service evidence |
| Public personal messaging and DAO writes | Inactive; `PERSONAL_MAINNET_DEPLOYMENT` and `PERSONAL_MAINNET_RELEASE` remain `null` |

Main was read at `592beb63251a070afea4b1d04aa3a1bd50f0e069` during this refresh.
Scheduled data commits may advance main. The latest verified tracker/data
publication and observation limits are recorded at the top of this file.

## Juno v31 interruption and tracker

**Community Tools follow-up:** the owner approved publication on 7 October.
The hub is `/community-tools/`, with Juno Faucet and Validator Upgrade Status
as children, and a permanent v31 upgrade detail page. The shared footer now says
Community Tools. The first-signature column measures observed signing delay from
the halt plus block offset after restart, not actual binary readiness.
Published and checked live at 08:50 UTC: 17/25 validators, 76.68% signing power,
both observers agreeing. The separate archive had reached 42,452,320 with 16
first signatures; the bounded collector continues automatically. These are dated
observations; fetch fresh data before drawing conclusions about a validator.

**Tracker follow-up:** the owner reported advancing blocks but all-zero live-round
votes. The compact correction uses five canonical committed blocks for participation,
with one summary/list and collapsed source details. See the correction section in
[JUNO_UPGRADE_MONITOR_2026-10-07.md](JUNO_UPGRADE_MONITOR_2026-10-07.md).
The original round-only UI description below is historical. A missing signature
does not prove a failed upgrade; current values must come from a fresh observation.

During the prior session, independent public nodes remained at committed height
**42,452,000**, block time **2026-10-07 06:56:31 UTC (08:56:31 Berlin)**, the scheduled
v31 upgrade height. Some configured RPCs returned HTTP 502. This explained why
Keplr authorization could succeed while network verification/connection failed.
A reachable node serving the same old block was not sufficient for deployment.

Historical observation around **07:32 UTC (09:32 Berlin)**: PublicNode and STAVR
both exposed height 42,452,001, round 0, with 25 validators and total voting power
29,766,214:

| Observed prevote | Voting power | Share |
| --- | ---: | ---: |
| For block prefix `64AEF8D4020F` | 16,302,684 | 54.77% |
| Nil | 2,906,222 | 9.76% |
| No vote observed | 10,557,308 | 35.47% |

Visible prevote participation was 64.53%; no precommits were observed in that
round. These are dated observations, **not the current network state**. The owner
reported Dimi's roughly 55% estimate, which these observations corroborated.

A nil vote means participation without support for a block in that round. It does
not by itself show which software version is installed or why support is missing.
Missing votes do not prove a validator failed to upgrade. Block commitment requires
**more than two thirds of voting power in precommits for the same block and round**;
prevote support alone is not a committed block.

The tracker:
- Refreshes every 30 seconds while open and visible; offers manual refresh and an
  auto-refresh toggle. This describes the original live-round view; unattended
  archive collection was subsequently added as documented at the top.
- Shows PublicNode and STAVR independently, including prevotes/precommits and each
  validator's voting power. Never combines votes across nodes, heights or rounds.
- Shows unavailable observers without treating failed reads as zero participation.
- Uses live validator metadata plus a clearly dated name-only fallback; votes and
  voting power are always read from nodes, never from the fallback snapshot.
- Requires no wallet or additional server. It does not authorize transactions or
  prove upgrade readiness from a software-version check.

See [JUNO_UPGRADE_MONITOR_2026-10-07.md](JUNO_UPGRADE_MONITOR_2026-10-07.md) for
endpoints, parsing boundaries and test coverage. Recheck current committed block
progress and the deployment helper's approved verification providers before upload.

## Wallet and upload fixes already completed

The owner page now displays connection progress/errors next to the wallet button,
distinguishes wallet authorization from network verification, tries the next approved
RPC after 12 seconds, and disconnects late clients. Freshness checks, two-provider
verification and pending transaction journals remain intact. PR #205's final browser
and frontend checks passed (`37587969931`, `37587969933`).

The earlier HTTP 400 was reproduced in a **read-only simulation**: 513,331 raw WASM
bytes produced a 1,027,263-byte hex ABCI request rejected by PolkaChu as too large.
Gzip reduced the code to 127,833 bytes and the request to 256,267 bytes; simulation
succeeded at the then-observed block. The signing bridge now compresses large
store-code requests, verifies the decompressed bytes with a bounded reader, and
retains recovery of legacy raw signed transactions. Reviewed uncompressed hash:

`835323a60b0d418d0ef88e1fe12c02f8d65cc5c84fcf593135fdb18977f86708`

Do not infer a Juno protocol WASM-size limit from that provider request-size error.
Reload the published owner page when the network is usable, reconnect the same wallet
and use **Check pending transaction** before preparing another upload. Never clear
site data, discard a journal or repeat an unresolved action. Simulation evidence
does not establish a signed or broadcast owner transaction.

## PR #195: previous failing tests are resolved

The scripted crash/recovery test used to race the Inbox's 30-second automatic
receive poll. The crash suite now owns its receive order; the separate UX suite
checks automatic polling and exclusion while the controller is busy.

The network interruption exposed a separate community-accounting browser assumption.
Retained receipts must remain visible, while failed/stale refreshes must prevent
provisional zeros and totals. The regression now checks both outcomes; production
accounting behavior was not weakened. Old statements that full CI still needs to
pass are superseded by these successful runs for `39feff397f600a25057087285e7710d032326aca`:

| Workflow | Successful run |
| --- | --- |
| Browser crypto/recovery/UX | [37589126376](https://github.com/cristianoneta/neta-dao/actions/runs/37589126376) |
| Frontend/contracts | [37589126464](https://github.com/cristianoneta/neta-dao/actions/runs/37589126464) |
| Faucet/signing | [37589126439](https://github.com/cristianoneta/neta-dao/actions/runs/37589126439) |
| Reproducible WASM | [37589126381](https://github.com/cristianoneta/neta-dao/actions/runs/37589126381) |
| Encrypted backup candidate | [37589126528](https://github.com/cristianoneta/neta-dao/actions/runs/37589126528) |

Green CI does not establish real Keplr/mainnet or hosted Render recovery evidence.
Keep PR #195 draft until its remaining release work is resolved deliberately.

## Owner decisions that remain binding

- **Only sending requires an active owned `.neta` name.** Registration, consent,
  receiving and reading one's own messages do not. Reading still requires the
  recipient's messaging keys; this does not make plaintext public.
- The personal mailbox upgrade administrator remains
  `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`. Do not silently make it immutable
  or transfer administration to a DAO.
- Use the existing `neta-junox-faucet` Render service/plan/disk for the initial
  encrypted-backup pilot. No second paid service or plan upgrade is authorized.
  Separate after adoption, before expanding beyond the ten-wallet pilot or earlier
  if contention requires it. See [shared-pilot runbook](RELAY_SHARED_PILOT_2026-10-07.md).
- Preserve Faucet identity, mnemonic secret configuration, SQLite/WAL and payout
  journals, plus messaging keys, transaction journals, backups and generated data.
- Keep explicit wallet signatures/consent and the 15-minute/120-request backup
  session limits. Passkeys and unattended signing remain deferred.
- Complete personal mainnet messaging first. Then shared DAO recovery/inboxes and
  direct mainnet testing; then **payment requests/invoices** and Treasury linkage.

## Exact next steps

1. Read this checkpoint, inspect current PR #195 and fetch main. Recheck the tracker
   and fresh committed blocks using the deployment helper's approved providers.
   Do not treat these historical percentages as a current outage report.
2. Once network/provider checks pass, resume the owner's existing deployment attempt
   from its journal. Upload and instantiate require separate explicit Keplr reviews.
   Export the public receipt JSON and independently verify exact hashes, code ID,
   contract address, owner admin and policy before pinning the actual deployment.
   Use the [deployment runbook](PERSONAL_MAINNET_DEPLOYMENT_RUNBOOK_2026-10-06.md).
3. Continue PR #195, integrating the latest main changes. Update the **existing**
   Render service's root/build/start/environment settings with RELAY initially
   disabled; preserve Faucet data/config. Configure the verified mailbox and a
   second consenting wallet. Check actual service origin, CORS/authentication,
   quotas, restart persistence, unchanged Faucet behavior and off-service backups.
   Only pin reviewed real values; never create a placeholder contract or origin.
4. Record a real two-wallet mainnet pilot: register, grant consent, send/read/reply,
   reload, then fresh-browser recovery with explicit rotation. Verify that an
   unnamed recipient can receive/read and cannot send without an active `.neta`.
   Resolve the remaining release/security gates before public activation.
5. Resume DAO shared recovery and inboxes: disabled by default, one shared message,
   compact selector next to Inbox, shared open/claimed/answered status and authorized
   handlers. Avoid separate message copies per member. NNS notices remain ordinary
   Inbox messages; do not restore a redundant Names filter.
6. Implement payment requests/invoices, project/milestone evidence, reviewed DAO
   proposals, duplicate-payment prevention and Treasury linkage. These are still
   planned; do not describe a proposal draft as an executed payment.

The older handoff retains Treasury, NNS, governance and wider roadmap details.
This checkpoint does not complete unrelated backlogs or change application behavior.
