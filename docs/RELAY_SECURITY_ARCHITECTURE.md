# RELAY security requirements and implementation boundary

Reviewed 2026-10-02. This is a threat model and release-gate document, not a
claim of an audited implementation. [CURRENT_STATE.md](CURRENT_STATE.md) and
[RELAY_IMPLEMENTATION_PLAN.md](RELAY_IMPLEMENTATION_PLAN.md) inventory actual code.

Main RELAY has a disabled, non-persisting composer. A separate UNI-7 encrypted
lab is shipped with GPL Wire CoreCrypto 10.5.3 Proteus, local encrypted storage
and Keplr registration/send. Two-profile CI uses mocked chain/wallet services;
no live two-wallet E2E has been recorded. Mainnet messaging is not implemented.

## Threat model and intended guarantee

Payload encryption is intended to protect message contents from chain/RPC/
index observers. Sender/recipient, timing, frequency and approximate ciphertext
size remain public. Unlocked/compromised devices, extensions, dependencies,
malicious builds, recipient screenshots and social engineering are outside
that guarantee. Forward secrecy/post-compromise recovery are protocol goals;
lab tests are not an independent proof of those guarantees. Never claim perfect security.

## Identity and envelope

Wallet signing keys are not encryption keys. Device keys are generated locally;
Keplr registration binds public fingerprint/prekeys to `info.sender`. Before
initial encryption, verify the actual remote Proteus fingerprint against the
recipient registration; recheck wallet/network/contract/generation before send.
The lab encrypts an inner envelope containing chain, mailbox, sender/recipient,
generations, fingerprints and message ID and checks it against public state.
A `.neta` alias is an address convenience, not key trust.

The current contract exposes only latest devices. The lab rejects old-generation
sender messages after rotation. Historical proof, rotation/revocation UX and
prekey refill must be designed before claiming supported device replacement.
One active device per wallet is the current contract model; multi-device/groups
are not supported product features.

## Contract boundary: implemented versus required

Implemented in `contracts/neta-relay-mailbox/src/lib.rs`: hardcoded `uni-7`;
no attached funds; one current registration; generation increments on register/
revoke; bounded prekeys; atomic initial-prekey consumption with ciphertext storage;
message-ID deduplication; public inbox/device/sent queries; blocklist;
10-second sender cooldown; 4096-byte ciphertext limit; 50-entry query limit.
The contract stores opaque ciphertext and does not perform encryption or verify
its decrypted envelope. Gas fees are separate from attached application funds.

**Not implemented:** mainnet network configuration, stake queries or a 5-NETA
gate, historical registrations and a production migration/recovery policy.
The agreed future mainnet policy requires at least 5 actively staked NETA at
registration/send, with independent review. The current crate cannot simply be
instantiated on `juno-1`; it rejects that chain.

## Local state, crash and recovery

The lab wraps a random DB key, stores encrypted CoreCrypto state and separately
archives readable text encrypted under an HKDF-derived key. Public descriptors/
registration intent live in localStorage; secrets and plaintext do not. Outbox
contains ciphertext and public metadata. Same-origin tabs use Web Locks; these
do not coordinate devices/profiles.

Intent is persisted before ratchet send/decrypt work; unresolved state blocks
continuation. Ratchet, outbox and archive are separate stores, not one atomic
transaction. Their failure recovery needs more review and a reconciliation UX.
A green reload test is not complete crash-window/rollback recovery.

The agreed [recovery direction](RELAY_RECOVERY_DECISION.md) is automatic encrypted
off-device backup of current state plus a separate readable-history archive,
unlocked by a generated high-entropy code. It is not implemented. Provider,
versioning, authentication, sync, retention and anti-rollback remain open.
Keplr alone cannot recreate messaging keys. A stale restore must not send before
safe reconciliation/fresh registration. Backup plus code exposes archived text;
used ratchet keys remain deleted. Messages after the last confirmed backup may
be lost. Local lab unlock does not recover erased browser data.

## Browser and release gates

Lab CSP uses same-origin scripts and the narrow `wasm-unsafe-eval` allowance,
not broad `unsafe-eval`. Main page CSP/runtime remain separately gated. Render
message text through text nodes. Review dependency provenance, vendor hashes,
GPL obligations, XSS/CSP and wallet/tab isolation against the actual build.

Before main application messaging: real two-wallet UNI-7 exchange/reply/reload,
measured gas/storage, authenticated identities, replay/out-of-order/lost-message
and crash-state testing, usable encrypted backup/recovery and independent client
review. Before mainnet: new reviewed stake/network policy, contract/client audit,
resolved findings and explicit activation approval. No documentation edit, mock
CI result or Pages deployment satisfies those gates by itself.
