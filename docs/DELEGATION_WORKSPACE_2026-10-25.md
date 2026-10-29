# Delegation policy workspace — 25 October 2026

The owner approved transfer of the separate policy lab’s presentation and process
into the real Delegation Programme. PR #318's refinement was published in release
40200433577 on 25 October, preserving the live data readers, rule schemas, frozen
review format and native governance handoffs. PR #319 subsequently added checked
Rebalance proposal preparation; PR #320 corrected compact-rule discovery. See the
[current execution specification](REBALANCE_EXECUTION_2026-10-25.md) and
[29 October acceptance](DELEGATION_CHECKPOINT_2026-10-29.md).

## Corrected user flow

The initial #316 release published on 25 October but did not reproduce the approved
lab. The owner explicitly corrected that mismatch. The correction uses the lab's
actual composition, rather than treating any restyled production page as equivalent.

- **Eligibility:** narrow left panel with concise gates, contextual help and aligned
  inputs; the wide right panel recalculates eligibility, concentration and exact
  current/target/change outcomes as valid inputs change.
- **Distribution:** visible base/bonus exploration and relative criterion weights,
  actual available budget and exact Max, beside the same production impact view.
  Available funds are delegated plus spendable micro-JUNO less the 50 JUNO reserve;
  rewards and unbonding funds are excluded. The amount is independent of policy.
- **Review:** one frozen actual-versus-target and old/new-policy comparison using
  the same evidence, exact export and Open proposal draft. The previous Compare
  and Review pages duplicated this component; they are now combined. Legacy
  #simulation links alias #proposals. Invalid fields and unavailable observations
  never become zeros; failed review preparation shows its reason, not an endless
  calculating message. The community review and wallet handoff remain unchanged.
- **Rebalance:** exact approved rules, separate budget and fresh observations, with
  current/target/change including held ineligible positions. Approval, snapshot,
  budget changes and expiry invalidate stale exports. The export contains no messages.
- **Programme overview:** secondary header action for holdings, rewards and approved
  rules; legacy overview links still work, outside the four planning stages.

Criteria use aligned 42px values. Optional no-limit/cap-slider controls and upgrade
evidence are secondary disclosures; partial-history coverage remains visible.
Current, target and signed change headers toggle exact numerical sorting, with a
mobile selector. Sorting is retained during recalculation and applies to all rows
before the show-first-eight limit. It never modifies calculated/frozen evidence.

The compact header, four-square Cosmoot mark, spacing, graphite/mint palette and
light/dark appearance follow the actual lab. No test-environment label or fictional
sample data is carried into production. Appearance is stored locally and separately
from rule drafts, frozen reviews and transaction journals.

## Proposal capabilities

Rule proposals and reward-claim proposals already use the real governance workspace.
Opening a draft is distinct from publishing community review, wallet submission,
native voting and later chain execution. The existing corrected claim path and
real-Juno execution gate remain mandatory and unchanged.

At the #318 refinement checkpoint, Rebalance did **not** generate executable staking
messages. Its simulation export remains explicitly
`ALLOCATION_SIMULATION`, `executionEnabled: false`, `messages: []`; it is not passed
to `savePlannerProposal` or the wallet. The subsequently published #319 path prepares
a separate checked staking proposal after approval, authority, funds and lock
verification. The simulation export itself never becomes an execution authorization.
Approval of the policy alone cannot move funds. On 29 October no supported native
rule proposal was present and the corrected reward claim #384 remained pending.

## Planned points model

Mandatory gates precede scoring; a bonus cannot compensate for failed eligibility.
Each eligible validator would get the same base B and at most W bonus, B+W=1,000.
The interactive explanatory slider starts at 900/100 and also supports 100/900.
Illustrative bonus weights are RPC 40, testnet 30, archive 20 and governance 10.
The exploration permits relative-weight edits and shows their normalized shares.
They are not live validator measurements or editable proposal fields.

For normalized verified contribution q, points are B+Wq; the token share follows
points divided by all earned points, subject to the separately approved caps.
900/100 is therefore not a guaranteed 90/10 token-budget split. Higher bonus weighting
can concentrate stake; B=0 removes the base guarantee. Missing bonus evidence earns
no verified points and remains labelled unknown. Fixed budget pools are explained
as a different model, not a second unexplained mode switch.

Activation requires an approved scoring schema, measured and attributed evidence,
observation periods and expiry, operator independence checks, appeals and transition
rules. The old objective/subjective 80/20 roadmap is superseded. Production remains
equal-capped; no policy migration or fictitious allocation is introduced by this UI.

## Verification

The correction adds independent impact checks for exact conservation, changing gates,
unavailable evidence, invalid inputs and stale snapshots. Browser regressions cover
the four planning views plus the retained overview, immediate impact, theme, exact
budget and preserved real proposal handoffs. This refinement adds exact signed
BigInt ordering tests, keyboard-accessible sortable headers/mobile selection,
recalculation persistence, aligned-field geometry and legacy-link routing.

Earlier unit cases cover exact Max, reserve conservation, immutable historical policy,
missing approval/evidence, invalid budgets, zero recipients, stale/future observations,
changed approval/snapshot and modified exports. The existing browser regression
adds four-view navigation, slider isolation, frozen Rebalance export, edit isolation
and mobile current/target/change layout. Existing rule/claim workspace and stale-data
regressions remain. Required release gates include programme execution and full
browser CI; their actual results belong to the associated PR and workflow run.

No backend deployment, contract migration, message activation, custody change or
production wallet transaction is part of this source change.
