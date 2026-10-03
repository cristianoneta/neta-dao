# NETA DAO Workspace checkpoint

Updated: **2026-10-03** after the interrupted chat. This is the continuation index;
[CURRENT_STATE](docs/CURRENT_STATE.md) owns the feature inventory and
[HANDOFF](HANDOFF.md) owns navigation and working rules.

## Completed and verified

- #100: signing denomination, async context, Treasury pricing and dependency fixes.
- #101: transactional local receive recovery, invalid-ciphertext isolation and
  sender/generation-scoped archive identity; adversarial browser checks passed.
- #102: v0.2 recipient consent and historical identity **source only**; Rust/audit
  and WASM checks passed. The pinned live UNI-7 v0.1 artifact is unchanged.
- #103: guarded shared signing bundle, moderation/depth/cycle protection and
  anchored Treasury scans with full-replay fallback. Final CI passed.
- #104 / Website #139: integration evidence. Resumed verification confirmed the
  PR-head checks, successful Pages deployments and 23 matching production files.
- Treasury run 934 successfully ran the final source and retained 57 events.
  PARTIAL valuation and three cached Osmosis transactions missing from the current
  index remain explicit limitations; no generated exports were hand-edited.

Exact runs and deployment hashes: [security continuation](docs/SECURITY_CONTINUATION_2026-10-03.md).

## Next work, in order

1. Implement and test generation-aware sessions and consent/prekey replenishment
   against isolated v0.2 fixtures. Cover rotating unapproved senders, depleted
   prekeys, historical unread messages, collisions, revoke and concurrent use.
   Prepare a separately verified UNI-7 deployment plan; do not repin or deploy
   source-only changes as if they were already active.
2. Specify authenticated automatic backup provider, versioning, synchronization
   and anti-rollback policy; implement a coherent snapshot of ratchet, archive,
   outbox, cursors, vault and descriptor. A recovery code alone is not a backup.
   Fresh-profile and stale restores must not silently resume sending.
3. Test wrong wallet/code, corruption, rollback, already-read history, newer inbound
   messages, interrupted writes and concurrent tabs/devices using synthetic keys.
   Resolve legacy intents without checkpoints and uncertain outbound state by
   verified reconciliation; never clear pending records simply to unblock the UI.
4. After these gates, prepare the live E2E runbook for a separately authorized
   wallet session. **This task prohibits real wallet keys and live attack
   transactions.** The old immediate-real-wallet-test instruction is superseded.
5. Continue accounting completeness, governance policy/pagination and measured
   efficiency work without describing partial data as a complete ledger.

Mainnet messaging and the main composer SEND remain disabled. Production release
also needs reviewed mainnet stake/network policy, client/distribution review and
independent security review. Native Juno submission/voting, Names activation and
Treasury execution are separate unfinished features.
