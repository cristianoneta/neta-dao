# Delegation controls and governance bonus decisions — 31 October 2026

## Implemented source changes

The owner requested removal of the redundant Additional rule options block.
Commission now has one whole-number field (0–100%); 100% permits every valid rate.
Stored no-limit policies retain their original null value until that field is
edited. Voting power has one numeric factor, 1.0–3.0 in 0.1 increments. Existing
draft values and the 1.5 default are unchanged. The independent 30% ceiling remains.

New editable policies use schema 8 for the extended factor range. Schemas 2–7
retain their original 2.0 maximum and frozen-review meaning. Schema 7's fixed
allocation behavior is retained without alteration.

Schema 9 now makes the points controls part of the actual proposed policy. It
uses exact rational points and deterministic capped redistribution of the regular
budget. Governance is first at 100%; RPC/API, testnet and archive are disabled at
zero. Base/maximum bonus defaults to 900/100 and is configurable. Schemas 2–8 keep
their previous equal-allocation semantics and immutable review hashes.

Collector installation and feature CI acceptance are confirmed; fresh feed
acceptance and the manual website release remain pending. A missing governance feed blocks a new bonus-weighted
review. Approved legacy rules remain usable under their original semantics.

## Measurement with the owner's collection-window refinement

1. At the frozen calculation block/time, select all native Juno proposals whose
   voting periods finished in the preceding 90 days. Include passed, rejected and
   execution-failed proposals; exclude open voting, deposit-only and cancelled
   proposals. Only use voting periods captured completely within our own
   continuous observation history. If fewer than ten finished, use up to the ten
   most recent fully observed periods available in our 180-day working history.
   Never fetch older archive/indexer history or pre-collection votes to reach ten.
   Fewer than 90 observed days and fewer than ten proposals are valid while
   collecting; use the actual available sample. Order by voting-end time, then
   numeric proposal ID. Display the actual dates, count and collecting state.
   A proposal whose voting began before complete observation coverage is excluded
   from the sample for everyone, not recorded as a missed vote.
2. Count a validator's own successful on-chain vote once per proposal. Yes, No,
   Abstain, NoWithVeto and valid weighted votes count equally. Voting again does
   not add participation. The vote must have been accepted during that voting
   period. Resolve the operator's account bytes and validate any authorized vote;
   an unrelated account or delegated voting power is not an operator's own vote.
3. For a new validator, exclude proposals whose voting began before its first
   observed active-set entry in our collection. A validator already active at
   collection start uses that observed baseline; do not guess an earlier entry
   date or request external history. Show this smaller opportunity count
   explicitly. Do not reset history on a later exit/re-entry. Unknown entry history
   remains unknown, and zero applicable proposals does not produce 100%.
4. Let N be the applicable proposal count and V the number with an evidenced own
   vote. With complete evidence and N > 0, governance contribution q = V/N.
   Every proposal has the same weight; voting power and preferred vote option do
   not increase the participation score. Use exact ratios for allocation and
   round only the displayed percentage.
5. With base B and maximum bonus W (B+W=1,000), points = B + W×sum(a_j×q_j),
   where a_j is each enabled criterion's nonnegative weight normalized by the
   sum of enabled weights, and q_j is its verified contribution in [0,1]. Zero
   weight disables a criterion; all weights zero means no earned bonus.
   Governance starts at 100% of the bonus criteria weight; the three unavailable
   services start at zero. Neither W=100 nor governance-only scoring is hardcoded.
   Example: eight of ten votes with B=900, W=100 and governance weight 100% gives
   980 points. With B=800, W=200 and governance weight 25%, the same participation
   earns 40 governance points, plus any independently earned points from the other
   criteria. This is not a guaranteed percentage of tokens allocated to bonus.
   Base/bonus balance, criteria and weights belong to an explicit approved rule
   version; activating a new service cannot change an existing policy or review.
6. Reserve fixed commitments first. Allocate the remaining budget among eligible
   validators in proportion to points, with the approved cap and deterministic
   micro-unit remainder handling. Fixed portions remain exempt from programme
   gates and bonus requirements; bonus never repairs a failed regular gate.

The new-validator exception gives a small sample less statistical certainty.
Show “3/3 applicable; 10 proposals in programme window” rather than hiding this
behind “100%”. A separate minimum-opportunity requirement would penalize new
operators and is not proposed as an additional eligibility gate.

## Evidence findings and activation boundary

A diagnostic native proposal enumeration on 31 October found five completed voting
periods inside 90 days: #378–382. The ten most recent completed periods are
#373–382, reaching back to 24 March 2026. #383–385 were still voting and are excluded
at that observation. This explains the earlier backfill suggestion, which the
owner rejected. These older proposals are not the scoring sample unless their
entire voting period was already captured by our own collection. No March history
will be fetched to manufacture a ten-proposal minimum.

