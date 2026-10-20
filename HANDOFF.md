# Cosmoot public handoff

Updated 19 October 2026. This file contains public project status and development
boundaries. Read [CURRENT_STATE](docs/CURRENT_STATE.md), the
[documentation policy](docs/DOCUMENTATION_PRIVACY.md) and applicable AGENTS.md.
Operator access, private backup locations and exact continuation commands belong
in the owner's private operations handoff, outside this repository.

## Proposal 381 execution incident — 20 October 2026 containment candidate

Juno proposal 381 passed its vote but failed at contract deserialization. Cosmoot
emitted DistributionMsg actions that the deployed DAO DAO Core 2.4.0 / code 4047
does not support. The original binary and original payload reproduce the exact
failure before any host call. Submission simulations and mocked browser responses
had not tested the later contract execution. The 5,000 JUNO deposit refund is
confirmed in execution block 42894587; none of the 37 withdrawals executed.

The candidate pauses new programme claims and blocks publication, finalization,
native submission and additional funding of programme execution payloads. Historical
reviews and receipt recovery remain available. The native proposal view now shows
the chain-reported failure reason. Replacement execution is not enabled. See
[the incident evidence and remaining verification requirements](docs/INCIDENT_381_2026-10-20.md).
CI, integration and manual website publication are still required. Nothing in
this checkpoint claims the production claim control has already been disabled.


## Complete rule reviews within the proposal limit — 19 October 2026 candidate

A real programme snapshot exceeded the proposal text limit even without rationale
or exclusions: the sufficient comparison retains 46 validators and 37 held
positions. Repetitive 25-validator arithmetic fixtures did not cover this size.

The candidate adds a lossless dictionary/tuple transport alongside the existing
gzip format and uses a shorter text envelope when needed. Review fingerprints,
all retained observations and amounts, policy semantics and the shared author/voter
view remain unchanged. The 10,000-byte limit is still enforced; evidence is never
removed to fit. Oversize errors report the actual size without blaming absent
optional text. The reproduced public snapshot now fits in 9,241 bytes.

All 356 Node tests, syntax/format checks, the Pages build and Worker runtime check
pass locally. New tests cover realistic identities/portfolio size, long rationale,
exclusions and a prior policy, original-format compatibility, altered transport
data and an oversized required package. A full browser regression for the compact
author and published views is added; local browser installation failed, so its
GitHub result remains required. This correction is not released.

