# Rule changes, impact comparison and allocation approval

17 October 2026 · researched design proposal · not implemented or released.

This extends the [delegation product design](DELEGATION_PRODUCT_DESIGN.md) after
the owner's review. It specifies how the existing planner and proposal workspace
should explain first rule adoption, later rule changes and subsequent allocation.
It does not enable signing, an execution adapter or new scoring features.

## Recommendation

Treat **observed holdings**, **approved rules** and **proposed rules** as three
separate objects. Show what a vote changes and what remains pending. Every rule
proposal should carry the same readable change-and-impact review seen by its
author; voters must not have to reconstruct it from JSON or run the planner.

Two decisions remain separate:

1. Approve the exact rule revision. Its allocation simulation is illustrative.
2. Approve a concrete allocation proposal using those approved rules and fresh
   observations. Only an authorized, verified execution can move funds.

Approval of rules never implies that the existing allocations already follow them.
Use “Rules approved · Allocation unchanged” between the decisions. The future
primary action is “Prepare allocation proposal”, not “Execute” or “Apply rules”.

## Evidence and references

Sources inspected on 17 October 2026. Product statements are attributed below;
the recommendations for Cosmoot are our synthesis, not measured usability results.

| Reference | Observed pattern | Application to Cosmoot |
| --- | --- | --- |
| [RockawayX Smart Delegation, archived policy guide](https://web.archive.org/web/20240813161133/https://smartdelegation.app/docs) | Public policies expose allocation effects; the simulation explains additions, removals, ineligibility and locked funds. Only committed policies can generate transactions. | Keep before/after allocations together and make policy state explicit. Replace a local commitment with verifiable community approval. A committed policy in that tool is not proof of a governance vote. |
| Owner-provided RockawayX simulation image | Rows share a scale, with existing/assigned stake and other markers; a “Show only changes” control is visible. | Retain aligned comparison and a changes filter. Reduce the default visual to programme holdings and target; total network stake belongs in a separate detail. The original screenshot is low-resolution and does not establish current functionality. |
| [Tally's June 2025 Seatbelt integration report](https://gov.uniswap.org/t/tally-uniswap-communication-thread/25133/9) | Human-readable simulation reports, state differences and warnings appear inside proposal pages before voting. | Put the change-and-impact review in the voter view, not solely in the author's planner. |
| [Uniswap: governance Seatbelt](https://blog.uniswap.org/governance-seatbelt) and [ScopeLift technical explanation](https://scopelift.co/blog/seatbelt-for-governance) | Reports enumerate actual state changes, calls and execution failures. | A policy allocation model is not a transaction simulation. Later execution review must inspect the actual messages and constraints. Do not imply that the EVM tooling directly supports Juno. |
| [Aave governance process](https://aave.com/docs/ecosystem/governance) | Specification, binding decisions, payload review and execution have distinct states. | Preserve the distinction between approved intent and a specific authorized operation; do not copy Aave's voting thresholds or timelocks. |
| [HashiCorp: automated plan/apply](https://docs.hashicorp.com/terraform/tutorials/automation/automate-terraform) | An approval must identify the exact plan; a competing change can invalidate older plans. | Bind allocation approval to an immutable rule revision and exact reviewed plan. Superseding rules or changed transactions require renewed review. |
| [NN/g: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Primary decisions stay visible; specialized detail is disclosed on demand. | Show changed rules and a readable impact summary first; unchanged fields, exact quantities and provenance remain accessible. |
| [W3C: use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) | Meaning cannot depend on color alone. | Pair before/after marks with labels, numbers, plus/minus signs and explicit reasons. Allocation losses are not automatically “bad”. |

The live Smart Delegation guide was unavailable during this review. Its archived
2024 content was retrieved successfully. It is a historical reference, not a claim
about an operating 2026 service. No additional scoring or stake agreements are
proposed for Cosmoot merely because the reference includes them.

## The two useful allocation comparisons

Let `A` be actual programme holdings at the proposal snapshot. Let `T_old` and
`T_new` be targets under the approved and proposed rule revisions, respectively.
Compute both targets against the **same snapshot, evidence, budget and compatible
calculation semantics**. Preserve exact integer quantities.

| Comparison | Question answered | Difference |
| --- | --- | --- |
| Today → proposed | What would need to change from actual holdings? | `T_new − A` |
| Rule effect only | What changes because we change the rules? | `T_new − T_old` |
| Row detail: current-policy gap | How far are holdings already from the old target? | `T_old − A` |

Do not present the old target as the current holding. Do not compare an old
simulation from last month with a fresh new simulation and attribute the whole
difference to policy. A change to the budget or reserve is shown separately.
If reserve rules change feasible budgets, hold a declared common feasible budget
constant for rule-only comparison or state that the effect cannot be isolated.
Unknown or unsupported calculation versions make the comparison unavailable;
never silently reinterpret old rules using newer algorithm semantics.

The first comparison is the default because it answers the concrete portfolio
question. The second is one clearly labelled alternative, not another permanent
dashboard. Keep search, sorting and pagination in the existing comparison area.
“Only changes” uses exact raw quantities and explicitly states which baseline it
uses. A displayed rounded zero must not hide a real micro-unit change.

For a future three-value detail, display Actual / Target under approved rules /
Target under proposed rules together. Never make voters remember values across
separate pages. Row reasons explain indirect effects too: a validator can gain
because another validator becomes ineligible, even if its own metrics are unchanged.

## Initial adoption and current outside-set holdings

Initial adoption has no previous approved policy value. Render “Not established”
and “Initial adoption”, rather than zero, a default, or a fabricated old rule.
The Actual → proposed comparison remains fully available. A failed approval read
is “Approval unavailable”, not “No approved rules”. Discovery of no supported
Cosmoot-format policy does not prove that no historical governance policy existed.

A read-only production observation at block 42,786,733, 17 October 2026 07:36:24 UTC,
showed 37 programme positions: 18 in the current set and 19 outside it. The latter
held 6,234,818.793440 JUNO, about 41.57% of the observed 14,999,522.938980 JUNO total.
These are time-stamped observations, not simulated outputs or permanent facts.
Source: the public delegation planner snapshot on cosmoot.com.

Keep all these holdings visible even when the proposed rules produce a zero target.
“Outside the active set” is a network status, not evidence of a stopped node and not
itself a transaction instruction. Distinguish:

- Fails a known rule, with that rule and observed value identified.
- Evidence unavailable or incomplete, requiring review.
- Eligible but constrained by the cap.
- Target differs from the amount currently movable.

The owner decided on 14 October that V1 requires 90 consecutive days in the active
set. The present simulator still uses the older eligibility model. The new history
collector began on 14 October and cannot by itself establish a preceding 90-day
window on 17 October. This is a real implementation/evidence dependency. The design
preview uses explicitly fictional complete evidence; it must not be substituted
for a verified current target. A future implementation must version this change,
retain old policy meanings, and fail closed where evidence is incomplete.

## Screen integration

### Overview

Keep the existing three planning stages and stable routes. Do not add another
top-level dashboard or a second proposal wizard. The overview's policy state
determines the primary entry:

| State | Primary action | Visible explanation |
| --- | --- | --- |
| No verified first approval | Propose initial rules | Actual holdings exist; no approved structured rules found. |
| Current rules available | Prepare allocation proposal, once supported | Uses the current approved revision. “Propose rule changes” is the separate secondary action. |
| New rule proposal voting | View rule proposal | Current approved rules remain in force while voting continues. |
| New rules approved, no implementation | Prepare allocation proposal, once supported | Rules approved; holdings have not changed. |
| Unsupported approval or verification failure | Review approval status / retry | Execution stays unavailable; do not imply initial adoption. |

While the execution adapter is absent, the product must clearly label the future
entry as unavailable. Existing simulation may remain usable as a read-only preview.

### Set rules

Start a change draft from the verified approved revision. Keep its immutable
reference while the user edits; never overwrite edits during a refresh. Beside each
changed field show the old value and a reset action. The summary counts actual
semantic changes. Added/removed exclusions include reasons and stable addresses.
Changing only free-text rationale is not a numerical rule change.

Distinguish policy revision numbers from the planned V1/V2/V3 scoring models and
from the JSON schema version. A commission change does not activate model V2.

### Review distribution

Show a small changed-rule summary followed by the comparison. Use aligned neutral
ticks for the baseline and mint bars for the target, a shared scale and adjacent
numbers. Do not overlay network stake, programme allocation, an ideal allocation,
agreement amounts and score colors in the default view. The existing network-share
information remains in an explicitly labelled detail.

Keep the main summary to decision-relevant quantities: programme funds leaving
existing positions, actual recipient count before/after, and holdings at validators
outside the set. In Rule effect only, summarize the changed targets instead.
Use actual recipients (`target > 0`), not all eligible validators.

Do not call the sum of absolute deltas “funds moved”: that double-counts a balanced
reallocation. Show decreases, increases and net newly allocated/released capital
separately when totals differ. An executable movement plan can differ because of
unbonding, redelegation locks, transaction limits and the source of new funds.

On mobile stack each validator's Current / Proposed / Change values. Preserve
labels, reasons and exact detail; do not shrink a wide graph until it is illegible.

### Review proposal and the existing voter view

Reuse one review renderer in both places. The default reading order is:

1. Decision requested and scope: rule approval, no movement of funds.
2. Changed rules: approved value → proposed value, plus author rationale.
3. Allocation consequences with the two comparison modes.
4. The existing discussion, participation and vote controls.

The full policy, unchanged fields, sources and hashes sit behind named disclosures.
They remain reachable without exporting JSON. On-chain proposal review must render
the stored, verified proposal data, never the browser's local draft.

## Proposal lifetime and approval gates

A rule review package identifies the prior policy (or explicit initial adoption),
proposed policy, exact budget, input snapshot, evidence and calculation version.
Store both target results and the observed holdings, with verifiable content
references. A hash without available data does not let voters reproduce the result.
The proposal's original published comparison stays fixed. A separately labelled
“Updated estimate” may be recalculated; it never replaces what was reviewed.

The current review system already finalizes a revision with a content hash. Extend
that binding to the comparison package, and verify its availability and contents
on import and in the voter view. Editing the proposed policy or bound evidence
before submission invalidates finalization and requires a new review revision.

After a rule approval:

1. Verify the exact on-chain outcome, policy identity and supported semantics.
2. Open a new allocation draft pinned to that revision; rule fields are read-only.
   A rule edit branches to a rule-change draft and loses allocation eligibility.
3. Read fresh balances, evidence, reserve, validator states and movement constraints.
   Compute exact messages and show the proposed movements and blocked portions.
4. Obtain the separate required allocation approval through the verified authority.
5. Revalidate the exact approved payload, current-policy reference, balance and
   movement constraints before execution. Recalculation cannot silently replace
   the approved transaction amounts or recipients.
6. Mark implemented only after confirmed execution and reconciled holdings.
   An intermediate or partial transaction state is not “allocation complete”.

If a new policy supersedes the plan's parent revision, stop the old plan and require
review against the current revision. Mere passage of a pending competing rule
proposal cannot retroactively rewrite an already published proposal. The governance
resolution for two competing accepted rule amendments must be explicit; the current
display reader's latest-voting-end ordering is not a concurrency-safe execution
policy. A parent-revision check in an enforcing authority/contract is needed if
that ordering is meant to constrain all callers, not just this UI.

Native Juno rule proposals currently contain no messages. Their passage is a
governance signal; it grants no new control over the programme DAO. The approved-rule
reader explicitly supplies display data only. A disabled button is not an execution
security boundary. Authority integration, on-chain enforcement where applicable,
freshness checks and exact transaction validation are required separately.

## Implementation map and acceptance

The existing modules provide useful pieces, not the completed design:

| Existing component | Needed integration |
| --- | --- |
| `juno-approved-rules.mjs` | Supply the verified immutable baseline and explicit unavailable/no-match states. Preserve historical meaning. |
| `juno-delegation-core.mjs` | Reuse deterministic simulation for both policies with compatible input/evidence semantics; implement the separately decided 90-day model as a versioned policy. |
| `juno-delegation.mjs` / view helpers | Changed-field summary, comparison modes and per-validator explanations using a shared review model. |
| `planner-proposal-draft.mjs` | Bind and describe initial/adopted parent rules and the complete comparison package; current output includes only the proposed policy and illustrative totals. |
| Existing community-review/native-proposal views | Render that same frozen review for voters and preserve the finalized content binding. |
| Future execution adapter | Require approved policy + separately approved exact plan + verified authority + valid fresh execution state. Currently absent. |

Before shipping, a reviewer must be able to answer: “What was the old value?”;
“What changes because of this rule?”; “What changes from the portfolio today?”;
“Does voting yes move money?”; and “What remains before redistribution?”.

Acceptance cases include initial adoption with held outside-set positions, unchanged
policy with portfolio drift, isolated commission changes, indirect allocation
effects, changed budget, unavailable approval, unsupported rules, incomplete 90-day
history, parent-policy supersession, immutable published evidence, stale execution
plans and failed/partial execution. No automatic transformation of an old approval
or target simulation into a new authorization is allowed.

Implementation should extend the existing combined design branch. This document is
a proposed integration contract, not evidence that these gates or views already run.
