# Personal messaging first — owner continuation, 6 October 2026

## Browser integration checkpoint — 6 October 2026

Continue draft [PR #195](https://github.com/cristianoneta/neta-dao/pull/195),
branch `codex/personal-messaging-recovery-mainnet`. This checkpoint supersedes
older statements below that the controller and real-profile restore are absent.

The personal browser controller now connects real CoreCrypto, the encrypted local
checkpoint, archive, cursor, outbound journal, lifecycle actions and exact-byte
signing bridge. Automatic encrypted snapshots cover all these records together.
The bridge requires a successful backup of the exact signed bytes before broadcast;
failed or ambiguous uploads preserve the attempt and block continuation. Recovery
uses receipts and never automatically retransmits. Restored profiles remain
read-only, including after a rejected rotation, until an explicitly reviewed new
key generation is confirmed. Old generation keys remain available for delayed reads.

A pinned CoreCrypto cache issue was found by the interrupted-decryption test.
Restoration now creates a fresh disposable same-origin WASM runtime before copying
checkpoint blocks; reopening the old runtime could retain an advanced ratchet.
The iframe is runtime isolation, not a security boundary. The unmounted Inbox
component provides recovery-code setup, unlock/restore, history, contact permissions,
review/confirm actions and pending recovery. `relay-personal-session.mjs` wires the
actual wallet/query/backup adapters; its default deployment still fails closed.

Local evidence: **166 root Node tests, 59 signing/faucet tests, seven backup tests
and 22 mailbox Rust tests**. The real-browser integration test exercises create,
registration, send/read/reply, exact ciphertext retry after rejection, pre-ready and
inbound crashes, wrong recovery code, interrupted fresh-profile import, historical
and unread messages, rotation/retired keys, unknown accepted transactions, exact
signed bytes in backup before broadcast, failed backup, lost acknowledgement,
concurrent tabs/profiles and wallet switching. The tested UI creates/registers a real
local crypto profile; desktop/tablet/mobile layouts (1440/768/390/320) were inspected.
Wallet, chain and remote backup transport in this browser test are simulated.
Actual HTTP/ADR-36/SQLite behavior is covered separately by the backup suite.
Inspect the latest PR-head Actions results before integration; local evidence is
not a claim that a newer hosted run passed.

The contract candidate now requires mainnet `sender_generation` and
`expected_previous_generation` at execution, fencing delayed sends and competing
rotations. Candidate v0.4 WASM SHA-256 (Rust 1.81.0):
`835323a60b0d418d0ef88e1fe12c02f8d65cc5c84fcf593135fdb18977f86708`.
The deployed v0.1 WASM asset and UNI-7 pin are unchanged.

**Still not live:** production Inbox mounting/runtime review, backup provider and
budget approval, owner-reviewed mainnet deployment and the consenting two-wallet
mainnet test remain. The deployment pin is null and production SEND is disabled.
No service, cost, wallet transaction or real remote backup was created. Restoring
an unknown transaction without provable inclusion/non-broadcast remains locked;
a fresh profile cannot independently prove a malicious provider's freshness.
Owner upgrade admin, active owned .neta sender policy and disabled DAO write routes
are unchanged. After personal release: shared DAO recovery/mainnet testing, then
payment requests/invoices and Treasury linkage.

## Continuation — 6 October 2026, personal messaging recovery candidates

Continue **draft PR #195**, branch `codex/personal-messaging-recovery-mainnet`.
The former failing browser regression is fixed: its sender recipient field was
empty after the deliberately exercised reload. The adversarial branch now selects
the recipient again. All three checks passed at `3e678e1`; no test was skipped or
weakened. This supersedes the preceding checkpoint's still-running CI wording.

Additional implemented candidates (not mounted in the production Inbox):
- `relay-personal-transport.mjs`: reviewed exact-ciphertext attempts through the
  existing exact-byte signing bridge, durable attempt binding, origin lock,
  generation/consent/block/prekey checks and evidence-only reconciliation. A
  proven rejected signature or included failure allows a separately reviewed
  retry of identical ciphertext; RPC errors/null receipts do not. No automatic
  resend, ratchet rewind after ready, or disposal of an unresolved intent.
- `relay-personal-lifecycle.mjs` and `relay-personal-protocol.mjs`: reviewed
  consent/block/refill/rotation adapters, monotonic prekey checks, immutable
  historical sender identity and generation/mailbox-separated Proteus sessions.
  Local crypto preparation is required through a host callback. The complete
  browser host and rotation activation are still open, not implied by these APIs.
- `relay-backup/` plus `relay-personal-backup.mjs`: isolated provider/codec/client
  candidate, real ADR-36 authentication, client AES-GCM encryption, revision CAS,
  identical-write recovery, quotas and a separate optional Render Blueprint.
  Pilot wallet allowlist required; no faucet environment or signing key is used.
  Provider/cost approval is still outstanding. No service or upload was created.

Validation: 166 root Node tests and six backup integration tests pass locally.
The lifecycle/protocol application head `188fbe8` passed all three hosted checks;
its new real-CoreCrypto browser test covers generation isolation, delayed old-device
reads, new-device reply, replay rejection and historical identity. Backup candidate
head `772dd77` passed hosted backup CI 37516185694 and frontend/contract CI
37516185612; check all final-head runs before integration. Local Chromium download
failed, so browser evidence comes from hosted CI, not a claimed local browser run.

**Still not mainnet-test-ready.** The next implementation is to connect these
modules to one recovery-aware personal controller and its existing signed-byte
journal bridge, capture actual quiescent browser stores automatically, and prove
coherent fresh-profile restoration with real ratchet/archive/outbox/cursor state,
rotation and concurrent profiles. The backup tests use synthetic complete snapshot
objects; they do not prove real-profile restore. Returned restore snapshots are
read-only by default, and that restriction still needs controller enforcement.
A fresh profile has no trusted prior revision watermark; provider CAS alone does
not solve malicious/stale-server rollback. Production runtime/UI review, owner-
reviewed deployment and consenting two-wallet mainnet evidence remain open.

The separate Render proposal is **USD 7.25/month base** (USD 7 compute + USD 0.25
for a 1-GB disk, before tax/possible workspace charges/transfer overages), not a
billing cap. Its README records exact settings and boundaries. Approval does not
make the client release-ready. No mainnet contract, wallet write, remote backup,
hosting cost or authority change occurred. Mainnet deployment pin is still null.
Owner upgrade admin, active owned .neta sender rule and DAO-write lock are retained.
After personal messaging: shared DAO inbox recovery/direct mainnet testing, compact
selector/handling states, then project/milestone payment requests and Treasury links.

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
