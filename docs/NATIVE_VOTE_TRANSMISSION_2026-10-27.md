# Native vote transmission and saved-vote continuation

27 October 2026. PR #325 was published in release 40577870252 at source
`61bec3235e8fd9c3471bb34f334bda8ceba7ea85`. The owner then tested the saved vote and
reported the admission error described below. The gas correction remains a source
candidate requiring deliberate publication and owner wallet acceptance. The agent
did not sign or transmit a live transaction.

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
proposal/deposit resubmission, weighted vote conversion, DAO DAO voting, or automatic
continuation. The higher-gas follow-up below adds a separate, explicit fee review.
The previous proposal and swap journals retain their original behavior.

## Confirmed admission error and gas follow-up

The published continuation returned BroadcastTxError, SDK code 11, with an
out-of-gas failure at WriteFlat: gasWanted 101682, gasUsed 102520. This is a CheckTx
rejection, not a DeliverTx receipt. Read-only chain checks still found the original
account sequence and no included hash. The reported gasUsed is the failure point,
not an estimate of the full gas needed. The original estimate times 1.4 was too
small for this signed transaction; a successful unsigned simulation had not
established admission with the signed fee and gas limit.

New native votes use max(250000, ceil(estimate × 1.8)), with an enforced final
2,000,000 gas ceiling and the existing 0.075 ujuno/gas price. A replacement also
requires at least ceil(previousGas × 1.5). The floor's reviewed fee is 18750 ujuno.
These bounds are product limits, not a guarantee that every future state fits.

After an out-of-gas error, Review higher gas displays the unchanged proposal and
choice, old/new gas limit and exact new fee. Confirm higher gas in Keplr requests
a new signature, pinned to the original chain, account number and ordered sequence.
The signed body must be identical; only the reviewed fee may change. Full signature,
current-sequence, wallet/context, balance and voting checks run again. Another
transaction consuming that sequence blocks replacement. One RPC rejection never
serves as permission to sign at a later sequence or change the ballot.

Keep the original journal unchanged during wallet confirmation. Before any new
broadcast, archive its exact signed bytes under the original hash, verify durable
storage, then checkpoint the replacement as the active shared journal. Its explicit
predecessor link repairs a UI receipt interrupted between the two storage writes.
RPC errors keep both attempts. A resumed replacement sends its saved bytes without
another signature; cancelling or rejecting Keplr preserves the original attempt.
Either ordered variant can consume the sequence; both cannot execute their vote.

## Validation and boundaries

SDK tests use real signatures from a synthetic fixture wallet. They exercise exact
byte transmission, wrong network/account, altered vote/fee/signature, consumed
sequences, changed reviews/records, simultaneous tabs, lost responses, rejected
transmissions and failed delivery. The browser regression covers the actual
status/review controls, persistence after reload, cancellation, no transmission on
checking, no second signature and responsive saved-vote reviews. Its chain and
wallet responses are synthetic; it does not establish live wallet acceptance.
The existing required faucet workflow runs the delegation/native-governance
browser runner, including this saved-vote regression.

The gas follow-up adds SDK signature/storage/concurrency regressions and a browser
case covering a legacy gas error, higher-fee review, cancellation, wallet rejection,
interrupted receipt repair and subsequent continuation without another signature.
The pinned local Juno execution gate now exercises low-gas CheckTx rejection,
unchanged sequence/balance after rejection, inclusion with the reviewed vote fee,
and rejection of another adequately funded signature at the consumed sequence.
All chain writes in that gate are confined to its ephemeral loopback chain.

Run repository verification, the faucet SDK tests, reproducible signing build and
all required CI gates before integration. Preserve the pending browser records
through publication; the owner chooses whether to send their reviewed saved vote.
