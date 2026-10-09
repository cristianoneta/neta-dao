# Juno Delegation Programme

9 October 2026. Native Juno governance and Community Tools balances are published
from `e5ffabab3324a2c4d7a8e5705d5ae24d5b216351` (manual run 37946802277,
all 18 jobs successful). A live claim-entry defect was subsequently reproduced;
the correction below is a candidate pending CI and manual release. Rule approval
verification and allocation execution remain unconnected.

## Claim entry and current rewards correction

The claim adapter previously accepted only short validator addresses. This
rejected the programme's long DAO validator positions before the draft could
open. It now shares the planner's bounded 20-/32-byte address shape check, with
real long-address regression cases. Claims still include held jailed and standby
positions; allocation eligibility never removes their rewards actions.

The actual button has local, focusable feedback for preparation and failures.
Draft storage is read back before navigation and existing drafts remain intact.
The existing same-origin holdings snapshot supplies claimable JUNO and optional
indicative USD directly above the button. Both its observation and collection
must be within one hour. Identity, height pinning, withdrawal target, validator
count and reward-asset reconciliation are checked. The collector already reads
the full distribution response and truncates each validator's micro-unit payout
separately. This is not historical daily accrual or spendable balance.

Missing/partial/stale data is unavailable, not zero. A missing price suppresses
USD only. Refresh reloads rewards with planner data; open tabs expire observations
without resetting edited allocations. The draft repeats the snapshot estimate
and warns that the eventual execution amount can differ. Rewards do not enter
the allocation budget until confirmed execution and a refreshed balance.

Validation: 248 root Node tests, five signing tests and existing Treasury rounding
tests pass locally. Browser regressions cover real long-address handoff, keyboard
activation, storage failure, missing/stale rewards and missing price. CI and
post-release acceptance remain required; no live signing is claimed.

## Placement and interface

`/community-tools/juno/delegation/` is the third Juno tool on the Community Tools
hub. It reuses `neta-ui.css`, `community-tools.css`, `community-tools-header.css`
and the existing assembly-plaza header asset. There is no new theme, wallet
connection, framework or sidebar. English matches the existing application.

The owner approved a three-stage layout on 9 October: **Set rules → Review
distribution → Review proposal**, with each stage directly accessible. Keep the
shared graphite/mint tokens, typography and assembly-plaza identity. The first
stage groups criteria, amount and optional manual exclusions, with a keyboard
slider and an exact numeric factor input. Commission accepts whole percentages
from 0 to 100 (default 10), with a separate no-limit checkbox. Invalid, empty or
fractional values block simulation and saving; exports retain basis-point units. Local storage saves rules only, not the
amount or simulation. The V2 roadmap is collapsed and explicitly inactive.

The simulation leads with allocated funds, actual recipients and unallocated
funds. Eligible validators with no capacity are distinguished from recipients.
Evidence-review cases have an explicit notice and a filter. The comparison has
name/address search, status filters, deterministic sorting and ten rows per page;
there is no nested vertical scroll. Each row expands to explain its target,
provide exact amounts, validator identity and participation evidence. The compact
table shows two decimal places; nonzero values that would round to zero use
`<0.01`. Full six-decimal values remain in details and downloads. Stake-share
percentages are rounded for display only. The revised engine separates consensus membership from eligibility and projects membership after allocation.

The current-position summary separates consensus-set and outside-set positions; the table
compares both current and projected stake shares. A collapsed historical note
explains the 2025-1 points system without importing it into the new allocation.
The final stage reviews exact rules and illustrative impact before opening the prepared proposal;
future execution prerequisites are secondary details. Local draft storage never
confers approval. Updating inputs invalidates the old
simulation and downloads. Missing data disables calculation; old data is labelled
historical. Names and exclusion reasons are rendered as text.

## V1 rules and arithmetic

- Equal distribution among non-jailed Juno validators with the required participation evidence. Current consensus-set membership is not an eligibility gate. The snapshot cannot independently establish current uptime for standby nodes; absence from the set is not proof of downtime.
- No additional per-validator minimum or maximum amount.
- Voting power limit: `min(30%, factor × 100% / N)`, with factor 1.0–2.0 and
  proposed default 1.5. `N` is the actual full active consensus set at the snapshot,
  including programme exclusions. At N=25 and factor 1.5, the limit is 6%.
