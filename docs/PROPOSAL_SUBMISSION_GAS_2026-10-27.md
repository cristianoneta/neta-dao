# Native proposal submission gas

27 October 2026. The owner successfully completed the higher-gas native vote
after PR #326's release, then reported a different error while submitting the
finalized corrected programme reward claim. This follow-up concerns native
MsgSubmitProposal only. The finalized review and executable content are preserved.

## Reproduction

The old controller called fixedFee(estimate, 1.4, 0.075ujuno, 2000000).
That helper rejects the unadjusted estimate above 2M before asking Keplr to sign.
It does not apply that ceiling to the final adjusted gas limit.

Read-only mainnet simulations of the exact finalized review, using only the
account's public key and a signer that throws on any signature request, returned:

| Selected deposit | Estimated gas | Old guard |
| --- | ---: | --- |
| 1,000 JUNO | 1,882,616 | Accepted |
| 5,000 JUNO | 2,208,967 | Rejected before signing |

The earlier Community Pool proposal consumed 525,159 gas at submission. The
earlier incompatible reward claim consumed 1,178,772 gas at submission; its
later DAO DAO execution failure was separate. These were different proposal
envelopes, not evidence that the corrected claim fits the same gas limit.
Simulations and historical receipts are state-specific observations.

## Resulting behavior

Native submissions use a dedicated proposalFee helper:
max(250000, ceil(estimate × 1.4)), capped at a final 5,000,000 gas.
At the unchanged 0.075 ujuno/gas price, the maximum reviewed fee is 0.375 JUNO.
The observed full-deposit estimate produces 3,092,554 gas and 0.231942 JUNO;
the exact fee is recalculated for the selected deposit before wallet confirmation.
Invalid estimates and final limits above the cap stop before signing, with a
specific message showing the required gas and the submission limit.

The vote fee, vote resumption/replacement, deposit contributions and swap fee
policies retain their own behavior. No pending record is cleared, no review is
rewritten, and no contract or execution authority is changed. Both deposit
choices preserve existing review/identity, fresh-state, balance and wallet guards.
Cancelling the wallet request creates no submission.

## Validation and limits

Fee tests cover both observed estimates, exact rounded fees, invalid input, the
final ceiling including reserve and separation from the vote policy. Browser
coverage exercises both deposit choices, an excessive quote before signing,
wallet rejection, account changes and the unchanged native vote recovery flow.

The pinned local Juno gate submits the real 37-withdrawal envelope using the
production message encoder and fee policy. It verifies a partial deposit stays
in the deposit period, a full deposit enters voting, the precise fee/deposit
balance changes, and no programme reward movement during submission. The existing
subsequent native vote and real DAO DAO execution must still produce all 37 reward
withdrawals with unchanged delegations. The vote gas/sequence regression also runs.
All writes in this test are restricted to its ephemeral loopback chain.

Submission simulation is not future execution evidence. The SDK checks message
signers/routes and stores the proposal; ordinary proposal messages can still fail
when executed after voting. See [governance semantics](GOVERNANCE_EXECUTION_SEMANTICS.md)
and the [pinned SDK handler](https://github.com/cosmos/cosmos-sdk/blob/v0.53.7/x/gov/keeper/proposal.go).
No live submission was signed or sent by the agent. Publication and owner wallet
acceptance remain separate from the source regression checks.
