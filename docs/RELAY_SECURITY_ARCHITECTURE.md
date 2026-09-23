# RELAY security architecture

Status: design gate for UNI-7 implementation. The current frontend composer is a
non-persisting interaction shell; no messaging contract is deployed or connected.
Messaging must remain disabled on mainnet until every release gate below is satisfied.
The implementation sequence and current library evaluation are in
[`RELAY_IMPLEMENTATION_PLAN.md`](RELAY_IMPLEMENTATION_PLAN.md).

## Security claim

RELAY must never be presented as perfectly or “110 percent” secure. Its intended guarantee is that only devices authorized by the sender and recipient can decrypt message contents, assuming their devices, wallets, implementation dependencies and random-number generators are not compromised. Public-chain metadata cannot be hidden by payload encryption.

## Threat model

RELAY protects message content against chain observers, RPC operators, indexers and an attacker who later obtains an old session key. It does not conceal sender and recipient addresses, transaction timing, ciphertext size or messaging frequency. It does not protect an unlocked or malware-infected device, a malicious browser extension, compromised build infrastructure, social engineering or screenshots made by a recipient.

## Identity and devices

- A wallet address is the account identity, but its wallet signing key is never used directly as an encryption key.
- Every device creates separate encryption and signing keys locally with a cryptographically secure random-number generator.
- A Keplr-signed registration transaction binds the Proteus identity fingerprint, protocol version, device identifier and prekey material to `info.sender` on UNI-7. The transaction signature proves wallet control; a separate arbitrary-message signature is unnecessary for this on-chain registration.
- Before encrypting an initial message, compare the actual remote Proteus session fingerprint with the current on-chain registration for the resolved Juno address and device generation. Reject a substituted prekey even if it is otherwise valid. Recheck the generation before broadcast; a changed registration needs a visible identity warning and a new session.
- Registrations are versioned. Devices can be revoked; senders must reject revoked or expired prekeys.
- Private keys remain on the device in encrypted storage. If local state is lost, wallet control can authorize a new device registration but cannot decrypt old messages. Do not describe this reset as message recovery. A usable encrypted keystore backup and unlock design is still a release gate; the current CoreCrypto browser API does not expose a verified keystore export/import flow.

## Message protocol

- One-to-one sessions use a reviewed Double Ratchet implementation to provide forward secrecy and post-compromise recovery.
- Initial asynchronous sessions use signed device keys and one-time prekeys. A missing or already-used prekey must fail closed.
- Use the selected reviewed library's authenticated encryption suite as published; do not substitute a preferred cipher. Verify the encrypted envelope binds protocol version, sender, recipient, device IDs, conversation ID and sequence information. If the library lacks external associated data, authenticate these fields inside the encrypted envelope and verify them against the public transaction metadata after decryption.
- The chain stores public device material and opaque ciphertext only. Plaintext, private keys and decrypted search indexes never go on-chain.
- Group messaging is out of scope for the first release. MLS should be evaluated rather than extending the one-to-one protocol ad hoc.

## Network policy and spam controls

- UNI-7 deliberately has no NETA stake requirement. Registration and sending stay open so the full workflow can be tested without creating an artificial test-token barrier.
- The mainnet configuration checks at registration and send time that the sender has at least 5 actively staked NETA.
- Network configuration is immutable after instantiation. A testnet contract cannot be migrated or reused as the stake-gated mainnet instance.
- A recipient can block an address without decrypting new payloads from it.
- Contract-enforced ciphertext limits, per-sender cooldowns and bounded pagination prevent unbounded storage and query work.
- The stake check is an anti-spam cost, not an identity or trust guarantee.

## Browser and application controls

- No third-party scripts are permitted on the messaging page. The currently deployed `script-src 'self'` blocks the selected WASM bundle; a reviewed CSP must allow `wasm-unsafe-eval` while continuing to exclude broad `unsafe-eval` and remote scripts.
- Rendered message text uses text nodes, never HTML injection.
- Sensitive key material must not be placed in localStorage. An audited encrypted IndexedDB keystore with explicit lock and device removal is required.
- Dependency versions and build artifacts are pinned and reproducible. Cryptographic primitives are never implemented inside this repository.

## Mainnet release gates

1. Written threat model and protocol state machine reviewed and accepted.
2. Maintained, independently reviewed cryptographic library selected; no custom primitive or ratchet implementation.
3. Interoperability test vectors, lost-message, out-of-order-message, replay, device reset and supported device-count tests pass on UNI-7.
4. Network-policy, mainnet 5 NETA stake gate, cooldown, payload limit, blocklist, device revocation and pagination contract tests pass.
5. XSS, dependency, CSP and supply-chain review passes against the production build.
6. Independent external audit findings are resolved or explicitly accepted and disclosed.
7. Clear user warnings explain public metadata, device compromise and irreversible loss of undecryptable history.

Until the UNI-7 contract and reviewed client are connected, the frontend may accept
temporary composer input for UX testing but must not transmit or persist it. Mainnet
messaging stays disabled until every release gate passes.
