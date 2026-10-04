# NNS validator profiles — implementation checkpoint

Owner decision: 2026-10-04. Branch: `feat/nns-validator-profiles-20261004`.
Base: main `d1047a9` (faucet platform banner). This is a tested **source slice**,
not a deployed registry or evidence of a live operator signing.

## Product decisions

- An active purchased personal `.neta` name is required **only for testnet bonus
  points**, never as a general entry condition for the delegation programme.
- Optional public contacts: Discord, Telegram, X/Twitter, email, homepage, plus
  introduction. Contact data are self-declared, not verified social ownership.
  Publishing email makes it public. Private RELAY contacts remain separate.
- Link the exact mainnet and testnet **operator** addresses with chain IDs.
  Juno `junovaloper1…` identifies the operator; the corresponding `juno1…` account
  signs. Never use the validator consensus/node private key for this procedure.
- Both operator wallets consent to the exact pair, name and current name owner.
  Identical names/monikers are not proof. The NNS owner can be a third wallet.
- At the programme snapshot, verified link plus membership in the active testnet
  consensus set earns the full configured testnet score. No uptime threshold or
  extra uptime weighting initially. A mainnet operator may be outside its active
  set. One testnet operator cannot provide duplicate credit to multiple names.
- Expiry removes eligibility for a new snapshot; no automatic change to an
  already approved delegation. Transfer/re-registration invalidates old identity
  proofs and profile contents. Programme weights remain a separate governance rule.

## What this change implements

| Component | Implemented | Boundary |
| --- | --- | --- |
| RELAY → My profile | Contact fields, optional validator addresses, local in-memory preview, safe links, checksum checks | Explicitly unpublished, no persistence, signatures or wallet broadcasts |
| `names-profile-core.mjs` | Field normalization, chain/Bech32 checks, exact human-readable challenge, two-wallet Keplr ADR-36 proof collection, pure bonus eligibility function | Deployment remains null; proof collection is not wired into production UI or a transaction submitter |
| `contracts/neta-validator-profiles` | Owner-authorized contacts, two cryptographic proofs, one-to-one operator bindings, owner unlink and operator-initiated revocation, lifecycle-aware reads | Requires the **new v2 identity query**; does not register or sell names |
| Test suite | Real secp256k1 signatures over synthetic keys; mocked v2 identities; browser and state/lifecycle regressions | No real operator, chain registration, fee payment or deployment demonstrated |

The currently existing `contracts/neta-names` is inactive legacy v1 (fixed 5 NETA).
It does **not** implement the accepted v2 USD tariffs, ownership generations or
transfer rules. It must not be activated to make this sidequest appear complete.
The v2 name registry and quote service were already missing before this change.
The sidequest is therefore not ready for a real validator E2E test yet.

## Contract and identity protocol

The profile contract pins its name registry at instantiation. There is no profile
administrator or price-service authority to replace an operator's signature.
The registry must answer `{"identity":{"name":"alice.neta"}}` with:

```json
{
  "name": "alice.neta",
  "owner": "juno1…",
  "generation": 1,
  "ownership_revision": 1,
  "expires_at": 1800000000
}
```

`generation` increases on registration after release; `ownership_revision`
increases on every accepted transfer, including transfers back to a former
owner. Both are nonzero monotonically increasing integers. The v2 registry must
retain the last identity after expiry/release until replacement: an unknown or
failed registry query is an error, not proof that a binding may be reassigned.
The API is intentionally incompatible with legacy v1's `resolve` response.

`UpdateContacts`, `LinkValidators`, `UnlinkValidators` require the current active
name owner and expected profile revision. A changed name identity resets visible
contacts/proofs and advances the revision. Renewal by the same owner can retain
the profile only where the exclusive operator slots have not been reclaimed.
Queries suppress expired/reassigned profiles. Removing an old profile's indexes
cannot remove another name's later binding. Historical chain data remain public;
suppression is not deletion from blockchain history.

The human-readable challenge binds purpose, registry chain, profile contract,
name registry, name, owner, generation, ownership revision, profile revision,
**both** chain/address pairs and expiry (at most ten minutes, never beyond the
name expiry). Contract reconstructs these bytes; it never trusts a submitted
challenge string. ADR-36 uses canonical sorted Amino JSON, SHA-256 and secp256k1;
SHA-256/RIPEMD-160 of the compressed public key must match the operator account.
No funds are accepted. Contact updates and revocation advance the same revision,
so old prepared proofs cannot be reused after either operation.

An operator can revoke with a fresh `revoke-validator-link` signature even when
the name owner refuses. The transaction can be relayed by another wallet; the
signature is bound to the exact current link and revision. It cannot create a
link or transfer a name. Name-owner unlink needs no further operator signature.

First adapter supports `juno-1` + `uni-7` and ordinary secp256k1 operator accounts.
Multisig/contract-controlled operator accounts and additional chains require
explicit adapters. No fallback that silently treats a multisig as one EOA.

The contract proves **control of operator keys**, not that a validator actually
exists or is active on a remote chain. The later dashboard must fetch both exact
validator records and testnet consensus membership at the recorded snapshot.
Unknown/stale/unavailable sources must be visibly unresolved. The pure eligibility
function consumes already validated observations; it is not a live chain reader
or the complete delegation simulator.

## Validation commands

```sh
cargo fmt --manifest-path contracts/neta-validator-profiles/Cargo.toml --check
cargo test --locked --manifest-path contracts/neta-validator-profiles/Cargo.toml
cargo clippy --locked --all-targets --manifest-path contracts/neta-validator-profiles/Cargo.toml -- -D warnings
bash scripts/build-wasm.sh neta-validator-profiles
node --test tests/*.test.mjs
cd spikes/relay-corecrypto
npm ci
node browser-names-profile.mjs
node browser-workspace-security.mjs
```

