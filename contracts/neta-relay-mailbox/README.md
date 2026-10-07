# Personal-mainnet source candidate — v0.4

Owner decision 6 October 2026: personal messaging is tested on mainnet before
shared DAO mailboxes. An active sender-owned .neta name replaces the earlier
5-NETA staking condition. No stake query or extra application fee exists.
Mainnet instantiation is explicit (`mainnet: true`), owner-controlled, and binds
the production NNS registry immediately. All DAO execute routes stay disabled
in this first personal-mainnet candidate. No deployment or migration is implied.

See [personal messaging preparation](../../docs/PERSONAL_MESSAGING_MAINNET_2026-10-06.md)
for the artifact, implemented recovery and remaining backup/client/review gates.
The deployed v0.1 UNI-7 address/artifact below is preserved. The historical v0.3
DAO source introduced shared mailbox support; v0.4 is its undeployed successor.
New instances must retain the owner's explicit upgrade administrator.

## Historical UNI-7 prototype

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
uses the new explicit v0.4 mode described above, with active .neta sender ownership and no staking gate. Production recovery, client integration and deployment evidence are still required.
