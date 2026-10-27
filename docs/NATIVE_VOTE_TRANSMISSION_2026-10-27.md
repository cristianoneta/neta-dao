# Native vote transmission and saved-vote continuation

27 October 2026. Candidate; a deliberate website release and owner wallet
acceptance are still required. No live transaction was sent during this work.

## Problem and evidence

A signed native vote remained in the account journal while chain lookups did not
find its hash or the voter's ballot. The stored message decoded as a valid native
MsgVote, the account sequence was still unconsumed, and a read-only simulation of
the message succeeded. That simulation omitted the actual signature; it does not
verify the original signature, establish mempool acceptance, or prove the original
RPC failure reason. The old UI discarded the broadcast error's cause and replaced
vote-specific status guidance with text about submitting another proposal.

## Resulting behavior

- Preserve the actual nested send-error message as plain text in the vote receipt,
  including after reload. Status checks retain that diagnosis and never broadcast.
- Offer **Review saved vote** beside the pending status action. Decode the existing
  account journal, verify its exact SHA-256 hash, canonical transaction/message
  encoding, single native vote, proposal, voter, bounded JUNO fee and ordered
  sequence. Verify the original direct secp256k1 signature against Juno's chain ID
  and the current account number. Refuse a changed/consumed sequence or an already
  indexed transaction; retain the journal.
- Show the actual saved choice, fee, wallet and transaction hash. A separate
  **Send saved vote** click rechecks the proposal, deadline, balance, wallet,
  review age, journal and signature under the same origin/account Web Lock used
  by the other signing bundles. A read-only Stargate client sends only the original
  saved bytes. It never requests another signature or changes the fee.
- Preserve the journal through lost responses and RPC rejections. Only the normal
  independent-source inclusion check resolves the pending vote and removes its
  matching journal. A lookup miss alone never clears the account lock. A sequence
  consumed by another transaction remains unresolved by this feature.
- Add Stavr and Kleomedes ahead of the existing governance connection candidates.
  Connection fallback occurs before sending; there is no automatic transmission
  retry or broadcast fan-out.

This applies only to the existing direct native MsgVote format. It does not add
proposal/deposit resubmission, weighted vote conversion, fee replacement, DAO DAO
voting, or automatic continuation. The previous proposal and swap journals retain
their original behavior.

## Validation and boundaries

SDK tests use real signatures from a synthetic fixture wallet. They exercise exact
byte transmission, wrong network/account, altered vote/fee/signature, consumed
sequences, changed reviews/records, simultaneous tabs, lost responses, rejected
transmissions and failed delivery. The browser regression covers the actual
status/review controls, persistence after reload, cancellation, no transmission on
checking, no second signature and responsive saved-vote reviews. Its chain and
wallet responses are synthetic; it does not establish live wallet acceptance.

Run repository verification, the faucet SDK tests, reproducible signing build and
all required CI gates before integration. Preserve the pending browser records
through publication; the owner chooses whether to send their reviewed saved vote.
