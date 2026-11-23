# Current state — Cosmoot

## ROAR price archive — configuration prepared, 23 November 2026

The owner requested ROAR price-history activation after the Osmosis repair.
The existing Terra adapter already supports its registered Astroport ROAR/LUNA
pair and CW20 supply. Two additive configuration entries enable the minute-price
collector; the private activation package adds the six public archive paths while
preserving collector sources, service units and the installed Osmosis fix.
The price reference is a simulated trade before commission, with its remaining
price impact, converted through the existing LUNA/USDC.inj and dated USDC/USD
references. Supply is a separately dated daily CW20 reference. Collection begins
with real observations; no earlier price history is manufactured.
Twenty-nine focused price/source tests and ten private installer tests passed.
Host activation and a later automatic ROAR observation remain pending; the
installer verifies the live registered pair, price and supply before mutation.

## Osmosis volume catch-up — active, 23 November 2026

The Osmosis pilot stalled after a short block range exceeded its 600-result
pagination ceiling. Public chain blocks continued advancing while the retained
volume cursor stopped. The source repair processes bounded block ranges, divides
oversized ranges before collecting full pages, and retains each completely
validated checkpoint before requesting the next range. A later provider failure
or request-budget expiry preserves earlier progress. Delayed coverage remains
unavailable until the index actually catches up; no cursor reset or fabricated
zero is used. Detailed, bounded provider errors identify the failed operation.
The repair is scoped to Osmosis; the other chain scanners and collection schedule
retain their behavior. All 94 focused market, pool and catch-up tests passed.
The owner confirmed installation. Osmosis caught up by 5,801 blocks, and later
public cycles advanced beyond the installation target with no index errors.
A 15:30 UTC snapshot contained 228 tracked Osmosis pools: 224 had USD volume;
186 had complete 24-hour coverage and 42 were still building their own history.
Four lacked complete USD valuation. The separate BTC inventory check still
reported unavailable, so the aggregate service exit status can remain nonzero.
The next scheduled encrypted backup remains a separate acceptance check. See [the pool pilot](MARKET_POOL_PILOT.md).


## Market archive lock coordination and Terra archives — active, 22 November 2026

Terra archive activation rolled back after immediate contention on the common
archive lock; the existing price and pool timers resumed successfully. The two
market collectors now wait up to 60 seconds while preserving exclusive archive and
backup protection. Their service start budgets include this wait. A persistent
lock still fails explicitly, and a later cycle exports retained observations
without duplicate trades or resetting the storage baseline. All 66 focused market,
pool, history and contention tests passed, followed by successful repository CI on
repair commit `454dcfed18cc4cb2ac62c8231bcaed78c218dd23`. The owner confirmed
corrected installation. All five new minute-price feeds are public and contain
observations after installer completion; a later pilot publication records 267 of
267 pools, complete inventories and no index errors. The Astroport Terra inventory
is also publicly readable. The next encrypted backup after activation and next-day
storage comparison remain separate; website publication is unchanged.

## Direct market sources and five-asset pool pilot — active, 22 November 2026

The sixteen-asset price collector now reads its original chain/provider sources directly and reuses dated supply references. The existing NETA collector remains direct. Existing price identities and archives are preserved, including numeric compatibility with earlier external observations.

A separate five-minute pilot covers BTC, ETH, SOL, ATOM and JUNO. Shared pools and repeated trade receipts are deduplicated. The follow-up source exports recorded volume during the first day, retaining a building status and the actual coverage boundary; after a full fresh day it becomes a rolling 24-hour window. Incomplete or delayed evidence remains unavailable. The activated follow-up freezes each trade’s USD estimate using a prior recorded reference, at most 30 minutes old; it is not an exact historical USD execution price. The existing NETA collector retains its separate valuation method. The pilot excludes alloy backing, native Ethereum/Solana venues, orderbooks and unregistered legacy JUNO contracts.

The owner confirmed successful direct-source and pilot installation. Subsequent public cycles advanced all three indexes and recorded all 261 pilot pools. The next encrypted backup after activation remains unverified. The owner confirmed the first-day-volume update succeeded. The further update is now installed for derived 24-hour/five-minute and seven-day/hourly pool charts, last-trade timestamps and frozen prior-reference USD valuations. It preserves the original baseline, data and five-minute schedule and reports derived public-history bytes separately. The corresponding Markets work adds a shared pool registry, searchable directory, provenance and read-only venue quotes; its publication is tracked separately from collector activation. See [the pool pilot](MARKET_POOL_PILOT.md) for methodology and scope; exact operator evidence and continuation remain in the private operations record.

