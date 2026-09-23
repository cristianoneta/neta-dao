# RELAY private messages: UNI-7 implementation plan

Status: implementation gate, 2026-09-23. No DM contract is deployed and no
message may be sent by the current composer. Keep mainnet messaging disabled.
This plan supplements [RELAY_SECURITY_ARCHITECTURE.md](RELAY_SECURITY_ARCHITECTURE.md).

## What has been verified

- Wire CoreCrypto 10.5.3 exposes a Proteus one-to-one prekey/session API, an
  encrypted persistent keystore, and browser and native Rust-backed bindings.
- An isolated native Node smoke test exchanged an initial encrypted message and
  encrypted reply between two independent CoreCrypto instances. The recipient
  reopened an encrypted local database before decrypting the initial message.
  The 202-byte ciphertext did not contain the message text. This proves only
  the library's basic native flow, not browser behavior or protocol security.
- The published package is GPL-3.0. It does not declare all of the imports used
  by its native entry point as package dependencies (`@ubjs/core`, `@ubjs/node`
  were installed separately for the smoke test). A reproducible, pinned browser
  build and license review are hard gates before integration.
- Local Playwright/Chromium cannot launch in the current execution environment:
  Chromium's socket call is blocked. Browser tests must run in GitHub Actions
  or another environment that can launch Chromium. Do not call this browser
  gate passed on the strength of the native smoke test.

Reproduce the native check with `cd spikes/relay-corecrypto && npm ci && npm test`.
The fixture is private and test-only; none of its dependencies are loaded by the
website. It is not a substitute for the required isolated browser-profile test.

## Step 1: prove the browser client before building the contract

Create a **separate test-only fixture** with two isolated browser profiles and
the official, pinned CoreCrypto browser bundle. No cryptographic primitives
are written in this repository. Demonstrate device creation, generation and
publication of a prekey bundle, offline initial send, reply, out-of-order
delivery, replay rejection, restart and encrypted IndexedDB persistence.
Verify that the published WASM loads under the site's self-only CSP with no
remote runtime scripts. Explicitly design unlock, backup and device-loss UX;
never derive a database key from a wallet signature or store it next to the
encrypted database. Test that corrupted storage fails safely.

Before choosing Proteus, resolve GPL obligations for the distributed website,
pin all runtime dependencies, and independently review the resulting build.
If the browser build, license, storage model or security review fails, stop and
re-evaluate a maintained library. The frontend remains in preview mode.

## Step 2: UNI-7 mailbox contract

Define and review the complete execute/query schema before deployment:

- Wallet-signed registration binds one active device ID, protocol version,
  Proteus identity fingerprint and public prekey bundle to `info.sender`.
  Revocation increments a device generation. A new device cannot silently
  inherit old sessions. First release supports one active device per wallet;
  explicitly add multi-device fan-out only after independent testing.
- `send_initial` references a specific recipient device generation and prekey
  ID. The contract checks the prekey is unused and atomically marks it spent
  with storing the ciphertext. Competing sends fail and must initialize with
  another prekey. Subsequent `send` checks the currently active device.
- Sender comes from `info.sender`, recipient and message ID are explicit;
  bounded ciphertext, pagination, deduplication and blocking are enforced in
  the contract. Query and execute are limited to UNI-7 (`uni-7`) during this
  stage. Testnet has **no NETA stake gate**. The mainnet policy belongs to a
  separate reviewed deployment and requires at least 5 actively staked NETA.
- Never put plaintext, draft text, private keys or a decrypted search index in
  chain transactions, events, memo fields, logs or telemetry. The chain still
  exposes sender, recipient, time, frequency and approximate ciphertext size.

Check the real UNI-7 gas and storage cost per message before selecting message
size limits. Chain transaction history remains public even if contract storage
is later pruned. Names are resolved to a Juno address before encryption; a
`.neta` alias is not a device key and does not guarantee device trust.

## Step 3: durable client send/receive state machine

`draft -> encrypted outbox -> wallet signature -> chain confirmation -> sent`.
Serialize sends per local session. Record the exact ciphertext, recipient
device generation and unique message ID in a local encrypted outbox. After a
timeout or reload, query the contract for that ID before submitting again;
retries must reuse the same ciphertext. Never reuse a message key for different
plaintext. Test what happens if the browser crashes between library session
commit and outbox persistence; if the library cannot make these changes atomic,
specify a fail-closed recovery/reset flow before enabling send.

Decryption must verify that the authenticated inner identity/conversation data
matches the public transaction envelope and the on-chain registered device.
Proteus does not expose an arbitrary associated-data parameter through the
reviewed high-level API: document and test the envelope-binding design rather
than claiming the external metadata is authenticated by default. Add a visible
identity-change warning when the registered device changes.

Only after two real Keplr wallets exchange and recover messages on UNI-7 do we
enable `SEND MESSAGE` in RELAY. Show pending/signing/confirmed/failed states;
label loss of local keys, public metadata and per-message chain gas clearly.
Do not promote this testnet result to mainnet without independent contract and
client review, a security audit, and the mainnet policy gates.
