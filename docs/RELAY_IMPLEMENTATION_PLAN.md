# RELAY private messages: UNI-7 implementation plan

Status: implementation gate, 2026-09-23. The UNI-7 mailbox contract was
instantiated at `juno13uft9dl34x9wdzcxnm80q8m8sh5cw04lkskzknm9vc0wduxchdxsrnr4pa`,
as reported by the Keplr setup page. No messages may be sent by the current
composer. Keep mainnet messaging disabled.
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
- The isolated browser fixture now wraps each random CoreCrypto database key
  with a separate password using Web Crypto PBKDF2-HMAC-SHA256 (600,000
  iterations) and AES-256-GCM, with a random salt and IV and authenticated
  UNI-7 wallet identity. It tests reload, wrong password, cross-wallet use,
  corrupted ciphertext and encrypted record export/import. This export is
  **only the database key**: without a verified backup of the encrypted
  CoreCrypto database it cannot recover message history or device identity.
  Neither the password nor unwrapped key is persisted by the fixture.
- A second isolated fixture, `browser-device-backup.mjs`, snapshots the
  encrypted `core-crypto` IndexedDB blocks for one quiesced database alongside
  the password-wrapped key and authenticates the entire bundle with Web Crypto.
  GitHub Actions Chromium restores the bundle into a fresh browser profile,
  recovers the exact Proteus device fingerprint and decrypts a prekey message
  created before export. Wrong password, wrong wallet, tampering and replacing
  an existing device are rejected. This is pinned to CoreCrypto 10.5.3's
  observed `blocks` storage layout; it is not a stable upstream backup API.
- `spikes/relay-corecrypto/mailbox-transport.mjs` is an isolated UNI-7 adapter
  against the deployed mailbox address. It requires an independently verified
  code identity, exact connected wallet and chain, a ready persisted outbox
  ciphertext, matching on-chain recipient device/fingerprint and (for initial
  delivery) the exact available prekey. It checks `sent` by message ID before
  any execute and after broadcast; uncertain RPC outcomes and ambiguous intents
  block retries. Node tests cover a confirmed send, duplicate recovery and
  fail-closed identity changes. The adapter has no production integration or
  live signed UNI-7 transaction yet; a real client must supply the verified
  fingerprint from its cryptographic session and enforce decrypted envelope
  binding before displaying messages.
- The test-only `browser-envelope.mjs` now binds chain, mailbox contract,
  addresses, generations, device fingerprints and message ID inside the
  Proteus plaintext. The browser smoke test rejects mismatched on-chain
  sender, generation, message ID or sender fingerprint after decryption.
  Production must fetch a trustworthy registration for the sender generation
  at the time of send. The current contract exposes only the latest device,
  so older messages cannot be safely attributed after rotation without a
  historical registration record. Until then, rotated senders fail closed.
- Local Playwright/Chromium cannot launch in the current execution environment:
  Chromium's socket call is blocked. Run the browser fixture in GitHub Actions.

Reproduce the native check with `cd spikes/relay-corecrypto && npm ci && npm test`.
Run the transport boundary checks with `npm run test:transport`.
For the browser check run `npx playwright install --with-deps chromium` and
`npm run test:browser` in the same directory on a Chromium-capable host.
The fixture is private and test-only; none of its dependencies are loaded by the
website. It is not a substitute for the remaining security checks.

Before integrating this vault into RELAY, review and version the observed
IndexedDB layout, make backup quiescence reliable across tabs, define failure
recovery for the two-database restore, and verify larger databases and multiple
devices. A password or wrapped key alone cannot restore a lost database. Resolve
the GPL-3.0 distribution obligations for the library and independently review
the browser build before publishing runtime dependencies on the main site.

The isolated `browser-device-lock.mjs` fixture now demonstrates immediate
exclusive Web Locks access per physical database path across same-origin tabs.
Production must acquire it before opening CoreCrypto and hold it through
quiescence, backup or restore; release only after all database handles close.
The fixture fails closed when Web Locks are unavailable or another tab holds
the path. Web Locks do not coordinate separate browser profiles or devices.
Wallet-to-database binding, tab crashes, and the lifecycle of every CoreCrypto
handle still require integration review before any messaging is enabled.

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

An undeployed Rust prototype is in `contracts/neta-relay-mailbox`. Its tests
cover prekey consumption, message-ID deduplication, device rotation, revocation,
blocking, pagination and UNI-7-only execution. It does not complete the
deployment or end-to-end client gates below.

The admin-only `relay-testnet-setup.html` page prepares a real UNI-7 deployment
with the configured test wallet. It loads `assets/neta_relay_mailbox.wasm` from
the same site, copied from the validated CI artifact in the
[verified workflow run](https://github.com/cristianoneta/neta-dao/actions/runs/35902328405),
size 266165 bytes, SHA-256
`e02c7918d1f8da0f662a0720fc3668765d79ededce8e9e9dcccff9aae2b9e64a`.
It verifies the downloaded bytes in the browser and checks on-chain code and
instance state before requesting upload and instantiate signatures from Keplr;
neither transaction is automatic. Both confirmations were completed and the
setup page reported the contract address above. RELAY performs a separate
read-only check of network, creator, label and code hash when its composer opens.
The setup page does not enable DMs or register any device.

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

The isolated browser fixture `spikes/relay-corecrypto/browser-outbox.mjs`
implements a test-only fail-closed state machine: persist an intent **before**
encryption, then store the exact ciphertext as ready. A ready entry survives a
tab restart; an uncertain RPC query does not trigger a retry, and a confirmed
message ID is marked sent. If the tab closes with an intent but no ciphertext,
the device is locked for new sends until reset. This fixture stores only public
routing metadata and Proteus ciphertext in IndexedDB; production still needs
reviewed encrypted-at-rest storage, wallet/account isolation, cross-tab locking,
device-rotation UX, and integration with a real contract query. The ratchet and
outbox remain two databases and cannot be committed atomically.

Decryption must verify that the authenticated inner identity/conversation data
matches the public transaction envelope and the on-chain registered device.
Proteus does not expose an arbitrary associated-data parameter through the
reviewed high-level API: document and test the envelope-binding design rather
than claiming the external metadata is authenticated by default. Add a visible
identity-change warning when the registered device changes.
The browser fixture tests the inner envelope; it does not authenticate a
historical sender registration after rotation or perform a live inbox query.

Only after two real Keplr wallets exchange and recover messages on UNI-7 do we
enable `SEND MESSAGE` in RELAY. Show pending/signing/confirmed/failed states;
label loss of local keys, public metadata and per-message chain gas clearly.
Do not promote this testnet result to mainnet without independent contract and
client review, a security audit, and the mainnet policy gates.
