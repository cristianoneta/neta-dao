# Current state — Cosmoot / NETA DAO

Updated 17 October 2026. This is the public feature/deployment/evidence matrix.
Private operator records are governed by [DOCUMENTATION_PRIVACY](DOCUMENTATION_PRIVACY.md).

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
has not been released. See [rule-change design and implementation](DELEGATION_RULE_CHANGE_UX.md) and
[example-data browser frames](DELEGATION_PRODUCT_DESIGN.md).

Local validation: 340 Node tests and 164 Python tests pass. Full planner/review/
funding/voting browser checks, repository/build checks and PR CI are recorded in
the associated PR; production publication remains a separate manual step.

## Delegation product design — 15 October 2026 candidate

The existing overview and three planning stages have a revised hierarchy: prominent
holdings and rewards, a clear allocation-planning entry, open active criteria with
a draft summary, secondary future-policy disclosures, a comparison-first simulation
and an accurately labelled proposal-draft handoff. Calculations and downstream
governance/transaction behavior are preserved. This change is not deployed.
See [design review, research and browser frames](DELEGATION_PRODUCT_DESIGN.md).

Local verification includes the planner unit tests, full planner/review/funding/
voting browser regression and four-stage reflow at 1440/768/390/320px. Example-data
frames are explicitly labelled. PR checks and the manual release are separate gates.

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
See [voting design and follow-up scope](JUNO_GOVERNANCE_VOTING.md).
Local validation: 315 Node tests, repository syntax/integrity and the full planner,
review, funding and native-voting browser flow pass. The new flow covers deduplication,
review-history round trips/reload, live/manual/automatic tally updates, failures and
late-response isolation, with 1440/768/390/320 px inspection. PR CI and the manual
website release remain pending for this candidate.


## Validator history — 14 October 2026 candidate

The owner requested continuous Juno validator evidence collection, starting with
active-set membership, canonical commit participation and jail events. A separate
SQLite collector and resource-limited systemd timer are prepared; hourly metadata
also preserves commission, stake, consensus/operator identity and chain parameters,
while selected block events support later governance and upgrade analysis.
Gaps block the cursor rather than manufacturing uptime. No production timer,
90-day history, independently verified eligibility or frontend integration is
claimed. See [scope and installation gates](VALIDATOR_HISTORY.md).

The latest agreed V1 rule is continuous active-set membership for 90 days;
projected standby admission is superseded. V2 adds 95% participation and no jail
episode in that window. The allocation policy implementation still needs this
explicit revision and community approval; existing drafts are preserved.

The previous website release 38582008807 completed successfully at `934c632d`
with all 18 jobs successful. The new collector requires a separate server install,
not a website release.


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

`/community-tools/neta/dex/` is a browser-only working simulation using the shared
graphite/mint theme. Swap review updates demo balances and XYK reserves; LP deposits,
withdrawals and NETA-only pool creation update the same session. Featured pools
require $1,000 on the NETA side at an explicitly illustrative $4 reference price.
The DAO view previews conversion of protocol fees into the placeholder DAO token
and burning, with a demo-only 1% per-hop impact ceiling and atomic skipped routes.

Fee split is 0.20% LP / 0.10% protocol, totaling 0.30%. Local arithmetic uses six
demo decimals, integer rounding and conservation checks; it is not contract code.
No wallet, chain writes, real prices, DAO/token deployment or fundraise is enabled.
Pool actions include an unfunded incentive planner: fixed 84-day campaigns with
reward asset, total budget and UTC dates. Drafts do not debit balances or accrue
LP rewards. Existing Astroport/WYND incentive implementations require LP deposits;
no such contract or participation model has been adopted by this preview.
Reload resets the session. HTML noindex metadata and route-scoped X-Robots-Tag
headers accompany omission from all public navigation. This does not make the URL
private. Production contracts, custody transfer, oracle/price protections, executor
funding and audit remain future work. Publication is through the existing manual
release, after candidate checks; no new production release is claimed here.
Local acceptance: 308 Node tests and the focused browser flow pass, including
four viewport widths, dialogs, validation, unfunded incentive plans, reset and
absence of wallet/network access. Source/static checks and screenshot review pass.

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

## Current architecture

Owner-approved on 8 October: GitHub primary for source/CI; Cloudflare for
`cosmoot.com` and `dao.netareborn.com`; OVH for bounded collectors and active
Faucet/encrypted-backup hosting; GitLab dormant reserve. The owner has retired
Render. See [HANDOFF](../HANDOFF.md) for immediate work.

