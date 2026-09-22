# NETA Names — implementation and activation

## User-facing behavior

`cristiano.neta` resolves to one Juno wallet in the NETA Names registry. A wallet may own one name; names are 5–32 lowercase ASCII letters, digits or interior hyphens. The name works only in clients that explicitly query this registry. It is not a DNS domain or a universally recognized wallet alias. RELAY accepts either the name or the Juno address and displays the resolved address, but messaging remains disabled until its separate encryption and contract review is finished.

The interface uses the same navigation, hero, colors, cards and responsive rules as Proposals, Delivery, Treasury and RELAY. Search and registration clearly state when the registry has not been deployed. No example name is claimed to be active.

## Pricing and fee destination

The first registration costs exactly 5 NETA (5,000,000 CW20 base units), including 365 days. A renewal extends the current expiry, or renews from today during the 30-day grace period. The initial renewal quote is 5 NETA (5,000,000 units). The USD 5 annual target requires an authorized admin to set a new on-chain NETA amount when necessary; it is **not** an automatic USD peg, because there is no trustworthy on-chain NETA/USD feed specified. The admin may change only the renewal fee, never the initial 5 NETA or the treasury. The displayed on-chain quote must be reread before a future signing flow.

Every CW20 payment is forwarded atomically to the **NETA DAO** treasury `juno1c5v6jkmre5xa9vf9aas6yxewc7aqmjy0rlkkyk4d88pnwuhclyhsrhhns6`. The contract refuses instantiation with any other treasury. This is distinct from the NETA Operations DAO treasury. Verify this destination with the DAO before mainnet activation.

## Contract rules

The sender commits SHA-256 of `neta-names-v1:{label}:{juno_address}:{random_salt}`. The commitment must age at least one block and expires after 100 blocks. The user then sends exactly 5 NETA through CW20 `Send` with `{ "register": { "name": "label.neta", "salt": "…" } }` as the base64-encoded hook. Atomic execution rejects wrong token, fee, ownership, expiration or commitment. There is a 30-day renewal grace after expiry, during which resolution returns no active address; afterward a new owner may register. The admin transfer requires nomination and acceptance. Contract query variants: `resolve`, `name_of`, `config`, `commitment`.

Current contract does not support changing the wallet associated with a name, delegated registration, or an appeal for disputed names. Users should keep their wallet safe. Production deployment requires contract security review and a verified NETA CW20 address and DAO admin address.

## Activation checklist

1. Run Rust formatting, tests, Clippy and a security review of `contracts/neta-names`. The CI workflow covers these steps; a mainnet WASM build should additionally be reproducible.
2. Verify the NETA CW20 token contract, its six-decimal denomination, the given DAO treasury and an admin controlled by the DAO. The provided treasury address is not independently attested by this repository.
3. Deploy and instantiate on Juno with `neta_token`, the fixed `dao_treasury`, `admin` and `renewal_fee: "5000000"`. Verify the resulting on-chain config and CW20 transfer destination before showing any registration CTA.
4. Add the verified registry address to `names.js` after deployment. The prepared Keplr commit/reveal and renewal flow is gated by this address. Test real transaction receipts and register/renew against the deployed contract before activating the UI; the current UI keeps registration disabled until then.
5. Enable RELAY message delivery only after the separate security design in `RELAY_SECURITY_ARCHITECTURE.md` is implemented and reviewed.
