# Delegation Programme checkpoint — 29 October 2026

Read-only acceptance checked around 20:20–20:23 UTC. This is a dated observation,
not a promise of future proposal outcome, ongoing collector health or an execution
authorization. [CURRENT_STATE](CURRENT_STATE.md) owns the current inventory;
[HANDOFF](../HANDOFF.md) owns continuation. No application, contract, wallet journal,
production data or operator configuration was changed by this documentation update.

## Published source

PR [#327](https://github.com/cristianoneta/neta-dao/pull/327) merged at
`65f48c5bff863eea44c99cd6516984cd7c37a074`. Manual release
[40589638063](https://github.com/cristianoneta/neta-dao/actions/runs/40589638063)
completed on 27 October at 21:52:30 UTC. The actual publication step succeeded;
this was not a checks-only run. The release includes the dedicated proposal gas
policy and the previously accepted native vote correction. The full release
checks, including real local Juno execution and browser gates, succeeded.

The module served at `https://cosmoot.com/planner-native-governance.mjs` was
byte-identical to the released source on 29 October. A documentation-only merge
after this checkpoint does not require another production website release.

## Corrected reward claim submitted: native proposal 384

STAVR (`https://juno.rpc.m.stavr.tech`) and PublicNode
(`https://juno-rpc.publicnode.com`) independently returned agreeing proposal
observations at Juno height **43,209,038**, block time
**2026-10-29T20:20:20.276097199Z**. Both also returned the same successful submission
receipt. Public query paths are `/cosmos.gov.v1.Query/Proposals` and RPC transaction
lookup; these checks did not sign, simulate a new transaction or broadcast.

| Observation | Verified value |
| --- | --- |
| Native proposal | [#384: Juno Delegation Programme — claim staking rewards II](https://cosmoot.com/?reviewChain=juno-1&reviewContract=juno15wwr9dezyfp86p4px5p664gguargukml3wa9pctw9nutfn2rzk9qwf45gq&proposal=384#governance) |
| Submission | Code 0; block 43,143,980 at 2026-10-27T21:53:03.714964217Z |
| Transaction | `65CA0082936BE90B7F87D539F774CAC8D2A49AC7DBDF39172A1879007FE2BCA1` |
| Gas used / limit | 2,255,995 / 3,092,554 |
| Network fee | 231,942 ujuno = 0.231942 JUNO |
| Total proposal deposit | 5,000,000,000 ujuno = 5,000 JUNO |
| State at the observation height | `PROPOSAL_STATUS_VOTING_PERIOD`; not executed |
| Scheduled voting end | 1 November 2026, 21:53:03 UTC / 22:53:03 Europe/Berlin |

The proposal metadata binds Juno review **3**, finalized hash
`b6d56d79adf5743cb9154db1cc1bbd8f912dbf815be0b7d15d68ed34aa889339`, at the published
review contract. A read-only contract query confirmed this finalized review is
not withdrawn. Its nullable `dao_proposal_id` is not evidence that a native
submission is absent: the native proposal's review-bound metadata identifies it.

Decoded proposal content contains one governance-sent `MsgExecuteContract` to the
programme core, zero attached funds and `execute_admin_msgs`. Its 37 distinct
Stargate withdrawals all use `/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward`
with the programme as delegator. This confirms the submitted envelope uses the
corrected format. It does not prove later mainnet reward execution or its amount.
The prior #381 remains failed with the incompatible `distribution` variant error.

Do not resubmit review 3, repeat the submission repair or clear uncertain wallet
journals. Follow #384 through the end of voting; only subsequent execution evidence
can establish rewards movement. Keep the [governance layers](GOVERNANCE_EXECUTION_SEMANTICS.md)
and [original claim repair](PROGRAMME_CLAIM_REPAIR_2026-10-23.md) distinct.

## Supported allocation rules have not yet been approved

Both RPC providers returned **152 unique currently stored native proposals**, in
two forward-paginated pages at the same height, ending at an empty cursor. Neither
result contained a proposal with the supported
`Juno Delegation Programme — allocation rules` title prefix. Therefore there is
no matching native rule proposal or approved structured policy for Cosmoot's
current Rebalance path in that observation. Historical programme proposals,
including #50 and #363, remain historical governance decisions; this is not a
claim that the programme has never had a policy. Private browser drafts and
community reviews are not established by this native-history check.

The published rule-discovery correction is available. Its presence does not
substitute for an actual approved rule revision. Rebalance requires that revision
and refuses another programme treasury execution while #384 remains pending.
Preparing/reviewing initial rules is separate from moving programme funds. Rules
are enforced by Cosmoot's supported path, not a newly deployed enforcement contract.

## Current published validator observations

The same-origin public planner
`https://cosmoot.com/data/daos/juno-delegation-planner.json` returned HTTP 200,
`X-Cosmoot-Snapshot: server` and upstream status 200. Its data report:

- Snapshot block **43,208,715**, time **2026-10-29T20:06:37.814468935Z**;
  collected **2026-10-29T20:07:32.933425+00:00**.
- Original collection start **2026-10-14T19:17:50.221235511Z**, block **42,701,361**.
- Approximately **15.03 days** of continuous available history, not 90 days.
- Production `snapshot()` and `participationEvidence()` validation succeeded:
  25 continuous active-set members and 25 reconciled participation records, with
  `complete: true` for the available interval and `collecting: true`.

The published data now resolve the older unavailable-history/catch-up checkpoint.
This validates the exported evidence shape, continuity and count reconciliation;
it does not independently replay every observed signature or prove host timers,
backup retention, redundant history collection or future availability. The source
history remains provider-observed. No specific eligible allocation is certified.

## Continuation

1. Track #384 through voting and verify its eventual execution separately.
2. Review and submit the first supported allocation-rule proposal when the owner
   chooses; freeze the exact policy and actual-versus-target comparison. No such
   proposal or owner signature was created during this checkpoint.
3. After a supported rule approval and the resolution of pending programme actions,
   refresh evidence, funds and staking locks; prepare the separate Rebalance vote.
4. Keep bonus scoring exploratory. Historical no-jail episodes, independently
   attributed service measurements and their scoring policy are not implemented
   by this documentation or the current eligibility schema.
5. Retain the separate operational acceptance items in HANDOFF. No host or backup
   acceptance is inferred from these public checks.