- Proposed commission limit 10%, editable or removable in a rule draft.
- Manual exclusions use `(chainId, valoper)` plus a reason. No exchange or other
  operator is pre-excluded without a decision. Every exclusion-list change,
  including restoring a validator or changing a reason, changes the rule hash.
- Juno v31 participation must be evidenced by the five-hour deadline after the
  archived halt. The existing earliest consensus vote / block signature evidence
  is reused. Missing or later observations are **not proof of installation time**;
  such validators receive no target and remain explicit evidence-review cases.
  New validators without archived evidence also require review. The observation
  window must be completely covered before simulation is available.

All amounts use integer micro-JUNO. The engine removes current programme positions
before adding new targets. It distributes equally, caps each recipient and
redistributes excess. It recomputes capacity until unallocated funds are also
removed from the projected bonded denominator. Remainders are deterministic by
validator address. A lower programme budget separately records released funds.
Budget cannot exceed current delegations plus spendable bank JUNO minus a 50-JUNO reserve; unclaimed rewards and unbonding balances are not counted. The default is `floor((delegated + spendable - 50) / 100) * 100` JUNO, clamped to zero, displayed without decimals. For 1,249 JUNO it suggests 1,100 JUNO. Exact manual inputs remain possible within that reserve. If spendable funds are below 50, reducing the target does not produce immediate liquidity; completion of any needed unstaking must be checked. No funds are moved by this calculation.

The resulting **stake share is a voting-power estimate** for the projected top-N non-jailed
set. The engine excludes targets that remain outside the set from bonded totals; deterministic ties prefer existing members then operator address. Capacity bounds only tighten during iteration, so set transitions never inflate permitted stake. Consensus power rounding, actual set transitions, execution fees and available
redelegation capacity still require a fresh transaction-level check. A validator
whose non-programme stake is already over the limit receives no programme target;
the programme cannot reduce stake controlled by other delegators.

## Data collection and rollout boundary

`scripts/update_delegation_planner.py` reads a single pinned block (latest minus
20) from a configured Juno provider. It verifies programme core/code/name and
voting/proposal-module identities against the existing directory, maps consensus
public keys to operator records, and collects all validator tokens, commission,
delegations, spendable balance and redelegation records. Pagination, response size
and overall duration are bounded. It replaces the JSON atomically only after a
complete successful collection. Failed collection retains the old timestamp.

Published output: `data/daos/juno-delegation-planner.json`. It is included in the public
snapshot allowlist and the existing hourly `main` collector job (165-second
process bound). Source health checks both block and collection timestamps. The
frontend uses the existing same-origin snapshot proxy, without direct browser RPC
fan-out. No production snapshot or synthetic live fallback is committed here.

The original collector installation and website rollout were accepted on 9 October.
For future collector revisions, generate and inspect the snapshot with the existing
service identity, then run publication under the common lock. The publisher requires every allowlisted file:
a missing initial planner snapshot must not replace a good public generation.
Verify the new path, identities, receipt and freshness on the data origin and
both website origins. Then use the established deliberate website release flow.
This UI revision needs only the established manual website release. It changes no
collector, timer or signing authority. The collector remains read-only.

## Two separate community decisions

1. **Rule approval:** open the prepared proposal in the existing proposal workspace and retain a
   JSON review package. The package contains the exact canonical rule, complete
   source snapshot, upgrade archives, simulation rows and independent SHA-256
   identifiers. Simulation amounts illustrate impact; they do not authorize
   execution. A hash identifies content; it does not prove chain truth or approval.
2. **Allocation update:** a future adapter must verify an approved immutable rule
   version on-chain, re-simulate under that rule and prepare an exact execution
   proposal. It must verify programme authority, available assets, redelegation
   constraints, message limits and the voted transaction set. Rule changes require
   step 1 again. No local toggle may manufacture approval.

Allocation execution is visibly unavailable. The planner does not perform background
reallocations or deploy contracts. Native proposal submission is a separate explicit
review/signing step described below.

## Revised controls and proposal handoff

The four criteria (validator status, voting power, commission, upgrade participation)
use identical numbered headings, spacing and separators. Optional manual exclusions
remain separate. Policy schema 2 fingerprints the eligibility change and 50-JUNO
reserve; old v1 local drafts are preserved and never silently approved or reinterpreted.

