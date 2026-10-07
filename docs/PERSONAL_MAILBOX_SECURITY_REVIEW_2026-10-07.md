# Personal mailbox v0.4 adversarial security review

Review date: 7 October 2026. This is a scoped source review and regression-test
exercise by the development assistant, not an independent external audit,
formal verification, or a guarantee that the system is secure.

## Result and exact scope

No exploitable critical- or high-severity defect was confirmed in the reviewed
personal-mainnet contract paths. The review added ten adversarial regression
tests; all 32 mailbox-crate tests pass. No production contract logic, dependency,
release pin or shipped WASM was changed.

Source baseline: `b84c78ef6ada29c60154705681f44732a0de52c1`, including
`contracts/neta-relay-mailbox/src/lib.rs`, `policy.rs`, `dao.rs`, existing tests,
and the NNS query implementation used by the policy. The deployed-helper
publication was PR #200. The artifact under review is
`assets/relay-mainnet/neta_relay_mailbox_v04.wasm`, SHA-256:

```text
835323a60b0d418d0ef88e1fe12c02f8d65cc5c84fcf593135fdb18977f86708
```

A pinned Rust 1.81.0 release rebuild is byte-for-byte equal to that artifact.
This establishes the reviewed source/artifact relationship, not the identity of
any future on-chain deployment. There is still no verified owner deployment
receipt in this session, and both personal deployment/release pins remain null.

The threat model includes arbitrary gas-paying callers, a permitted malicious
correspondent, stale device generations, malformed inputs, duplicate sends,
registry failures, and numeric boundary conditions. DAO code was inspected, but
the security claim here is its mainnet write prohibition, not approval of a
future mainnet DAO mailbox. Selected client adapters were read to understand
contract assumptions; client cryptography, backup service, browser, wallet and
chain implementation were not comprehensively audited by this review.

## Attack coverage

| Attempt or invariant | Review and test evidence |
| --- | --- |
| Instantiate under another owner/network or silently select mainnet | Existing tests verify explicit `mainnet:true`, `juno-1`, the agreed owner and pinned policy. |
| Bypass the mainnet DAO prohibition | New tests submit every current DAO execute variant as owner and as another caller; all fail without state changes. |
| Impersonate a device or grant another recipient's consent | State is scoped by authenticated `info.sender`; copied labels/fingerprints do not alter another wallet, and the caller cannot grant a different recipient's consent. |
| Send without a valid current `.neta` identity | Initial and follow-up sends reject missing/expired names, transferred ownership, mismatched address/name responses and failed registry queries. Expiry equal to the current timestamp is rejected. |
| Evade recipient approval, blocklist or rotation | Consent binds both generations; existing tests cover rotation/revocation and one initial per approved pair. New tests verify follow-up blocking and revoked consent. |
| Replay after rotation or reset throttling | Message IDs and the ten-second sender cooldown survive rotation; new tests exercise both and the successful cooldown boundary. |
| Consume a prekey before a later error | Rejected send cases compare the complete mock storage before/after; sequence overflow cannot consume a prekey. Generation overflow also rejects without writes. |
| Submit malformed or oversized records | New cases cover prekey duplication, count/size/ID limits, invalid ciphertext sizes, missing/stale sender generation and invalid IDs; rejected calls leave storage unchanged. |
| Attach funds or trigger recursive writes | Personal execute variants reject attached funds; existing instantiate checks also reject funds. Reviewed paths emit no outgoing bank/contract execution messages. The NNS interaction is a read-only smart query. |
| Force an unbounded inbox query | New tests use 55 messages and exercise the 50-entry cap, default 20, cursor boundaries and zero limit. |

The new tests are in
[`security_tests.rs`](../contracts/neta-relay-mailbox/src/security_tests.rs).
Mocks establish these branch/storage invariants; they do not prove VM gas costs,
chain transaction rollback, complete state-machine coverage or real wallet behavior.

## Findings and explicit trust boundaries

### L-01: Persistent state growth is not fully covered by the name gate

Classification: low-severity economic/resource-hardening limitation. An address
without a `.neta` name can register and repeatedly rotate its own device, leaving
historical identity records. A new regression test demonstrates eleven such
generations while verifying that sending still fails the name gate. Registration
has no contract-level cooldown or total history quota. Block/consent records and
accepted ciphertext history also lack a total retention cap; not every such
write requires a name.

