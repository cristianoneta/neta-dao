# Juno Delegation Programme

9 October 2026. The original planner and dedicated snapshot are live from release
`885beb9ac6adbb175997dd8bf8ae4e00d23e66ef`. The staged UI described below is a
release candidate. Rules, simulation and proposal drafts are available; on-chain
approval verification and execution remain unconnected.

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
percentages are rounded for display only. The allocation engine is unchanged.

The current-position summary separates active and inactive recipients; the table
compares both current and projected stake shares. A collapsed historical note
explains the 2025-1 points system without importing it into the new allocation.
The final stage reviews the exact rules and illustrative impact before downloads;
future execution prerequisites are secondary details. Local draft storage never
confers approval. Updating inputs invalidates the old
simulation and downloads. Missing data disables calculation; old data is labelled
historical. Names and exclusion reasons are rendered as text.

## V1 rules and arithmetic

- Equal distribution among eligible active, non-jailed Juno mainnet validators.
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
Budget cannot exceed current delegations plus spendable bank JUNO; rewards and
unbonding balances are not counted. No funds are moved by this calculation.

The resulting **stake share is a voting-power estimate** for the fixed snapshot
set. Consensus power rounding, set transitions, execution fees and available
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

1. **Rule approval:** export an explicitly unsubmitted Markdown proposal and a
   JSON review package. The package contains the exact canonical rule, complete
   source snapshot, upgrade archives, simulation rows and independent SHA-256
   identifiers. Simulation amounts illustrate impact; they do not authorize
   execution. A hash identifies content; it does not prove chain truth or approval.
2. **Allocation update:** a future adapter must verify an approved immutable rule
   version on-chain, re-simulate under that rule and prepare an exact execution
   proposal. It must verify programme authority, available assets, redelegation
   constraints, message limits and the voted transaction set. Rule changes require
   step 1 again. No local toggle may manufacture approval.

Execution preparation is visibly unavailable in this build. There are no wallet
messages, contract writes, submissions, background reallocations or deployed new
contracts. Governance integration is the next implementation stage.

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
