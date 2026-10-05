# NNS WYND quote service

Implemented server and Render Blueprint; **not yet deployed or connected to paid
mainnet purchases**. The owner selected WYND JUNO/NETA and confirmed annual
USD 99 / 19 / 5 on 2026-10-05. The operational thresholds below are the initial
implementation proposal; observe live behavior before enabling issuance.

## Price and trust model

The pair is `juno1h6x5jlvn6jhpnu63ufe4sgv4utyk8hsfl5rqnrpg2cvp6ccuq4lqwqnzra`.
`juno1uu3cewmpynvgsdu3lfqv2rh2n5nwtrguahkw64wjk99eg8r6fsss0e757x` is its **LP token**,
not the pair. Asset identity, pool/token code IDs and hashes, creators and admins
are pinned in `service/chain.mjs`. The pair may be migrated by WYND governance;
such a migration deliberately stops this service until its new code is reviewed.

Two independent REST providers (STAVR and Validatus) must agree on the same block
hash and the complete requested data at one height. Every state query must return
the requested `x-cosmos-block-height`. No fallback to unpinned/latest-only state.
This trusts those providers; it is not a Tendermint light client.

The pair's NETA -> JUNO cumulative-price difference divided by elapsed seconds
produces a 30-minute arithmetic average, with WYND's 10^6 precision. Multiply it
by CoinGecko's **juno-network/USD** reference (decimal parsed into integers, with
the provider's `last_updated_at`). NETA fees round upward to microNETA. The service
does not buy/swap NETA or estimate swap execution/slippage. Treasury JSON is never
used as a price source.

Initial guards:

| Check | Limit |
| --- | --- |
| Average window | At least 1,800 seconds; observations no more than 120 seconds apart |
| Pool/block freshness | 90 seconds |
| JUNO/USD freshness | 300 seconds |
| Reserve floor throughout sampled window | 80,000 JUNO and 700 NETA |
| Spot versus average | At most 10% |
| USD/NETA movement versus accepted price about one hour ago | At most 10% |
| Maximum baseline age | 2 hours |
| Signed offer lifetime | 300 seconds |
| Quote attempts, globally | 20/minute, 1,000/UTC day, persisted across restarts |
| Concurrent quote requests | 2 |
| Ordinary HTTP requests | 300/minute; health check excluded |

There are no remote operator endpoints for changing these limits, the baseline,
the quote key or the deployment. Changing the source requires a reviewed release.
`NNS_CONFIG_JSON` supplies the initial observed USD/NETA baseline and verified
deployment. Accepted price history replaces that baseline as the hourly reference
becomes available. A movement failure does not advance accepted price history;
an extended halt requires deliberate operator investigation/re-anchoring.

On 2026-10-05 at block **42386655** (08:30:17 UTC), both providers agreed on
103,019.433705 JUNO and 881.970017 NETA. CoinGecko's separately timestamped JUNO
reference was about USD 0.00892095. This implies roughly USD 1,838 total spot pool
value; it is not proof this is the largest market and is not a launch-ready TWAP.
Thin liquidity remains manipulable despite the guards. A prolonged price
distortion can still affect this trusted oracle. Missing data or one failed
provider stops new quotes rather than silently changing sources.

## Hosting in Render

Create a **separate Blueprint** in Render for `cristianoneta/neta-dao`, branch
`main`, Blueprint path **`names/render.yaml`**. Do not point the faucet Blueprint
at this file. Root Directory stays empty: this service imports shared root modules.
Review Render's displayed price for the `0.5c-512mb` service and 1 GB persistent
disk. One instance, Frankfurt, automatic deployments and previews disabled.

The Blueprint runs Node 24.19.0, `node names/service/server.mjs`, with durable
`/var/data/nns/quotes.sqlite`. Supply a CoinGecko Demo API key in the private Render
environment (`COINGECKO_DEMO_API_KEY`). The reader also works without a key where
CoinGecko permits public access; a denied/rate-limited response stops readiness.
The polling loop waits 30 seconds after each completed observation, so provision
the upstream request budget for up to 2,880 CoinGecko reads/day (actual frequency
is lower due to request duration). Check the selected account's monthly allowance
before using its key; the service does not upgrade or purchase an API plan.
No wallet mnemonic, private wallet key or faucet secret is needed.

First boot creates an Ed25519 quote key **inside the private SQLite database**.
`/status` exposes only its public key, configured policy and market observations.
Keep the disk and database/WAL together across deploys. Use a consistent SQLite
backup stored privately: it contains the signing key. Never attach it to a chat,
commit it, serve it through Pages or delete it to reset readiness. Losing it needs
an explicit DAO key rotation. There is no automatic rotation or cloud backup.
Disk restores may roll back request counters/audit history; investigate before
resuming issuance. On-chain quote nonces/identity checks still enforce replay rules.

