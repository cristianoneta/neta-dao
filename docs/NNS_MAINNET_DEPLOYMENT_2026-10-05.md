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
workflow artifact. PR #161 passed all four final checks and merged as
`7bdcb47e140c0efda768b5cae5fcd828a4526dc4`; final live verification run
[37307194424](https://github.com/cristianoneta/neta-dao/actions/runs/37307194424) passed.

Re-run before activation with dependencies installed via `npm ci --prefix faucet --ignore-scripts`:

```sh
node names/verify-mainnet-deployment.mjs docs/deployments/nns-mainnet-receipts-2026-10-05.json docs/deployments/nns-mainnet.json /tmp/nns-mainnet-verification.json
```

This is a paused initial-deployment check, deliberately failing after activation,
a tariff change or authority transfer. It is not a scheduled service or a new
price poller. Provider observations are not Tendermint light-client proofs.

The published normal Names page was read in the browser after deployment:
**Juno mainnet verified · purchases paused · annual USD 99 / 19 / 5**.
Reservation/payment controls remained disabled.

## Evening investigation: recurring failure emails

The owner's 19:30 Berlin screenshot shows Main DAO snapshots failure emails.
The two latest corresponding runs were read directly:

| Run | Screenshot time (Berlin) | Collection | NNS signing | Treasury publication |
| --- | --- | --- | --- | --- |
| [37343822798](https://github.com/cristianoneta/neta-dao/actions/runs/37343822798) | 18:50 | success | failed | success |
| [37347330414](https://github.com/cristianoneta/neta-dao/actions/runs/37347330414) | 19:18 | success | failed | success |

Both report the fixed diagnostic: **Price key must be a valid unencrypted PEM
private key.** The exact private input and underlying parser errors were not
inspected or logged. This cannot distinguish missing PEM delimiters, wrong file
contents, broken line breaks or an encrypted key; do not invent a specific cause.

The existing cron (`7,37 * * * *`, starts can be delayed) repeats the failing
signing step every half hour, so GitHub repeats failure notifications. The final
publication step deliberately runs after a signing error. Latest inspected bot
commit `c285eaf` publishes the 17:17:41 UTC Treasury observation; portfolio status
remains PARTIAL, not a claim of full coverage. At inspected main `22a5706`,
`data/nns/price.json` is absent. At that checkpoint there was no usable public NNS price; see the recovery below.

These jobs do not upload or instantiate contracts, use a Keplr wallet, or spend
JUNO gas. No workflows, notifications or schedules were disabled to conceal the
error. This evening review changed documentation only. The secret was subsequently corrected and independently verified as recorded below.

## Price-key recovery and access-path verification — 19:50 Berlin

The owner confirmed at 19:37 that the PEM BEGIN/END delimiters had been omitted,
then privately corrected the existing Actions secret at 19:38. No replacement
key, deployment or chain write was made. Retrying old run 37347330414 proved key
parsing, public-key matching and signing succeeded, but publication conflicted
with newer generated data. Use a fresh **Main DAO snapshots** workflow on main
after secret changes; rerunning old snapshot jobs can rebase stale generated data.

Fresh run [37350238171](https://github.com/cristianoneta/neta-dao/actions/runs/37350238171)
succeeded and committed the first price as `5f2790701ef827f2e7ac7f6f11fe13f86fc905db`.
Pages run 37350292762 succeeded. The served `data/nns/price.json` matched the committed
file byte-for-byte. WebCrypto and Node Ed25519 verification passed against the
pinned public key; deployment fields and original collector price matched.
Observation: **2026-10-05T17:41:02Z**; expiry: **2026-10-06T17:41:02Z**;
rate: **1.051527774123 USD/NETA**, signer version 1. These are dated observations,
not a permanently current quote. Preserve source timestamps and the 24-hour cap.

Direct assistant access encountered Cloudflare 1010 at Polkachu, proxy-generated
502 responses at some other providers, and timeouts. These do not establish
general provider outages. The existing read-only **NNS mainnet deployment
verification** workflow successfully ran again via GitHub Actions:
run **37307194424**, new job **111902537250**, verified at **17:49:53 UTC**.
Polkachu (height 42399738) and STAVR (42399739) independently matched code identity,
owner administrators, pinned public key, tariff version 1 / USD 99/19/5, and
purchases paused. All four original transaction payloads were reverified.
Use this established runner-based check when direct environment access fails.

Two-provider comparison is the launch/deployment review gate, not a requirement
for every ordinary page read or price refresh. `NamesV2Reader.verify` uses one
verified provider with fallback; normal price use verifies signature, deployment
binding and expiry. The deployment workflow is read-only and has no wallet,
price secret or broadcasts. It deliberately expects the initial paused state;
after activation or a tariff/admin change it must not be reused as a generic
health check without a reviewed update to expected state.

## Owner activation and first mainnet purchase — 20:20 Berlin

PR #166 shipped the owner-only opening/pausing review. All four PR checks, three
main checks and Pages run `37354104975` passed; all six changed served application
files matched their local SHA-256. The owner reviewed and confirmed opening in
Keplr, then confirmed reservation and payment through the normal Names page.

| Action | UTC time | Height | Transaction |
| --- | --- | --- | --- |
| Open purchases | 18:17:20 | 42400382 | `4937E8F871C5C0970960BF65AADFA88D7DD6DDB100B8B3B7EEE7D8D011867EEB` |
| Reserve name | 18:19:50 | 42400441 | `BA0F52C93627A99BA15FE087F68C2AFB5CA483A5BD09293F56A9D713CBF25001` |
| Pay and register | 18:20:13 | 42400450 | `85689A2C75DE86829D4116FA0AABBA5062D269679CA139984E169E8E2ACF8DC1` |

All three decoded REST receipts report code 0 and the approved owner sender.
Activation executes exactly `set_purchases_paused: {paused: false}` against the
manifest registry. The payment executes CW20 `send` through the pinned NETA token,
with a one-year `register_snapshot` hook for `cristiano.neta`, tariff/signer version 1,
price **1.051503244853 USD/NETA** and amount **4,755,098 base units = 4.755098 NETA**.
The token's successful `send` event records owner → registry, and its `transfer`
event records registry → approved main NETA DAO for that same amount. Payment gas
fee: **0.037164 JUNO**; reservation gas fee: **0.019377 JUNO**.

Fresh config observed at 18:18:22 UTC shows purchases open with unchanged admin,
key and tariff. Fresh identity/name_of/resolve reads at 18:20:48 UTC agree:
`cristiano.neta` is active, owned by `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`,
generation **1**, ownership revision **1**, expiry **2027-10-05T18:20:13Z**.
A subsequent correctly formed `commitment: {address: owner}` query returned null.
This is a distinct mainnet registration, not the earlier UNI-7 identity/revision.

[Public launch receipts](deployments/nns-mainnet-launch-receipts-2026-10-05.json)
archive the three relevant decoded transaction responses, wasm events and successful
post-state queries from **STAVR REST**. This follow-up is a single-provider observation;
it does not claim a new two-provider comparison, raw-protobuf hash verification or
Tendermint light-client proof. The earlier independent two-provider deployment
review remains the pre-activation evidence. No transaction was resent by the assistant.

## Continuation

Activation and first real purchase are complete. Load the existing mainnet name
for profile work if requested; do not repeat activation, reservation or payment.
Mainnet renewal/transfer and real validator E2E remain unverified. The initial
paused-state workflow intentionally no longer matches live state and must not be
rerun unchanged as a generic health check.

Keep UNI-7 artifacts, completed tests, browser key and pending journals intact.
Treasury P&L work and validator E2E remain deferred.
