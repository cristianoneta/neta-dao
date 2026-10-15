# Juno native proposal voting — 15 October 2026

## Bug-fix candidate

The proposal list previously displayed a finalized community review and its native
submission independently. Clicking the review immediately redirected to the same
native proposal. Link the immutable finalized review hash, exact chain/contract
metadata, title, summary and complete executable messages; only one unambiguous
match hides the redundant list row. Keep the original review and revisions
accessible through View community review, with a return link to the native record.
Matching titles alone never establish identity.

Show the prominent contribution panel only during deposit. Preserve unresolved
contribution receipts and a compact, read-only status-check action after funding
closes. No transaction journal is deleted or automatically resent.

Open native proposals must read the live /tally endpoint, not final_tally_result.
Fetch the selected proposal and tally at one fresh chain height from the same
provider, with fallback on source failure. Use the existing same-origin read proxy
to avoid provider CORS preflight failures; the allowlist adds only a positive
proposal ID followed by /tally, without arbitrary query parameters or writes. Display all four choices including
No with veto, amounts in JUNO, read time and height. Refresh every 30 seconds while
the governance view is visible, on tab return, and through Refresh results.
Missing/incomplete/error data is unavailable, never a zero-vote result. Reject
late responses after selection changes and changed proposal content. Closed
proposals use their final tally. This is read-only display evidence, not a
transaction authorization proof; native voting remained disabled in PR #292. The combined candidate below adds it.

## Combined increment — implemented candidate, owner approved 15 October

Keep the existing graphite/mint interface and one canonical native-proposal view:

1. Compact header: proposal ID, status, voting deadline, author, and one Vote action.
   Keep proposal text/actions and review history accessible without a duplicate row.
2. Results: four-option bar, JUNO and percentage per choice, turnout relative to
   bonded stake, quorum progress and current acceptance/veto thresholds. Fetch
   actual Juno parameters, including expedited rules, rather than hardcoding them.
   Explain that Yes acceptance excludes Abstain while quorum includes it.
3. Your vote: current on-chain ballot, own eligible delegated stake, inherited
   validator choices when no personal ballot exists, and Change vote during the
   voting window. Support displaying existing weighted ballots. A first standard
   voting form offers Yes / No / Abstain / No with veto with explicit Keplr review,
   fee simulation, chain/proposal/deadline checks and post-inclusion receipt check.
   Pending or uncertain broadcasts survive reload without automatic resubmission.
4. Validators tab: verified operator name, ballot or Not voted, current staking
   power and effective proposal weight after direct-voter deductions. Allow search,
   vote filters and power/name sorting. Preserve weighted votes as weighted.
5. Direct votes tab: unique voting addresses, their ballots, current eligible own
   stake and share of the tally. Identify validator operator accounts explicitly;
   addresses are not unique people. Add total directly represented stake and the
   remaining stake represented through validator votes without double counting.

The Cosmos SDK v0.53.7 tally subtracts direct-voter delegation shares from each
validator before adding the validator's effective vote. Accurate detail therefore
needs complete paginated votes, validators and voter delegations at the same
height, not just raw validator power plus wallet balances. During voting, stake
and ballots can change. Capture a final-height snapshot for historical detail;
a later current-state reconstruction must not be labelled the final breakdown.
Retain terminal votes/events or an appropriate index because finalized proposals
need not retain all live voter queries. The existing validator-event collector
is useful input but does not yet supply this complete indexed dataset.

Owner correction: direct voting and participation analysis ship together in one PR.
The earlier separate-release suggestion is superseded. No programme scoring is
added. Validation: 326 Node tests and eight signing-adapter tests pass. The complete
planner/review/funding/browser flow passes with added vote rejection, confirmed
change, lost response/reload/status recovery, filters and unavailable-detail cases.
Desktop/mobile screenshots at 1440/768/390/320 px inspected. A real read-only
Proposal 381 snapshot at height 42734121 reconciled 25 bonded validators and 15
direct voting addresses exactly with the chain tally. No real wallet write.
Full PR CI and manual website publication remain pending for this candidate.



## Research references

- Keplr: [Cast Your Vote](https://help.keplr.app/wallet-dashboard/5R3bMyjtr33UpY5E29q8p1/cast-your-vote/5So5gM41LhxyLfQPJxvfaG) — proposal detail, quorum/turnout, validator choices and wallet confirmation.
- Mintscan: [API capabilities](https://docs.mintscan.io/apis) — separate account-vote and validator-vote histories.
- [Cosmos SDK v0.53.7 tally implementation](https://github.com/cosmos/cosmos-sdk/blob/v0.53.7/x/gov/keeper/tally.go) — stake shares, direct-voter deductions and weighted choices.

## Implementation boundaries

`native-voting-core.mjs` implements the fixed-point SDK tally, complete reads,
reconciliation and vote preflight; `native-voting-ui.mjs` owns the mounted view.
The existing governance signing bundle registers only MsgVote for this action,
with an empty metadata/memo and a simulated explicit JUNO fee. Uncertain votes
retain both the account transaction journal and proposal-specific receipt. Checking
status is read-only; after two matching inclusion proofs, only a matching account
journal hash may be released. An interrupted signature remains locked.

Participation is current single-provider evidence, not a historical index or an
independent multi-provider data proof. Transaction authorization uses two distinct
source origins. Pagination is bounded to 50 × 100 records per list and repeated
cursors/duplicates fail. Large proposals can exceed these limits or provider
retention; details then stay unavailable without blocking independent vote review.
No server collector, production timer or historical capture is installed here.