The return source imports GitLab `b00683c4` onto GitHub main `f5b21a50`, preserving
GitHub history and all newer public snapshots. Dependabot version PRs are paused,
legacy data/bot writers removed, source CI remains complete and a manual protected
Cloudflare release is prepared. PR #257 was merged as `0916bec5` after all 16 CI
jobs passed. GitHub confirms main is protected with `Required repository checks`
and `has_pages=false`. The owner configured the two Cloudflare secrets and release
run `37767439816` successfully published deployment `55e7a408` at 11:13:07 UTC.
Owner/VPS custom-domain acceptance found a persistent static fallback caused by
an unsupported Worker fetch option. PR #259 corrected it and passed all 16 checks;
release `37774069535` published exact main `153f7a8c` as deployment `b9efb912` at
12:14:25 UTC. A later operator check reported the signed-price server marker
on both website origins. All 26 public files subsequently matched across the three origins; controlled fallback acceptance remains open in the
[release evidence](deployments/GITHUB_PRIMARY_2026-10-08.md).
The original 32 Dependabot proposals are recorded in the maintenance inventory,
without applying their package upgrades or dismissing security alerts. All 32
were closed, and no open PR remained at the completion check.

## Deployment evidence

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
real two-wallet acceptance is still open. See [mainnet review rollout](JUNO_REVIEW_MAINNET.md).

Earlier release notes below are historical and superseded by this update.


- PR #278 merged after all 16 checks, but manual release 38068377663 failed the
  personal-browser generation-2 fingerprint check; it did not publish. A new
  candidate drains queued IndexedDB writes and releases CoreCrypto's temporary
  native constructor handle before checkpoints and teardown. Browser regressions
  distinguish the old and corrected handle lifetime, and cover delayed/aborted
  writes. Local backup/restore/rotation integration and 273 Node tests pass;
  full CI and manual publication remain pending. [Details](PERSONAL_STORAGE_LIFETIME.md).


- PR #277 is published from `d9954bccf217af11ea57857228a6212123433b6d` in
  successful manual release 38065296076. Post-release submission checking exposed
  a Juno reverse-pagination error on the second history page. A forward traversal
  correction is merged, with publication blocked by the mailbox check above. Live read-only queries through the
  published proxy returned identical complete histories (147 IDs at height 42562163)
  from Polkachu and Stavr. Real wallet/testnet execution acceptance remains open.
  These facts supersede the candidate status in the earlier entry below.

- PR #276 is published from `e30336128fc1c6f2e3afa549d4a79694a6e00242` in
  manual release 38037267610 (18 successful jobs). A new candidate addresses
  pinned-read browser preflights, bottom-of-review minimum/full deposit actions
  and author withdrawal from READY before native submission. Its 268 local tests,
  synthetic browser flow and workerd checks pass; it is not a new production
  release. Genuine wallet and governance-execution acceptance remain open.
  See [review behaviour](JUNO_COMMUNITY_FUNDING.md).

- The Juno Delegation Programme planner and dedicated same-origin snapshot were
  accepted live from release `885beb9ac6adbb175997dd8bf8ae4e00d23e66ef` on 9 October.
  The staged UI was subsequently published from `5d14ce24`; criteria, reserve and
  local draft handoff shipped as `ba65ba30` (manual run 37936517683, all 18 jobs
  successful, 9 October 13:36 UTC). Native governance and Community Tools balances
  shipped as `e5ffabab` in manual run 37946802277, all 18 jobs successful. A live
  claim click then exposed rejection of long DAO validator addresses. Release `ef7873b1` corrected that check and added local feedback and timestamped
  rewards (manual run 37963591472, all 18 jobs successful). Both domains passed
  claim handoff acceptance without submitting a transaction. The next candidate
  adds shared review, third-party submission and native deposit contributions;
  see [review and deposits](JUNO_COMMUNITY_FUNDING.md). See
  [planner status](JUNO_DELEGATION_PROGRAMME.md).

- Daily staking accrual remains unavailable in the live accounting feed, while
  holdings continue to refresh. Historical RPC responses reproduced the retained
  checkpoint and three missing UTC boundaries. A strict height-pinned adapter,
  resumable catch-up and explicit accounting health check are prepared and tested;
  collector installation and live acceptance remain open. No production rewards
  were backfilled by this code review. See [catch-up evidence and limits](STAKING_REWARDS_CATCHUP.md).

- Current release `885beb9ac6adbb175997dd8bf8ae4e00d23e66ef` passed all 18 release jobs
  and was published to both domains; API/CSP and both origins were accepted.
  The earlier confirmed upload was GitHub main `153f7a8c`, release run
  37774069535, deployment `b9efb912`. The publish step passed at 12:14:25 UTC.
  The earlier `55e7a408` deployment returned 200 with `static-fallback` to owner/VPS
  checks, while OVH returned 200 in 0.186 seconds. The previous owner-confirmed
  custom-domain release was GitLab `ec077488`, deployment `d89506f6`, with SSL.
