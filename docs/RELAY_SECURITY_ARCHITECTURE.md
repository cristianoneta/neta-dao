# RELAY security architecture

Status: design gate for UNI-7 implementation. The current frontend composer is a
non-persisting interaction shell; no messaging contract is deployed or connected.
Messaging must remain disabled on mainnet until every release gate below is satisfied.

## Security claim

RELAY must never be presented as perfectly or “110 percent” secure. Its intended guarantee is that only devices authorized by the sender and recipient can decrypt message contents, assuming their devices, wallets, implementation dependencies and random-number generators are not compromised. Public-chain metadata cannot be hidden by payload encryption.

## Threat model

RELAY protects message content against chain observers, RPC operators, indexers and an attacker who later obtains an old session key. It does not conceal sender and recipient addresses, transaction timing, ciphertext size or messaging frequency. It does not protect an unlocked or malware-infected device, a malicious browser extension, compromised build infrastructure, social engineering or screenshots made by a recipient.

## Identity and devices

- A wallet address is the account identity, but its wallet signing key is never used directly as an encryption key.
- Every device creates separate encryption and signing keys locally with a cryptographically secure random-number generator.
- A Keplr-signed registration transaction binds a device public key, protocol version and device identifier to the Juno address.
- Registrations are versioned. Devices can be revoked; senders must reject revoked or expired prekeys.
- Private keys remain on the device in encrypted storage. Recovery means registering a new device, not reconstructing an old private key from the wallet signature.

## Message protocol

- One-to-one sessions use a reviewed Double Ratchet implementation to provide forward secrecy and post-compromise recovery.
- Initial asynchronous sessions use signed device keys and one-time prekeys. A missing or already-used prekey must fail closed.
- Payloads use XChaCha20-Poly1305 authenticated encryption. Associated data binds protocol version, sender, recipient, device IDs, conversation ID and sequence information.
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

- No third-party scripts are permitted on the messaging page. The current self-only content security policy remains mandatory.
- Rendered message text uses text nodes, never HTML injection.
- Sensitive key material must not be placed in localStorage. An audited encrypted IndexedDB keystore with explicit lock and device removal is required.
- Dependency versions and build artifacts are pinned and reproducible. Cryptographic primitives are never implemented inside this repository.

## Mainnet release gates

1. Written threat model and protocol state machine reviewed and accepted.
2. Maintained, independently reviewed cryptographic library selected; no custom primitive or ratchet implementation.
3. Interoperability test vectors, lost-message, out-of-order-message, replay and multi-device tests pass on UNI-7.
4. Network-policy, mainnet 5 NETA stake gate, cooldown, payload limit, blocklist, device revocation and pagination contract tests pass.
5. XSS, dependency, CSP and supply-chain review passes against the production build.
6. Independent external audit findings are resolved or explicitly accepted and disclosed.
7. Clear user warnings explain public metadata, device compromise and irreversible loss of undecryptable history.

Until the UNI-7 contract and reviewed client are connected, the frontend may accept
temporary composer input for UX testing but must not transmit or persist it. Mainnet
messaging stays disabled until every release gate passes.
