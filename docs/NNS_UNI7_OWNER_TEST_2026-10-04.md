# NNS UNI-7 owner test — 2026-10-04

## Current owner checkpoint

The isolated deployment is complete: codes 122/123/124, three contracts, and
activation are confirmed on UNI-7. See [the next-chat handoff](HANDOFF_NEXT_CHAT_NNS_2026-10-04.md)
for all seven receipts and the [public manifest](deployments/nns-uni7-owner-2026-10-04.json).
The instructions below do not require redeployment of these existing contracts.

The latest owner screen still reports an invalid checksum and pending unpause.
The checksum normalization fix is live in PR #142, but successful recovery in the
owner's browser has not yet been reported. Do not assume a hard reload solved it.

## Resume this existing deployment

1. Hard reload names-v2-setup.html without deleting site data. Prepare the existing
   test signer, connect the same Keplr wallet, then Check pending transaction.
2. Recover activation receipt 3A33D74BE3F1F1C059D22FF19D0E3D131F1100EC3CC6A1BEB84D904E03BB9853
   if its optional exact hash is needed. Never activate/upload/deploy again to
   repair this UI. If the checksum error persists, inspect actual loaded module
   versions and endpoint checksum responses; do not disable verification.
3. Save verified manifest. Open names-v2-lab.html in the same browser, load the
   manifest, Verify deployment, then Connect Keplr.
4. Prepare a test name, Reserve name in Keplr, create/review the local quote,
   then explicitly confirm the mock-NETA payment. Record each exact receipt.
5. Publish optional public contacts; separately test renewal and a transfer to a
   second wallet with acceptance, then old-profile invalidation. These live tests
   remain unrecorded. The final consenting validator/proof UI flow remains open.

## Fresh isolated deployment only

For a deliberately new deployment, use Prepare test signer / Connect Keplr, then
review and separately confirm upload + instantiate for token, registry and profiles,
followed by activation and manifest export (seven transactions). This recipe is
not the next action for the existing owner's deployment.

Keep this browser's site data during the test. The test quote key is a non-exportable
Ed25519 CryptoKey in an isolated IndexedDB store. It is deliberately separate from
Keplr keys and from RELAY encryption keys. It does not follow the wallet to another
browser. Loss requires administering a new test authority/deployment; there is no
backup/rotation UI in this slice. Never reuse this test authority for mainnet.

The mock CW20 creates 1,000,000 TNETA (six decimals) for the deploying wallet, with
no minter. It rejects instantiation/execution outside UNI-7. Registry fees go to
the test administrator wallet; actual mainnet source still pins the main NETA DAO.
The local quote is explicitly **fictional USD 2 per mock NETA**, not live pricing.
No new quote server or paid resource is needed for this isolated operator test.
Production market policy, feed verification, hosted service and custody remain open.

## What the implementation verifies

- `names-v2-reader.mjs`: allowlisted UNI-7 REST endpoints, current block freshness,
  every role's code ID/checksum/creator/migration admin, registry config and quote
  authority, six-decimal CW20 and the profile contract's registry binding. Missing
  data fails closed. Reads reuse deployment verification for at most ten seconds;
  signing forces a fresh verification. This is not a Tendermint light client.
- `faucet/src/names-signing.mjs`: pinned UNI-7 signing RPC, exact protobuf payload,
  memo, native-fund absence and unchanged reviewed fee after signing; fresh wallet
  check before and after the Keplr popup. Store and instantiate are limited to the
  setup's reviewed recipe and shipped code. The wallet never signs for mainnet.
- Shared origin journal: uses the existing `neta-pending-tx-v1:uni-7:<wallet>` gate
  and Web Lock. No other app journal implementation or behavior was replaced.
  Names/Setup have additional durable attempt IDs and their own preparation locks.
- Signed bytes are persisted before broadcast. The receipt is fetched by exact
  hash, its raw bytes are hashed and its single protobuf message matched to the
  preserved intent. A generic successful transaction cannot unlock a Names action.
- Explicitly rejected/unbroadcast attempts can be recovered without submitting
  again. Included code failures restore the appropriate review phase. Unknown
  outcomes preserve both journals. A crash during signing without signed bytes or
  a proven exact receipt remains locked; never erase site data to bypass it.
- Setup confirms receipt events and then queries the actual code/contract identity
  before advancing. A timeout cannot trigger another upload/instantiate. Setup
  records contain public recipes; large WASM bytes are reloaded from checksum-pinned
  assets during recovery. Completed attempt records omit redundant signed bytes.
- Gas uses simulation with a 1.8 multiplier and a 250,000 floor at 0.2 ujunox/gas.
  Estimate caps are 10,000,000 for store-code, 2,000,000 otherwise. Thus maximum fees
  are 3.6/0.72 JUNOX respectively. Keplr shows the actual fee; changed fees are
  rejected before broadcasting. These are test gas caps, not hosting limits.

An imported lab manifest is operator-supplied configuration, not an authenticated
public deployment announcement. The page says so. Production deployment constants
remain null, and public purchases/profile publishing in the normal workspace stay
disabled. The normal profile preview links to the separate operator setup.

## Files and shipped artifacts

- `names-v2-setup.html`, `names-v2-setup-core.mjs`, `names-v2-setup.mjs`: explicit
  owner-driven deploy, recovery and manifest export.
- `names-v2-lab.html`, `names-v2-lab.mjs`, `names-v2-wallet.mjs`: Keplr session,
  registration/renewal/transfer/contact-profile review and recovery.
- `names-v2-test-authority.mjs`: isolated IndexedDB authority and UNI-7-only synthetic
  quote issuance. A different configured quote key is rejected.
- `names-v2-artifacts.mjs`, `assets/names-testnet/`: three reviewed WASMs.
  CI rebuilds and byte-compares them; browser setup hashes each before upload.
- `contracts/neta-names-test-token`: UNI-7-only fixed-supply CW20 wrapper.
- `assets/names-signing.js`: reproducible bundle from the existing locked faucet
  dependencies, built with `npm run build:names --prefix faucet`. It is loaded only
  by the two operator pages. The existing faucet bundle and behavior are unchanged.

## Validation and next evidence

Local checks: 72 root Node tests, 45 faucet-package tests (including real protobuf
setup/receipt tests), the test-token Rust test and strict Clippy, both Chromium
Names browser suites, actual non-exportable IndexedDB key persistence, valid local
quote signatures, blocked mainnet quoting, keyboard flow and 320/390/768/1440px
screenshots. Registry/profile Rust tests remain in CI from the preceding slice.
The complete seven-transaction setup is tested against a deterministic RPC harness,
including a lost upload response and reload recovery. This is not a live E2E.
CI also validates all seven WASM crates, compares the three shipped artifacts,
checks dependency audits and verifies signing-bundle reproducibility.

Setup confirmations are now recorded in the next-chat handoff. Next evidence is
successful browser recovery and the live registration/profile/renewal/transfer tests.
Then finish operator proof collection/submission with a willing validator. Do not
resume the delegation dashboard or activate mainnet purchases from these fixtures.
