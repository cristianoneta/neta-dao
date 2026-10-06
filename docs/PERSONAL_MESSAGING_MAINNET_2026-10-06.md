# Personal messaging first — owner continuation, 6 October 2026

## Owner decision, 20:20–20:22 Europe/Berlin

Prepare and test **personal messaging on Juno mainnet first**. Only afterwards
resume shared DAO mailbox recovery, test that directly on mainnet, integrate the
compact selector/handling states, and implement payment requests. This replaces
the previously required live UNI-7 testing sequence. Local/mock adversarial tests,
recovery requirements and explicit wallet confirmation remain required.

## Implemented candidate, not deployed or mainnet-test-ready

- An encrypted, wallet/chain/contract-bound outbound preparation journal is saved
  before touching CoreCrypto. It includes a quiescent checkpoint. On interruption
  before ciphertext becomes ready, reopen restores that exact pre-send state and
  marks the preserved intent rolled back. A user may compose a new message with a
  fresh ID; the old ID/ciphertext is never automatically regenerated or sent.
- The atomic ready transition removes rollback authority and discards its now
  unusable full DB snapshot. The exact ciphertext and authenticated routing remain.
  Reopening only queries the on-chain message receipt. Accepted messages complete
  local history idempotently; unconfirmed messages stay locked, with no automatic
  retransmission. RPC errors never mean not-sent. Legacy unresolved outbox/archive
  records remain locked and are not discarded by the new recovery mechanism.
- Interrupted registration can be reconciled against the exact prepared device,
  fingerprint and first generation without another signature.
- Account changes immediately clear visible plaintext/code and retain the device
  lock until the in-flight operation reaches durable completion.
- Contract v0.4.0 has explicit `mainnet: true` instantiation for the agreed owner.
  Mainnet binds the production NNS registry at instantiation, requires active
  sender name ownership and keeps all DAO execute routes disabled. Owner update
  at 20:37 explicitly removes the former 5-NETA staking condition: there is no
  stake query, minimum stake or additional messaging fee. Existing consent,
  blocking, no-funds and prekey/cooldown limits remain. Failed eligibility checks
  happen before prekeys or inbox state are changed. Expired names, transferred
  names, absent names and failed registry queries cannot send.
- `PersonalMailboxClient` separates network/deployment identity from the unchanged
  UNI-7 compatibility wrapper. Mainnet verification additionally checks admin,
  exact code ID/hash and immutable contract policy; signing RPC identity is checked.
- `relay-personal-network.mjs` deliberately has a **null deployment** and produces
  **not-ready-to-sign unsigned preparation**. No mainnet address is invented. The
  production Inbox SEND remains disabled and the crypto lab is still UNI-7-only.

Candidate WASM SHA-256 (Rust 1.81.0, `scripts/build-wasm.sh`):
`ec8650278f5ce4dd3c587154581caeec20f7ff9e0d6d6d5903f4cb2712720c45`.
No replacement of the deployed v0.1 asset/pin; a new reviewed instance is required.
No migration entrypoint is provided by this candidate. Future migrations require
compatible migration code and state-preservation tests. The new instance must
retain owner wallet `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57` as upgrade admin.

## Remaining work before wallet testing

1. Connect consent, prekey refill and reviewed rotation, with generation-scoped
   sessions and historical identity lookup, to the personal crypto controller.
   The shared query/registration adapter alone is not a mainnet crypto client.
2. Finish ready-but-not-included handling using exact signed transaction evidence,
   including wallet rejection/failed transaction outcomes. Current behavior keeps
   these intents locked instead of guessing whether a resend is safe.
3. Implement automatic off-device backup. Provider and hosting approval are still
   unresolved from the agreed recovery decision. Local checkpoint recovery does
   not protect against loss of browser storage. Do not advertise it as backup.
4. Complete fresh-profile restore, coherent archive/cursor/ratchet/transaction
   state, stale-backup and concurrency tests; review production runtime/security.
5. Prepare the concrete reviewed upload/instantiate UI only after the above gates.
   The owner signs each mainnet transaction. Verify the deployed code/config/admin,
   record the real address, then test with two consenting wallets. No real-wallet
   evidence is supplied by mocked browser tests.

Proposed next backup action for owner decision: a dedicated Render service with
persistent storage, isolated from the faucet signing service. Store only client-side
ciphertext. Wallet-signed authentication, bounded storage, revision compare-and-swap,
failed-backup visibility and recovery-code protection are required. No service was
created, no hosting fee approved and no data uploaded. A concrete service deployment
and retention/budget choices still need preparation; this is not a finished service.

## Validation

Local: 155 root Node tests, 20 mailbox Rust tests, format/Clippy with warnings denied,
and reproducible WASM build pass. Chromium download is unavailable in this executor;
real browser validation runs in the repository's existing CI. Browser regression
now injects interruption after encryption but before ready persistence and loss of
an accepted broadcast response, proving rollback and receipt reconciliation without
an extra send. Final hosted results are recorded in the PR/checkpoint.

## Sidequest

PR #194 hides exactly UNI-7 Juno workshop #1 `Make Cristiano the new Senator` and
#2 `Testing 1` by default, with `Show test reviews` access. Matching includes the
contract, ID and title. Other workshops and mainnet proposals are unaffected.
No chain record is deleted. Both applicable PR checks passed before integration.

Payment requests remain in scope after shared DAO inboxes: project/milestone,
evidence, fixed payee, amount/token/category, reviewed payment proposal, distinct
execution/payment confirmation and Treasury linkage. No automatic payout or
additional NNS fee is approved.
