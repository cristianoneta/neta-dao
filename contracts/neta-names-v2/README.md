# NETA Names v2 registry

Deployed on UNI-7 for the separate manifest-driven `names-v2-lab.html` test workspace.
Mainnet deployment and main-workspace purchases remain disabled. See the
[current deployment and owner-test evidence](../../docs/HANDOFF_NEXT_CHAT_NNS_2026-10-04.md).
See [the implementation checkpoint and UNI-7 runbook](../../docs/NNS_V2_REGISTRY_2026-10-04.md).
The legacy `neta-names` contract is unchanged and is not compatible with v2 profiles.

The registry implements paid commit/reveal registration, renewal, recipient-accepted
transfer, owner lookup and the persistent `identity` query used by
`neta-validator-profiles`. It does not store verified receiving addresses, DAO
subnames, profiles, reminders or a delegation programme.

## Build and verify

Use the repository's pinned Rust toolchain:

```sh
cargo fmt --manifest-path contracts/neta-names-v2/Cargo.toml --check
cargo test --locked --manifest-path contracts/neta-names-v2/Cargo.toml
cargo clippy --locked --all-targets --manifest-path contracts/neta-names-v2/Cargo.toml -- -D warnings
bash scripts/build-wasm.sh neta-names-v2
node --test tests/names-v2.test.mjs
```

CI also runs `cosmwasm-check` 1.5.11 on the WASM artifact. The dev-only integration
tests instantiate a real CW20, this registry, and the profile contract together.
Synthetic test keys in fixtures are public and must never be used for deployment.

## Contract interface

`msg.rs` defines the complete JSON interface. Instantiate with `token`, `treasury`,
`admin`, `quote_public_key` (base64 Ed25519 public key), and `testnet_only`.
Purchases and renewals start paused. UNI-7 test mode requires a six-decimal CW20.
Mainnet mode pins the real NETA token and main NETA DAO as treasury and governance.
There is no migration entrypoint or admin name-transfer method.

Registration is an owner-signed `commit` transaction, then in a later block a
CW20 `send` carrying `register: {offer, salt}`. Never reveal the name in the commit
memo. Commitments expire after one hour; replace an unexpired commitment only by
explicitly cancelling its exact hash. The quote has a maximum five-minute life.
Renewal uses CW20 `send` with `renew: {offer}` and permits a third-party payer.

The quote signer controls the USD/NETA conversion rate, not identity ownership.
The registry independently enforces tariff arithmetic, payment token and amount,
context, term, identity revisions, quote expiry, nonce and Ed25519 signature.
Changing a tariff or quote key increments its version and invalidates old quotes.
Failed fee forwarding reverts the whole token/registry transaction.

Transfers require an owner offer and separate recipient acceptance of its unique
ID. Acceptance preserves expiry and advances ownership revision. An expired name
cannot transfer; expiry plus 30 days permits a new registration generation.
`identity` remains queryable after expiry; `resolve` and `name_of` hide inactive
ownership. An owner may hold only one active personal name. Registering another
name during an old name's grace period prevents renewing the old one while the
new one is active.
