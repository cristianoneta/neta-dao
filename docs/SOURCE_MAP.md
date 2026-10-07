# Source map and stable entry points

| Feature | Entry / source | Shared contracts |
| --- | --- | --- |
| Governance | `neta-governance.js`, `src/governance/comments.mjs`, `proposal-accounting.mjs` | DAO directory, wallet events, draft/transaction journals |
| Treasury | `treasury.js`, `treasury-*.mjs` | `data/treasury`, DAO hierarchy, receipt schema |
| Names | `names-workspace.js`, `names-profile*.mjs`, `names-v2*.mjs`, `names/` | Registry/profile identities and signed price snapshots |
| RELAY | `relay.js`, `relay-personal-*.mjs`, `relay-dao-*.mjs` | Wallet/chain-scoped stores, consent, backup and journals |
| Community Tools | `community-tools/`, `community-*.mjs`, `juno-*.mjs` | Shared header, archived upgrade evidence |
| Service transport | `service/http-guards.mjs` | Bounded bodies and direct-peer throttling, no forwarded-IP trust |
| Faucet | `faucet/service/`, `faucet/src/` | Persistent quota/transaction ledger and pinned signing build |
| Backup | `relay-backup/` | Separate database/auth; immutable scoped ciphertext envelopes |
| Contract checks | `scripts/contracts.json`, `scripts/check-contracts.mjs` | Independent lockfiles and unchanged WASM hashes |

Root browser URLs remain compatible. Handwritten sources are formatted; only
produced browser artifacts are minified. Feature helpers already split financial,
protocol and storage logic; keep additional behavior in those dedicated modules.
A mass path move would require import/fixture/URL migration without reducing runtime
complexity, so physical relocation is not treated as a security fix.

Signing bundles load on demand through their existing loaders. The pilot retains
its own pinned copy to preserve release isolation. Do not replace exact-byte
transaction signing with a generic wallet wrapper, or sum all bundle sizes as if
every page loads all of them. `scripts/build-signing.mjs` owns common build options.

Legacy/reference material: UNI-7 setup/lab pages, original `neta-names` contract,
`names/service.mjs` quote-service implementation and the separate backup Blueprint
are retained for compatibility or later use. Their presence does not imply that
these services are active. Mainnet Names uses the signed Treasury snapshot; the
continuous quote server is deferred. Existing deployed contract dependencies must
be verified before deleting old source/constants.