The first history-update installation rolled back at public HTTP acceptance;
observed data was retained. The corrected update is now operator-confirmed installed.
A subsequent public cycle at 2026-11-22T13:25:54Z recorded all 262 registered pools,
with complete inventory for all five assets and no errors in the three chain indexes.
A sampled 24-hour history for each pilot asset was publicly readable and identified
its frozen prior-reference USD basis. The publication fix makes only directories
below the public output root traversable under `UMask=0077`; private state/archive
permissions and collection schedules are unchanged. Verification of the next
scheduled encrypted backup and the next-day storage comparison remain pending.

## Interchain Markets expansion — 21 November 2026

The Markets expansion includes TIA, INJ, AXL, LINK, SOL, BABY and UNI alongside the original ten assets; AKT is excluded at the owner’s request.
Cosmos pool liquidity is separate from external USD price references and Injective orderbook depth. The price collector now validates explicitly identified external references without inventing chain blocks, and retains native-chain supply evidence, including finalized Solana slots and the UNI burn-address adjustment.
The operator subsequently confirmed installation of all sixteen additional price archives and an overnight encrypted backup/download verification. A full off-server application recovery remains untested. See [Interchain Markets](INTERCHAIN_MARKETS.md) for identities and rollout boundaries.


## NETA pool coverage and swap volume — prepared, 21 November 2026

A separate five-minute collector adds the weighted NETA/OSMO pool 631 and rolling
24-hour indexed swap volume for both tracked pools. It retains native quote-token
volume, timestamps and completeness, and values USD at the current quote. Minute
series also carry their observed supply for the separate Markets valuation chart.
The existing Markets website/domain is active; these new host services still
require the private installation and subsequent timer/backup acceptance. See
[NETA Markets](NETA_MARKETS.md) for methodology and limits.

## NETA Markets — prepared, 21 November 2026

The owner approved a separate NETA market page and minute reference-price collection.
The new collector reads only the known WYND pair, keeps block and USD-quote times
separate, preserves daily Treasury history as a different evidence class, and writes
its own SQLite history and public snapshots. The existing Treasury schedule and
wallet/governance code are unchanged. Source validation and a read-only live query
passed; production timer installation, DNS and subsequent scheduled observations
remain separate acceptance steps. See [NETA Markets](NETA_MARKETS.md).


## Treasury collection checkpoint, 18 November 2026

The November collector package is installed. Published staking accrual is current through 17 November, with the 1 and 13 November payout controls verified. Both Operations chains refreshed successfully and retained all 57 receipts; the statement remains explicitly partial where historical evidence or classification is incomplete.

The shared WYND collector now publishes all eight pools. Its former HTTP 403 was reproduced with `Python-urllib/3.12`; otherwise matching requests succeed with the existing Treasury identity `NETA-DAO-Treasury/1.0`. PR #347 adds that identity while preserving height headers, pool identity validation, block anchoring, timeouts and freshness limits. All 18 repository checks passed, including a local HTTP regression rejecting absent/wrong response heights and genuine HTTP failures.

