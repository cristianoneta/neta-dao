# DAO inbox candidate — 6 October 2026

Status: **implemented and locally tested source candidate, not deployed or enabled**.
The main workspace does not import or mount the new component. No DAO inbox appears
for a real user until a verified deployment and recovery-capable crypto integration
are available. The existing v0.1 UNI-7 address, artifact, transaction journals and
mainnet send locks are unchanged. No invoice/milestone feature is activated.

## Implemented candidate

- Mailbox contract v0.3 adds an immutable, registrar-assigned `.dao.neta` identity
  with an explicit DAO authority and curated CW4 membership source. There is no
  ordinary transfer or overwrite API. This is a DAO namespace in the mailbox,
  not a new entry in the deployed personal NNS registry.
- Every DAO inbox defaults to disabled. Only a transaction executed by the DAO
  authority may configure selected readers or all current members and managers.
  The registrar cannot opt a DAO in. Configuration is exported as a proposal action.
- Membership is queried on every send/permission action. Removed members are
  excluded even if configuration revision is unchanged. Incoming encrypted packets
  must match the exact current recipient set and current device generations and
  fingerprints. Stale sets, missing/additional/duplicate recipients fail before writes.
- Each shared message has one canonical DAO record with independent per-device
  ciphertext envelopes. A reply records both the DAO scope and the actual member
  author. New readers have no envelope for older records. Public chain queries
  expose routing metadata and ciphertext; hiding a UI is not confidentiality.
- One conversation per correspondent account, chronological history, shared
  open/assigned/answered status, compare-and-swap assignment and reply revisions.
  A confirmed reply marks answered; merely reading does not.
- DAO authority/current managers can block accounts. Blocking bumps policy revision
  to invalidate pending preparations. Departure removes manager permissions too.
- Registry binding is one-time. DAO send/reply requires the actor's active personal
  NNS identity and checks name ownership/expiry against that registry. Binding also
  adds the active sender-name gate to the existing personal sends. Existing v0.2
  consent and protocol cooldown/prekey/size bounds are retained, not weakened.
- Scoped Proteus envelopes bind contract, DAO name, policy revision, correspondent,
  author, recipient, generations/fingerprints, message ID and reply direction.
  Session IDs separate DAO and personal conversations. No new encryption primitive.
- Exact durable ciphertext transport checks chain/code verification, current
  recipient devices and conversation revision before signing. Uncertain broadcasts
  stay in the outbox; confirmed sends reconcile without a second transaction.
- A dependency-injected UI component places the mailbox selector beside Inbox.
  It only lists enabled accessible DAOs, hides when no DAO is available, groups by
  account, and places take/release and blocking behind explicit action reviews.
  It clears plaintext immediately on account changes and access-refresh failures;
  delayed replies cannot repaint the previous account's conversation.

## Supported membership and bounds

This candidate supports **CW4 weighted member groups only**, initially suitable for
an Operations-style DAO. Native Juno governance and staked-token membership need
separately verified adapters. Do not bind Juno's Community Pool or an arbitrary
mainnet group to this UNI-7 test instance. Reporting hierarchy grants no authority.

All-members enumeration is bounded at 32 entries. Larger groups must select up to
32 current readers. A reply can add one external correspondent. These are testnet
packet/gas bounds, not a proposed paid tier or an extra product sending quota.
Actual gas/storage measurements remain pending. Existing ten-second protocol
cooldown and maximum 4096-byte ciphertext per recipient remain in force.

## Critical recovery finding

The real CoreCrypto browser test found that session creation can persist after a
transaction callback throws. Do **not** claim the library transaction alone rolls
back an entire batch. `prepareDaoPacket` writes a durable outbox intent before any
crypto mutation; a partial failure keeps it unresolved and blocks every new prepare.
This is fail-closed behavior, not a finished recovery experience. Never delete or
reset that journal as a workaround. A coherent checkpoint/restore integration is
required before mounting the component for users. Decryption likewise requires
the existing authenticated archive/checkpoint discipline; `readable` must come
from a verified recovery-aware provider, never arbitrary chain fields.

## Validation

- Rust 1.81.0: all 18 mailbox tests pass (12 new DAO cases), format and Clippy with
  warnings denied pass; release WASM built using `scripts/build-wasm.sh`.
- Eight Node tests cover envelope substitution, stable grouping, proposal scope,
  current roster/wallet checks, outbox reconciliation, deployment verification and
  review tampering/revocation.
- Isolated browser uses real shipped Wire CoreCrypto with four independent device
  databases: two-recipient send, reply, removed/new readers, wrong DAO scope and
  a partial-encryption failure whose durable intent prevents unsafe retry.
- UI browser fixtures cover 100 messages grouped into one correspondent, reviewed
  action with no early submission, membership removal, delayed decryption during
  wallet change, and 320/390/768/1440 px layouts. These are synthetic identities and
  chain adapters used only in tests, not published DAO records or live wallet evidence.

## Artifact and continuation

Reproducible candidate: `neta-relay-mailbox` v0.3.0, 498964 bytes, SHA-256
`ad578110fcaa418bfb00b8c9c88e46b941a01eb1506dcccc1ae4ae5af7e4e104`.
The Build contract WASM CI job publishes its reviewed candidate artifact. Do not
replace `assets/neta_relay_mailbox.wasm` or the v0.1 setup helper/pin with this file.

1. Complete coherent multi-recipient outbound and inbound crash recovery, archive
   scopes/cursors, history reload, prekey refill and rotation behavior. The new
   components deliberately remain unmounted while these release gates are open.
2. Use a **new UNI-7 deployment**; no migration path is implemented. Retain explicit
   upgrade admin `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`. The instantiate sender
   becomes the namespace registrar. User signs upload/instantiate in Keplr; do not
   deploy immutable or write to mainnet. Pin creator, chain, code hash and instance.
3. Registrar binds the verified UNI-7 NNS registry once and assigns a test DAO/CW4
   group. The test DAO itself executes its opt-in configuration. Verify a wrong
   wallet, registrar-only activation, stale membership and stale device are rejected.
4. Complete real two-wallet (plus member replacement) UNI-7 end-to-end evidence,
   encrypted archive restart, unknown-broadcast reconciliation and gas measurements.
   Then wire a reviewed adapter into the main Inbox; `DAO_INBOX_DEPLOYMENT` stays
   null until this is actually done.
5. Native/staking membership adapters, name-resolution routing to DAO inboxes,
   personal blocking UX, full DAO administration UI and backup/recovery release
   requirements remain separate work. Mainnet activation requires the existing
   security gates in `RELAY_RECOVERY_DECISION.md` and `SECURITY_CONTINUATION_2026-10-03.md`.

This checkpoint supplies working protocol/components and executable tests; it is
not a claim that the complete requested DAO mailbox feature is ready for users.
