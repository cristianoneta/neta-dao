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
- GitHub Actions Chromium smoke test (`spikes/relay-corecrypto/browser-smoke.mjs`)
  passed with two isolated browser contexts: initial encrypted message, reply,
  and recipient tab restart with encrypted keystore reopened before delivery.
  The initial 202-byte ciphertext did not contain the message text. This is a
  partial browser proof; crash recovery, key backup and protocol review remain
  open.
- The browser fixture also checks out-of-order delivery, replay rejection,
  session recovery after a replay, and loading WASM with self-only sources
  plus the `wasm-unsafe-eval` script exception. A duplicate raises a library error; the eventual
  client must recognize duplicates by message ID before decryption and must
  not show the raw library error to users. This is not a complete CSP test of
  the deployed website. The current `index.html` CSP uses `script-src 'self'`
  and blocks WebAssembly compilation; integration requires a reviewed,
  narrowly scoped `wasm-unsafe-eval` allowance. Never add broad `unsafe-eval`.
- A simulated tab crash after encrypting, before any outbox write, leaves a
  committed ratchet but no locally recoverable original ciphertext. Encrypting
  the same text after restart produces different ciphertext; both messages can
  be decrypted if delivered. This demonstrates the duplicate-send risk, not
  an application-level crash recovery implementation.
- The browser fixture checks that a genuine prekey creates the same remote
  Proteus fingerprint as the recipient registration, while a substituted
  prekey for another device yields a different fingerprint. The fixture has
  no chain connection; the client and contract still need an end-to-end
  test of the address-to-registration binding and device rotation.
- Local Playwright/Chromium cannot launch in the current execution environment:
  Chromium's socket call is blocked. Run the browser fixture in GitHub Actions.

Reproduce the native check with `cd spikes/relay-corecrypto && npm ci && npm test`.
For the browser check run `npx playwright install --with-deps chromium` and
`npm run test:browser` in the same directory on a Chromium-capable host.
The fixture is private and test-only; none of its dependencies are loaded by the
website. It is not a substitute for the remaining security checks.

## Step 1: prove the browser client before building the contract

Create a **separate test-only fixture** with two isolated browser profiles and
the official, pinned CoreCrypto browser bundle. No cryptographic primitives
are written in this repository. Demonstrate device creation, generation and
publication of a prekey bundle, offline initial send, reply, out-of-order
delivery, replay rejection, restart and encrypted IndexedDB persistence.
Verify that the published WASM loads under a reviewed CSP with only the
`wasm-unsafe-eval` exception and no remote runtime scripts. Explicitly design
unlock, backup and device-loss UX;
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

**Crash window decision:** a ratchet transaction can commit before a separate
outbox write. Until both are in one atomic storage transaction, block sending
on any restart with an unconfirmed or incompletely persisted send. Preserve
the ciphertext when available and reconcile its message ID with the contract;
if missing, require a new device registration and show that the old session
cannot safely continue. Never regenerate ciphertext for the same message ID.
This is an interim design constraint, not an implemented recovery path.

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
