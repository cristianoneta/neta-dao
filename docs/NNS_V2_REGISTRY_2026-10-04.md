# NNS v2 registry and purchase protocol — 2026-10-04

Status: source continuation of Draft PR #139. No new contract deployment, live
purchase, wallet signature, quote server or hosting resource was created. Both
`NAMES_V2_DEPLOYMENT` and `PROFILE_DEPLOYMENT` remain null. The production profile
form still produces only an unpublished preview. Delegation Programme planning
remains paused; its accepted decisions are in the profile checkpoint.

The [owner test continuation](NNS_UNI7_OWNER_TEST_2026-10-04.md) supersedes the
missing adapter/UI/setup items below. It adds a separate mock-token deployment
and local synthetic test quotes, not a production price service.

## Implemented source

| Component | Implemented | Still required for live operation |
| --- | --- | --- |
| `contracts/neta-names-v2` | USD tariff arithmetic, signed quotes, CW20 fee forwarding, registration, renewal, offer/accept/cancel transfer, persistent identity | Verified UNI-7 deployment and owner-signed E2E |
| `names-v2-core.mjs` | Exact BigInt calculation, shared signing preimage, WebCrypto quote verification, commitment hash, CW20 message | Pinned deployed identities and supported browser path |
| `names-v2-client.mjs` | Persisted registration secret/intent, wallet rechecks, injected cross-tab lock and transaction journal, explicit quote review, receipt reconciliation, renew/transfer coordination | Concrete verified chain reader, existing journal/signing bridge, failed/unbroadcast intent recovery, UI mounting |
| `names/quote-policy.mjs` | Fail-closed price policy and quote construction using injected observations/signer | Verified market readers, durable approved baseline, HTTP service, deployment and signer custody |
| Joint contract tests | Actual CW20 + v2 registry + profile contract in `cw-multi-test` | Real network receipts and consenting validator signatures |

The quote-policy module is a library, not a running service. A test harness reader
is not a deployed registry. No production feature flag was switched on.

## Rules enforced by the registry

- Annual prices: 3 characters USD 640, 4 characters USD 160, 5–32 characters USD 5.
  Registration and renewal use the same versioned tariff. Terms are 1–5 years;
  a year is 365 days. Fees settle in six-decimal NETA, rounded **up** to a microNETA.
- The whole fee is forwarded to the main NETA DAO on mainnet. Mainnet instantiate
  pins the NETA contract and main DAO as both treasury and registry governance;
  Operations DAO is not the recipient. UNI-7 uses a separate mock token/treasury.
- A personal name uses canonical lowercase ASCII with interior single hyphens.
  Reserved names are rejected. One active personal name per owner is enforced
  on registration, renewal and transfer acceptance.
- Expired names stop resolving. During the following 30 days only renewal of the
  existing identity is possible; anyone may pay, with the same owner retained.
  After grace, re-registration increments generation. Renewal extends from the
  later of now/expiry and may leave at most five years remaining.
- If an owner registers a different name during an old name's grace, renewal of
  the old name fails while the new one is active. Grace does not reserve a second
  active-name slot. Transfer is allowed only while the name itself is active.
- Offer IDs monotonically increase. Acceptance needs the named recipient and
  current offer ID, generation and ownership revision. Offers last at most seven
  days and never beyond name expiry. A DAO recipient must accept through its own
  execution/governance, not an individual member wallet.
- Transfer preserves name expiry and increments ownership revision. Profile reads
  invalidate old-owner contacts/proofs. Re-registration likewise invalidates the
  former generation. A renewal keeps the same identity; profile binding exclusivity
  still uses the existing profile contract's lapse/reassignment protections.
- Resolution returns owner identity only. It is **not** a verified receiving
  address and must not be silently used as a payment address.

## Quote and commitment protocol

The Ed25519 quote preimage binds chain, registry, token, treasury, operation,
payer, owner, name, generation, ownership revision, previous expiry, years,
tariff/signer versions, USD-per-NETA scaled by 10^12, exact microNETA amount,
nonce, issue time and expiry. Maximum quote lifetime is 300 seconds; single-use
nonces prevent replay. Browser, Node and Rust share one synthetic fixture.

Registration requires payer = owner, plus a preceding owner's commitment bound
to chain/registry/owner/name/random 32-byte salt. Reveal must be in a later block
and before the one-hour commitment expiry. The client saves the secret before
signing and uses a generic public commit memo. A user explicitly reviews the
exact debit before the second transaction; an expired quote is not silently
replaced. The signer has no method to transfer names or replace identity records.

