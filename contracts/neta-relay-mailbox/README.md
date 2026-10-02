# NETA RELAY mailbox (UNI-7 prototype)

The contract is a public, testnet-only store for one active device per wallet,
bounded public Proteus prekeys and opaque ciphertext. It does **not** encrypt
messages, hold private keys, validate decrypted metadata or provide backup.
The recorded UNI-7 instance is `juno13uft9dl34x9wdzcxnm80q8m8sh5cw04lkskzknm9vc0wduxchdxsrnr4pa`; adding this crate alone does not deploy it. The separate `relay-uni7-lab.html` loads the Keplr/crypto client; the main composer remains disabled. See [current state](../../docs/CURRENT_STATE.md).

`Register` is a wallet-signed execute transaction: `info.sender` is the address
bound to the supplied device fingerprint. A registration or revocation advances
the device generation. `AddPrekeys` only accepts new IDs greater than every ID
previously issued by that device generation. `SendInitial` checks the current
recipient generation, consumes a prekey and stores the ciphertext atomically.
`Send` stores follow-up ciphertext only for the current recipient device.
Each sender has a ten-second contract cooldown; ciphertext is limited to 4096
bytes, and inbox queries return at most 50 entries.

The sender must compare its actual remote Proteus fingerprint with the latest
registered fingerprint **before encryption**, and confirm the generation again
before signing the transaction. An address or `.neta` name alone never proves a
device identity. `Sent` queries the sequence for a sender/message ID so a
restarted client can reconcile an uncertain broadcast without encrypting anew.
`Inbox` and `Device` are public queries; all chain observers can see addresses,
timing, message count and ciphertext size. No encrypted attachment or plaintext
belongs in execute data or events. A device reset cannot restore old history.

This is a deployed testnet prototype, not an audited mainnet contract. Still required before production integration: actual gas and storage measurements, Keplr transaction
tests with two wallets, session envelope binding and client outbox recovery,
device-loss UX, production distribution/license and independent security review. GPL CoreCrypto is already shipped for the isolated lab; mock browser integration passed, but real two-wallet E2E remains unrecorded. Mainnet
needs a new separately reviewed implementation with the 5 actively staked NETA policy. This crate has a hardcoded UNI-7 guard, no network-config parameter and no stake query.