Default `NNS_CONFIG_JSON={"signing_enabled":false}` runs **observe mode**. After a
complete uninterrupted 30-minute window, `/status.indicative` shows the averaged
USD/NETA value. `market_ready` remains false without a reviewed initial baseline.
Health check success means the process runs; it does not mean purchases are ready.
Restart once and verify the same public key and retained observation window.

After the service is live, send only its public URL/public key for the next step.
Do not enter deployment addresses copied from the UNI-7 manifest.

## Mainnet sequence

1. Deploy the quote service in observe mode and record its public key. Review the
   live pool observations, limits and behavior across restart.
2. Run `node names/mainnet-plan.mjs '<PUBLIC_KEY_FROM_STATUS>' /tmp/nns-mainnet-plan.json`.
   This checks the two existing WASM hashes and writes unsigned review material;
   it does not upload, instantiate, sign or broadcast anything. The asset folder's
   historical `names-testnet` name does not change the registry's explicit
   `juno-1`/real-NETA/DAO constraints. Never upload the mock token on mainnet.
3. Upload/instantiate the two reviewed contracts with the owner's explicit
   mainnet wallet signatures. The registry's governance admin AND treasury are
   the main NETA DAO, not Operations or the uploading wallet. CosmWasm migration
   admins are empty/null. The registry starts paused. Record code IDs, creators,
   immutable checksums, addresses and exact successful receipts. No mainnet
   deployment or mainnet Keplr setup page has been shipped by this service slice.
4. Create a reviewed version-2 manifest using those real observations. Validate
   it with `validateDeployment` and `MainnetReader.registry`. The shape is the
   existing test manifest with `version:2`, `chain_id:juno-1`, `testnet_only:false`,
   real NETA, DAO governance/treasury, actual registry/profile code pins, and the
   production quote key/version. Token identity is fixed by the service.
5. `tariffProposal(manifest, freshlyReadConfig)` in `mainnet-plan.mjs` prepares the
   exact DAO `wasm.execute` message for `set_tariff`, including its current expected
   version. Submit via the DAO's real governance module; chat assent is not the
   DAO transaction. This proposal **keeps purchases paused**. Check its executed
   receipt and tariff version before continuing.
6. Finish/review the mainnet website reader, wallet, quote-client and recovery
   integration. Existing website flows remain UNI-7; swapping a chain string or
   production constant is insufficient. Preserve all existing test journals.
7. Set `NNS_CONFIG_JSON` to `{signing_enabled:true, deployment:<verified manifest>,
   baseline:{usd_per_neta_12:<reviewed value string>, observed_at:<epoch seconds>}}`
   as actual JSON. Changing the baseline starts a new 30-minute sample window.
   The registry still rejects purchases while paused; the service checks current
   config, tariff, identity, signer and contract pins for every quote.
8. After readiness and frontend review, prepare a **separate** DAO
   `set_purchases_paused:{paused:false}` proposal. Verify its execution, then make
   one explicitly reviewed owner-signed purchase and check exact debit/DAO credit,
   identity and expiry. Only that closes the first mainnet-purchase gate.

The UNI-7 tariff change remains a separate transaction by the original test admin
in the lab. Its confirmation cannot activate a future DAO-administered mainnet
registry. Live validator tests remain deferred by the owner.

## HTTP and operations

- `GET /healthz`: process health; no upstream request.
- `GET /status`: cached public observations, policy, public key and mode.
- `POST /quote`: JSON `{operation:"register"|"renew", payer, name, years}` only.
  Never accept a client-provided rate, amount, recipient, identity or tariff.
  Returns the existing `{quote,signature}` protocol; errors return no signature.
- CORS allows `https://dao.netareborn.com`; backend callers can omit Origin.
  Request limits, not CORS, bound public server usage. No IP-header trust required.
- Amount/price and preimage hash are recorded before signature delivery. The
  30-day audit contains no plaintext requested names, payers or private keys.
- Monitor `/status` and errors. Availability/flood protection at the hosting edge
  is separate from these application limits. Limits are not a hosting invoice cap.

Local tests: `node --test names/tests/*.test.mjs` and `node --test tests/*.test.mjs`.
The standalone CI uses pinned Node 24.19.0. No added npm dependencies.

References: [WYND pair oracle source](https://github.com/wynddao/wynddex/blob/main/contracts/pair/src/contract.rs),
[WYND pair types](https://github.com/wynddao/wynddex/blob/main/packages/wyndex/src/pair.rs),
[CoinGecko Demo price API](https://docs.coingecko.com/demo/reference/simple-price),
[Render Blueprint reference](https://render.com/docs/blueprint-spec).
