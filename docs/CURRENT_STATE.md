# Current state — Cosmoot

Updated 26 October 2026. This is the authoritative current feature and release
inventory. Update rows in place; retain dated evidence separately. Public/private
boundaries are defined in [DOCUMENTATION_PRIVACY](DOCUMENTATION_PRIVACY.md).

## Source and publication

| Item | Confirmed state | Evidence / remaining boundary |
| --- | --- | --- |
| Last successful website release | Source `c573f21d7a304948197fd7eb29012cbac83a9683` | [Manual release 40227248631](https://github.com/cristianoneta/neta-dao/actions/runs/40227248631) succeeded on 25 October. Includes the five-pool WYND swap, compact rule-approval discovery correction, token/menu/price/mascot refinements and Keplr fee preferences. The `/wynd` short link needs another release. |
| Maintenance release | [PR #304](https://github.com/cristianoneta/neta-dao/pull/304) integrated; website published and backend separately installed | [Changes and validation](MAINTENANCE_2026-10-24.md), [deployment acceptance and limits](DEPLOYMENT_ACCEPTANCE_2026-10-24.md). |
| Homepage / snapshot fallback follow-up | Source corrects obsolete voting/submission copy and adds the missing packaged delegation-planner snapshot | [Scope and evidence](HOME_FALLBACK_2026-10-24.md). Published in release 40106761715; updated homepage observed on both website domains. Responsive CI passed at 320/390/768/1440 px; separate mobile live acceptance and controlled live fallback remain open. |
| Collector archives / efficiency | Source captures UTC Treasury days, archives expired validator evidence before pruning, preserves daily membership/planner observations and signed prices, and shares bounded RPC results | [Scope and acceptance](COLLECTOR_ARCHIVING_2026-10-24.md). Owner confirmed host installation and successful manual collector/archive checks on 24 October; regular cycles, multi-day growth and measured savings remain pending. Local archives do not prove independent retention. |
| Infrastructure backup | Online SQLite exports, locked collector/validator evidence, explicit recovery files, encrypted Restic backup plus verified fresh download; units and retention preview provided | [Runbook and boundaries](INFRASTRUCTURE_BACKUPS.md). Owner confirmed installation, first verified R2 backup/download and full repository data check on 24 October. Daily timer enabled with explicit deferral of another-machine application recovery; unattended cycles and destructive retention remain unaccepted. Private receipts remain outside Git. |
| Backend / public data | OVH backend updated from the reviewed #304 source; Render is retired | Owner-confirmed healthy replacement, successful isolated host checks and independent public API/data probes. Private operational receipts remain outside Git. |
| Source and CI | GitHub primary; GitLab dormant reserve | One PR per related batch. Protected required aggregate check; security audits retained. Production data writers do not run on GitHub schedules. |

The failed pre-#303 release 40073942022 did not publish #302. The successful
release above supersedes that checkpoint. Workflow publication is separate from
live-wallet acceptance and current collector health. The backend installation has its
own dated acceptance record; no new wallet transaction or browser restore is claimed.

[Release 40105745463](https://github.com/cristianoneta/neta-dao/actions/runs/40105745463)
on source `54121449927f30af6e5d590051d0e4323da19b04` was blocked before publication:
the browser test counted main-DAO member rows before their asynchronous snapshot
was ready after reload. The test now holds that fixture response and waits for the
expected membership state before retaining the row assertion. No production UI,
membership rules or wallet behavior changed. PR #309 fixed the test; successful
release 40106761715 supersedes that failed attempt.

## Delegation workspace refinement — published, 25 October

Release 40192326607 published PR #316 successfully, but that implementation adapted
only parts of the lab. The owner identified the mismatch against the actual lab
screenshot. It was an implementation mismatch, not a failed deployment or evidence
of a browser-cache issue.

PR #317 restored the lab composition and was published in release 40196047184.
The owner then identified remaining criterion-density differences and redundant
Compare/Review pages, and requested monetary-column sorting.

The published PR #318 uses Eligibility → Distribution → Review → Rebalance. One review
contains the frozen policy and allocation comparison, exact export and proposal
handoff; old #simulation links select #proposals. Criteria share aligned 42px value
fields. Secondary controls/evidence sit below the concise rows. Observed partial
history stays visible. Current, target and change sort both ways using exact signed
micro-units, with a mobile selector and ordering retained across recalculations.

Base/bonus controls remain explicitly exploratory: production bonus measurements
and a scoring policy schema are not connected. The right-hand production targets
use equal-capped allocation, not fictional lab evidence. Rebalance retains exact
approved-policy isolation and non-executable exports. [Scope and verification](DELEGATION_WORKSPACE_2026-10-25.md).
This refinement was published in release 40200433577. Checked execution followed in release 40219239387, described below.

## Rebalance execution — published, 25 October

The Delegation Programme is an independent product integrated with Cosmoot and an
entry point for its users; it is not Cosmoot's product core (owner clarification).
The new execution path freezes approved-rule targets and exact staking movements,
checks current funds/authority/redelegation limits through independent sources,
and opens the existing Cosmoot community-review/native-governance flow. Rule
approval, exploratory point settings and uncertain transaction journals retain
separate meanings. [Specification, validation and limits](REBALANCE_EXECUTION_2026-10-25.md).
PR #319 is integrated and published in manual release 40219239387 at the source recorded above.

## Five-pool WYND swap — published; short-link candidate, 26 October

The owner requested five selectable WYND pools, current USD liquidity, dropdown
asset selection, the original flickering WYND mascot and a 50-USD swap cap.
The source replaces the explanatory sidebar with pool rows and extends the existing
review/signing path to the exact configured native/IBC/CW20 pairs. The URL remains
`/community-tools/neta/buy/`. [Scope, provenance, validation and release boundary](WYND_SWAP_2026-10-25.md).
PR #321 is published in the website release above. The owner's follow-up requests
add the four missing token logos, constrain the receiving menu to direct pairs of
the pay asset, show both token prices and enlarge the original mascot. Those
refinements were published as PR #322 in release 40225307377. A subsequent wallet
attempt stopped before broadcast because Keplr returned a changed fee. The source
correction supplies Keplr's per-signer fee/memo preferences and retains exact
post-signing validation and unknown-outcome locks. PR #323 was published in release
40227248631; successful live wallet acceptance remains unconfirmed. The requested
`/wynd` short link redirects to the existing swap page, with or without a trailing
slash. The redirect remains a source candidate until the next deliberate release.

## Compact rule-approval discovery — published, 25 October

PR #319 integrated checked Rebalance execution at source
`ae29770b07bfa09b092b87bb69c6d336ae816e5e`; the owner started manual release
40219239387, which completed successfully. Served execution-module bytes match
this source on both public website domains. A subsequent full-lifecycle
check found missing identity lines in compact rule proposals, which prevented
their recognition after passage. PR #320 integrated the correction at `de1fa55c5ada9848f09c933b61083eed25223db0`
after all 18 required checks passed. It retains these lines in new drafts
and verifies immutable older compact approvals from their complete frozen
comparison. [Cause, lifecycle coverage and meaning of rule approval](REBALANCE_EXECUTION_2026-10-25.md#compact-rule-approval-correction).
The correction was subsequently published together with PR #321 in release
40223522400. Publication does not establish a real governance execution.

## Eligibility controls — published 24 October

Manual exclusions at point 5 and configurable Uptime at point 6 (95–100%, default
97.5%) were published in release 40128216384. Policy schema 6 applies the selected
minimum; historical schemas and approvals retain their original meaning.
The repaired history collector had resumed progress at the last operational
checkpoint. Completion of catch-up requires a fresh history-bearing public
snapshot; publication alone does not establish complete or current observations.

## Compact header follow-up

The owner requested removal of the consolidated-scope note above all workspace
routes and the Proposals eyebrow. Source removes both and reduces the shared
navigation-to-content gap to 24 px. Published in release 40108859541; DAO
selection, Treasury consolidation and transaction behavior are unchanged.

## Snapshot diagnostics follow-up

Controlled single-file origin failure exercises restored the original configuration
and normal responses, but did not demonstrate the packaged fallback: both website
domains continued returning the previous server bytes beyond the configured cache
TTL. The specific cause is not established. Private operational evidence remains
outside Git. Source now adds bounded `X-Cosmoot-Upstream-Status`,
`X-Cosmoot-Upstream-Cache` and optional `X-Cosmoot-Upstream-Age` diagnostics to both
server and fallback responses. These describe what the Worker's fetch observed,
not proof of an origin connection or snapshot freshness. Published in manual release 40115824821; normal responses exposed upstream
cache HIT/EXPIRED as expected. Caching, routing and fallback bytes are unchanged.
The owner paused further live failure exercises; packaged live fallback remains
unproven.
See [header semantics and limits](HOME_FALLBACK_2026-10-24.md#upstream-diagnostics).

## Features

| Feature | Current implementation / publication | Limits and owning reference |
| --- | --- | --- |
| Delegation Programme | Published rule workflow with actual holdings/rewards and approved-policy discovery; published #318 includes compact criteria, monetary sorting and unified Review; checked staking execution is a separate source candidate | Frozen old/new rules and allocation impacts; rule approval does not authorize redistribution. [Programme](JUNO_DELEGATION_PROGRAMME.md), [review](DELEGATION_RULE_CHANGE_UX.md). |
| Validator history | Automatic use of the collected period until 90 days exist, then the rolling window; schema 5 fixes the minimum at 97.5%; published schema 6 permits 95–100% | Continuous observed membership, exact counts and original collection start; unavailable/gapped evidence blocks eligibility. Historical schemas retain their meaning. [History](VALIDATOR_HISTORY.md). |
| Programme reward claim | Correct DAO DAO Stargate withdrawals with the programme as delegator and destination | Required real local Juno test reproduces old/wrong-authority failures and verifies 37 withdrawals plus unchanged delegations. First replacement includes the #381 explanation; later omission uses agreed chain history. [Repair](PROGRAMME_CLAIM_REPAIR_2026-10-23.md). |
| Juno community review | Mainnet review v0.3.1, finalization, author withdrawal, native submission/deposits and voting | Fresh authority/content/balance checks; explicit wallet confirmation; pending outcomes remain locked. Operations legacy review is a separate UNI-7 flow. [Semantics](GOVERNANCE_EXECUTION_SEMANTICS.md), [funding](JUNO_COMMUNITY_FUNDING.md). |
| Native voting display | Four choices, live tally, direct voting, participation and validator/direct-address views | Incomplete detail is unavailable, not zero; no invented historical final participation. [Voting](JUNO_GOVERNANCE_VOTING.md). |
| One-off DAI proposal | Direct template link fills 460.9 axlDAI to the recipient of proposal #382; no permanent button | Exact native Community Pool spend is tested locally. Dimi's conversion to USDC and return are separate manual operations, not automated by the proposal. Opening the link does not sign. |
| Community Tools | Interchain → Juno → NETA; Delegation Programme chain picker and NNS entry | Juno currently offered; existing Faucet, v31 tracker and bounded Buy NETA on WYND retained. [Tools](COMMUNITY_TOOLS.md). |
| Treasury | Assets, DAO/SubDAO consolidation, P&L, Community Tax and staking accrual | Accounting begins 1 October 2026. Missing coverage/prices remain Partial or unavailable; claims do not double-count accrued rewards. Freshness is not established by a website release. [Accounting](TREASURY_ACCOUNTING_2026-10-06.md). |
| Names | Mainnet registry v0.3.1 / profiles v0.1.0; purchases active | Published code 5168/5169; recorded registration/fee evidence. Preserve renewal/transfer/validator acceptance limits. [Deployment](NNS_MAINNET_DEPLOYMENT_2026-10-05.md). |
| Personal messaging | Separate two-wallet mainnet pilot, code 5170 | Public release pin remains null. Send/read/reload evidence exists; fresh-profile restore/rotation was deferred. Sending requires an active owned name; receiving does not. [Pilot](deployments/PERSONAL_PILOT_2026-10-07.md). |
| Encrypted backup | Authenticated, scoped envelopes and separate database on the existing backend | Original allowlist retained; synthetic restore/restart evidence exists. Infrastructure backup and daily scheduling are installed; unattended cycles, another-machine application recovery and fresh-browser restore remain unaccepted. [Recovery](BACKUP_RECOVERY.md). |
| Faucet | 25 JUNOX per wallet per 24 hours; ownership proof and durable payout journal | Visitor admission fix installed behind Caddy; original public identity and 25 JUNOX/24-hour limit confirmed. Per-visitor separation tested with isolated real Caddy; no production quota-exhaustion test. |
| DAO Inbox / payments | Gated protocol/UI groundwork; no activated DAO message writes or payment execution | Further recovery, permission and workflow work remains. |
| Notifications / People / Delivery | Browser-local notices and real membership reads | No push/email, cross-device notice sync or fictional live contributor/delivery data. |
| DEX | Unlisted browser simulation with orbital/list views, liquidity forms and unfunded incentive planning | No live swaps, token issuance, funded incentives or DCA; session/demo values. Contract/custody/audit work remains separate. |
| Juno upgrades | v31 archive closed; future-watcher lifecycle core tested | Future network collection, scheduling and automatic publication are not activated. Missing signatures are not proof of failed upgrades. [Tracker](JUNO_UPGRADE_AUTOMATION.md). |

## Security and maintenance boundaries

- Backup source-owner export: the installed first correction failed its new
  backup acceptance. A synthetic host probe reproduced EXDEV at hard-link
  publication across systemd mounts. Matching sandbox CI also reproduced a
  missing effective SETUID capability at the worker's identity transition; the
  unit now retains it explicitly while keeping NoNewPrivileges. The source follow-up uses a bounded copy, reclaims
  temporary ownership on failure, permits worker termination and adds required
  real-systemd sandbox regression checks. The owner confirmed installation, a successful new backup with fresh download
  and SQLite verification, followed by collector progress on 24 October. Do not
  repeat the repair; unattended cycles and the deferred recovery drill remain open. See [backup runbook](INFRASTRUCTURE_BACKUPS.md).
- `crypto-bigint 0.5.5` remains unpatched in the reviewed native test dependency
  graph. The guarded applicability exception expires **24 November 2026 00:00 UTC**;
  all seven WASM normal/build graphs must exclude that chain. Other advisories
  remain blocking. [Assessment](SECURITY_REVIEW_2026-10-24.md), [upgrade work](DEPENDENCIES.md).
- Review contracts, DAO authorization, native submission and later chain execution
  have separate semantics. [Required engineering reference](GOVERNANCE_EXECUTION_SEMANTICS.md).
- Initial upgrade/admin custody remains with the explicitly agreed owner wallet.
  Contract deployment, administration and fee destination are separate; maintenance
  does not transfer custody or make contracts immutable.
- Preserve original databases, crypto/transaction journals, source evidence, frozen
  reviews and generated Treasury/history data. Code rollback never restores an old
  database over newer production state.
- Source checks and synthetic tests are evidence for their fixtures, not a complete
  security audit or a promise of future mainnet execution.

The superseded combined chronology and earlier feature matrix are preserved in
[the 24 October archive](archive/CURRENT_STATE_2026-10-24_before-maintenance.md).
Use [HANDOFF](../HANDOFF.md) for the current development continuation.