- GitLab pipeline 2925921267 passed bootstrap, backend and Pages packaging for
  `c21183bf` at 09:59:30 UTC. No Pages proxy publication occurred in that run.
- Node-mocked proxy tests missed a real workerd incompatibility: fetch rejects
  `redirect: 'error'` before contacting the origin. The corrected proxy uses
  `manual`, with its existing non-200 rejection preserving redirect safety.
  A regression check now exercises the compiled artifact in real workerd through
  pinned Wrangler's Miniflare, with synthetic origin/assets. Local runtime tests
  and release checks passed. The corrected artifact is published; verify its live
  behavior on both domains; the owner confirmed all-path byte equality. Controlled fallback remains open. Assistant HTTP 403 probes did not prove a public outage.
- The public snapshot edge is installed. The owner verified all 26 public file
  hashes and four private/unlisted 404 paths. A later manual main collector run
  published a signed NNS price successfully. This does not establish freshness
  of every collector or all historical accounting. Public observations now advance;
  inspect installed timers and receipts before changing them.
- Both production databases were exported while Render remained live. The
  preliminary encrypted copy passed transfer, decryption and database/receipt
  verification. This is not a production restore or an application message test.
- The original NNS price key was installed and checked privately. Its separate
  encrypted backup is not covered by the database archive.
- Faucet/NNS identity backups were verified privately. Synthetic authenticated
  restart/export/restore passed on the target host and inside its hardened image;
  Compose/Caddy validation and image build passed too. Final quiesced export,
  target configuration, DNS/TLS and backend cutover are complete. OVH is the active
  writer; the owner subsequently retired Render. Exact evidence is in the private operator handoff.
  Do not rotate authority, extend expired prices or run a second payout writer.

| Feature | Code | Deployment / activation | Evidence and remaining boundary |
| --- | --- | --- | --- |
| Juno Delegation Programme planner | Shared Community Tools UI; capped equal simulation, exclusions, snapshots, rewards and rule drafts | Native submission and Overview published through PR #285; compact UI and approved-settings display are the current candidate | Read-only policy discovery is implemented in the candidate; allocation execution approval/authority integration remains open. [Scope and rollout](JUNO_DELEGATION_PROGRAMME.md) |
| Community Tools | Candidate: Interchain / Juno / NETA, with a Delegation Programme chain picker (initially Juno) and a Neta Naming Service entry under Interchain | Existing four-tool menu published; five-entry Interchain navigation awaits manual release | Existing Juno routes retained; native/CW20 swap, contract allowlist, $25 cap and pending journal retained. Signing and browser checks passed; desktop/mobile screenshots inspected. The published hub was checked during the original planner release. [Details](COMMUNITY_TOOLS.md) |
| Names | Registry v0.3.1 and profiles v0.1.0 | Mainnet code 5168/5169; purchases active | First registration and fee receipt recorded; mainnet renewal/transfer and live validator E2E remain open. [Receipts](NNS_MAINNET_DEPLOYMENT_2026-10-05.md) |
| Personal messaging | Maintained client, builder, backup and browser suites integrated in cleanup candidate | Code 5170 deployed; separate two-wallet pilot live; public release/deployment pins null | User confirmed send/read/reload; device/consent queried through one provider. Fresh-profile restore/rotation explicitly deferred; reply and hosted durability open. [Pilot evidence](deployments/PERSONAL_PILOT_2026-10-07.md) |
| Backup service | ADR-36, scoped encrypted envelopes, atomic revisions, local snapshot export; isolated admission lanes | Active OVH backend, separate database, unchanged pilot allowlist | OVH activation and API/origin behavior confirmed. Synthetic authenticated process restart/export/restore passed locally, on the target host and in its hardened image; recurring off-host retention remains open. [Service receipt](deployments/RELAY_SHARED_RENDER_2026-10-07.md), [recovery runbook](BACKUP_RECOVERY.md) |
| DAO inbox | Gated components and protocol groundwork | Not mounted; DAO writes disabled in code 5170 | Multi-recipient recovery/history/prekeys are next product work. [Design](DAO_MAILBOX_DESIGN_2026-10-06.md) |
| Proposals | Local drafts, UNI-7 workshops, mainnet history, Operations voting adapter | Existing static workspace | Operations legacy finalization does not create a mainnet proposal. Native Juno voting and general review-to-mainnet adapter disabled. A separate planner-only native submission candidate is prepared; live wallet acceptance remains open. [APIs](../REVIEW_ARCHITECTURE.md) |
| Treasury | DAO/SubDAO/consolidated assets, receipt categories, provisional P&L, Community Tax and daily staking accrual | Cloudflare static release; OVH data edge; collectors and health installed, scheduled-cycle acceptance open | Accounting floor 1 October; explicit partial coverage; missing data is not zero. Claims do not double-count accrued rewards. [Accounting](TREASURY_ACCOUNTING_2026-10-06.md), [cutoff](TREASURY_CUTOFF_2026-10-06.md) |
| RELAY notifications | Browser-local governance/NNS notices, favorites, unread/history | Public workspace | No push/email or cross-device notification sync. NNS notices are Messages, not a separate Names filter. |
| Faucet | 25 JUNOX per wallet per 24h, signature proof, exact-hash payout journal | Active OVH backend, deliberate deploy | Reward/donation evidence recorded; real payout/restart/stake/unstake evidence incomplete. Cheap HTTP traffic no longer consumes persistent claim-work quota in candidate. |
| Juno v31 tracker | Closed-event static archive and boundary tests | Live, monitoring stopped | 22/25, 94.44% saved participation in the five-hour window; first votes/signatures distinct. Three missing-evidence notes, not proof of failed upgrades. [Tracker](JUNO_UPGRADE_AUTOMATION.md) |
| Future upgrade watcher | Tested proposal/lifecycle core | Not scheduled or published | Two-source governance agreement, strict upgrade messages, immutable halt/deadline, all-baseline-signature closure and locked atomic checkpoints implemented. Network capture, runner integration and automatic pages remain open. [Specification](JUNO_UPGRADE_AUTOMATION.md) |
| People / Delivery / payments | Membership reads; contributor/delivery plans | Members live; payment execution absent | Roles, invoices, milestone acceptance and Treasury payment linkage remain future work. |