PR #298 itself is live: manual release
[39303406085](https://github.com/cristianoneta/neta-dao/actions/runs/39303406085)
published `3c978afc52cb5440b9e933c8e5f2dc4b77b0dc75`, with all 18 jobs including
Publish successful. The operator installed the exporter, both timers are active,
and the public feed contains reconciled participation counts with the original
collection start. Exact host evidence is retained in the private operations handoff.
No additional host installation is needed for this text-format correction.

## Automatic history and 97.5% commit participation — earlier 19 October candidate

Owner update: editable drafts automatically use the entire available collection
period until 90 days exist, then the rolling 90-day window. Schema 5 also requires
at least 97.5% observed canonical commit signatures. Missing and nil slots are
unsigned. The exact integer ratio decides eligibility; this is not server uptime
or the SDK slashing metric. Other current eligibility checks remain in place.

The read-only archive exporter adds per-validator expected/signed/absent/nil
counts to the existing planner feed, with exact counted height/time bounds.
Roster continuity, original collection start and the snapshot endpoint remain
checked. Counts cover (snapshot minus 90 days, snapshot], or every collected
block during the initial period. The preceding anchor supplies membership only.
Missing or inconsistent observations never become fabricated zero targets.

Saved editable drafts migrate without a transition button, preserving their
settings, rationale and approved parent. Published reviews and approved schemas
2–4 retain their original meaning; a frozen schema-4 regression retains its exact
hash. Author and voter details show the observed signature ratio and counts.
Objective/subjective scoring and allocation execution remain disabled.

Local validation: 351 Node tests and 169 Python tests pass. The local environment
blocks Chromium socket creation, so browser acceptance is delegated to the
existing GitHub browser job. PR CI and manual website publication are pending.
The exporter also needs installation on the data host before new targets can be
calculated from the live feed. No host installation or deployment is claimed.
PR #297's earlier hash repair was installed successfully by the operator on
19 October; the public history retains the original collection start.

## Planner archive hash comparison — 18 October 2026 repair

The website from PR #296 was published successfully by manual run
[39155206263](https://github.com/cristianoneta/neta-dao/actions/runs/39155206263),
source `c09710ed205c23d91b6854e13b62ca131db29161`. All 18 jobs, including Publish, passed.

The first host run with archive integration exposed an encoding error: Cosmos
REST returns the block hash as Base64 protobuf bytes, while the archive checkpoint
uses hexadecimal. Decode the REST value strictly before comparing the same hash.
Height, timestamp, archive continuity and consensus-roster checks remain intact;
malformed and different hashes are rejected before programme reads.

The REST fixture now uses its real wire encoding and reproduces the failure with
the old code. The correction and malformed/wrong-length hash regressions pass.
This candidate requires host installation and a successful published-history
check; it does not change website assets or authorize allocation execution.

## Available-history transition and balanced overview — 18 October 2026 candidate

Owner update: keep a 90-day target, but evaluate the entire available collection
period until 90 days exist. New policy schema 4 expresses this explicitly. All
validators share the same window and must remain active throughout it; later
entry or re-entry does not shorten an individual validator's test. Current jail,
commission, cap, exclusions and upgrade checks remain. Schemas 2 and 3 retain
their historical meaning, including the strict schema-3 requirement. Saved drafts
switch only through an explicit action and the changed eligibility is reviewed.

Archive schema 2 retains the original collection start. Missing prefixes, internal
gaps, absent data, mismatched endpoints/rosters and zero-length observations do not
qualify. The UI and frozen proposal show actual coverage and dates; crossing 90
days automatically selects the full rolling window. Published comparisons remain
bound to their original inputs. Allocation execution stays disabled.

The planner can select a recent common archive/provider block and reads every
balance, validator and programme setting at that height. It cross-checks block
hash/time before exporting history. Missing or >1-hour-lagging archives preserve
current holdings with unavailable targets. The collector service template supplies
COSMOOT_VALIDATOR_HISTORY_DB; the existing archive is opened read-only. Source
changes do not install this integration on the server.

Overview uses one aligned two-column grid, with rules and compact planning inside
one right-hand card. The unavailable execution step is a disclosure. Desktop card
edges align; tablet/mobile stack without losing positions or controls.

Local validation: 344 Node tests, 166 Python tests, the full planner/review/funding/
voting browser regression, repository and format checks, and the Pages/Worker
build pass. Browser checks include shared collecting-period eligibility, automatic
90-day coverage, unavailable evidence and aligned overview cards.

Previous release receipt: PR #295 was published by manual run
[39029839056](https://github.com/cristianoneta/neta-dao/actions/runs/39029839056),
source `45b49ed68563051151d658a9567de32c83db6e68`, with successful Publish on
17 October. Older candidate/unpublished notes below describe earlier checkpoints.
This 18 October change still needs PR CI, integration and a separate manual release;
server installation is also pending. No real wallet or chain write occurred.

## Rule changes and frozen impact review — 17 October 2026 candidate

PR #295 now carries the implemented rule-change review: exact old/new values,
initial adoption without fabricated prior rules, actual-to-target and same-input
old-policy-to-new-policy comparisons, exact deltas and per-validator reasons.
Author and voter share a renderer. The proposal embeds sufficient observations and
results; hash and reproducibility checks reject altered or unavailable packages.
Published views use stored proposal content, never a local draft.

Drafts retain their approved parent. Preparation, publication/revision and review
finalization recheck it. Policy schema 3 implements continuous 90-day active-set
eligibility; historical schema 2 keeps its original meaning. Missing history keeps
new targets unavailable while preserving actual holdings and rule review. A
read-only archive exporter is opt-in; no server change was installed here.

Rule approval contains no execution messages. The future allocation entry remains
disabled until exact-plan approval, verified authority and transaction checks are
implemented. No real proposal, vote or redistribution was submitted. This candidate
has not been released. See [rule-change design and implementation](docs/DELEGATION_RULE_CHANGE_UX.md) and
[example-data browser frames](docs/DELEGATION_PRODUCT_DESIGN.md).

Local validation: 340 Node tests and 164 Python tests pass. Full planner/review/
funding/voting browser checks, repository/build checks and PR CI are recorded in
the associated PR; production publication remains a separate manual step.

## Delegation product design — 15 October 2026 candidate

The existing Juno delegation core has been reorganized around observation, rule
editing, distribution review and proposal preparation. No allocation algorithm,
future scoring, signing or execution capability changes. The candidate reuses the
shared graphite/mint design and preserves the existing routes and downstream flows.
See [the critical review, sources and implementation previews](docs/DELEGATION_PRODUCT_DESIGN.md).
Local planner/browser checks cover desktop, tablet, mobile, failures and the
proposal handoff. The production site remains unchanged by this candidate;
inspect PR CI and use the deliberate release workflow separately.

## Compact voting and Treasury diagnostics — 15 October 2026 candidate

The native proposal view keeps the deadline and removes the duplicate upper tally
cards. Four result bars show percentages plus whole, rounded JUNO in parentheses.
The bars use the independent live/final tally, so a failed participation lookup
or an unavailable historical breakdown cannot hide the result. Source/refresh and
review history move below the participation area; legacy DAO vote totals remain.

Consolidated Income and Expenses retain available valued receipt subtotals labelled
Partial when a unit is incomplete. The result remains unavailable until all units
pass the existing accounting checks. The coverage line identifies incomplete units
and their block/reward cutoff. No missing values become zero.

Live read-only diagnosis found Community Tax through 13 October 23:59:30 UTC while
holdings/statement publication continued on 15 October. Staking rewards extended
through 14 October 23:59:58 UTC. Operator-provided logs show repeated
`Truncated RPC batch` failures in the Community Tax collector. Independent holdings
and statement jobs still publish, so a recent publication did not prove current
block coverage. The old exception did not retain the RPC envelope; the upstream
reason is unconfirmed. A subsequent read-only probe of the next 1,000 heights
returned complete batches, so the failure was not reproduced from this environment.

Rejected or incomplete batch envelopes now trigger a bounded reread of every
requested height using individual calls to the same RPC. Diagnostics retain the
height range, response type/count and short RPC error. Duplicate/foreign response
IDs, per-item RPC errors and invalid block evidence still fail closed. Only a
complete, contiguous, header-verified chunk can advance the existing checkpoint.
The source health check now independently checks Community Tax accounting refresh,
block-collection time, covered block time and status. Neither server change is
installed by a website release; production installation and catch-up remain pending.

Validation: 327 Node tests; 162 Python tests (including batch fallback, unchanged
checkpoint on failure, exactly-once recovery and published-source health); full planner,
review, funding and voting browser flow; hierarchy/consolidated P&L browser flow;
static build and syntax/integrity checks. Desktop/mobile screenshots inspected.
A read-only comparison of ten real heights returned identical amounts and evidence
hashes via batch and individual requests. Full PR CI and manual publication remain pending.

## Native voting and participation — 15 October 2026 candidate

One combined change adds four-choice native Juno voting and Change vote, an inline
proposal/choice/fee review, explicit Keplr signing, two-source preflight checks and
persistent pending-receipt recovery without resubmission. The signature adapter
checks exact message and fee bytes and rechecks the wallet, proposal and deadline
before broadcasting. This does not cast any vote on behalf of the owner.

The same view shows turnout/quorum, regular or expedited acceptance thresholds,
veto share, own delegated weight and inherited validator choices. Searchable,
filterable, sortable and paginated Validators / Direct votes tables distinguish
validator accounts from other voting addresses. Bonded stake and represented
weight remain separate; direct delegations, including validator self-delegations,
are deducted before validator votes are tallied. Weighted ballots retain their
weights; the transaction form deliberately replaces the full ballot with one choice.

Complete validators, votes and voter delegations are read at one header-confirmed
height. SDK-compatible fixed-point rounding and reconciliation against the live
four-option tally gate the detail display. Incomplete pages, missing heights and
mismatches show unavailable, never partial totals. Reads use the narrowly extended
same-origin allowlist, at most four concurrent voter lookups and 50 pages per list.
The view refreshes while visible, preserves independent tally/participation errors,
and rejects responses from earlier selections. No historical final breakdown is
invented from current stake; final tally remains available for closed proposals.

Validation: 326 Node tests and eight signing-adapter tests pass. The complete
planner/review/funding/browser flow passes with added vote rejection, confirmed
change, lost response/reload/status recovery, filters and unavailable-detail cases.
Desktop/mobile screenshots at 1440/768/390/320 px inspected. A real read-only
Proposal 381 snapshot at height 42734121 reconciled 25 bonded validators and 15
direct voting addresses exactly with the chain tally. No real wallet write.
Full PR CI and manual website publication remain pending for this candidate.

## Previous native governance display change — 15 October 2026

Fix duplicate finalized-review/native-proposal list entries through exact immutable
content linking while keeping review history accessible. Hide the contribution
panel after deposit, retaining unresolved receipt checks. Read a fresh live tally
for open native proposals through the existing same-origin read bridge (including
the narrowly allowlisted tally endpoint) and show all four options in JUNO, with 30-second visible
view refresh, manual retry, source/height/time and explicit unavailable states.
Closed proposals use their final tally. No native vote transaction is enabled.
See [voting design and follow-up scope](docs/JUNO_GOVERNANCE_VOTING.md).
Local validation: 315 Node tests, repository syntax/integrity and the full planner,
review, funding and native-voting browser flow pass. The new flow covers deduplication,
review-history round trips/reload, live/manual/automatic tally updates, failures and
late-response isolation, with 1440/768/390/320 px inspection. PR CI and the manual
website release remain pending for this candidate.


## Delegation priority and validator evidence — 14 October 2026 candidate

The owner prioritized completing the Juno Delegation Programme before DEX,
token-creation and launch work. V1 eligibility now requires continuous active-set
membership for the immediately preceding 90 days, superseding projected standby
admission. V2 will add at least 95% participation and no jail episode in that
window. These policy changes are decided but not yet applied to saved rules,
simulation or execution gates.

A separate bounded, read-only collector archives each canonical block's roster
and participation, relevant jail/governance/upgrade events, and hourly validator,
commission, stake, signing-info and chain-parameter observations. Atomic SQLite
checkpoints resume without duplicates or skipped heights; exact evidence is kept
for 120 days with daily aggregates. It has separate systemd units, state and limits;
existing collectors and the website publisher remain unchanged. No scoring or
allocation authorization is inferred from this single-provider evidence.
See [collector design and acceptance](docs/VALIDATOR_HISTORY.md). Source tests and
live probes do not establish server installation or a running production timer.

Release correction: the previous PR #290 source `934c632d` was published in
successful manual release 38582008807, with all 18 jobs successful. Earlier
candidate notes below do not supersede that release receipt.


## DEX viewport alignment — 14 October 2026 candidate

The shared single-line desktop heading now sits above the map and swap columns.
The map preserves its aspect ratio while its size responds to viewport height;
the complete trade column is vertically aligned beside it. Short desktop windows
use a compact inline heading/subtitle, and liquidity/balances share a secondary
row. Mobile and zoomed layouts continue to wrap and stack without clipping.
The owner requested removal of the standalone demo notice and duplicate Explore
pools cards. Simulation labels remain in the header, amounts and action dialogs;
map/list and Pools & liquidity remain the pool navigation paths.

Local validation: full DEX browser flow, screenshots at 1440/768/390/320 widths,
keyboard and 200% reflow. A regression verifies the entire map and trade column
fit simultaneously without scrolling at 1920×900, 1440×900, 1366×768, 1280×720
and 1536×864. Expanded details, feedback and small/mobile viewports may scroll.
PR CI and the manual production release remain pending. No financial model,
wallet, contract or execution changes.

## DEX overview, motion and compact swap — 13 October 2026 candidate

Pools & liquidity adopts the requested overview structure with Incentivize pool
and Create demo pool actions above three graphite/mint metric cards. Total
liquidity includes both sides of every demo pool, including smaller pools, valued
at reserve ratios and the fixed $4 NETA reference; it updates with session state.
The 24h volume card explicitly has no connected data. The incentive dialog now
allows pool selection, including newly created and smaller pools. Existing row
shortcuts, default-collapsed smaller pools and unfunded 84-day plans are preserved.
No wallet, network data or production transactions have been added.

Owner decision: DCA belongs in V2. Proposed initial scope is fixed-budget recurring
swaps through NETA pairs with cancellation and return of unused funds. No DCA UI,
contract or executor is enabled. Astroport's app exposes DCA, but its exact current
implementation, reusable source/license, Juno compatibility and execution fees
remain unverified. Reusing its AMM core alone does not establish DCA support.

Owner update: pool planets now follow independent slow ellipses (3.5–7.5 minutes
per revolution) with Freeze/Resume motion. Hovering the map or focusing an asset
pauses targeting; reduced-motion preferences disable animation. List mode, hidden
views, hidden tabs and open dialogs suspend orbit advancement. No runtime library.
The compact swap form adds muted USD estimates using each demo pool's reserve
ratio and the fixed NETA reference. Fee detail is default-collapsed; total fees
and price impact remain visible, with exact fees still in transaction review.

Local acceptance: DEX browser flows, freeze/resume/hover, reduced motion, USD
estimates and invalid input clearing, overview updates/reset and incentive pool
selection pass. Four viewport widths, 200% reflow and screenshots are checked.
Full PR CI and manual publication remain pending for this candidate.

## Orbital DEX design — 12 October 2026 candidate

The owner approved an original Interchain visual direction for the unlisted DEX.
Its Explore & swap view places NETA at the center of an illustrated orbital map,
with selectable pool assets and an adjacent working demo swap form. Map/list,
small-pool visibility, the pair selector and compact pool cards share the same
session state. The selected pair also opens the existing liquidity dialog.
A 42 KB WebP illustration replaces the concept's static UI artwork; all controls,
labels and amounts are real HTML. Shared graphite/mint controls, fee split,
liquidity, buyback and unfunded incentive-planning behavior remain intact.
The background glow can be paused and respects reduced-motion preferences.
There is no added runtime dependency, wallet integration or network request.
The route remains unlinked and noindex; production publication is manual.

Local acceptance: existing financial model tests and the full DEX browser flow,
plus map/list/pair synchronization, small-pool selection, selected-pair deposits,
keyboard selection and reduced motion pass. Four viewport sizes and 200% reflow
are covered; representative screenshots were inspected. Full PR CI and manual
publication remain pending for this candidate.

## Unlisted DEX preview — 12 October 2026 candidate

An isolated browser-local MVP at `/community-tools/neta/dex/` models NETA-paired
swaps, liquidity deposits/withdrawals, pool creation, and protocol-fee buyback/burn.
All balances, reserves and prices are explicitly illustrative and reset on reload.
No wallet integration, RPC calls, deployed DEX contracts, token issuance or funding.
The added incentive planner saves unfunded session drafts for exactly 84 days,
with reward asset, budget and UTC start/end dates. Astroport's reusable external
incentives module requires LP deposits and uses next-Monday-plus-N-weeks schedules;
adopting that module would change the no-LP-staking architecture and needs a
separate decision. No incentive distribution or sponsorship transfer is enabled.
The page has no incoming navigation/tool links; HTML and response headers request
no indexing. This is an unlisted public route, not access control.

Owner model: 0.30% swap fee, 0.20% stays with LPs, 0.10% funds DAO-token purchases
and burning. NETA remains every pool's counterpart; smaller pools stay accessible
below the $1,000 NETA-side listing threshold. No LP staking. Initial administration
is the owner's wallet, then a new DAO that approves upgrades and owns initial
liquidity. Its token is intended to help fund that liquidity; operating reserves
are separate from buyback fees. No token terms or production buyback parameters
are set by this simulation. Local validation: 308 Node tests, source/static
artifact checks, and the full browser flow passed at 1440/768/390/320 px, including
keyboard dialog dismissal and 200% zoom reflow. Screenshots inspected. Full PR CI
and manual production publication remain pending.

## Compact planner and approved settings — 11 October 2026 candidate

Overview and Set rules keep A/B/C criteria behind default-closed native disclosures.
Category weights remain prominent disabled percentage fields, with the inactive
B80 + C20 =100 preview and the future group-total requirement made explicit.
Set rules puts Allocation settings first, then full-width A/B/C cards. Invalid
V1 inputs open their disclosure before receiving focus. Snapshot status, source
and Refresh data now sit at the bottom; the redundant opening notice is removed.

Overview adds Current rules with actual approved V1 values, the native proposal
link and voting-end date. A read-only adapter scans complete, height-pinned Juno
proposal history through two independent fresh sources and requires agreement.
It recognizes the planner's exact policy format and fingerprint, selecting the
latest passed version by voting-end time, then proposal ID. Incomplete history,
source disagreement, invalid hashes or an unsupported latest policy fail visibly;
they never fall back to an older version or a local draft. Before the first matching
approval, the section explains that the settings will appear after passage.
Refresh clears old approval display and retries independently of holdings.

This is display-only: it neither changes saved drafts nor unlocks allocation
execution. V2/V3 scoring and live weight editing remain planned. Human-authored
historical policies without the exact planner policy block are not auto-imported.
Local validation: 299 Node tests, repository/format/static checks, and the complete
synthetic planner/review/submission browser flow. Four views at 1440/768/390/320 px,
expanded criteria at 1440/320 px, keyboard toggles and invalid-input focus checked.
Full candidate CI and manual publication remain pending. No live wallet action.

## Delegation Programme overview — published 11 October 2026

Overview is now the default entry, followed by Set rules, Review distribution and
Review proposal. It leads with the current snapshot: delegated and spendable JUNO,
validator positions, and claimable rewards. The existing claim-proposal action
moves here from Set rules; returning from a claim draft opens Overview. Current
holdings are read-only and do not establish an approved policy version.

Overview and Set rules share A Eligibility (available V1), B Objective scoring
(planned V2), and C Subjective assessment (planned V3). Manual exclusions remain
part of eligibility. Future controls are greyed and disabled. V2 is objective-only;
an explicitly inactive V3 example shows 80% objective / 20% subjective, with RPC
30% and seven other objective criteria 10% each. An external DAO/person and
subjective rubric are future settings, not an appointed authority. These examples
never enter the simulator, saved rule schema or proposal export. The structure
reuses the archived C4E/RockawayX research without adopting historical parameters.

Local browser acceptance covers current positions, rewards placement, disabled
future controls, draft return links and all four views at 1440/768/390/320 px.
PR #285 passed all 16 CI jobs (38142732149), merged as `a3caada9`, and was
published by successful manual release 38143829153 (all 18 jobs). Overview and
Set rules were inspected on both production domains. No live transaction sent.

## Proposal review hierarchy — published 11 October 2026

The redundant review-link/testnet shortcut row and isolated discussion stake badge
are removed. A prominent author card sits beneath the heading: the verified .neta
name opens a read-only public profile and the full address opens Atomscan. Address
fallback remains available when name lookup fails. The default-closed proposal
text/actions disclosure is now a raised card with explanatory text and clear state.
Public profiles verify the mainnet registry and current ownership before showing
contacts; expired or mismatched identities fail visibly, with a retry option.

Local validation: 294 Node tests, repository/static checks, and the full synthetic
planner/review/submission browser flow. Review and public profile screenshots at
1440/768/390/320 px inspected; keyboard disclosure and profile/address links checked.
PR #284 passed all 16 CI jobs (run 38141482634) and merged as `e56a8901`.
Manual release 38142763291 passed all 18 jobs and published this exact commit.
The author profile and review hierarchy were inspected on the production sites.
No live wallet action performed.

## Community Tools navigation — 11 October 2026 candidate

Interchain now precedes Juno and NETA. Delegation Programme moves to Interchain
alongside a Neta Naming Service card opening the existing .neta name panel.
The programme card first opens a chain picker, currently with only Juno. Its
Juno card opens the existing planner; breadcrumbs provide the return path.
The planner URL and all chain/transaction behavior remain unchanged.
Local validation passed: 292 Node tests, source/static checks and the existing
Community Tools browser flow, including direct NNS navigation and four viewport
screenshots. Full PR CI and manual publication remain pending.

## Current priority

11 October update: PR #281 was published by successful manual release
38078172222 from `fd18e05b13b7d9957aeaaccf59a50cf54d80ebd8`. The owner
reported that activation could not complete its wallet connection. Activation
passed raw browser fetch into the height-pinned verifier, bypassing the existing
same-origin read proxy. Direct provider preflight requests were rejected.

The connection fix routes activation verification through the existing allowlisted
proxy, preserving provider identity, pinned heights and all code/authority/policy
checks. Connection failures now show a clear status alongside the actual reason.
A browser regression rejects every direct provider request and covers outage,
retry, owner activation and pending transaction recovery. No real activation or
production release was performed by the agent. The fix needs manual publication.

10 October update: PR #280 was published by successful manual release
38074225057 from `c4c91fdac8883fec10edffe34d89fcf40b65ffe9`. The owner
uploaded and instantiated Juno community review v0.3.1 on mainnet (code 5171).
Independent transaction-byte and two-provider checks confirmed the new address,
code hash, owner/upgrade administrator and **1 delegated JUNO, zero NETA** policy.
The instance was **paused** at verification; no activation was sent by the agent.

The activation candidate pins that instance in the Juno workspace. Historical
unqualified review links stay on UNI-7; new links, drafts, finalized metadata and
transaction records carry their network identity. Operations stays on UNI-7.
The owner activation page prepares one explicit `set_paused: false` transaction
with exact-payload recovery. Website release and owner signature remain manual;
real two-wallet acceptance is still open. See [mainnet review rollout](docs/JUNO_REVIEW_MAINNET.md).

Earlier release notes below are historical and superseded by this update.


PR #278 merged as `6b9eeeb9e6e5d02b1311f59da3b85e054f60474f` after 16 successful
CI jobs, but manual release 38068377663 failed the personal mailbox browser test
with a generation-2 fingerprint mismatch. PR #277 remains the published source.
A new candidate addresses two verified storage-lifetime gaps: the temporary
CoreCrypto constructor handle survives until GC, and relaxed-idb writes can
outlive the crypto call. It explicitly releases that handle and waits for queued
IndexedDB transactions before snapshot, restore and runtime teardown. Write
failures block checkpoints; concurrent disconnects share one cleanup operation.

The real-browser regression fails on the previous source (one retained native
handle) and passes on this candidate (zero). Delayed/aborted IndexedDB writes,
273 Node tests and the full encrypted message backup/restore/rotation browser
flow pass locally. The original intermittent fingerprint stack was not reproduced
verbatim locally. Full CI and manual publication remain required. Public messaging
stays disabled; pending journals, archived messages and fingerprint checks remain.
See [storage lifetime](docs/PERSONAL_STORAGE_LIFETIME.md).

PR #277 is now published from `d9954bccf217af11ea57857228a6212123433b6d`
in successful manual release [38065296076](https://github.com/cristianoneta/neta-dao/actions/runs/38065296076).
The owner then encountered HTTP 502 while checking prior native submissions.
Read-only diagnosis reproduced HTTP 500 / nil-pointer errors on the second
reverse-paginated governance page at both Polkachu and Stavr. Forward cursor
pagination through the published proxy returned the same complete 147 proposal
IDs at height 42562163 from both providers.

A new correction uses complete forward traversal for duplicate detection and
claim numbering; numbering also preserves provider URL path prefixes. Two-source
agreement, pinned submission checks and incomplete-history failure remain.
Local 269 Node tests, repository/static checks and the full synthetic planner /
review / submission / funding browser flow pass. PR #278 CI passed; its manual release is blocked as described above. No real signature, deposit or contract change occurred.
The earlier implementation notes below describe the now-published PR #277.

PR #276 was published from `e30336128fc1c6f2e3afa549d4a79694a6e00242` by manual
release [38037267610](https://github.com/cristianoneta/neta-dao/actions/runs/38037267610),
with all 18 jobs successful. The owner finalized a review and then encountered a
source-verification error before native submission.

The new candidate moves submission to the bottom of the finalized review. Two
buttons use the verified chain minimum and full voting deposit (currently 1,000
and 5,000 JUNO). A click verifies content, duplicate submissions, authority,
balance and fee, then asks for Keplr confirmation without another form step.
The author can withdraw READY reviews on UNI-7 before native submission;
existing history, journals and status-only recovery remain intact.

Pinned governance reads now use an allowlisted, read-only same-origin Pages
route. Provider identities, block heights, freshness and two-source agreement
remain checked. Browser preflight rejection of the custom height header no
longer blocks these reads. The route cannot sign, broadcast, accept arbitrary
upstream URLs, follow redirects, or fall back to static chain data. Read errors
are displayed beside the deposit buttons. See [review and deposits](docs/JUNO_COMMUNITY_FUNDING.md).

Local validation: 268 Node tests, complete synthetic planner/review/funding browser
flow at four widths, source/static checks, and real workerd transport tests pass.
Full PR CI and a separate manual production release remain required. No real
wallet signature, withdrawal, native proposal or deposit was performed by the agent.
A genuine testnet governance lifecycle through execution, then production-domain
acceptance, remains necessary before declaring the whole flow mainnet-ready.

Stricter standby selection, verified rule approval, allocation execution and native
voting remain separate work. No live signing or deposit is claimed for this candidate.

The current development priority is the Juno **Delegation Programme** planner,
placed under Community Tools → Interchain in the current navigation candidate. Its first implementation adds capped equal
allocation, explicit v31 evidence review, manual exclusions, current-versus-target
comparison and downloadable rule drafts using the shared UI. The collector and
snapshot path are live from release `885beb9a`. The owner-approved three-stage
UI revision is live from `5d14ce24`: rules, searchable distribution review and a
proposal preview, with detailed evidence and exact values available on demand.
On-chain approval verification and execution proposals remain the next stage.
See [JUNO_DELEGATION_PROGRAMME](docs/JUNO_DELEGATION_PROGRAMME.md) for the current
V1 decisions, inactive V2 scope, arithmetic and rollout requirements.

The owner requested project sections in Community Tools: Juno owns the existing
Faucet and Validator Upgrade Status; NETA adds **Buy NETA on WYND**. The
released site contains the menu and a port of the old Rescue NETA functionality
in the shared graphite/mint style. The criteria and reserve revisions are live; native planner proposal submission is published; the shared-review and deposit flow is the new candidate.
See [COMMUNITY_TOOLS](docs/COMMUNITY_TOOLS.md) for provenance and remaining checks.

Juno Delegation Programme holdings refresh, but daily staking accrual is stalled:
the historical REST query at height 42442228 reports pruned state. The existing RPC
reproduced the retained checkpoint and three missing daily boundaries. A reviewed
historical adapter, bounded resumable catch-up and accounting health check are
prepared; they are not installed on the collector and no live backfill is claimed.
See [STAKING_REWARDS_CATCHUP](docs/STAKING_REWARDS_CATCHUP.md). Preserve verified
intervals; do not replace missing daily evidence with current unclaimed rewards.

The backend is active on OVH. Final source quiescence, verified database transfer,
original identities, admission settings and target activation are confirmed in the
private operator record. The owner has retired Render; it is no longer a rollback
reserve. Any future host recovery must preserve the latest OVH state.

The website release from `885beb9ac6adbb175997dd8bf8ae4e00d23e66ef` passed all 18
release jobs and was published on both domains. The original planner and its
same-origin data source passed live acceptance on 9 October. The stable API endpoint and CORS for
both website origins were accepted. Public mainnet messaging remains disabled.

Independent recurring backups and controlled live data fallback remain open. The
operator confirmed all three collector schedules active and enabled. The reviewed
receipt/freshness checks are installed, sequential manual collector runs passed,
and the health service passed before its timer was enabled. Two actual scheduled
cycles still require acceptance. Follow
[COLLECTOR_ACCEPTANCE](docs/COLLECTOR_ACCEPTANCE.md). The original identities are
already independently backed up; do not repeat those transfers or rotate keys.

## Source and release status

- GitHub is primary for source/CI. Cloudflare serves `cosmoot.com` and
  `dao.netareborn.com`; OVH provides public snapshots and the active backend.
  GitLab is a dormant reserve. Render has been retired by the owner. A current
  encrypted database copy is held independently; recurring retention is still open.
- PR #257 imported the newer GitLab source without replacing GitHub history.
  PR #259 fixed the real-workerd proxy incompatibility. Exact source `153f7a8c`
  was published successfully; see [release evidence](docs/deployments/GITHUB_PRIMARY_2026-10-08.md).
- The old scheduled data/bot writers are removed. Dependabot version-update PRs
  are paused; security alerts/updates and the weekly security audit remain.
  Use one branch/PR for related changes and deliberate releases only.
- Main requires `Required repository checks`. Code/manifest changes retain the
  full CI gates; Markdown-only changes still report the required result.
  A documentation merge does not authorize an application deployment.

## Development boundaries

1. Follow [BACKEND_MIGRATION](BACKEND_MIGRATION.md). Preserve both databases,
   the existing Faucet identity, payout journals, quotas and admission settings.
   A fresh final export must follow quiescence of all source writes. Never start
   a second production writer or silently initialize empty production state.
2. Runtime configuration, synthetic application restore and independent identity
   backups are confirmed. Complete recurring independent database retention.
   A process health check is not proof of application recovery.
3. Continue personal-message durability, DAO multi-recipient messaging and payment
   requests after infrastructure acceptance. Both personal devices are registered;
   user-confirmed send/read/reload passed. Fresh-browser restore/rotation remains
   explicitly deferred and must not be repeatedly requested.
4. NNS prices: 3 characters $99/year, 4 $19, 5+ $5. The owner controls initial
   upgrades/tariffs/pause/key rotation; fees go to the main DAO. Receiving/reading
   messages does not require `.neta`; sending does.
5. Preserve pending transaction/crypto journals and wallet/chain binding. Do not
   silently rotate keys, resubmit uncertain transactions, change live payout limits
   or enable public messaging. No new paid service or plan upgrade is authorized.
6. Juno v31 observation is closed. A tested future-upgrade lifecycle core now implements proposal identity, plan reconciliation, fixed halt windows and immutable closure. Network collection, persistent scheduling and automatic publication remain open in
   [JUNO_UPGRADE_AUTOMATION](docs/JUNO_UPGRADE_AUTOMATION.md); missing signatures
   are not proof of a failed software upgrade.

Historical development evidence is in [the archive](docs/archive/repo-review-2026-10-07/HANDOFF.md).
It does not override the current handoff or the private operator record.