Each transaction costs chain fees, individual records and inbox queries are
bounded, and recipient consent prevents this from being an arbitrary inbox-spam
or account-takeover bypass. Nevertheless, name-gated sending is not a guarantee
against overall contract-state growth. Measure gas and state growth in the pilot;
before broader scale, decide whether registration admission/cooldown and a
retention or storage-cost policy are needed. Preserve historical identity proof
and pending recovery state in any future design. No unreviewed admission-policy
change was introduced during this review.

### I-01: Public metadata and unvalidated ciphertext are deliberate boundaries

Sender/recipient, timing, size, permissions and encrypted message bytes are
public on-chain data. The contract neither encrypts messages nor checks their
decrypted authenticity. An approved peer can submit an opaque malformed payload.
Authenticated client envelopes, fingerprint verification, quarantine and
recovery behavior remain necessary. This contract cannot promise anonymity or
establish end-to-end cryptographic security by itself. A follow-up is permitted
without a directional initial; this supports replies in a shared session and
does not bypass recipient consent.

### I-02: Owner upgrade custody and registry behavior remain trusted

The agreed owner is
`juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`. The helper requests and verifies this
wallet as the chain-level upgrade administrator. The instantiate sender check
alone does not enforce the chain-level admin field; verify the actual deployment
receipt. An administrator can authorize a future code migration. This review
does not approve any migration: source/target behavior and state preservation
must be separately tested. The current v0.4 contract has no migration entry point.

The pinned registry is
`juno1pc8wrq89ljuhu2qt6rtk5lkkrptxajtf3un5llu8prg7r4z50vlszfhhza`.
Its availability and authoritative identity responses affect sending. Registry
query failure rejects sends rather than bypassing the policy. Registry upgrades
remain a separate trust assumption.

The API rejects attached application funds and contains no withdrawal route.
This does not prevent direct bank/token transfers to a contract address; such
transfers should not be used as a mailbox funding mechanism.

### I-03: Dependency audit has an explicit exception

Repository CI explicitly ignores
[RUSTSEC-2024-0344](https://rustsec.org/advisories/RUSTSEC-2024-0344.html), the
`curve25519-dalek` timing advisory, for the CosmWasm 1.5 dependency family. This
must not be described as an exception-free dependency audit. In the locked
mailbox dependency graph, `cosmwasm-crypto` is a non-WASM target dependency of
`cosmwasm-std` 1.5.11. The `wasm32-unknown-unknown` dependency tree contains
neither `cosmwasm-crypto` nor `curve25519-dalek`; the affected native test
dependency is not compiled into this shipped contract WASM. This observation
does not assess the chain node's cryptographic runtime or all other dependencies.
A fresh standalone local `cargo-audit` was not run in this review.

## Reproduction and release decision

Run with the repository-pinned Rust toolchain:

```sh
cargo fmt --manifest-path contracts/neta-relay-mailbox/Cargo.toml --check
cargo test --locked --manifest-path contracts/neta-relay-mailbox/Cargo.toml
cargo clippy --locked --all-targets --manifest-path contracts/neta-relay-mailbox/Cargo.toml -- -D warnings
cargo tree --locked --target wasm32-unknown-unknown --manifest-path contracts/neta-relay-mailbox/Cargo.toml
bash scripts/build-wasm.sh neta-relay-mailbox
cmp contracts/neta-relay-mailbox/target/wasm32-unknown-unknown/release/neta_relay_mailbox.wasm assets/relay-mainnet/neta_relay_mailbox_v04.wasm
```

Local results: formatting passes; **32 tests pass, zero failed/ignored**; Clippy
passes with warnings denied; artifact comparison passes. The pinned release
build emits the existing Rust warnings about the `reference-types` and
`multivalue` target-feature flags. No live exploit or wallet transaction was used.

No contract blocker was found for the already planned owner-controlled private
pilot, subject to the documented resource and trust boundaries. This is not a
public-release approval or closure of the independent-review gate. Verify real
deployment receipts and the two-wallet lifecycle, resolve backup/provider and
recovery gates, measure operational costs, and obtain independent contract/client
review before representing the overall messaging system as audited.