The mint **Create claim rewards proposal** button belongs in Programme amount.
It prepares one CosmWasm `distribution.withdraw_delegator_reward` draft action for
each positive recorded programme delegation, including jailed/standby positions.
No destination change, stake move or known reward amount is assumed. The draft
requires verification of the current withdrawal destination, programme authority,
supported messages, fresh delegations and transaction limits before submission.
Snapshots older than one hour, unavailable data and empty positions disable preparation.
The [CosmWasm message definition](https://docs.rs/cosmwasm-std/latest/cosmwasm_std/enum.DistributionMsg.html)
binds withdrawals to the executing contract; these are not wallet-level claims.
After confirmed execution, refresh the planner to include the resulting spendable balance.

**Publish proposal** replaces the Markdown-download primary action. It opens the
existing Proposals page scoped to Juno → Delegation Programme with title, summary,
complete policy and content hashes prefilled. Rule drafts carry no execution actions.
The review JSON remains downloadable. Opening either button creates a distinct
browser-local draft, keeps existing drafts intact and never signs or publishes.
Revisions persist under that draft's unique key; New draft returns to the ordinary
saved draft. The live `ba65ba30` version still labels the target as a read-only DAO.
The candidate corrects that boundary as described next.

## Native governance correction — release candidate

Delegation Programme remains the subject/scope. Submission and the community
vote belong to **Juno native governance**, not the legacy programme proposal
module or the UNI-7 public review contract. The composer loads Juno proposal
history, fills title/summary/full body/actions before history requests finish,
and displays an explicit handoff error rather than an unexplained empty form.
Schema-1 claim drafts and their saved revisions are upgraded in memory; the
original records and unrelated local drafts are preserved.

The claim contains one `/cosmwasm.wasm.v1.MsgExecuteContract`: sender is Juno's
governance module `juno10d07y265gmmuvt4z0w9aw880jnsr700jvss730`, contract is the
programme, funds are empty, and `execute_admin_msgs.msgs` contains only the
recorded reward withdrawals. The connected user is the outer
`/cosmos.gov.v1.MsgSubmitProposal` proposer and pays its initial deposit/fee.
Rule approval is a text-only native proposal with no execution messages.

Authority evidence: public onboarding run
[37473502144](https://github.com/cristianoneta/neta-dao/actions/runs/37473502144)
queried the programme's `admin` as the governance module and code ID 4047 on
6 October. DAO DAO's [core implementation](https://github.com/DA0-DA0/dao-contracts/blob/v2.5.0/contracts/dao-dao-core/src/contract.rs)
authorizes `execute_admin_msgs` through that internal admin; Cosmos SDK's
[proposal keeper](https://github.com/cosmos/cosmos-sdk/blob/v0.53.7/x/gov/keeper/proposal.go)
requires the governance module as the sole signer of executable proposal messages.
Historical evidence is not treated as a current authorization check.

The candidate requires complete preflights from at least two independent Juno API
origins, requesting a fresh pinned height within each source: correct
chain/recent block, gov module account, code/internal admin, unpaused state, programme withdrawal
address, complete delegation pagination, native deposit parameters and proposer
spendable balance. Governance parameters must agree; the lower verified balance
is used. Returned height headers are checked when exposed by the provider.
The unpaused requirement is a conservative product gate: the contract itself permits
its governance admin to execute while paused. Missing/mismatched evidence stops
submission. The minimum
initial deposit is calculated with integer rounding up. The UI shows the deposit,
voting threshold and simulated submission fee, then requires a review checkbox
and a separate submit click. Submission simulation does not simulate future
post-vote contract execution; state may change during voting.

A second preflight precedes signing. Wallet/context/text changes invalidate the
review; reviews expire after two minutes. The bridge verifies exact signed
protobuf messages and fees before broadcast and uses the existing origin-wide
pending-transaction journal. A per-draft submission receipt prevents accidental
repeat proposals; an exclusive per-draft device lock also covers different-wallet
attempts from other tabs. Unknown outcomes expose Check submission status, which
only reads the saved transaction hash and requires two agreeing inclusion receipts.
Reloads preserve the attempt, and status lookup never signs or broadcasts. Confirmed
submission is distinct from a passed proposal and future rewards execution.
Only direct-signing Keplr
accounts are supported. No live wallet signature or proposal submission is claimed.
Generic UNI-7 review, native voting, allocation execution and rule-approval
verification for allocations are unchanged.


## V2 — visible, inactive

30-day uptime; stricter / scored update responsiveness; verified testnet
participation; governance participation; public RPC contribution and reliability.
Do not add V1 weights for these criteria. Testnet operator linkage may support a
future contribution bonus without becoming a gate for all programme validators.
The proposed UNI-7 bonus is fixed for a verified active operator, initially without
an additional uptime threshold. Preserve .neta and separate mainnet/testnet proofs;
multiple linked addresses do not multiply the bonus. Governance counts the
validator's own vote regardless of option, including Abstain and weighted votes.
Twenty completed proposals remains a planning window, with eligibility limited to
proposals whose full voting period the validator was active for. Unknown history
must not be counted as a missed vote. Uptime uses expected signatures during actual
active participation rather than a current slashing-window counter.

For RPCs, start with declared / registry endpoints and verify operator attribution
and endpoint control. Proposed monitoring uses at least two independent locations
and a 30-day window: valid-response availability, correct chain and freshness,
p95 latency, outages and monitoring coverage. A chain halt or probe failure is not
automatically an endpoint failure. Aliases do not multiply rewards. Any scoring
weights, thresholds, observation period and capped bonus need a new rule approval.
No recurring RPC monitoring has been activated.
Include API function and separate archive-capability checks against prescribed
historical heights; distinguish mainnet/testnet service. Providing an endpoint is
not evidence of owning its underlying node. Missing measurement data is unassessed,
not zero points or perfect service. Every score needs a measurement, time window,
source and reproducible formula. Do not automate discretionary dApp, community or
special-agreement points from posts, commits, users or transaction counts. Relayer
contribution is a later V2 option, pending credible attribution and useful transfer
evidence rather than raw traffic rewards.

## Historical allocation context — not a new scoring policy

The official [2025-1 policy](https://github.com/CosmosContracts/delegations/blob/main/policy/delegations.md)
and [funding proposal text](https://github.com/CosmosContracts/roadmap/blob/main/proposals/99-extra-delegation-program.md)
were reread for this implementation. The programme planned 15 million JUNO,
distributed proportionally to discretionary committee-assigned points. Maximum
category points were 25 special agreements, 25 dApps, 15 mainnet infrastructure,
10 testnet infrastructure, 10 governance, 10 community and 25 open category
(120 overall). Its top-15 rank deduction has no concrete formula in that policy;
do not invent one or substitute it for the new dynamic voting-power cap.

The historical formula is `15,000,000 JUNO × validator points / total points`.
Published [application reviews](https://github.com/CosmosContracts/delegations/tree/main/applications/2025-1)
are historical inputs, not active V1 criteria. Current positions come exclusively
from the height-pinned chain snapshot; differences from historical targets do not
by themselves establish their cause. The new preference is objectively measurable
criteria with community-approved weights and thresholds, rather than automatic
reuse of historical discretionary scores. No exact new bonus or score threshold
was approved by the additional planning input.

## Verification

The focused Node suite exercises conservation, cap limits, exclusions, incomplete
evidence, budget reduction, deterministic rounding and 100 seeded allocation
scenarios. Python tests cover key mapping, commission rounding, duplicates,
unknown delegation identities, owner mismatches and overcounting. The dedicated
Playwright flow checks stage navigation, linked factor controls, search, filters,
pagination, per-validator details, exclusions, persistence, invalidation, full JSON
exports, stale/error states and literal rendering. All three stages are checked
at 1440/768/390/320 pixels. Presentation tests cover exact large integers, tiny
nonzero amounts, percentage rounding, filter membership and reason labels. Browser tests run in
the existing repository CI and upload screenshots for inspection.

## Allocation comparison update — candidate

The distribution table includes **Total JUNO after allocation**, the validator's
whole stake across all delegators: current validator stake minus the programme's
current delegation plus its simulated target. It is not the programme target alone.
The existing Sort by control offers ascending/descending total JUNO and projected
share. Sorting uses exact integer amounts, not rounded display values. Validators
outside the projected set have no projected voting share and appear last in both
share sort directions. The six-column comparison scrolls within its table on small
screens; row details preserve six-decimal precision.

## Next policy revision — owner decision, not implemented

Future allocation candidates must already belong to the active consensus set or
enter it as a result of the final simulated redistribution. A standby validator
that remains outside receives no target allocation. Replacing existing programme
positions, recomputing the full ranking/caps and deterministic convergence belong
in a new policy version and a new community rule approval. Do not reinterpret
existing drafts. Protocol eligibility and current operating evidence are separate;
non-jailed status and historical upgrade participation do not establish current
standby operation. Operating-proof requirements still need a concrete definition.
Claims continue to include every existing positive programme position regardless
of eligibility for a future allocation.
