# Readable allocation-rule proposals

31 October 2026. PR #332 published in manual release 41224653138. The navigation
follow-up below remains a separate manual website release.

The old native proposal repeated the entire compressed frozen comparison and its
rules. It approached the application text limit while its summary explained little
about the vote. Newly prepared rule reviews use a readable summary and an exact
reference to the complete evidence already recorded in the Juno workshop.

## What voters see

- Initial adoption explains validator eligibility, scoring and allocation rules,
  and that existing delegations remain unchanged.
- Amendments summarize changed thresholds, cap factors and point settings with
  before/after values. Changes to fixed allocations or exclusions are counted;
  the complete comparison lists recipients, amounts, obligations and dates.
  When the 300-character summary cannot hold every change, it explicitly points
  to the remaining changes in the comparison. Authors can edit the summary before
  publishing their review.
- The native proposal links to Cosmoot with the exact chain, workshop contract,
  review ID, finalized revision and content hash. That view displays the full rules,
  scoring, exceptions, fixed allocations and frozen distribution comparison.
- Technical references remain in the native proposal. The JSON envelope includes
  the content, policy and frozen-review hashes. No allocation messages are included;
  moving funds requires a separate governance proposal.

The existing review is the evidence store. Cosmoot is its viewer, and its URL is
not a mutable pointer to the latest planner. An incorrect revision or content hash
blocks the pinned view instead of displaying a different draft. Native rule views
also confirm the actual native record and referenced evidence against two sources.

## Open the proposal and vote — navigation follow-up

The shipped pinned links initially forced the review-history view. They now open
the review before submission and the unique matching native proposal afterwards,
including its existing phase-appropriate voting or deposit controls. The full
rules and frozen comparison remain on that native proposal view. Opening a link
does not connect a wallet, select a vote or sign anything.

The native proposal must exactly match the finalized review, and complete histories
from two independent sources must agree on its single ID. Wrong pins, duplicate
submissions and disagreeing sources prevent automatic navigation. A possible
existing submission also hides the new-submission controls while verification is
unavailable. A withdrawn review can still link to its existing native decision.

No serialized URL, proposal bytes or hashes change. The existing pinned
`reviewHistory=1` links resolve to the proposal; the explicit View community review
action uses `reviewHistory=full` so history survives reload. Older unpinned history
links keep their previous behavior. Voting/signing/gas code and the generated
signing bundle remain unchanged. Unit and browser regressions cover both routes,
wrong hashes, source disagreement, duplicate submissions and later withdrawal.

## Compatibility and verification

Only reviews containing the explicit `cosmoot-rule-reference-1` opt-in marker use
the new native format. Legacy finalized reviews and native proposals retain their
original bytes and parsing. The default legacy fixture builder is unchanged;
the planner explicitly requests the new format for new drafts.

An existing local draft offers **Prepare readable rule proposal**. This preserves
the exact frozen rule/evidence hashes and regenerates its summary and envelope;
the author must review the regenerated summary. Published or finalized reviews
are never silently converted. The finalized native text and byte count are shown
before submission. Existing transaction, funding and uncertain-outcome checks remain.

Approved-rule discovery requires a passed native vote, ended voting period,
empty execution messages, matching title/summary/metadata and exact review hashes.
Each independent source resolves the pinned revision, including revision numbers
beyond the first query page. Missing evidence, altered fields or source disagreement
block discovery; they do not select an older rulebook. Workshop withdrawal blocks
new submission, but cannot revoke a native decision already made by governance.
Only its stored content is read in that historical case.

## Limits and remaining work

The application checks native proposal text against a 10,000-byte budget. Workshop
limits remain separate: title 100, summary 300 and body 10,000 Unicode characters.
The full frozen comparison still consumes the workshop body allowance. Removing
the native duplication therefore provides substantial native-text headroom without
claiming unlimited evidence storage. Oversize reviews remain blocked, with no
silent evidence removal. A larger or chunked evidence store would require a
separately reviewed contract/storage design and migration plan.

Hash binding detects changed evidence; it does not guarantee perpetual provider
availability. Missing contract state or unavailable independent reads prevent
verification. No contract migration, custody change, production-data write or
wallet operation is included in this source change.

## Regression coverage

- Unit tests cover compact native output, preservation of frozen evidence, exact
  amendment summaries, separate character/byte limits, all reference fields,
  native payload tampering, source disagreement, missing evidence, pinned links,
  legacy compatibility and withdrawal after a native decision.
- The browser regression covers explicit old-draft conversion, new-format review
  rendering, corrupt references, local-edit isolation and 320/390/1440 px layouts.
- The isolated pinned Juno v31 regression uses the released workshop WASM with
  synthetic genesis state and an ephemeral test signer. It publishes/finalizes
  a real review, passes a native reference proposal, resolves the exact rulebook,
  rejects a revision after finalization and preserves the decision after withdrawal.
  Programme balances and delegations must remain unchanged.

The required CI jobs run the browser and chain acceptance before integration and
again during the explicitly manual website release. Synthetic checks do not claim
a live mainnet rule submission or successful future fund execution.
