# NNS Treasury price snapshots

Owner decision, **2026-10-05**: reuse the existing Treasury WYND NETA price.
Ordinary price deviations and delayed updates are acceptable for name fees.
No separate Render NNS service, continuous market polling, TWAP warm-up,
liquidity-floor or hourly-movement gate is required for launch. The faucet and
its persistent disk are unaffected. This supersedes the earlier Render plan.

## Current implementation and boundary

Registry source `contracts/neta-names-v2` **v0.3.0** accepts shared signed prices.
The reviewed new artifact is `assets/names-mainnet/neta_names_v2.wasm`, pinned
in `mainnet-artifacts.mjs`. The old `assets/names-testnet/` registry, deployed
UNI-7 contracts, original quote fixtures, keys and journals remain unchanged.
The v0.3.0 code also retains the original individual-quote hooks for compatibility.

The snapshot publisher and shared browser/client purchase path are implemented.
They do **not** imply a mainnet deployment or live purchase: no production price
secret, reviewed mainnet manifest, new contract addresses or wallet receipts are
recorded. The normal website reader/wallet remains UNI-7-only; its test purchases
continue using the original local key. Mainnet reader/wallet and page wiring are
still a separate launch dependency. Never point the new snapshot client at the
old UNI-7 registry and claim it supports the new hooks.

## How it works

1. `scripts/update_treasury.py` already reads WYND JUNO/NETA reserves and a JUNO/USD
   reference (CoinGecko, with its existing DefiLlama fallback). It now records
   `nns_price` in its snapshot using those **same reads**, even with zero NETA
   holdings. This observation is independent of unrelated unpriced Treasury
   assets; a PARTIAL portfolio is not automatically a missing NETA price.
2. The existing main DAO job runs at minutes **7 and 37**. After collection,
   `publish-snapshot.mjs` signs the main DAO observation offline and writes
   `data/nns/price.json`. It makes no new market or chain API request.
3. The price signature binds chain, registry, real payment token, DAO treasury,
   signer version, USD/NETA integer rate, observation time and expiration. Its
   lifetime is **at most 24 hours from the original observation**, not from a
   retry or publication time. Failed signing retains the last good file and
   reports a failed Actions step without preventing Treasury output publication.
4. `snapshot-client.mjs` verifies that public file and locally prepares a purchase
   for the current name/owner/term/tariff. `NamesV2Client.snapshotQuote` integrates
   this with registration and renewal. The host shows `snapshotReview` (exact
   NETA debit, rate, observation time and validity), identity and chain, then gets
   a separate click before calling `register` or `renew`.
5. The contract checks signature/time/key, current tariff, exact amount, payer,
   commitment and current name identity. A registration still uses commit/reveal;
   renewal still binds owner/generation/revision/old expiry. The payer's wallet
   transaction authorizes the purchase; the shared price does not authorize it.
   The fee is forwarded atomically to the main NETA DAO. Failed forwarding rolls
   back the debit and registry changes. Pending transaction recovery is unchanged.

The browser uses the latest published file. **Older authentic snapshots remain
usable until their signed expiry**, including after a newer price is published.
There is intentionally no on-chain price-update transaction or latest-price
sequence counter. The owner accepts approximate pricing; limiting old-price
selection further would require a different protocol. A five-minute *purchase
review* remains separate from the 24-hour price lifetime: an expired review is
never silently repriced. Price/key/tariff/purchase pause controls remain with the DAO.

The signed time records when the collector observed the source, not a guaranteed
last market trade time. This is a trusted scheduled price, not an on-chain oracle
proof. Scheduled Actions can run late or fail. Missing/nonpositive/malformed or
expired NETA prices stop new quotes. Other valid market movements are accepted.
No price jump limits or continuous-server safeguards are inherited from the old
WYND service. No additional hosting or API subscription is introduced; existing
GitHub Actions usage quotas/billing still apply.

## One-time setup and mainnet sequence

