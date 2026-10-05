# NNS Treasury price snapshots

Owner decision, **2026-10-05**: reuse the existing Treasury WYND NETA price.
Ordinary price deviations and delayed updates are acceptable for name fees.
No separate Render NNS service, continuous market polling, TWAP warm-up,
liquidity-floor or hourly-movement gate is required for launch. The faucet and
its persistent disk are unaffected. This supersedes the earlier Render plan.

## Current implementation and boundary

Registry source `contracts/neta-names-v2` **v0.3.1** accepts shared signed prices.
The reviewed new artifact is `assets/names-mainnet/neta_names_v2_v031.wasm`, pinned
in `mainnet-artifacts.mjs`. The old `assets/names-testnet/` registry, deployed
UNI-7 contracts, original quote fixtures, keys and journals remain unchanged.
The v0.3.1 code also retains the original individual-quote hooks for compatibility.

The snapshot publisher and shared browser/client purchase path are implemented.
The owner completed mainnet registry/profile deployment on 2026-10-05. The
version-3 [production manifest](../docs/deployments/nns-mainnet.json) and
[four receipts](../docs/deployments/nns-mainnet-receipts-2026-10-05.json) are recorded.
Both exported provider observations show **purchases paused**, USD 99/19/5 and
owner-wallet administration. See [verification evidence](../docs/NNS_MAINNET_DEPLOYMENT_2026-10-05.md).
No unpause or mainnet purchase is recorded. Private backup custody, Actions secret
installation and the first valid public signed price still need confirmation.
Do not repeat key creation or deployment. UNI-7 keeps its existing manifest,
original local key and old quote flow; never direct snapshot payments to UNI-7.

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
never silently repriced. The approved owner wallet controls tariffs, price-key rotation and purchase pause.

The signed time records when the collector observed the source, not a guaranteed
last market trade time. This is a trusted scheduled price, not an on-chain oracle
proof. Scheduled Actions can run late or fail. Missing/nonpositive/malformed or
expired NETA prices stop new quotes. Other valid market movements are accepted.
No price jump limits or continuous-server safeguards are inherited from the old
WYND service. No additional hosting or API subscription is introduced; existing
GitHub Actions usage quotas/billing still apply.

## One-time setup and mainnet sequence

Current owner checkpoint: key creation and steps 3–5 are complete; do not repeat
them. Confirm the matching Actions secret, then continue with step 6.

