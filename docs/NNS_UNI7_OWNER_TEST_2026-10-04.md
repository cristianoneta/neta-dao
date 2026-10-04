# NNS UNI-7 owner test — 2026-10-04

## Current continuation

Setup and browser recovery, registration, contacts, renewal and transfer are now
complete as owner-driven flows with post-state checks. The older steps below are
historical recipes, not instructions to repeat them. See the latest NNS handoff:
cristiano.neta now belongs to the second wallet and its old contacts are invalidated.

For the new Validator ownership section: connect the name owner, enter the name
and exact juno-1 / uni-7 junovaloper addresses, then Prepare ownership proofs.
Review the exact message. Select each corresponding operator account in Keplr and
click its separate ownership-signing button. Reconnect the name owner, Review
publication, and separately Confirm in Keplr. Read current link after inclusion.
Use Review owner unlink for name-owner removal, or Withdraw operator consent to
prepare and sign a revocation using either operator. A UNI-7 payer then explicitly
publishes it. No name-owner consent is needed for a valid operator revocation.
All signatures require review; mainnet ownership signatures send no transaction.
No consenting operator or real validator-publication evidence is recorded yet.


## Current owner checkpoint

The isolated deployment is complete: codes 122/123/124, three contracts, and
activation are confirmed on UNI-7. See [the next-chat handoff](HANDOFF_NEXT_CHAT_NNS_2026-10-04.md)
for all seven receipts and the [public manifest](deployments/nns-uni7-owner-2026-10-04.json).
The instructions below do not require redeployment of these existing contracts.

Browser recovery is complete. The owner exported and used the verified manifest;
registration, public contacts, renewal and accepted transfer have been observed.
Do not repeat activation or those name operations to recover the interface.

## Resume the existing deployment

1. Keep the same browser/site data. Open `names-v2-lab.html`, load the saved
   manifest and Verify deployment. Connect the wallet for the intended action.
2. For `cristiano.neta` owner actions use the second wallet recorded in the NNS
   handoff. Read current state before signing; it has empty contacts after transfer.
3. If a pending transaction exists, use Check pending transaction and its exact
   receipt. Nothing is automatically resent. Never clear journals to bypass a lock.
4. Continue the consenting-operator test above. For a remote volunteer, use their
   own active test name and wallets in their browser; unpublished proofs cannot
   currently be exchanged between browsers. A new isolated setup, if needed for
   that volunteer, is separate from the owner's completed deployment.

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

Original setup-slice checks: 72 root Node tests, 45 faucet-package tests (including real protobuf
setup/receipt tests), the test-token Rust test and strict Clippy, both Chromium
Names browser suites, actual non-exportable IndexedDB key persistence, valid local
quote signatures, blocked mainnet quoting, keyboard flow and 320/390/768/1440px
screenshots. Registry/profile Rust tests remain in CI from the preceding slice.
The complete seven-transaction setup is tested against a deterministic RPC harness,
including a lost upload response and reload recovery. This is not a live E2E.
CI also validates all seven WASM crates, compares the three shipped artifacts,
checks dependency audits and verifies signing-bundle reproducibility.

Setup receipts and completed owner-test post-states are recorded in the NNS
handoff. PR #145 subsequently passed 84 root Node tests plus browser/operator-flow
checks; its release evidence is recorded there. Next evidence is live operator
link/unlink/revocation and exact receipt archival. Do not activate mainnet purchases
or award delegation points from these fixtures.
