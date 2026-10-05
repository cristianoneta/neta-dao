# NNS pre-deployment security and efficiency review

Owner-requested targeted source review, 2026-10-05. This is an internal adversarial
review with reproducible tests, not an independent third-party audit or a claim of
zero vulnerabilities. Scope: registry v0.3.1, unchanged profile contract, snapshot
pricing/publisher, mainnet manifest/deployment controller, signing/recovery bridge
and integrated Names price/payment UI. Other DAO/RELAY services were not re-audited.
No live transaction was sent. At 12:54 Berlin the owner confirmed that only the
old upload review had been opened; nothing was uploaded or signed.

## Corrected deployment and authorization findings

| Finding | Impact | Correction / evidence |
| --- | --- | --- |
| No Wasm migration admin in the initial deployment helper | Production bugs would require new contract addresses instead of controlled upgrades | Both instantiate messages now pin the approved owner wallet in the actual outer `admin` field; signed protobuf is compared exactly. Tests reject missing/substituted admin and wallet payload changes |
| Registry v0.3.0 forced the DAO to be application admin | The owner-requested tariff authority would fail at instantiation | v0.3.1 separates application admin from the fixed main-DAO fee recipient; manifest, plan, reader and export agree on the owner's address |
| Mainnet UI required exactly USD 99/19/5 | A legitimate later price adjustment would block purchases | Mainnet preparation uses freshly verified on-chain tariffs; browser regression changes pricing and successfully prepares a renewal at the new amount. UNI-7's existing tariff gate stays intact |
| Legacy calculator could overwrite the current verified tariff display | Displayed estimates could differ from the active tariff | Integrated Names owns the fee display; legacy navigation/input emits a refresh to that calculation instead of writing hardcoded prices |

Approved wallet for **both upgrade rights and registry administration**:
`juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`.
Fees go to the main NETA DAO:
`juno1c5v6jkmre5xa9vf9aas6yxewc7aqmjy0rlkkyk4d88pnwuhclyhsrhhns6`.
The new mainnet registry starts with annual USD 99/19/5 and purchases paused.

## Boundaries examined

- Registry `Receive` accepts only the configured real CW20 token. Payer, amount,
  normalized name, operation, owner/generation/revision/expiry and tariff/key
  versions are checked. Fees use integer/Uint256 arithmetic with upward rounding.
  Failed fee forwarding reverts payment, identity, nonce and commitment updates.
- Price signatures bind chain, registry, token, treasury, signer version, rate and
  original validity timestamps. The 24-hour maximum is enforced on-chain and in
  the browser. A buyer's ordinary wallet signature authorizes the exact payment;
  the shared price signature does not grant name ownership or wallet authority.
- Commit/reveal binds a 32-byte salt to chain/contract/owner/name and requires a
  later block. Replay nonces, expected expiry and ownership versions stop repeated
  payments/old transfer offers from mutating an already changed identity.
- Tariff changes are admin-only, positive-cent and version-bound; old prepared
  quotes fail after a change. The DAO fee destination has no ordinary setter.
  `set_admin` is restricted to the current application admin and changes neither
  treasury nor tariff. It is separate from Wasm upgrade custody.
- Synthetic future migration targets demonstrate that the current source can be
  upgraded without its own migrate entrypoint: the target supplies one, validates
  source identity/version and preserves storage. Tests reject unauthorized actors,
  preserve names/expiry/config/profile contacts and verify wallet-to-DAO
  `MsgUpdateAdmin` transfer removes the old wallet's upgrade authority. Every real
  future schema migration still requires its own tested conversion.
- Profile writes require current ownership/revision. Operator links require both
  correctly derived secp256k1 proofs over a chain/contract/name/identity-bound,
  expiring challenge. Transfer/reassignment invalidates old contacts and proofs;
  operator revocation remains unilateral. Real operator E2E is still deferred.
- The signing bridge checks chain, exact protobuf payload, fee, account and memo,
  journals signed bytes before sending, and reconciles exact transaction hashes.
  Unknown results never trigger automatic retransmission. Requests without the required upgrade admin cannot be newly signed. Recovery
  only reconciles an original request when its identity checks still pass; it
  cannot silently reclassify an immutable deployment as upgradeable. Historical UNI-7 data stay separate.

## Efficiency

No extra Render process, new market polling or on-chain price-update transaction
is introduced. The existing Treasury job publishes one shared signed observation
for many buyers. Registry operations use keyed storage reads/writes rather than
scanning all names; profile proof checks handle a fixed pair of operators. The
initial tariff now matches the intended launch tariff, avoiding a setup transaction.

The signing bundle is about 1.64 MB uncompressed and loaded on wallet use in the
main workspace (the separate deployment page loads it directly). Code/identity
verification adds bounded RPC requests; the final deployment export requires both
providers. These are deliberate checks at low current volume, not background
price polling. Successful purchase nonces accumulate in chain state; pruning is a
future scaling topic and must preserve replay protection. No load benchmark or
claim of unlimited capacity is made.

## Remaining trust and launch gates

- Control of the owner wallet allows tariff/key/pause changes and arbitrary
  authorized contract upgrades. An upgrade can change future rules, including
  payment behavior. This is deliberate initial custody, not a trustless guarantee.
  A later DAO handover requires separate owner-confirmed transactions and updated
  verified frontend/manifest pins; no handover has been performed.
- GitHub Actions and its price-signing secret are trusted for conversion rates.
  Secret installation remains unconfirmed. Authentic older snapshots remain usable
  until expiry by design; approximate pricing was expressly accepted by the owner.
- REST/RPC checks trust the pinned providers; two-provider comparison is not a
  Tendermint light-client proof. Provider outages can stop verification without
  authorizing a retry payment. Website/source/dependency integrity remains trusted.
- Owner-signed mainnet uploads, creations, production manifest, public signed price,
  activation and a real purchase receipt are still outstanding. Test evidence is
  synthetic and does not close these gates.

## Reproducible evidence

- 23 registry Rust tests and 12 profile Rust tests passed.
- 118 root/Names Node tests and 57 faucet/signing tests passed.
- Browser flows passed for mainnet deployment/recovery/export, price-key handling,
  mainnet dynamic-tariff purchases and preserved UNI-7 lifecycle integration.
- Registry Clippy passed with warnings denied; `cosmwasm-check` 1.5.11 accepted the
  new WASM. CI now rebuilds it with the pinned toolchain and compares exact bytes.
- New artifact: `assets/names-mainnet/neta_names_v2_v031.wasm`, SHA-256
  `f25c982db217363c395a1c09c3028988cff390323b0aa852249016bbebe974fc`.
  Historical v0.3.0 and UNI-7 registry/profile artifacts remain unchanged.
- CI, merge and served-file verification are recorded in the release PR after
  integration. Source/test evidence is not a live chain receipt.