The authority's conversion rate is trusted: the contract does not prove external
market data. The service policy requires a pinned mainnet JUNO/NETA pool, fresh
JUNO/USD source, six-decimal reserves, positive block height, minimum liquidity,
maximum observation ages, approved price baseline and a configured jump limit.
Missing/stale/unknown inputs fail closed. Tests use synthetic policy values;
no production thresholds, pool or USD provider were silently selected. A reserve
spot price can be manipulated even with these checks; settle the averaging and
manipulation policy before allowing paid mainnet quotes. Never use Treasury JSON
as a quote feed. No private signing key belongs in browser code or repository.

Only registry governance can pause purchases/renewals, rotate the quote key or
change tariffs. The registry starts paused; transfers remain possible while
purchases are paused. Existing names may expire during an extended pause; no
implicit grace extension is implemented. Used nonces are retained, not pruned.
There is no legacy migration/import path in this slice.

## Transaction adapter obligations

`NamesV2Client` is source coordination, not an enabled wallet service. Its injected
`reader.verify` must verify chain, registry code/checksum/admin and current config
against a reviewed manifest; a matching JSON `chain_id` alone is insufficient.
The lock must cover the existing origin-wide wallet transaction journal, including
other app operations. Independent per-name locks alone are not sufficient.

The execute adapter must preserve exact signed bytes/hash before broadcast and
return only verified included receipts. The recovery adapter must match the exact
sender, contract, operation and payload against the preserved intent, not accept
an unrelated successful hash. Never clear the shared journal on a timeout.
Unknown/rejected outcomes remain pending in this source coordinator; explicit
confirmed-failure or proved-never-signed recovery and commitment cancellation
must be wired before a public UI is mounted. Current reconciliation only finalizes
successful intent-matching receipts. No automatic retry is implemented.

## UNI-7 runbook — next integration step

1. Build reviewed registry and profile WASM with the pinned toolchain and run
   CosmWasm validation. Record artifact checksum, source commit and code IDs.
2. Choose a test administrator/treasury and isolated six-decimal mock NETA CW20.
   Prepare an independent test quote key under the operator's custody; fixture
   keys are public and prohibited. No real NETA is used on UNI-7.
3. Have the operator explicitly sign store/instantiate transactions on `uni-7`.
   Instantiate registry with `testnet_only: true`; it starts paused. Instantiate
   the profile contract with the exact new registry address. Pin addresses,
   checksums, CW20 decimals, admins, treasury and quote public key in a reviewed
   deployment manifest. Record exact hashes and successful inclusion receipts.
4. Finish the read/transaction/recovery adapters and the explicit review UI.
   Configure test quote issuance separately from production price operation.
   Verify the manifest before unpausing the test registry through its admin.
5. Owner-sign commit → quoted CW20 send → profile save using test wallets.
   Verify exact debit/treasury credit, expiry, identity and profile data. Also test
   sponsor renewal, recipient-accepted transfer, old-profile invalidation, rejected
   stale quotes, wallet changes, page reload and ambiguous transaction recovery.
6. Test two operator ADR-36 signatures with synthetic keys first; then ask one
   consenting mainnet/UNI-7 validator to sign with their own operator wallets.
   The user need not run a validator. No outreach has been sent.
7. Separately approve production quote market policy, service hosting/custody and
   mainnet governance/deployment. Free DAO namespaces, verified receiving-address
   records, notifications and profile-governance adapters remain later slices.

No executable deployment configuration with fabricated addresses is provided.
A live deployment cannot be claimed from successful local tests or CI.

## Verification in this source slice

- 15 registry Rust tests: actual CW20 fee transfer and rollback, tariffs/rounding,
  maturity/expiry/cancel, replay/domain isolation, wrong-token rejection, signer
  rotation/pause/tariff authorization, grace and generation, one-active-name gates,
  stale renewals, transfer IDs/recipient checks and actual profile lifecycle reads.
- 67 repository JavaScript tests (including 10 v2 protocol/client/policy tests).
- Chromium profile smoke plus real Ed25519/WebCrypto signature and commitment
  fixture compatibility. Unpublished preview and disabled publishing remain intact.
- `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` for the registry.
- Local pinned-toolchain release WASM build passed. SHA-256:
  `76a8ce6ce72d8ea73116bafad83a770438aa0e3e8f1f87957177d855ddee8b65`.
- CI includes the new contract in test, audit and WASM-validation jobs. Workflow
  results and final source commit are recorded on PR #139; no live E2E is implied.
