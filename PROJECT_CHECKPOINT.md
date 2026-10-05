# NETA DAO checkpoint index

Updated **2026-10-04, end of session**. Start with [HANDOFF](HANDOFF.md), then
[CURRENT_STATE](docs/CURRENT_STATE.md). This file lists open priorities; detailed
release evidence belongs to the linked runbooks, not another duplicate chronology.

1. **NNS live validator test:** registration/profile/renewal/transfer and the
   validator UI are delivered. A consenting operator is the external dependency.
   Verify link, exclusive bindings, unlink/revoke and exact receipts. Preserve the
   current deployment and browser data. [NNS handoff](docs/HANDOFF_NEXT_CHAT_NNS_2026-10-04.md).
2. **Faucet evidence:** verify a real 25-JUNOX payout, repeat rejection, persistent
   cooldown after restart, empty-recipient behavior and stake/unstake receipts.
   Service funding/integration and reward/donation evidence already exist.
   [Faucet handoff](docs/HANDOFF_NEXT_CHAT_FAUCET_2026-10-04.md).
3. **Delegation programme:** retain approved parameters; use verified operator
   links plus independent validator and active-consensus snapshots. No automatic
   points from a stored link. Smart Delegation research stays deferred until the
   NNS gate is resolved. [Decisions](docs/NNS_VALIDATOR_PROFILES_2026-10-04.md).
4. **Names production gates:** real quote feeds/policy, signer custody/service,
   reviewed mainnet governance/deployment and wallet E2E. Main workspace writes
   remain disabled; separate UNI-7 tests are not a mainnet release.
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
No new deployment, wallet transaction or operator outreach is required to close
this documentation maintenance session.