Production acceptance on 18 November: the published Treasury and WYND observations both use Juno height 43,878,774, with block time 20:20:47 UTC and all eight pools present. Operations receipts refreshed on both chains; staking remains current. The unchanged external checker passed all 50 observations in a separate local run and [GitHub run 44377522930](https://github.com/cristianoneta/neta-dao/actions/runs/44377522930), job 135105775820, at 20:22 UTC. No alert or freshness threshold was disabled. This confirms the corrected publication; the next unattended timer cycle is a separate operational observation.

The Osmosis receipt adapter also supports the Validatus archive. On full RPC replays it checks retained bank transfers preceding the October accounting floor against the address index, transaction bytes and amounts. Verified block times fill missing dates on those retained transfers, which stay outside the October statement. A provider can advance a published cursor only after the floor, prior anchor and replay agree.

## Shared data collection candidate, 15 November 2026

The Operations receipt collector keeps a separate verified height and success time for each chain. The combined statement stays unavailable during an incomplete refresh. The Osmosis archive RPC adapter checks indexed transaction bytes against their block and replays the stored receipts before a provider switch. Evidence still requires actual provider availability.

The Treasury snapshot can carry all eight verified WYND pools at a single Juno block, with reserve and USD observation times. The swap overview reads these values. The selected pair, wallet balance and signing quote still use direct checks. The NETA membership snapshot now identifies its block hash and time for consumers reconciling the same height.

The publisher reuses identical payloads in the previous immutable generation and records byte counts per completed publication. The public freshness workflow reads the three websites and the origin independently. Host installation, external observations and the manual frontend release have separate acceptance steps.

Updated 5 November 2026. This is the authoritative current feature and release
inventory. Update rows in place; retain dated evidence separately. Public/private
boundaries are defined in [DOCUMENTATION_PRIVACY](DOCUMENTATION_PRIVACY.md).

## Source and publication

| Item | Confirmed state | Evidence / remaining boundary |
| --- | --- | --- |
| Last successful website release | Source `c34f5baee290460d05d4ec2cd46dfe6ddd388528` | [Release 42077505461](https://github.com/cristianoneta/neta-dao/actions/runs/42077505461) completed all 20 jobs on 5 November, including production publication. The homepage, Juno editor, distribution view and live native participation were opened on cosmoot.com. |
| Juno voter archive | Website published; collector installation requires separate host acceptance | The public proposal view supports retained weighted ballots and address counts for #387, #388 and later openings. The live participation view reconciled #387 with 80 direct voters on 5 November. [Coverage and checks](JUNO_VOTE_ARCHIVE.md). |
| Homepage and flexible rule editor | Published in the 5 November release | Homepage opens the real editor; schema 11 assigns exclusive criterion roles with editable bonus curves, real impact, frozen review and approved-rule Rebalance. Existing rule hashes remain unchanged. [Contract, checks and size boundaries](DELEGATION_RULE_COMPOSER_2026-11-04.md). |
| Code review and maintenance | Website fixes published; forum and collector service installs require separate host acceptance | Native-signature and pagination checks, discussion request admission, truthful collector failures, visible-view Treasury polling, shared Names signing loader and runtime linting. [Findings, validation and remaining work](CODE_REVIEW_2026-11-03.md). Website, discussion service and collector publication remain separate. |
| Direct voting-power cap | Published; review 4 revision 2 finalized at 100% | Native #387 observed in voting on 3 November (block 43,376,015), ending 8 November 06:05:43 UTC. Rules only, no execution messages. Historical semantics preserved. [Details](DIRECT_VOTING_CAP_2026-11-02.md). |
| Proposal size resilience | Website changes published; attachment activation remains separate | Compact rule/action storage, early sizes and separate native byte/gas budgets. Isolated Juno executes 45 moves and verifies the undeployed 0.4.0 attachment candidate. Wallet upload/resume UX and explicit migration approval still gate attachment activation. [Scope and validation](PROPOSAL_SIZE_RESILIENCE_2026-11-03.md). |
| Readable referenced rule proposals | Published, including native voting navigation | Native text contains a meaningful summary and exact on-chain review reference; full evidence stays in the existing workshop. The follow-up resolves the unchanged pinned link to its unique native proposal after submission, with separate explicit history and unchanged voting/signing behavior. Review storage retains its existing limit. [Format and validation](REFERENCED_RULE_PROPOSALS_2026-10-31.md). |
| Proposal discussions | Service/API and Juno-only website follow-up published | Follow-up retains the selected rule review, hides old imports through a persistent cutoff, automatically creates only new Juno native/review topics, and joins exact review/vote matches atomically. Removes the old topic form; session renewal preserves the visible draft. Targeted scope installation and encrypted backups accepted; one selected discussion remains visible and both scoped sources are current. Real Keplr/Ledger/mobile acceptance remains open. [Product contract and rollout](PROPOSAL_DISCUSSIONS.md). |
| Rebalance readiness correction | Published in manual release 41329125613 | Fixed-date preflight and SDK redelegation response parsing corrected; short referenced native text, complete inline staking messages, compact complete evidence and shared field limits. [Scope and validation](REBALANCE_READINESS_2026-11-01.md). No contract or collector update. |
| Native vote gas correction | Published; successful owner wallet acceptance verified on-chain | The higher-gas vote was included with code 0, the expected Yes ballot and 118,192 gas used from 250,000. Preserve original-sequence binding and both attempts during uncertain outcomes. [Evidence, safeguards and validation](NATIVE_VOTE_TRANSMISSION_2026-10-27.md). |
| Native proposal submission gas | Published; successful live submission verified | Corrected reward review 3 became native #384 with code 0, 2,255,995 / 3,092,554 gas and fee 0.231942 JUNO. Its 5,000 JUNO deposit opened voting; execution remains pending. [Reproduction](PROPOSAL_SUBMISSION_GAS_2026-10-27.md), [two-source checkpoint](DELEGATION_CHECKPOINT_2026-10-29.md). |
| Maintenance release | [PR #304](https://github.com/cristianoneta/neta-dao/pull/304) integrated; website published and backend separately installed | [Changes and validation](MAINTENANCE_2026-10-24.md), [deployment acceptance and limits](DEPLOYMENT_ACCEPTANCE_2026-10-24.md). |
| Homepage / snapshot fallback follow-up | Source corrects obsolete voting/submission copy and adds the missing packaged delegation-planner snapshot | [Scope and evidence](HOME_FALLBACK_2026-10-24.md). Published in release 40106761715; updated homepage observed on both website domains. Responsive CI passed at 320/390/768/1440 px; separate mobile live acceptance and controlled live fallback remain open. |
| Collector archives / efficiency | Source captures UTC Treasury days, archives expired validator evidence before pruning, preserves daily membership/planner observations and signed prices, and shares bounded RPC results | [Scope and acceptance](COLLECTOR_ARCHIVING_2026-10-24.md). Owner confirmed host installation and successful manual collector/archive checks on 24 October; regular cycles, multi-day growth and measured savings remain pending. Local archives do not prove independent retention. |
| Operations receipt collection | Source installed; fresh public events/accounting verified after update, with all 57 earlier events unchanged | Both previous providers had pruned the accounting-floor block. Seven regression tests cover archive access and rate limiting, retained evidence, failed child exits and missed freshness checks. [Repair and deployment boundary](OPERATIONS_COLLECTOR_2026-10-31.md). Complete host health and the next scheduled cycle remain separate checks; no website release needed for this repair. |
| Infrastructure backup | Daily backup extended to discussions; fresh encrypted backup/download and same-host isolated forum application restore accepted on 1 November | [Runbook and boundaries](INFRASTRUCTURE_BACKUPS.md). Final moderator/routing configuration also verified in a new backup. Another-machine recovery, unattended-cycle evidence and fresh-browser message restore remain separate; retention unchanged. Private receipts remain outside Git. |
| Backend / public data | OVH backend updated from the reviewed #304 source; Render is retired | Owner-confirmed healthy replacement, successful isolated host checks and independent public API/data probes. Private operational receipts remain outside Git. |
| Source and CI | GitHub primary; GitLab dormant reserve | One PR per related batch. Protected required aggregate check; security audits retained. Production data writers do not run on GitHub schedules. |

The failed pre-#303 release 40073942022 did not publish #302. The successful
release above supersedes that checkpoint. Workflow publication is separate from
live-wallet acceptance and current collector health. The backend installation has its
own dated acceptance record. The agent made no wallet transaction or browser restore;
the independently observed #384 submission is recorded separately above.

## Delegation treasury reward receipts

The collector reconciles SDK EndBlock withdrawals with the distribution module's bank transfers at their recorded event positions. Native proposal #384 executed at Juno block 43,312,101. Its 37 withdrawals included 35 transfers and two zero claims. The 3,595,908.770592 JUNO payout settled accumulated rewards. The claim-adjusted accrual for 1 November was 7,086.368884 JUNO. Payout evidence links to the block and has no transaction hash. The browser applies the full historical daily quote and truncates the final USD value to 18 decimals, matching the collector. Replayed the four missing UTC days and retained all 27 earlier intervals. Publish the compatible browser reader before installing the collector changes. Production acceptance is separate.

## Delegation controls and governance bonus — published 31 October

PR #330 implements schema-9 points-based allocation, using only our own fully
observed governance history. Configurable base/bonus points start at 900/100;
governance takes 100% of the bonus weight and the three unavailable criteria stay
at zero. The released schema-9 cap factor accepts 1.0–3.0; the schema-10 percentage replacement is tracked above. Fixed allocations are reserved
first and remain exempt; historical schemas 2–8 retain their exact semantics.
[Measurement, source behavior and validation](DELEGATION_GOVERNANCE_BONUS_2026-10-31.md).

The Python exporter reads captured voting starts, ends and accepted own-account
votes, with continuous block coverage and persistent first-entry evidence. No
external historical backfill is performed. Empty complete samples retain base
points; missing selected evidence blocks a new bonus review. Reviews freeze the
sample, votes, points settings and targets; approved Rebalance uses that revision.

Working history increases from 120 to 180 days, with verified archive-before-delete
and no archive expiry. Local source validation covers 443 JavaScript and 242 Python
tests (14 environment skips). Feature head `ed0bac062b76b8a1b057d270a511064991630348`
passed all 18 jobs in [CI 41199076122](https://github.com/cristianoneta/neta-dao/actions/runs/41199076122),
including browser and programme-execution acceptance. The subsequent readiness
update changes documentation only. Owner-confirmed collector installation is
complete. Fresh public governance evidence covers two fully observed completed
proposals; the production parser and simulation accept it. A frozen first-rule
proposal using all 37 held positions and both proposals roundtrips in 9,427
characters. Full host health and the next scheduled cycle remain separate checks.

Manual release 41200786112 initially stopped before publication when
the review-funding test held concurrent author-name reads and released only the
last one. The test-only correction uses one shared barrier and forces overlapping
reads, retaining the original wallet-disconnect, name-display, withdrawal-access
and no-republication checks. PR #331 integrated that fixture repair; manual release
41217797680 then passed all checks and published the exact checked artifact.
No production wallet/signing code was changed by the fixture repair.

## Fixed additional allocations — source implementation, 29 October

The owner approved schema 7 with explicitly documented fixed targets, reserved
before regular equal-capped allocation. Only fixed portions bypass programme
eligibility and cap rules; the actual stake still affects regular capacity.
Distribution includes authoring and budget breakdown; immutable rule and execution
reviews preserve obligations, dates, exact amounts and supporting links. Rebalance
keeps approved rules separate from local edits. No recipient is preconfigured.

[Semantics, UX, date boundaries and validation](FIXED_DELEGATIONS_2026-10-29.md).
This source was published in release 41010288402 on 30 October. Rule approval
and separately voted fund movements are still required;
no wallet, contract or infrastructure operation was performed.

## Delegation Programme continuation — checked 29 October

The [dated checkpoint](DELEGATION_CHECKPOINT_2026-10-29.md) records two-source
native history/receipt checks and public planner validation. Corrected claim #384
is voting until 1 November at 21:53 UTC (22:53 Europe/Berlin); it has not yet executed
at the observation height. No native proposal with the supported allocation-rule
title exists in the fully paginated current store. Historical programme policies
remain historical decisions, not a verified new planner revision. Initial rule
review/approval is the next product step. Separate Rebalance preparation requires
approved rules and resolution of pending programme treasury actions, including #384.

The public snapshot now provides continuous available-period history and reconciled
commit counts through 29 October 20:06:37 UTC, approximately 15.03 days. Production
validators accept that interval; the 90-day target is not yet reached. This updates
the older unavailable-history checkpoint without claiming independently replayed
history, scheduled host acceptance or a new allocation authorization.

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
PR #319 is integrated and published in manual release 40219239387 at source
`ae29770b07bfa09b092b87bb69c6d336ae816e5e`; it remains included in the current release.

## Five-pool WYND swap and short link — published, 26 October

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
slash. PR #324 was published in release 40378998268.

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
The 29 October public snapshot now contains validated continuous history and
participation counters through its observation height. This resolves the older
unavailable-history checkpoint; complete 90-day coverage and independent history
verification remain distinct from available-period validation.

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
| Delegation Programme | Published Eligibility → Distribution → Review → Rebalance, compact criteria, monetary sorting, approved-policy discovery and checked staking-proposal preparation | No supported native rule approval exists at the 29 October checkpoint. Rebalance requires approval and no pending programme treasury proposal; #384 is voting. [Programme](JUNO_DELEGATION_PROGRAMME.md), [execution](REBALANCE_EXECUTION_2026-10-25.md). |
| Fixed additional allocations | Schema-7 source implementation; awaiting manual website release | Exact fixed targets reserved before regular allocation; regular eligibility/cap exemptions are explicit. No preset beneficiary, automatic renewal or contract-enforced expiry. [Specification](FIXED_DELEGATIONS_2026-10-29.md). |
| Validator history | Published available-period/90-day transition; schema 6 permits 95–100% with default 97.5%. Approximately 15.03 days validated on 29 October | Provider-observed continuous membership and reconciled commit counts, not a completed 90-day record or historical no-jail proof. Historical schemas retain their meaning. [History](VALIDATOR_HISTORY.md), [checkpoint](DELEGATION_CHECKPOINT_2026-10-29.md). |
| Programme reward claim | Corrected 37-withdrawal Stargate envelope published and submitted successfully as native #384 from review 3 | In voting at the 29 October observation; no mainnet execution claim. Local Juno regression separately verifies withdrawals and unchanged delegations. #381 remains failed. [Repair](PROGRAMME_CLAIM_REPAIR_2026-10-23.md), [checkpoint](DELEGATION_CHECKPOINT_2026-10-29.md). |
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