## Deployment identity and custody

- Personal mailbox: `juno1dvmms7su8zfqu4gxxmrkqhzpxr5v3sh8hzfxe8ypsgfegc22lggq5jfjx6`,
  Juno `juno-1`, code 5170. [Verified deployment](deployments/PERSONAL_MAINNET_2026-10-07.md).
- Initial upgrade/admin wallet: `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`.
  Do not transfer custody, make contracts immutable or redeploy to resolve a UI issue.
- OVH is the active backend host; Render has been retired. Resource inventory is private.
  No additional service is authorized by this documentation change.
- Deployment manifests pin exact contract, source, crypto and frontend bytes.
  Static publication does not prove hosted database recovery or on-chain transactions.

## Data ownership and rules

The intended OVH cadence is Operations Treasury every 15 minutes, main DAO and
membership every 30 minutes. Public observations advance. Operator inventory confirms
all three schedules active and enabled. The reviewed runner and receipt/freshness
checks are installed; sequential manual collector runs and the health check passed,
then the health timer was enabled. Two actual scheduled cycles remain to be verified. GitHub's
scheduled snapshot writers have been removed. The browser reads published
snapshots, not the chain; seeded snapshots are not fresh collection evidence.
Community/staking accounting uses its existing bounded collectors. After timer
activation, inspect data timestamps/status instead of promising live freshness.
Preserve prior verified snapshots on source failures and all generated bot updates.
Partial index coverage, unpriced assets and missing historical values stay explicit.

Treasury starts at 1 October 2026 by owner decision; do not backfill earlier periods.
Community Tax is reconstructed from source evidence; delegation rewards accrue from
the recorded baseline on 6 October. Claims transfer assets and do not create revenue
again. Proposal category metadata is not an executed expense.

## Release boundaries

Keep atomic journals, uncertain-broadcast locks, wallet/chain binding, consent,
backup-before-send and read-only restore. Display RPC fallback does not replace
independent verification for signing. NNS requires no new hosting: the approved
signed snapshot has a 24-hour validity without a new TWAP/liquidity gate.
No stale 5-NETA messaging requirement applies: only sending requires `.neta`.

[Next steps](../HANDOFF.md) · [source map](SOURCE_MAP.md) · [historical inventory](archive/repo-review-2026-10-07/CURRENT_STATE.md)

## Completed cutover and remaining operating gates

Faucet and the separate two-wallet pilot target `https://api.cosmoot.com` in the
published frontend and CSP. Both website origins passed CORS/auth-boundary checks.
OVH is the active writer; Render has been retired by the owner. Public messaging
release pins, wallet allowlists and contract authorities are unchanged.

Collector/health installation and manual acceptance are confirmed in the private
operator record. Two scheduled cycles, controlled live data fallback and independent
recurring backups remain open. A current independently held encrypted database copy
is verified; the configured provider backup does not establish application restore
or independent retention. External health notifications are not configured. See
[COLLECTOR_ACCEPTANCE](COLLECTOR_ACCEPTANCE.md).