Juno v31.0.0 uses Cosmos SDK v0.53.7. Its
[tally implementation](https://github.com/cosmos/cosmos-sdk/blob/v0.53.7/x/gov/keeper/tally.go)
removes individual votes from the current store after tallying. Consequently an
empty current `/votes` response cannot establish non-participation. Capture successful native voting events and complete proposal lifecycles instead
of querying a post-tally vote store. `validator_governance.py` reads only our own
working SQLite database. The chain coverage endpoints include block hashes;
proposal periods include observed heights/times; votes retain the unique block
height, successful transaction index, event index, actual voter and option.
These references identify events in the frozen coverage's chain ancestry; no
transaction hash is invented. Individual block headers/results remain in our own
stored observations. This is provider-observed evidence, not a cryptographic
proof of each ballot or a current REST vote-store reconstruction.

Capture now additionally includes deposit-triggered voting starts and cancellations.
An older period without an explicit captured start is excluded, never assigned a
missed vote. Expedited rejection followed by regular voting is not a completed
period. Repeated votes count once, using the keeper's actual voter account; votes
by delegators or authorized grantees on their own behalf do not become validator
votes. Bech32 checksum, prefix and account bytes are validated.

First observed active entries persist across exit/re-entry and rolling pruning.
The additive migration uses existing own transitions; it refuses to infer a first
entry when older daily observations precede the retained transition. New blocks
also record a digest of the selected event payload, detecting missing/changed rows
from upgrade onward. Older observations do not retroactively gain those integrity
records. Continuous block/hash coverage and available event fields are checked
for the entire exported interval, with bounded execution and read-only access.

Missing evidence is `unverified`, not “did not vote”. A deliberately shorter
complete window is valid; source gaps, corruption or incomplete vote coverage
inside the selected window block new bonus-weighted calculation/approval,
retaining the last complete immutable comparison. No silent equal-allocation or
zero-bonus fallback after a data outage. With zero applicable completed proposals,
show `No completed proposals observed yet`, not 0% or 100%. No verified governance
bonus is earned; configured base points and other verified criteria still apply,
without reallocating governance's weight. If all resulting points are zero, keep
the regular budget unallocated. Freeze the actual sample, coverage, counts,
evidence and policy version with every review and approved redistribution.

## Retention refinement — installed, operational acceptance pending

The working validator SQLite history now retains 180 days rather than 120, using
the observed cursor time. The exact 180-day boundary remains queryable. Only older
rows are eligible for the existing bounded export, verification and transactional
removal from SQLite. Archive bundles have no automatic expiry; no new deletion
or backup-pruning task is introduced. The 90-day programme eligibility rule stays
unchanged. Tests retain selected governance events with their blocks and preserve
archive-before-delete, rollback and exact restore guarantees.

The owner confirmed installation of the reviewed validator collector alongside
the Operations repair, preserving existing identity, databases, locks, timers and
archives. Post-update collection, scheduled acceptance and measured disk growth
remain separate checks; a successful installer alone does not prove them.

## UX and validation

Show participation as `8/10 · 80%`, earned bonus as `80/100`, and resulting points
as `980`. An expandable evidence view lists proposal, closing date, own vote,
transaction/source and coverage status. Keep detailed rules in contextual help.
Recalculate targets only on a deliberate refreshed review; new votes must not
rewrite an already frozen or approved review.

The local regression suite covers sampling boundaries, young/empty samples,
proposal outcomes, repeated/weighted/authorized vote identity, invalid checksums,
missing message/ballot pairs, deleted/changed events, missing block coverage,
first-entry preservation, exact capped redistribution, fixed-only exemptions,
weight changes, unavailable data, historical review hashes and frozen roundtrips.
A realistic 37-position portfolio with ten observed proposals fits both rule and
execution review publication and reproduces its exact evidence. Historical 37/55
position publication cases remain covered using their original rule schema.

The compact schema-9 envelope may refer to the policy already embedded in the
verified frozen comparison instead of repeating JSON outside it. Approval discovery
requires that validated schema-9 review plus the matching policy hash; legacy
formats still require their original exact-policy section. Lossless transport uses
operator indices and relative vote heights. The 10,000-byte limit still fails
closed for larger evidence; it never drops ballots or silently truncates a sample.

Current local checks pass 443 JavaScript tests and 242 Python tests (14
environment-dependent skips). The browser acceptance adds point-setting persistence,
invalid-input handling, new-schema export and unchanged approved-rule behavior.
Feature head `ed0bac062b76b8a1b057d270a511064991630348` passed all 18 jobs in
[CI 41199076122](https://github.com/cristianoneta/neta-dao/actions/runs/41199076122),
including browser acceptance, programme execution and infrastructure backup. The
following readiness update is documentation-only. Collector installation is
confirmed; fresh feed acceptance and manual website publication remain pending.