1. Open [the owner setup page](https://dao.netareborn.com/names-mainnet-setup.html)
   on the owner's trusted machine. Click **Create price key**, download the private
   PEM backup, and follow the GitHub-secret instructions there. Only the public
   key is remembered in browser storage; restore the matching backup after reload.
   The page downloads the public deployment plan and sends no key over the network.
   This is a dedicated **Ed25519 price key**, not a wallet key. CLI alternative:
   `node names/create-price-key.mjs /private/path/nns-price-key.pem`.
   The script refuses overwrites and files inside this repository; it prints only
   the public key. Keep a private backup. Never paste the PEM into chat, commit it
   or upload it to a public artifact. Repository writers trusted with Actions
   necessarily control this price authority.
2. Store the PEM as the repository Actions secret **`NNS_PRICE_SIGNING_KEY`** in
   GitHub Settings → Secrets and variables → Actions. The scheduled main job
   receives it only in the signing step, never in a PR run. Do not generate or
   rotate a production key automatically. Loss/rotation requires registry-admin key rotation
   and a matching reviewed manifest before further publication.
3. `node names/mainnet-plan.mjs '<PUBLIC_KEY>' /tmp/nns-mainnet-plan.json` prepares
   unsigned deployment material and verifies local artifact hashes. No broadcast.
   Owner-sign the reviewed mainnet registry/profile upload and instantiation.
   Registry application admin is the approved owner wallet; treasury is the main NETA DAO. Both migration
   admins are the owner-approved wallet `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`.
   These are separate rights; do not substitute the deployer or DAO automatically.
   The registry starts paused with annual USD 99/19/5. Never upload the mock token or reuse UNI-7 addresses.
4. Verify and record exact receipts, code IDs/checksums, creator and addresses in
   **`docs/deployments/nns-mainnet.json`**. Use manifest `version:3`,
   `pricing_protocol:"treasury-snapshot-v1"`, `chain_id:"juno-1"`,
   `testnet_only:false`, real NETA/main DAO and the public price key/version.
   `validateSnapshotDeployment` checks identity and the new artifact pins.
5. Verify the initial **99 / 19 / 5 USD** annual tariff for 3 / 4 / 5–32-character
   names. Later changes are authorized by the owner's admin wallet, not the DAO.
   `tariffUpdate(manifest, freshlyReadConfig, tariff)` prepares a version-bound
   unsigned message using positive integer USD cents. It works while purchases
   are paused or open and does not change that pause. The compatibility export
   `tariffProposal` prepares the same wallet review, not a DAO proposal.
6. Verify a successful main DAO workflow, the public signed file, its original
   observation/expiry and browser verification against the actual deployment.
   Verify the implemented mainnet reader/wallet/page with the real manifest and signed price. The production manifest is recorded; secret installation and a successful signed
   publication are still unconfirmed.
7. Only after those dependencies, use a **separate admin-wallet unpause** transaction and
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

## Owner mainnet deployment page · 2026-10-05

Open `/names-mainnet-deploy.html` with Keplr and a funded Juno account. The pinned
public price key is `XfqS2XMXgZKJ5fiU721D3XsuhPas+4U1idUujcintdU=`.
Private backup and `NNS_PRICE_SIGNING_KEY` installation remain owner tasks and
are not verified by sharing the public key. Do not generate a replacement.

Review registry upload/creation, then profile upload/creation: four explicit
mainnet transactions, no token deployment. Keplr displays real JUNO gas fees.
The registry uses real NETA, the approved owner wallet as logical admin and the main DAO as fee recipient,
and starts paused. Both contract migration admins are the approved owner wallet. The helper has
no tariff/unpause action. Its state and signing journals are separate from UNI-7.

For unknown results, reconnect the same account in the same browser and choose
Check pending transaction; never delete site data or repeat an upload to recover.
Download public receipts after both providers verify pinned code, upgrade administrator, creator,
addresses, price key and paused configuration. This contains a version-3 manifest,
exact matched receipts and provider observations. Only after receiving/verifying
that output should `docs/deployments/nns-mainnet.json` be committed. The dated
`nns-mainnet-plan-2026-10-05.json` is unsigned preparation, not that live manifest.
Then follow tariff/price verification, separate owner-wallet activation and purchase
checks above. No live wallet transaction or private secret is claimed by UI tests.

### Upgrade authority and later DAO transfer

Owner decision 2026-10-05: retain upgradeability, initially controlled by
`juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`. A later handover to the main NETA DAO
uses `MsgUpdateAdmin` for **each** contract, signed by its current upgrade admin.
It does not require changing the code or contract address. After transfer, the
former wallet loses upgrade/admin-transfer authority; DAO execution is required.
Do not use `MsgClearAdmin`, which would permanently remove upgradeability. No
transfer is performed by the deployment helper. Update and verify the pinned
admin policy/production manifest with the reviewed handover receipts at that time.

Future upgrades upload a reviewed new WASM and use `MsgMigrateContract`, authorized
by the then-current admin. The **target** code needs a suitable `migrate` entrypoint
that validates old contract identity/version and preserves or explicitly converts
storage. The current source need not have a migrate entrypoint to be migrated away
from, so the existing pinned uploads remain usable. The synthetic cw-multi-test
checks owner-only migration, later DAO transfer, rejection of former/unauthorized
admins and preservation of registry configuration, name ownership/expiry and profile
contacts. Every actual future schema migration still needs its own tests and
reviewed code/receipt checks. Frontend code pins must be updated deliberately too.

The helper preserves existing upload journals. An old no-admin creation is only
recoverable as the exact original transaction; it cannot be rewritten to the new
admin. A recovered immutable instance blocks further setup and needs an explicit
owner decision. Do not clear browser storage or automatically deploy a replacement.

Owner correction at 12:53 Berlin: the wallet also holds application administration.
Registry v0.3.1 exposes admin-only `set_admin: {admin: <new address>}` for a future
explicit application-authority transfer, independently of each Wasm upgrade admin.
The immutable fee-recipient field stays the main DAO in this reviewed code; no
ordinary admin action redirects fees. An authorized future code upgrade could
change contract behavior, so upgrade-wallet custody is a deliberate trust boundary.
The owner confirmed no prior mainnet upload/signature at 12:54. Start with v0.3.1,
not the historical v0.3.0 artifact. Initial tariff already matches 99/19/5, so there
is no extra tariff-setting transaction required before launch.
