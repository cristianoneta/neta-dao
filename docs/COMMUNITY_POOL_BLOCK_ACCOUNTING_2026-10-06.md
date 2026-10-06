# Juno Community Pool block accounting

Status: live after PR #185 on 6 October 2026; successful production collector and
deployment evidence are recorded in the current handoff. Accounting begins
1 October 2026 UTC.

## Evidence and interpretation

`scripts/community_block_ledger.py` reads Juno `block_results` in bounded batches
of ten, using six workers and a shared connection pool. It reconstructs the
distribution allocation from the fee-collector-to-distribution transfer less the
sum of emitted validator `rewards` in BeginBlock. Commission is already included
in those rewards and must not be deducted again. Arithmetic retains 18-decimal
SDK precision, including the residual allocation rounding.

References: [SDK allocation](https://github.com/cosmos/cosmos-sdk/blob/v0.53.7/x/distribution/keeper/allocation.go),
[delegation withdrawals](https://github.com/cosmos/cosmos-sdk/blob/v0.53.7/x/distribution/keeper/delegation.go),
[Community Pool spending](https://github.com/cosmos/cosmos-sdk/blob/v0.53.7/x/distribution/keeper/fee_pool.go).
The inspected Juno source uses Cosmos SDK 0.53.7. Unexpected allocation shapes
stop collection rather than applying a guessed rate.

The distribution module account holds both Community Pool funds and validator
rewards. Its ordinary outgoing bank transfers are not automatically Pool expenses.
Successful transactions involving it are retained with their relevant message,
withdrawal and transfer context. Other block-level transfers are retained as
unclassified evidence. A governance proposal passing is not a payment receipt.

Every scanned height is included. Exact start-of-day block boundaries are found
from block timestamps; chunks never cross UTC dates. Stored ranges include start
and end block hashes and a SHA-256 digest over ordered block-result hashes. An
initial UTC cutoff is found from block headers; continuation verifies the previous
end anchor and appends only contiguous ranges. Data comes from the named public
RPC provider; this is not an independent light-client consensus proof.

## Projection and pricing

`community_statement.py` projects allocations into separate schema-v3 entries,
without routing fractional SDK coins through integer bank-receipt parsing.
Entries retain quantity, denomination, range and source. Treasury events show
Community Tax with a block link. The shared monthly/yearly P&L aggregates them.

Historical USD is a cached CoinGecko observation at or within one hour before
UTC midnight of the allocation date. It is a daily opening reference, not an
execution price. The quantity and price are multiplied using decimal arithmetic;
the UI validates the fixed-point conversion. Missing quotes remain `null`, never
zero, and observed USD subtotals remain labelled partial. Existing valid daily
quotes are reused, avoiding repeated historical price requests.

## Operation and recovery

The existing 15-minute Treasury workflow runs the scanner with a 180-second budget,
then builds receipt and tax statements. It retains the latest complete chunk even
if a later RPC request fails. Initial backfill can be run with a larger time budget;
normal collection starts after the saved last height and does not rescan October.
The block ledger and price cache are collector-owned generated JSON files. The
block ledger is stored as deterministic gzip (`juno-community-blocks.json.gz`),
without dropping evidence; this avoids committing megabytes of repeated event
attribute names at every checkpoint. The browser reads only the projected files.
The scanner step has a five-minute hard timeout in addition to its normal budget.

Funding refresh preserves previously published block events until their replacement
statement succeeds. Statement failures retain previous accounting entries. Block
evidence older than two hours is explicitly marked stale. The UI rejects foreign
treasury identity, duplicate records/denominations, overlap and coverage mismatches.
Existing asset snapshots and unrelated DAO histories are preserved.

## Remaining limitations

The tax allocation series does not yet reconstruct withdrawal dust, validator-removal
remainders or all other module income. Successful spends must be matched to actual
execution and approved categories before expense posting. Full module balance
reconciliation and complete expenses/operating-result totals remain unavailable.
Since PR #187, provisional recorded totals are allowed after a per-message audit
of distribution outflows against SDK reward withdrawals finds no unmatched spend.
Zero Other income means no other recorded income; unmeasured module rounding is
explicitly excluded. These are not full reconciled totals. Delegation Programme
reward accrual is now daily and claim-adjusted from its first retained snapshot
on 6 October. Earlier October rewards and slashing reconciliation remain open.

Pool snapshot differences can support an estimate after adding payouts and removing
other inflows, but are not themselves tax receipts. Daily snapshot timestamps do not
align to October's UTC opening boundary. No snapshot estimate is blended with this
evidenced tax series, and no current tax rate is retroactively applied.
