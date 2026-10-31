# Readable allocation-rule proposals

31 October 2026. Source implementation; manual website release remains separate.

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
