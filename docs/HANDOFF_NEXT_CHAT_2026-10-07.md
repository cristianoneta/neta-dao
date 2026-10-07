# Next-chat handoff — dao.netareborn.com — 7 October 2026

This is the current continuation entry point. It supersedes the status and next-step
instructions in the [6 October handoff](HANDOFF_NEXT_CHAT_2026-10-06.md), which is
retained as history. The owner requested this checkpoint because the previous chat
had become unusable. This update changes documentation only.

## Start here

- Repository: https://github.com/cristianoneta/neta-dao
- Live workspace: https://dao.netareborn.com/
- **Juno upgrade status:** https://dao.netareborn.com/juno-upgrade-status.html
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
| Full personal messaging and shared Faucet backup integration | PR #195 is **open, draft and unmerged**; all five workflows pass at the application head above |
| Real personal-mailbox upload/instantiate receipts | Still unrecorded; do not invent a code ID, address or successful owner transaction |
| Live shared Render backup deployment and two-wallet pilot | Still unverified; source implementation is not live-service evidence |
| Public personal messaging and DAO writes | Inactive; `PERSONAL_MAINNET_DEPLOYMENT` and `PERSONAL_MAINNET_RELEASE` remain `null` |

Main was read at `8302850becdc803821cdf48c8a4a21009d7a921f`; its Pages run
[`37590198709`](https://github.com/cristianoneta/neta-dao/actions/runs/37590198709)
also succeeded. Scheduled snapshot commits may advance main after this checkpoint.
The preceding chat reported checking the served wallet assets and opening the live
tracker. This documentation session independently verified GitHub merge/Pages/CI
records, not a new browser session or current chain recovery.

## Juno v31 interruption and tracker

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
  auto-refresh toggle. It is not an unattended monitoring service.
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
