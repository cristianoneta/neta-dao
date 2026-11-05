# Proposal size resilience — 3 November 2026

## Release scope

New referenced rule reviews use version-3 gzip/Z85 transport; the complete
semantic review and its hash remain unchanged. The existing review 4 revision 2
would need 9,321 rather than 9,898 body characters. Its historical content,
finalized hash and native proposal #387 are not rewritten.

New referenced rebalance reviews store an explicit, versioned JSON-array
transport: an ordered validator dictionary and exact movement tuples. Every
reader/validator/native submission boundary restores the canonical DAO DAO
`execute_admin_msgs` envelope with the full Stargate protobuf messages. This
storage envelope must never reach native governance directly. Unknown fields,
versions, indices, amounts, duplicate dictionaries and changed order fail closed.
Old JSON action arrays and earlier rule/rebalance formats remain readable.

Rules show storage usage when the comparison is prepared, before opening a
wallet. Oversized comparisons retain their full export and block publication;
the editor also shows remaining headroom. The native submission review reports
actual protobuf body bytes, a 2,048-byte signing reserve and simulated gas with
the existing 1.4 buffer. The conservative 262,144-byte application budget and the
5,000,000-gas application ceiling are distinct from chain parameters. The actual
signed transaction is checked again before broadcast. Submission simulation
still does not guarantee later proposal execution.

## Prepared on-chain attachment candidate (not activated)

Workshop 0.4.0 adds immutable revision-specific body attachments. A canonical
manifest in the existing body field commits to total bytes, complete-body
SHA-256, ordered chunk hashes and schema. The original four-field content hash
therefore binds the exact manifest, title, summary and separately stored actions.
All rules and calculation evidence remain on Juno; a web URL is only a viewer.

- Each chunk is at most 8,192 bytes; each body at most 750,000 bytes (92 chunks).
- Only the eligible, unblocked author can upload to the current, unfinalized,
  non-withdrawn revision while the workshop is active. No funds are accepted.
- Matching retries are idempotent. Existing chunks cannot be replaced. New
  revisions get independent namespaces; old evidence remains available.
- Finalization checks completeness and the ordered aggregate hash. Partial
  uploads cannot become finalized reviews. Queries return one bounded chunk.
- Client readers verify every chunk, length, UTF-8 decoding and aggregate hash,
  then verify the complete original calculation. Each independent chain source
  resolves its own chunks; no shared unverified external evidence is substituted.
- Migration accepts only workshop 0.3.1 and preserves all old state, including
  finalized hashes and a pending owner transfer. It does not change the Wasm
  admin. Rollback to a reader without attachment support is not an activation plan.

The candidate WASM and its checksum are in `assets/review-candidate/`; current
mainnet/testnet deployment pins and shipped legacy WASM are unchanged. The
candidate is reproducibly built and tested as a migration on isolated Juno.
This PR does **not** migrate a live contract or enable the upload workflow.

Before activation: approve the exact migration artifact/admin, finish the
wallet-facing upload/resume and fee-confirmation flow, test interrupted signatures
and receipts in the browser, then update the deployment pin following the actual
migration receipt. Until those gates pass, oversize reviews continue to stop
explicitly. A capability response alone must not enable writes to unreviewed code.

## Limits and execution

Attachments solve the single text-field constraint, not unlimited storage or
unbounded transactions. The 750 kB decoded evidence ceiling, bounded transport
collections, native action count, transaction bytes, gas, staking locks and
balances remain checked. No criteria/evidence are dropped to fit. No rebalance
is silently split: separate native execution proposals change atomicity and
must be planned and approved explicitly against refreshed state.

Proposal #387 remains a rules-only decision with 100% voting-power cap in its
pinned schema-10 rulebook. It does not authorize fund movements. A later
rebalance still requires approved-rule recognition, fresh observations, complete
execution messages and the separate governance vote.

## Validation recorded before review

- JavaScript verification: format, lint, typecheck, unit tests and repository/
  data checks; Python suite. Browser regression remains a separate CI gate.
- Workshop: 13 Rust tests plus Clippy; old raw storage and pending ownership
  transfer survive migration unchanged. Seven WASM dependency graphs reassessed.
- Real isolated Juno v31 with original programme DAO code: rules pass with no
  fund movements, then the 45-movement rebalance with 12 fixed targets passes and
  reaches the exact targets within one micro-JUNO share rounding. Stored actions
  use 3,376 characters; native text 1,351 bytes. Full-funding submission simulation
  is 3,000,374 gas (4,200,524 with the existing 1.4 reserve).
- The same local chain migrates the original workshop 0.3.1 to the candidate,
  preserves old finalized reviews/admin, rejects incomplete finalization, resumes
  an interrupted upload and recognizes the attached rulebook after native voting.
  The 28,882-byte review uses four chunks; finalization consumes 388,434 gas.
- This is synthetic local execution, not a live approval or a promise about
  future Juno state. No production contract or proposal was changed.
