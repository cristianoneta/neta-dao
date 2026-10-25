# Delegation Programme: checked execution

## Product boundary

Owner clarification, 25 October 2026: the Delegation Programme is an independent
product integrated with Cosmoot. It is an entry point into Cosmoot, not its product
core. Keep programme planning focused on its own task; use Cosmoot for community
review, discussion, native governance, receipts and outcome visibility. This does
not change Cosmoot into a delegation-only application.

The agreed four programme views remain Eligibility, Distribution, Review and
Rebalance. Rule approval and execution are separate decisions. Base/bonus points
remain exploratory; this change executes the currently supported equal-capped
approved policies, including their historical semantics. It does not activate an
unmeasured RPC/testnet scoring model.

## Execution contract

1. Load the current approved rule revision from two independent Juno sources.
   A draft cannot substitute for approval. Refuse a new execution while another
   native programme treasury proposal is in deposit or voting. Funding the same
   native proposal is exempt from that concurrency guard.
2. Calculate targets from a snapshot less than one hour old and complete required
   evidence. Preserve the approved policy without normalizing it into a newer
   version. Freeze that calculation and the exact movements together.
3. Deterministically match reductions to increases with redelegations, then use
   spendable funds for remaining increases. Remaining reductions begin unbonding.
   Unbonding proceeds never finance movements in the same proposal. Keep at least
   50 JUNO liquid; unclaimed rewards are not spendable allocation funds.
4. Read current delegations, validators, spendable balance, staking parameters,
   redelegation entries, unbonding entries and the exact-height consensus set with
   complete bounded pagination. Recheck current commission, consensus membership
   where required and the projected voting-power cap against the approved policy.
   Each source must return the requested block height. Check original programme
   code 4047/hash, governance admin, unpaused status and withdrawal destination.
   A second independent source must agree on relevant holdings and parameters.
5. Reject changed holdings, insufficient liquid funds, unavailable/jailed
   destinations, incoming redelegation locks and entry-limit violations. Existing
   entries count until the chain removes them, even after their nominal date;
   holds can delay completion. No partial plan is published as a full rebalance.
6. Open a scoped proposal draft. The frozen evidence is compressed losslessly into
   its immutable text; the exact actions must reproduce that evidence. Format 2
   reconstructs the deterministic movement plan from the complete calculation,
   retaining the full review hash and exact action comparison. Format 1 remains
   readable. Synthetic 37- and 55-position portfolios fit the 10,000-byte text
   limit; oversized proposals fail before enabling the draft action rather than
   dropping evidence. Recheck at publication,
   finalization, native preparation, immediately before signing and contribution.
7. Reuse the established community review, finalization, deposit, wallet signature,
   pending transaction recovery, native vote and execution-status display.
   Opening a draft neither connects a wallet nor sends a transaction.

The outer message is governance's MsgExecuteContract to the programme with zero
funds and execute_admin_msgs. Each inner message is Stargate protobuf for
MsgDelegate, MsgBeginRedelegate or MsgUndelegate, with the programme as delegator
and positive integer ujuno. Exact canonical re-encoding rejects alternate signers,
extra messages/fields, malformed bytes and foreign denominations. Existing claim
messages and immutable historical reviews retain their separate validation.

## Evidence and limits

The pinned Juno v31.0.0 / SDK v0.53.7 execution regression runs the original deployed
DAO DAO v2.4.0 Wasm and synthetic local state. It passes a native vote and observes
delegation/redelegation changes, an unbonding entry, preserved liquid reserve and
a non-unit staking share exchange rate. A second proposal first attempts a
delegation then a forbidden transitive redelegation: the whole execution fails
and both liquid funds and all delegations remain unchanged. Original claim and
Community Pool regressions remain mandatory. No mainnet transaction was made.

On 25 October a direct Juno source reported v31.0.0 / SDK v0.53.7, a 28-day
unbonding period and seven entries. Runtime reads determine the current values;
the product does not hardcode those observations as future guarantees.

Movement checks are conservative, not an optimizer for every alternative route.
At most 500 movements are considered, subject also to the smaller proposal text
and action limits. Share rounding may leave micro-JUNO residuals. The frozen
targets describe the recorded observations; checks cannot reserve chain state
through a multi-day vote or prevent transactions through another interface.
Submission simulation cannot prove future execution. Native execution failure
must stay distinct from acceptance of a proposal or vote. After execution,
refresh programme holdings to inspect the actual outcome; present balances alone
do not establish historical attribution to this proposal.

Source checks cover exact integer arithmetic, codecs independently decoded by
CosmJS, frozen content tampering, wrong authority, stale/mismatched heights,
incomplete pagination, changed approval/holdings, insufficient funds, staking
locks and responsive browser handoff. The real Juno test remains a required CI
gate. This source change requires the deliberate manual Cloudflare website
release; the read-only proxy is bundled in that same release. No OVH installation,
contract deployment or custody change is required.

Primary references:

- [SDK v0.53.7 delegation keeper](https://github.com/cosmos/cosmos-sdk/blob/v0.53.7/x/staking/keeper/delegation.go)
- [SDK v0.53.7 message handler](https://github.com/cosmos/cosmos-sdk/blob/v0.53.7/x/staking/keeper/msg_server.go)
- [Juno v31 dependency pins](https://github.com/CosmosContracts/juno/blob/v31.0.0/go.mod)
- [DAO DAO v2.4.0 interface](https://github.com/DA0-DA0/dao-contracts/blob/v2.4.0/packages/dao-interface/src/msg.rs)
- [Required execution semantics](GOVERNANCE_EXECUTION_SEMANTICS.md)