Browser tests support `CHROMIUM_PATH` for an installed Chromium and optional
`NNS_SCREENSHOT_DIR` for review frames. Tests use isolated browser contexts and
mock public HTTP responses, never the owner's keys or browser journals.
`tests/fixtures/nns-adr36.json` was produced by pinned CosmJS 0.38.1 using known
synthetic keys. Rust independently reconstructs and verifies the same signatures;
the browser challenge must match. Domain addresses in this fixture are examples,
**not** profile deployment addresses.

CI now includes the profile contract format/tests/Clippy/audit/WASM build and
the new browser test; final CI/build and publication evidence must be recorded
after actual completion, not inferred from workflow configuration.

## Local verification evidence — 2026-10-04

- 12 native Rust tests passed, including independent CosmJS/Rust ADR-36 signatures.
- Rust format and Clippy with warnings denied passed on toolchain 1.81.0.
- 57 root Node tests passed, including 7 new profile/protocol cases.
- Profile browser test passed at 320/390/768/1440 px, keyboard focus and 200%
  equivalent reflow; desktop/mobile frames were inspected. Existing workspace
  security/navigation/wallet tests also passed.
- Canonical `scripts/build-wasm.sh` build passed with an isolated target directory.
  SHA-256: `9d47676d8dd0040b1cea4a39a3e8c95a75ea4841cd5b2eb5feb83c7f4516ceed`.
  First local release-cache attempt failed loading a proc-macro; the clean target
  build resolved it. CosmWasm compatibility validation remains a separate CI check.
- No live profile/registry deployment, purchase or validator E2E was performed.

## Remaining work before public operation

1. Implement the accepted NNS v2 registration/renewal/transfer identity lifecycle
   and pricing interface from `NETA_NAMES_V2_PLAN.md`. Determine quote freshness,
   price-jump policy, custody and service hosting before paid mainnet purchases.
2. Deploy a separate UNI-7 registry/mock-token configuration and this profile
   contract. Verify chain, code checksum, registry interface and fee recipient.
   A registry testdouble is permitted in tests only, never as production proof
   of purchasing a name.
3. Add live profile reads and the owner transaction UI with exact before/after
   review, wallet/context recheck, origin-wide transaction lock, preserved intent,
   exact-hash confirmation and uncertain-result reconciliation. Connect proof
   collection only after this path and deployment identities are verified.
4. Exercise register → profile → link → query → edit → unlink/revoke with test
   wallets; test expiry, transfer and duplicate binding in the deployed system.
5. Recruit one willing mainnet + UNI-7 validator for a real two-operator test.
   Ask them to sign in their own wallets. Never request keys/seeds, and never use
   consensus signing keys. Mainnet ADR-36 proof is off-chain and has no gas cost;
   test registry/profile writes do consume UNI-7 gas.
6. Review mainnet deployment, registry/quote authority and actual payment flow;
   then enable public registration/profile writes. No mainnet activation by a
   frontend config change alone.

No outreach to validators was sent. No new hosting, paid resource, wallet,
contract deployment, name registration or governance transaction was created.

## Delegation programme continuation (planning, not implementation)

- First target: existing Juno Community Pool programme custody, now named
  Secondary Community Pool. User executed Council proposal A16; both RPC checks
  found an empty member list. Native governance is its internal admin; existing
  delegation authz grants remain nonexclusive and do not block governance.
- Parameters approved by a first proposal; subsequent quarterly execution drafts
  reuse that rule version and snapshot current data/positions. Rule changes need
  a new proposal. Do not add mid-vote/quarter emergency reallocation: user accepts
  that a validator may become jailed after the snapshot.
- Automatic objective criteria first; manual contribution assessment later.
- Allocate proportionally to points, with configurable min/max and optional
  active-mainnet-only filtering. No named validator exclusion.
- Provisional post-allocation voting-power cap:
  `min(30%, factor * 100% / actual_active_validator_count)`, factor 1.0–2.0,
  default 1.5. Redistribute excess within constraints; show infeasible remainder.
  No separate small-validator scoring initially; inspect simulations first.
- Optional commission maximum, default 10%.
- Governance: last 20 completed proposals by default; count own participation
  regardless of vote choice, weighted votes included. New validators are assessed
  only over proposals where active for the full voting period; unknown historical
  evidence is not a missed vote. Weight remains configurable.
- Mainnet uptime: optional minimum, provisional 99%, rolling 30-day collector.
  Collect actual signed/missed block history; current slashing-window snapshots
  alone cannot reconstruct a month. Show X/30 days and gaps; missing != downtime.
- Testnet: the decisions in this document; no extra uptime minimum initially.
- Native Juno mainnet proposal submission/drafts integration still needs a real
  adapter. The existing workspace is not an executable native-governance pipeline.

At the earlier 2026-10-04 UNI-7 audit: 22 registered, 10 actual active consensus
validators, 12 jailed/inactive. Explorer active stake/commission/power and rolling
20,000-block signing counters matched two RPC sources; proposed/delegator counts
were not independently checked. This is a timestamped observation, not a future
eligibility list or a 30-day uptime measure.

Protocol references: [Keplr ADR-36](https://docs.keplr.app/api/guide/sign-arbitrary),
[Cosmos ADR-36](https://github.com/cosmos/cosmos-sdk/blob/main/docs/architecture/adr-036-arbitrary-signature.md).
