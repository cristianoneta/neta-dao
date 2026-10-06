# NETA DAO checkpoint index

Updated **2026-10-06**. Start with [HANDOFF](HANDOFF.md), then
[CURRENT_STATE](docs/CURRENT_STATE.md). This file lists open priorities; detailed
release evidence belongs to the linked runbooks, not another duplicate chronology.

1. **Treasury accounting:** finish the receipt-backed P&L release in
   [accounting continuation](docs/TREASURY_ACCOUNTING_2026-10-06.md), then extend
   historical coverage, expense/funding classification and payment-time prices.
   NNS first purchase and UI release are complete; do not repeat deployment or payment.
   Validator live tests remain deferred. The separate UNI-7 tariff receipt is still
   outstanding; it is not a prerequisite for read-only Treasury work.
2. **Faucet evidence:** verify a real 25-JUNOX payout, repeat rejection, persistent
   cooldown after restart, empty-recipient behavior and stake/unstake receipts.
   Service funding/integration and reward/donation evidence already exist.
   [Faucet handoff](docs/HANDOFF_NEXT_CHAT_FAUCET_2026-10-04.md).
3. **Delegation programme:** retain approved parameters; use verified operator
   links plus independent validator and active-consensus snapshots. No automatic
   points from a stored link. Smart Delegation research stays deferred until the
   NNS gate is resolved. [Decisions](docs/NNS_VALIDATOR_PROFILES_2026-10-04.md).
4. **Names remaining evidence:** mainnet renewal/transfer and a consenting live
   validator E2E remain unverified. Preserve owner administration, the existing
   signed-price key, 24-hour validity and browser journals.
5. **Messaging release gates:** generation-aware sessions and consent/prekey refill
   against isolated v0.2 fixtures; full rotate/revoke/exhaustion/history tests;
   authenticated coherent backup and anti-rollback; wrong-code/corruption/stale/
   fresh-profile/concurrent restore tests; reconciliation of legacy and uncertain
   outgoing state. Only then plan authorized live-wallet E2E. Never erase journals.
   [Implementation plan](docs/RELAY_IMPLEMENTATION_PLAN.md).
6. **Data and UI follow-up:** inspect collector timestamp lag; preserve partial
   valuation and unavailable history labels; continue accounting coverage,
   governance pagination/policy and per-page accessibility. Measure performance
   before restructuring bundles or polling. [Maintenance review](docs/MAINTENANCE_CHECKPOINT_2026-10-04.md).

Mainnet messaging, native Juno proposal submission/voting, Treasury execution,
contributor-role/payment services and automatic remote recovery remain unfinished.
Do not repeat the completed mainnet deployment. Preserve journals and verify
existing receipts before any further owner-wallet action.
