# NETA RELAY mailbox (UNI-7 prototype)

The contract is a public, testnet-only store for one active device per wallet,
bounded public Proteus prekeys and opaque ciphertext. It does **not** encrypt
messages, hold private keys, validate decrypted metadata or provide backup.
Nothing is deployed by adding this crate.

`Register` is a wallet-signed execute transaction: `info.sender` is the address
bound to the supplied device fingerprint. A registration or revocation advances
the device generation. `AddPrekeys` only accepts new IDs greater than every ID
previously issued by that device generation. `SendInitial` checks the current
recipient generation, consumes a prekey and stores the ciphertext atomically.
`Send` stores follow-up ciphertext only for the current recipient device.

The sender must compare its actual remote Proteus fingerprint with the latest
registered fingerprint **before encryption**, and confirm the generation again
before signing the transaction. An address or `.neta` name alone never proves a
device identity. `Sent` queries the sequence for a sender/message ID so a
restarted client can reconcile an uncertain broadcast without encrypting anew.
`Inbox` and `Device` are public queries; all chain observers can see addresses,
timing, message count and ciphertext size. No encrypted attachment or plaintext
belongs in execute data or events. A device reset cannot restore old history.

This is a contract prototype, not an audited deployment. Still required before
UNI-7 integration: actual gas and storage measurements, Keplr transaction
tests with two wallets, session envelope binding and client outbox recovery,
device-loss UX, library licensing and independent security review. Mainnet
needs a separately reviewed contract with the 5 actively staked NETA policy.
