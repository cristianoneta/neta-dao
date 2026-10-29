# Delegation Programme: fixed additional allocations

Owner-approved implementation, 29 October 2026. The source adds policy schema 7;
publication requires the deliberate manual website release. The last verified
website release remains the one recorded in [CURRENT_STATE](CURRENT_STATE.md).
No fixed recipient is preconfigured. The validator mentioned during discussion
was an example, not an approved beneficiary or amount.

## Allocation semantics

The allocation budget remains delegated plus spendable JUNO, excluding unclaimed
rewards and unbonding funds, with at least 50 JUNO held liquid. An active fixed
allocation reserves its exact amount from that budget first. The remaining budget
uses the existing equal-capped algorithm. Each target is its fixed portion plus
its regular portion; current holdings are subtracted to calculate the movement.
A fixed allocation is a target component, not another payment on each rebalance.

For example, with a 10 million JUNO budget and one 500,000 JUNO fixed allocation,
9.5 million remains for regular allocation. If ten validators are eligible and
unconstrained, each receives 950,000 regularly; the fixed recipient's total target
is 1.45 million. If that recipient fails regular eligibility, its fixed target
remains 500,000 and its regular portion is zero.

Only the fixed portion bypasses **all programme eligibility and voting-power
limits**, including manual exclusion, current jail, commission, active-set history,
upgrade participation and observed uptime. Reasons for regular exclusion remain
visible. Fixed stake counts in actual projected stake and consumes that validator's
regular cap capacity. The projected consensus denominator continues to exclude
jailed validators. A fixed portion above the cap remains intact; its recipient
cannot also receive an above-cap regular portion.

Reservations exceeding the budget block calculation with the exact shortfall.
They are never scaled or silently reassigned. An active recipient absent from the
snapshot also blocks calculation. An incomplete shared observation dataset still
prevents a trustworthy full allocation calculation; this is distinct from a
known validator failing an eligibility criterion. Missing evidence is not invented.

## Authoring and review

Distribution presents the budget and fixed allocations before the exploratory
base/bonus controls. Add an allocation, choose a known validator, enter JUNO to six
decimals, essential obligations/acceptance criteria/reviewer, inclusive UTC start
and end dates, and an optional HTTPS documentation link. The operator address is
the identity. One entry per validator aggregates its obligations; the model rejects
duplicates, invalid dates, nonpositive amounts and credential-bearing links.

The essential obligations are embedded and hashed in the immutable review. A
linked document can change later, so its link does not replace those obligations
or constitute verification that they have been fulfilled. Performance assessment,
renewal and revocation remain governance decisions; there is no automatic external
service measurement or clawback.

The editor supports Edit, Cancel, Remove and Undo. Apply updates the draft; Save
rules persists it on the current device. An unfinished edit cannot be silently
ignored when saving or freezing a review. Eligibility and fixed changes share one
policy draft. There is no preset beneficiary and no wallet action in this editor.

Impact shows total, fixed reservations, regular budget and unallocated funds,
a fixed-recipient filter, current/target/change, regular + fixed amounts, and the
regular exclusion/cap exception. Review and proposal views preserve the mandate,
its dates, supporting link and exact policy revision. Rebalance uses the approved
revision independently of local edits; execution reviews also expose the frozen
allocation breakdown and obligations.

## Dates, governance and execution

Active periods are evaluated at the **snapshot's UTC date**, inclusive at both
ends. Scheduled and ended mandates remain visible in the rulebook but reserve no
budget in that calculation. Ending a mandate changes a subsequent target; it does
not initiate undelegation or move existing holdings. Rebalances never amend the
approved policy to the newest schema. Historical schemas 2–6 and frozen reviews
retain their original semantics and identifiers; only editable drafts migrate.

Adding, changing, removing or renewing a mandate is a rule change requiring a new
rule approval. Its subsequent fund movements require a separate approved execution
proposal. Current-state preparation checks and fresh source checks reject a changed
active period and require a new calculation. The original programme contract does
not enforce these dates: a period ending during a native vote does **not** cancel
its frozen messages at eventual execution. Choose periods appropriate for the
voting timeline and review delayed proposals explicitly. This feature does not
install a contract, change custody, or reserve funds on-chain when drafting rules.

The exception does not bypass technical constraints: current funds, the liquid
reserve, validator existence and valid staking share exchange rates, redelegation
locks, entry limits, exact approved rules, programme authority and pending treasury
actions remain checked. The SDK permits delegation to a jailed existing validator;
Cosmoot permits that only within its approved fixed target, with zero regular
portion. A newly jailed regular recipient still requires recalculation.

## Validation and publication boundary

The local repository verification passes 432 JavaScript tests, including 12 new
fixed-allocation tests. Coverage includes every individual policy exception,
exact micro-JUNO arithmetic, no recurring top-up, budget conservation over 100
varied portfolios, cap headroom, period transitions, schema-6 equivalence, immutable
review and execution round trips, compaction of an outside-set recipient, tampering,
and preservation of fund/exchange-rate/redelegation checks.

The pinned Juno v31/SDK v0.53.7 regression passed a real local native proposal
through the existing programme contract, delegating to the dominant active validator
and an existing jailed validator. Both exact principal changes and unchanged other
positions were verified. Delegation also settles accrued distribution rewards;
liquid changes therefore need not equal principal alone. Original reward-claim,
staking, atomic rollback, native vote/proposal gas and Community Pool checks remain.
This uses synthetic local chain state; it is not mainnet execution evidence.

Browser regression coverage adds authoring, unfinished-edit guard, overcommit,
local persistence, regular exclusion with fixed-only target, cancel/remove/undo,
exact export, frozen shared review, approved-rule isolation and execution handoff,
with narrow and desktop viewports. Required repository CI must pass before merge.
No website deployment or wallet transaction is part of this implementation.
