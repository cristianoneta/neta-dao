# Delegation controls and proposed governance bonus — 31 October 2026

## Implemented source changes

The owner requested removal of the redundant Additional rule options block.
Commission now has one whole-number field (0–100%); 100% permits every valid rate.
Stored no-limit policies retain their original null value until that field is
edited. Voting power has one numeric factor, 1.0–3.0 in 0.1 increments. Existing
draft values and the 1.5 default are unchanged. The independent 30% ceiling remains.

New editable policies use schema 8 for the extended factor range. Schemas 2–7
retain their original 2.0 maximum and frozen-review meaning. Schema 7's fixed
allocation behavior is retained without alteration.

The bonus explorer now lists Governance participation first at 100%, followed by
RPC/API, testnet and archive services at disabled 0%, labelled `(not live)`.
The entire points model is still explicitly a preview: the current allocator is
equal-capped, and no production governance score is connected. The measurement
proposal below is for owner review before implementing binding bonus allocations.

## Proposed measurement

1. At the frozen calculation block/time, select all native Juno proposals whose
   voting periods finished in the preceding 90 days. Include passed, rejected and
   execution-failed proposals; exclude open voting, deposit-only and cancelled
   proposals. If fewer than ten finished, extend backward to the ten most recent
   completed voting periods. Order by voting-end time, then numeric proposal ID.
   Display the actual date range and proposal list, not just “90 days”.
2. Count a validator's own successful on-chain vote once per proposal. Yes, No,
   Abstain, NoWithVeto and valid weighted votes count equally. Voting again does
   not add participation. The vote must have been accepted during that voting
   period. Resolve the operator's account bytes and validate any authorized vote;
   an unrelated account or delegated voting power is not an operator's own vote.
3. For a new validator, exclude proposals whose voting began before its first
   independently verified active-set entry. Show this smaller opportunity count
   explicitly. Do not reset history on a later exit/re-entry. Unknown entry history
   remains unknown, and zero applicable proposals does not produce 100%.
4. Let N be the applicable proposal count and V the number with an evidenced own
   vote. With complete evidence and N > 0, governance contribution q = V/N.
   Every proposal has the same weight; voting power and preferred vote option do
   not increase the participation score. Use exact ratios for allocation and
   round only the displayed percentage.
5. With base B and maximum bonus W (B+W=1,000), points = B + W×q. Governance uses
   100% of the bonus criteria weight; unavailable criteria have zero weight.
   Example: eight of ten votes, B=900 and W=100, gives 980 points. This is not
   a guaranteed 10% token budget for bonus.
6. Reserve fixed commitments first. Allocate the remaining budget among eligible
   validators in proportion to points, with the approved cap and deterministic
   micro-unit remainder handling. Fixed portions remain exempt from programme
   gates and bonus requirements; bonus never repairs a failed regular gate.

The new-validator exception gives a small sample less statistical certainty.
Show “3/3 applicable; 10 proposals in programme window” rather than hiding this
behind “100%”. A separate minimum-opportunity requirement would penalize new
operators and is not proposed as an additional eligibility gate.

## Evidence findings and activation boundary

A read-only native proposal enumeration on 31 October found five completed voting
periods inside 90 days: #378–382. The ten most recent completed periods are
#373–382, reaching back to 24 March 2026. #383–385 were still voting and are excluded
at that observation. Recompute these facts at the actual calculation timestamp.

Juno v31.0.0 uses Cosmos SDK v0.53.7. Its
[tally implementation](https://github.com/cosmos/cosmos-sdk/blob/v0.53.7/x/gov/keeper/tally.go)
removes individual votes from the current store after tallying. Consequently an
empty current `/votes` response cannot establish non-participation. Archive
successful vote transactions and proposal lifecycle information, with chain,
height/hash, transaction identity and complete coverage. Handle both gov API
versions, weighted votes, repeated votes and authorized execution.

The existing validator collector retains selected governance events, but its
observed history starts on 14 October. That alone cannot establish the proposed
March–October denominator or absence of earlier votes. Backfill and verify the
required history before activation; public transaction-index responses alone do
not prove that omitted transactions never existed. Do not overwrite current
validator observations or manufacture historical zeroes.

Missing evidence is `unverified`, not “did not vote”. Block new bonus-weighted
calculation/approval when the required history is incomplete, retaining the last
complete immutable comparison. No silent equal-allocation or zero-bonus fallback
after a data outage. Freeze the proposal set, counts, evidence and policy version
with every review and independently approved redistribution.

## UX and validation

Show participation as `8/10 · 80%`, earned bonus as `80/100`, and resulting points
as `980`. An expandable evidence view lists proposal, closing date, own vote,
transaction/source and coverage status. Keep detailed rules in contextual help.
Recalculate targets only on a deliberate refreshed review; new votes must not
rewrite an already frozen or approved review.

Before activation, test the 90-day boundary, backward extension, ties, open/deposit
exclusions, failed execution, repeat/weighted/authorized votes, voter identity,
new-operator opportunities, incomplete archives, zero denominators, exact capped
weighted allocation, fixed exemptions and immutable review roundtrips. No live
bonus activation, collector installation or website publication is claimed here.

For the implemented control changes, `npm run verify` passes (433 JavaScript
tests and 227 Python tests, including 14 environment-dependent skips). The
existing browser acceptance script now covers the 3.0 boundary, saving, removal
of redundant controls, governance ordering/weights and historical null-commission
restoration. Local browser execution is pending: the Chromium download did not
produce a valid archive. Required browser CI remains a merge/release gate.
