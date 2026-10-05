# NNS mainnet deployment — 2026-10-05

The owner signed four transactions and exported public receipts at 13:54 Berlin.
[Production manifest](deployments/nns-mainnet.json) ·
[Original public receipt bundle](deployments/nns-mainnet-receipts-2026-10-05.json).
The bundle contains public chain signatures/events only, never private keys.

| Action | Code | Height | Transaction |
| --- | --- | --- | --- |
| Store registry v0.3.1 | 5168 | 42391335 | `7C6BC00D7255ACCAAEA54AE6E4C86598B944AE4E8C46CAE24D7C042652812B0F` |
| Instantiate registry | 5168 | 42391393 | `77904434AD600176A750E89FA7DA7D31642D3B937D9ACF482314F845D3EBE1BB` |
| Store profiles v0.1.0 | 5169 | 42391418 | `B9F3FA477DD5A3334E7AC34CCF15F65A29698BCECD315EF3D5F741C27B0E19F3` |
| Instantiate profiles | 5169 | 42391432 | `34D7D86E1F59F7B8AAFDF8F3130DB94DA42B1140FB93346E21B6043A0F41D6A5` |

Registry: `juno1pc8wrq89ljuhu2qt6rtk5lkkrptxajtf3un5llu8prg7r4z50vlszfhhza`.
Profiles: `juno1y2yu66meq6p6wm0ur6wfwjr60ugaakjmefgjxqkw30l35kl45yhsywple6`.
Both creators/upgrade administrators and registry application admin:
`juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`.
Fee recipient: main NETA DAO `juno1c5v6jkmre5xa9vf9aas6yxewc7aqmjy0rlkkyk4d88pnwuhclyhsrhhns6`.

## Evidence and verification boundary

All four exported receipts report code 0 and intent matching. Local validation
matches each request against the existing deployment recipe, checked code IDs,
checksums, addresses and action order. Both exported provider observations match
at Juno heights 42391438/42391439: paused, tariff 99/19/5 USD (version 1), real NETA,
owner admin and approved public key (signer version 1). This offline consistency
check alone does not establish that an uploaded JSON represents chain truth.

Direct REST requests from the assistant execution environment returned 403/timeouts.
The dedicated **NNS mainnet deployment verification** PR workflow therefore gates
publication: it re-fetches all four transactions from the pinned RPCs, verifies
SHA-256 against raw transaction bytes, reuses the signing bridge's exact protobuf
intent matcher, checks actual deployment events, then verifies the full current
manifest/config independently through both pinned REST providers. It has read-only
permissions, no wallet, no price secret and no broadcast. The JSON report is a
workflow artifact. Record its successful run in the PR before merging.

Re-run before activation with dependencies installed via `npm ci --prefix faucet --ignore-scripts`:

```sh
node names/verify-mainnet-deployment.mjs docs/deployments/nns-mainnet-receipts-2026-10-05.json docs/deployments/nns-mainnet.json /tmp/nns-mainnet-verification.json
```

This is a paused initial-deployment check, deliberately failing after activation,
a tariff change or authority transfer. It is not a scheduled service or a new
price poller. Provider observations are not Tendermint light-client proofs.

## Remaining launch gates

1. Publish the manifest only after independent read-only verification succeeds.
2. Check the existing Main DAO snapshots job. Missing/mismatched signing authority
   must retain any previous public price and fail visibly. Never request a private
   price key in chat; do not generate a replacement.
3. Verify the public price signature, deployment binding and original observation/
   expiry, and the normal Mainnet Names UI while purchases remain paused.
4. Prepare a separate reviewed owner-wallet unpause, then verify one real purchase,
   exact NETA debit/DAO credit and name identity/expiry. No activation/purchase is
   recorded at this checkpoint. The dedicated owner tariff/unpause UI remains open.

Keep UNI-7 artifacts, completed tests, browser key and pending journals intact.
Treasury P&L work and validator E2E are deferred by the owner until NNS is finished.
