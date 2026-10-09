# Daily staking rewards recovery

Reviewed 9 October 2026. Code candidate only; collector installation and live
backfill remain open. Current holdings refresh independently of daily reward
accounting, so a fresh balance does not establish successful accrual.

## Cause and verified source

The REST historical query failed with pruned state at the first missing UTC
boundary. The existing Juno RPC's public ABCI query returned code zero and the
exact requested height for the retained checkpoint and all three missing daily
boundaries. A second RPC reported pruning and was rejected. No current-state
response is accepted as historical evidence.

`staking_reward_rpc.py` queries only DelegationTotalRewards and
DelegatorWithdrawAddress. Responses have a 12-second request timeout and 512 KiB
limit; JSON-RPC errors, nonzero ABCI codes, missing/different heights, malformed
protobuf and a different withdrawal owner fail closed. SDK LegacyDec protobuf
amounts use integer strings scaled by 10^18. The adapter converts them exactly,
then the existing validator-level truncation and aggregate reconciliation apply.
No new dependency or paid provider is introduced.

The retained height 42430022 reproduced both reward denominations. Boundaries
42442228, 42472554 and 42506029 closed the remainder of 6 October, 7 October and
8 October respectively. The implementation reproduced the independently decoded
interval arithmetic in an isolated archive. This is provider-backed evidence,
not a cryptographic state proof or a guarantee of future archive retention.

## Resumable collection

Each run closes at most three missing UTC days. It starts no further interval
after a 90-second soft budget; existing individual request and collector-process
timeouts still bound work already started. Each verified interval is atomically
saved before the next query, so a later failure retains completed progress.
Another run can resume on the same day. An exhausted budget reports pending work
even when no interval was added. A caught-up run does not duplicate an interval.

Existing opening balances are retained and excluded from income. Each interval
uses closing withdrawable rewards minus opening rewards plus recorded claims.
The existing receipt-feed coverage gate and stored-claim reconciliation remain
required. The receipt feed is explicitly PARTIAL; no exhaustive October history
or independent complete transaction scan is asserted. Unexpected decreases,
changed claims, unavailable boundaries or wrong identity stop collection.

The Treasury child task publishes verified partial progress and then exits with
an error if accrual is unavailable or still catching up. Accounting coverage is
UNAVAILABLE or CATCHING_UP accordingly. The source checker separately rejects
failed, stale or incomplete accrual even when current holdings remain fresh.

## Validation and live acceptance

Regression tests cover decimal scale, validator-level truncation, malformed
responses, exact heights, withdrawal ownership, bounded same-day resumption,
checkpoint retention after failure, exhausted budgets, receipt coverage and
accounting health. The full Python suite passed locally. Repository CI is a
separate integration gate.

Install only reviewed collector/checker changes while preserving existing data,
credentials and the shared collector lock. A website release does not install
them. Observe normal scheduled collection, verify retained interval continuity
and compare published accounting with the source archive. Historical daily USD
prices remain a separate valuation input; missing prices are not invented.
Two actual scheduled cycles and independent backup retention still require
operational acceptance. No schedule, key, payout setting or public messaging gate
is changed by this patch.
