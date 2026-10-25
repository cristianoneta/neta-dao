# Delegation policy workspace — 25 October 2026

The owner approved transfer of the separate policy lab’s presentation and process
into the real Delegation Programme. This source candidate preserves the live data
readers, rule schemas, frozen review format and native governance handoffs.

## User flow

- **Overview:** real holdings, rewards and independently discovered approved rules.
- **Rules:** compact names with hover/focus/touch explanations, aligned inputs,
  unchanged eligibility semantics and explicit exclusions. Available funds and Max
  use delegated plus spendable micro-JUNO less the 50 JUNO reserve; rewards and
  unbonding funds are excluded. The editable amount remains independent of policy.
- **Compare:** the existing frozen actual-versus-target and rule-effect comparison.
- **Review:** the existing rule proposal draft, community review and wallet flow.
- **Rebalance:** exact approved rules, independently chosen budget and fresh complete
  observations. Shows current, target and change, including held ineligible positions.
  Mobile preserves all three values. A fresh approval read is required at simulation
  and download. A changed approval, refreshed snapshot or edited budget invalidates
  the current result. Expired snapshots cannot be downloaded as current allocation
  drafts. The JSON preserves exact inputs, output and fingerprints, with no messages.

## Proposal capabilities

Rule proposals and reward-claim proposals already use the real governance workspace.
Opening a draft is distinct from publishing community review, wallet submission,
native voting and later chain execution. The existing corrected claim path and
real-Juno execution gate remain mandatory and unchanged.

Rebalance does **not** generate executable staking messages. Its export is explicitly
`ALLOCATION_SIMULATION`, `executionEnabled: false`, `messages: []`; it is not passed
to `savePlannerProposal` or the wallet. The disabled execution action explains the
remaining delegation/redelegation constraints, authority and real-chain tests.
Approval of the policy alone cannot move funds.

## Planned points model

Mandatory gates precede scoring; a bonus cannot compensate for failed eligibility.
Each eligible validator would get the same base B and at most W bonus, B+W=1,000.
The interactive explanatory slider starts at 900/100 and also supports 100/900.
Illustrative bonus weights are RPC 40, testnet 30, archive 20 and governance 10.
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

New unit cases cover exact Max, reserve conservation, immutable historical policy,
missing approval/evidence, invalid budgets, zero recipients, stale/future observations,
changed approval/snapshot and modified exports. The existing browser regression
adds five-view navigation, slider isolation, frozen Rebalance export, edit isolation
and mobile current/target/change layout. Existing rule/claim workspace and stale-data
regressions remain. Required release gates include programme execution and full
browser CI; their actual results belong to the associated PR and workflow run.

No backend deployment, contract migration, message activation, custody change or
production wallet transaction is part of this source change.
