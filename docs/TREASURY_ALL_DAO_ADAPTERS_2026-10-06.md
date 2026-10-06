# Accounting adapters for every configured DAO — 2026-10-06

The owner asked to connect Operations and Juno Community Pool after clarifying
that the shared Treasury UI did not mean accounting was connected for every DAO.

## Implemented

- The canonical DAO directory now configures each accounting file, adapter, scope
  and treasury accounts. Frontend accounting and event identity checks apply to
  Operations (Juno core + Osmosis proxy), NETA main DAO and native Juno separately.
- Operations now feeds both date-bounded receipt sources into a generated accounting
  ledger. A recent successful review with no observed post-cutoff movements permits
  **provisional** zero income/expenses/result. Any unknown movement, source failure,
  missing account or stale refresh blocks totals. Older undated exports remain intact
  and are excluded only when their heights predate the verified accounting scan floor.
- The native Juno adapter verifies the distribution module account, scans successful
  `MsgFundCommunityPool` receipts from 1 October, matches exact bank-transfer legs,
  and checks passed governance proposals for Community Pool spend messages, including
  legacy wrapped spend proposals. Ordinary distribution-account bank transfers are
  deliberately excluded: that account also holds validator rewards.
- Direct protocol-evidenced contributions are **funding**, outside operating income.
  Passed spending proposals are execution candidates, not booked payments: voting
  end time is not substituted for actual execution time or payment-time USD price.
- Community Pool block allocations, rounding, burns and drip/module payouts remain
  explicit coverage gaps, so an empty transaction index cannot create zero P&L totals.
  Native accounting is connected/partial, not complete. NNS account rows remain NETA-only.
- Juno's public API returned HTTP 500 (`nil pointer dereference`) on the second
  governance page. Successfully observed recent proposal records are retained with
  an explicit older-catalogue coverage warning. Failed first-page reads fail the
  refresh; known prior candidates are retained when later pages are unavailable.
- The existing 15-minute Treasury workflow collects Operations and Community Pool
  independently with bounded subprocesses and writes failure status while preserving
  prior evidence. A balances failure cannot suppress accounting refreshes. No new
  schedule, server, wallet write, contract change or paid service was introduced.
- Receipt scan watermarks are bound to account/chain and query profile. An adapter
  query change triggers full replay from the October scan floor, never reuse of an
  incompatible incremental watermark.

## Still open (do not call all-DAO accounting complete)

1. Native block/module accrual and payout reconstruction, with authoritative payment-time
   pricing and opening/closing reconciliation. Community Pool totals stay unavailable.
2. Approved proposal-purpose metadata binding to real execution legs and historical USD
   valuation for Operations and main NETA. Direction, title and proposal passage are
   insufficient. The existing category dropdown still captures planned purpose only.
3. Live main-DAO writes remain disabled; no proposal/contract/admin action was sent.

## Validation

Local: 130 Node tests and 54 targeted Python tests passed, covering account isolation,
empty Operations reviews, stale/failed/missing sources, unclassified movements,
cutoff preservation, exact Community Pool funding legs, failed/duplicate transfers,
governance pagination and evidence retention. Browser coverage is extended to both
new adapters, all three DAO switches, foreign identity failure and 320/390/768/1440 px.
Hosted CI, deployment and live collector results will be recorded after publication.