1. Create a dedicated **Ed25519 price key**, not a wallet key, on the owner's
   trusted machine with Node:
   `node names/create-price-key.mjs /private/path/nns-price-key.pem`.
   The script refuses overwrites and files inside this repository; it prints only
   the public key. Keep a private backup. Never paste the PEM into chat, commit it
   or upload it to a public artifact. Repository writers trusted with Actions
   necessarily control this price authority.
2. Store the PEM as the repository Actions secret **`NNS_PRICE_SIGNING_KEY`** in
   GitHub Settings → Secrets and variables → Actions. The scheduled main job
   receives it only in the signing step, never in a PR run. Do not generate or
   rotate a production key automatically. Loss/rotation requires DAO key rotation
   and a matching reviewed manifest before further publication.
3. `node names/mainnet-plan.mjs '<PUBLIC_KEY>' /tmp/nns-mainnet-plan.json` prepares
   unsigned deployment material and verifies local artifact hashes. No broadcast.
   Owner-sign the reviewed mainnet registry/profile upload and instantiation.
   Registry admin AND treasury are the main NETA DAO; migration admins are null.
   The registry starts paused. Never upload the mock token or reuse UNI-7 addresses.
4. Verify and record exact receipts, code IDs/checksums, creator and addresses in
   **`docs/deployments/nns-mainnet.json`**. Use manifest `version:3`,
   `pricing_protocol:"treasury-snapshot-v1"`, `chain_id:"juno-1"`,
   `testnet_only:false`, real NETA/main DAO and the public price key/version.
   `validateSnapshotDeployment` checks identity and the new artifact pins.
5. Through the actual main NETA DAO proposal module, execute the approved
   **99 / 19 / 5 USD** annual tariff for 3 / 4 / 5–32-character names. Use
   `tariffProposal(manifest, freshlyReadConfig)` for the exact version-bound
   message. This keeps purchases paused; chat approval is not DAO execution.
6. Verify a successful main DAO workflow, the public signed file, its original
   observation/expiry and browser verification against the actual deployment.
   Finish mainnet reader/wallet/page integration and recovery review. No secret
   or production manifest is currently installed by this change.
7. Only after those dependencies, use a **separate DAO unpause** proposal and
   verify one explicitly reviewed owner-signed purchase, exact NETA debit/DAO
   credit and resulting identity/expiry. Record evidence before calling NNS live.

The source workflow deliberately skips NNS signing while the mainnet manifest is
absent. Once the manifest exists, a missing/mismatched key is a visible failure.
There is no fabricated `data/nns/price.json` or placeholder mainnet deployment.

## Verification and retained alternatives

- `node --test names/tests/*.test.mjs tests/*.test.mjs`
- `python -m unittest tests/test_treasury_history.py tests/test_dao_onboarding.py`
- `cargo test --locked --manifest-path contracts/neta-names-v2/Cargo.toml`
- `cargo clippy --locked --all-targets --manifest-path contracts/neta-names-v2/Cargo.toml -- -D warnings`
- `bash scripts/build-wasm.sh neta-names-v2`; compare to `assets/names-mainnet/`.

New tests cover one price for multiple buyers, exact fees, real CW20 forwarding
and rollback, replay/identity checks, context/signature/time/key/tariff failures,
Node/Rust byte compatibility, zero holdings, offline publisher failures and
retained timestamps, and journaled client recovery with snapshot hooks.
Existing lifecycle tests remain applicable; none is a new live-wallet receipt.

The earlier implementation under `service/` and `quote-policy.mjs` is retained as
a deferred alternative, with its own tests and original artifact assumptions.
Its old operational instructions are [archived](../docs/archive/NNS_WYND_SERVICE_BEFORE_SNAPSHOTS_2026-10-05.md)
and its unused Blueprint is [archived](../docs/archive/nns-render-observe.yaml).
Do not create a Render NNS service as the next step.
