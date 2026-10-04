# NETA DAO code-backed current state

## Latest session checkpoint — 2026-10-04, 21:00 Europe/Berlin

Continue with [the NNS next-chat handoff](HANDOFF_NEXT_CHAT_NNS_2026-10-04.md).
All seven UNI-7 setup transactions succeeded, including activation. PRs #140–142
are merged and their application releases were verified. The owner's latest pasted
screen still shows `Invalid code checksum` and `unpause · registry · confirmation
pending`; successful recovery in that browser has NOT yet been reported. Next:
hard reload without clearing site data, prepare the existing signer, reconnect,
and Check pending transaction. Do not deploy or activate again. No live name
registration/payment/profile/transfer or operator-proof completion is evidenced.

The Smart Delegation research is retained in SMART_DELEGATION_RESEARCH.md;
resume it after NNS testing. The approved delegation criteria remain unchanged.
Older dated sections below are historical checkpoints, not instructions to repeat
completed deployments. The dedicated next-chat handoff takes precedence for NNS.

## NNS UNI-7 deployment verified and activated — 2026-10-04

The owner completed all three test contracts. The corrected NamesV2Reader verified
the complete manifest against live UNI-7 at height 18539107: code hashes, creators,
no migration admins, registry token/treasury/admin/test quote key, token decimals,
and profile registry binding all match. Registry purchases_paused is false:
activation already succeeded; do not send another activation to repair the UI.

Public manifest: `docs/deployments/nns-uni7-owner-2026-10-04.json`.
Codes are mock token 122, registry 123, profiles 124. The owner retains the
browser-local private test quote key; the manifest contains only its public key.
The mainnet deployment constants remain null. Registration, renewal, profile
publishing, transfer and real validator proofs still need owner-driven live tests.

The final activation/manifest check failed because the chain serves uppercase
hex code hashes and NamesV2Reader only accepted lowercase hex or base64. The
reader now normalizes valid 64-character hex to lowercase before comparing it
with the pinned digest. Wrong hashes and malformed encodings remain rejected.
Tests now use actual artifact hashes containing letters, cover uppercase/mixed
hex and canonical base64, and reproduce the previous live error before the fix.
All 20 targeted reader/network/v2 tests pass; the full live deployment check passes.
Reader-dependent module URLs are bumped to version 3. Reload without clearing
site data, reconnect, check any pending transaction, then save the manifest and
load it on the Names test workspace. The earlier pending-deployment entries below
are historical checkpoints.

PR #141's independent transaction confirmation fix is merged and published;
all PR/main workflows and Pages succeeded, and the deployed bundle plus both
Names HTML pages match the reviewed files. PR #142 merged as 8b4f450cc6e333341deeb5c3f5a22185bcbb6f8f; its PR/main
checks and Pages publication passed. All seven changed public assets matched
the reviewed source after publication. This does not prove browser recovery.


## NNS UNI-7 upload confirmed; independent receipt lookup — 2026-10-04

The owner's first real NNS transaction is confirmed successful (code 0):
`ABE19AD1FD53CDF4EB95F79E81ADB93E6454507634D0400CF56C5130E12C1E5B`,
UNI-7 height 18538759, mock-token code ID 122, creator
`juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt`. The on-chain checksum
matches the shipped token WASM (`66d18a996d8dd7bd8dfca480870242141677079a7aac1cfb49427f774d24f4db`).
The owner recovered the pending upload and reached the token instantiate review.
Token instantiation is also confirmed (code 0), height 18538887, TX
`D01F03275DA527BB5752B4B7519CEBCFDB5FEC4A4BA0A2A924BD854077756BD7`,
contract `juno1gcpuzmtetez6mf9tnuk3ua7pwe933pzeqr7ac5jl235au8ls38jsuuf2js`.
The remaining registry/profile deployments are not yet confirmed.

NodesHub accepts broadcasts but disables transaction indexing. Previously the
Names bridge awaited CosmJS broadcastTx's same-node lookup before using the
independent indexed lookup, causing successful submissions to appear unknown.
The bridge now submits once with broadcastTxSync and checks the exact signed
bytes, protobuf intent and inclusion through the existing allowlisted lookup.
Six bounded confirmation checks also cover delayed indexing and lost submit
responses. Unconfirmed outcomes retain both journals; no automatic resend or
signature occurs. Existing pending uploads remain recoverable with Check pending
transaction. The signing asset version is bumped on both Names test pages.
Regression tests cover an index-disabled sender, lost response, delayed visibility,
unknown outcomes preserved across reload, and exactly seven setup transactions.
Release evidence is recorded in the associated PR. Mainnet stays disabled.


## UNI-7 connection diagnostics — 2026-10-04

PR #139 is merged; its four PR workflows, two main checks and Pages publication
succeeded. The owner then reached the local test signer but Connect failed with
“Fresh UNI-7 data unavailable”. No deployment transaction is evidenced.
Read-only checks found fresh UNI-7 blocks. The new Chromium connection regression
then reproduced the actual browser failure: native fetch was stored on the setup/
reader and invoked with that object as its receiver, causing Illegal invocation.
Both constructors now bind the supplied fetch function to globalThis. The earlier
Node/mocked tests did not enforce the browser receiver requirement.

The follow-up retains the 120-second age/30-second future limits and chain checks,
binds browser fetch correctly and adds provider-specific HTTP/network/header/time diagnostics, correctly selects
sdk_block.header when block has no header, clears a previously selected node on
failure, and closes an incomplete signing client. Time errors show both block and
browser timestamps. A browser fixture exercises failure, retry and REST fallback;
no real wallet signature is performed. Asset versions are bumped. Pending journals
and the browser-local test quote key are preserved. After publication reload the
setup page without clearing site data; retry Connect and inspect the exact error.


## NNS owner-driven UNI-7 setup and wallet flow — 2026-10-04

Read [the owner test runbook](NNS_UNI7_OWNER_TEST_2026-10-04.md). The separate setup page now prepares
a browser-local test quote authority and lets the owner upload/instantiate a fresh
mock CW20, v2 registry and profile contract, then activate test purchases. Every
transaction needs explicit Keplr confirmation. The lab verifies the exported
manifest and supports reviewed name purchases, renewals, transfers, public contact
updates and exact-receipt recovery through the existing shared journal.

Source/UI and local tests are complete for this operator test path; publication
and CI evidence are on PR #139. No owner-signed deployment or live NNS transaction
has been performed. The test authority uses a fictional rate, requires this browser's
site data and is not the production pricing service. Both production deployment
constants remain null; mainnet purchases/profile publishing stay disabled.

Next user action after publication: open `names-v2-setup.html`, prepare the test
signer and connect Keplr. Continue one reviewed transaction at a time. After
deployment, record exact receipts and finish a consenting validator's proof flow.
The older missing-adapter statements below describe preceding source slices.


## NNS v2 registry — 2026-10-04 source continuation

Read [the v2 checkpoint and UNI-7 runbook](NNS_V2_REGISTRY_2026-10-04.md). New source implements
quoted CW20 registration/renewal, recipient-accepted transfers and persistent identity
for the profile contract. Fees follow the approved USD tariff and main-DAO recipient.
Joint CW20/registry/profile tests, shared quote protocol, persisted client intents
and a fail-closed price-policy library are included. These are not a deployed
service or wallet UI. Both deployment constants remain null.

The concrete chain/journal/recovery adapters and UNI-7 operator pages now exist
(see the later checkpoint above). Owner-signed deployment/E2E remain pending. Quote HTTP service, live feeds, custody and production
market policy remain open. No deployment, purchase, outreach or new hosting took
place. The earlier “registry missing” note below is superseded for source only.


## NNS validator profiles — 2026-10-04 source slice

Read [the profile checkpoint](NNS_VALIDATOR_PROFILES_2026-10-04.md). The owner
paused Delegation Programme planning to add optional public contacts (Discord,
Telegram, X, email, homepage) and proof-backed mainnet/testnet operator links.
A purchased active `.neta` name is required **only for testnet bonus points**,
not general participation. Active testnet membership earns the bonus without an
additional uptime requirement. The checkpoint preserves the programme decisions.

Implemented: integrated unpublished profile preview, strict field/address rules,
ADR-36 proof collector and a separate v2-bound profile contract with two operator
signatures, exclusive bindings, identity lifecycle invalidation and revocation.
No profile deployment or live wallet flow is claimed. `PROFILE_DEPLOYMENT=null`.
The v2 registry now exists as source (checkpoint above); the live quote service
and deployment are still missing. Legacy v1 cannot substitute for v2. Public profile publishing and purchases stay disabled until
registry, deployment identities and journaled transaction integration are ready.
The user does not run a validator: synthetic wallets suffice for development;
one consenting mainnet/UNI-7 operator is needed for final live E2E. No outreach
was sent. Next verify/deploy v2 and wire the journaled UNI-7 profile flow.


## Faucet platform banner — 2026-10-04

Owner-approved header promotion uses the existing voxel assembly plaza, the
label **dao.netareborn.com**, and “Create · Discover · Govern DAOs”. The label
promotes the platform for multiple DAOs, not NETA DAO alone. The whole tile
opens https://dao.netareborn.com/ in a new tab with noopener/noreferrer.
Desktop places it between Community tools and the UNI-7/wallet controls;
narrow layouts give it its own row. CSS uses shared theme tokens and the
existing decorative asset. Payout, wallet and transaction logic is unchanged.
Release evidence is tracked in the associated PR and Pages workflow. The
owner-signed payout and restart/cooldown verification below remain pending.

## Payout integration for first real test — 2026-10-04, 13:58 Berlin

The owner completed the Render manual deployment. Fresh `/status` now reports
UNI-7, expected dedicated address, balance 15000000, ready true,
`protection:usage-guards-v1`, `confirmation:uni7-exact-hash-v1`, and
`gasPolicy:bank-send-gas-v1`. Cross-origin POST preflight from
`https://dao.netareborn.com` returns 204 with the expected origin/method/header.
The previously verified donation was 15 JUNOX (receipt recorded below).

The page now pins `https://neta-junox-faucet.onrender.com` in its config and CSP.
Get 10 JUNOX is available after Connect only while validated service status says
ready and this wallet has no pending payout/cooldown. The frontend requires all
three deployed protection/confirmation/gas-policy markers; an old or mismatched
backend disables payouts. Donation availability remains independent. GET status
requests no longer add an unnecessary JSON content-type/preflight.

This enables the first owner-driven payout test, not a claim that payout E2E is
complete. Next: click Get 10 JUNOX and confirm the ADR-36 ownership signature in
Keplr. Verify the resulting transfer hash and exactly 10 JUNOX, repeated-request
rejection, then the persisted 24h cooldown after an owner-triggered Render restart.
An empty fresh recipient-wallet test and real unstake still need evidence.
With 15 JUNOX, one payout plus fee leaves less than the 12-JUNOX ready reserve;
additional payouts require replenishment. Never clear SQLite/WAL or pending
browser/backend journals. Hosting protections are still not a dollar invoice cap.


## Donation gas correction — 2026-10-04

The owner attempted a 10-JUNOX donation through the page. Exact signed bytes and
UNI-7 receipt were verified for
`E4E0C8918FA87CDAFBF2ADDB7E010B9E5F39524CA92ABB3ED9628BE9260331D7`,
height 18526822, SDK code 11: out of gas at WritePerByte. Gas limit 136997,
consumed 137382 at failure; fee 27400 ujunox (0.0274 JUNOX). The 10 JUNOX were
not transferred. This is a confirmed failure, not an ambiguous broadcast.

Browser donations and server payouts now share a bank-send fee policy: simulate,
require a positive safe estimate <=500000, then use max(250000, ceil(estimate*1.8))
gas at 0.2 ujunox/gas. At the floor the fee is 0.05 JUNOX. This adds headroom for
bank writes/new recipients; it is not a proof of a successful new donation.
Staking/reward gas calculation and shared journal semantics are unchanged. No
automatic retry occurs. Confirmed bank-send code 11 has a readable explanation;
long hashes wrap inside the dialog. Browser assets are versioned/rebuilt.
Backend `/status` adds `gasPolicy:bank-send-gas-v1`; this requires a manual Render
deploy before payout activation. Public payouts remain off; donations remain on.
The next step is one fresh owner-confirmed donation after Pages publication,
then verify its exact hash, amount and receipt. Do not clear browser storage.


## Donations before payout activation — 2026-10-04

The owner requested funding through the existing Donate JUNOX control. Donation
availability is now independent of the payout API: the public config pins
`juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt` while `api` remains null.
After Connect Keplr, a positive whole-number donation opens the transaction review
and uses the existing UNI-7 signing/confirmation journal. The exact recipient is
shown before signing; wallet/network, balance/fee room and pinned target are
rechecked. The faucet account cannot donate to itself. No Render deployment is
needed for this frontend change. Get 10 JUNOX remains disabled after funding.
This supersedes older snapshots saying both public values are null and donations
are unavailable. Payout deployment/activation gates remain in force. No real
owner-signed donation or payout is claimed by the mocked browser checks.


## Backend confirmation correction — 2026-10-04 continuation

The server now submits signed bytes once with `broadcastTxSync` and confirms
through indexed STAVR and the configured HTTPS RPC concurrently. Fresh UNI-7 identity,
exact hash, signed-byte SHA-256, height and execution code are checked. Unknown
outcomes stay pending; no automatic retry or journal deletion. Lookups are bounded
and concurrent checks of one hash share work. `/status` identifies this adapter as
`confirmation:uni7-exact-hash-v1`, separately from `protection:usage-guards-v1`.
Local verification: 30 service tests and 5 frontend tests passed; the signing
bundle rebuild is unchanged. New tests cover wrong-chain/tampered receipts,
index outages, one-shot broadcast, persistent pending outcomes, cooldown after
restart and included failures. A read-only live call of the new backend lookup
confirmed the owner's reward hash `72AA75539747AE522BBBEF06F6149F08252112CA15948E07F9BAE8F5FC2A8387`
at UNI-7 height 18525930, code 0. Real payout/stake/unstake E2E remains pending.

Render auto-deploy is off: merge/Pages alone does not deploy the backend fix.
Use the existing service's Manual Deploy, retain SQLite/WAL and private settings,
then verify the confirmation marker. Latest read-only status before deployment:
UNI-7, dedicated address unchanged, balance 0, ready false, usage guards present.
Public API/address stay null pending deployment, funding and activation tests.
See `faucet/RENDER.md` and the current faucet handoff for the next operator steps.


## Current continuation — 2026-10-04 final checkpoint

Read [the current faucet handoff](HANDOFF_NEXT_CHAT_FAUCET_2026-10-04.md) first.
PR #129 (HTTP 501) and #130 (Disconnect/address and exact-hash rewards recovery)
are merged and live. All relevant PR/main checks and Pages succeeded; six live
files matched source. The owner’s real reward claim succeeded (code 0).
Frontend recovery does not fix the Render adapter's configured RPC: verify an
indexed backend RPC before funding/payout activation. Public payouts remain off.
This checkpoint supersedes earlier incomplete-release snapshots below.


## Wallet controls and rewards confirmation — 2026-10-04

The shared workspace header and separate faucet now provide a shortened connected
address (full address in title/accessible label) and explicit Disconnect. Local
signing clients/access are cleared; drafts, keys and transaction journals remain.
Disconnect is disabled during a transaction; late connection/access responses
cannot restore a disconnected account. All workspace routes share the header.
Read-only DAO connection restrictions and inactive feature gates are unchanged.

PR #129 fixed the faucet delegation route; production core was compared with the
corrected source. The owner then signed a real reward withdrawal, confirmed on
UNI-7 at height 18525930, code 0, hash
`72AA75539747AE522BBBEF06F6149F08252112CA15948E07F9BAE8F5FC2A8387`.
Rewards were 173.075836 JUNOX; fee 0.037690 JUNOX. NodesHub accepted the transaction
but has transaction indexing disabled, causing the frontend's retry lock.

`juno-faucet-transactions.mjs` reads exact-hash transactions through the allowlisted
RPCs, verifies UNI-7 identity and the SHA-256 of returned signed bytes. Signing
confirmation polling uses this lookup. Connect/Refresh can reconcile a pending
journal under the existing origin-wide lock; only exact included transactions
clear it, and no repeat signature/broadcast is performed. Unknown, tampered or
interrupted-signature records stay locked. Tests cover recovery and preserved
journals, disconnect/reconnect on all eleven routes, and 320–1440 px layouts.
Release status is recorded by the associated PR/CI/Pages run. No operator-side
wallet signing was performed. Faucet payouts/donations remain disabled and the
faucet account still needs funding. Real stake/unstake/payout E2E remains pending.


## Wallet-data correction — 2026-10-04

The owner reproduced HTTP 501 after connecting Keplr. The faucet reader used
`/cosmos/staking/v1beta1/delegators/{address}/delegations`, which is not the
SDK route. Live NodesHub requests returned 501 for that path and 200 for
`/cosmos/staking/v1beta1/delegations/{address}`. This change corrects the route,
versions the frontend modules and makes wallet fixtures reject the invalid path.
The withdrawal/unbonding routes still correctly use `delegators/{address}`.
Deployment evidence is the associated PR/Pages run; real signed wallet E2E
remains unverified. No payout/donation activation or transaction journal change.

Live Render status rechecked at 10:27 Berlin: `protection:usage-guards-v1`,
`balance:0`, `ready:false`. The guard update is deployed, superseding the older
manual-deployment gate below. Wallet funding and payout/replay/restart checks
remain pending. Quotas are not a dollar billing cap.


## Live backend / usage-guard continuation — 2026-10-04

This section supersedes older hosting-pending snapshots below. The owner created
Render hosting, corrected a recovery-phrase typo privately, and provided
`https://neta-junox-faucet.onrender.com`. Read-only `/status` verified `uni-7`,
`juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt`, balance `0`, `ready:false`.
No live signed payout, funding or browser transaction was performed.

The owner accepted keeping Render with additional abuse/usage guards. The update
adds persistent aggregate quotas: 60 HTTP requests/minute, 5,000/day, 50,000/month;
100 payout reservations/day, 1,000/month, plus the existing 10 JUNOX/rolling 24h
per wallet. Day/month boundaries are UTC; failed payout reservations count too.
Status RPC reads and failures are coalesced/cached for 30s; HTTP concurrency is 4.
Invalid mnemonic errors no longer echo input words or the BIP-39 dictionary.
See `faucet/README.md` and `faucet/RENDER.md` for configuration and limitations.

**Deployment gate:** manually deploy this update on Render and verify
`protection:usage-guards-v1`. Quota exhaustion pauses API work/payouts, not Render
billing. A hard USD 10 invoice ceiling and automatic provider suspension are NOT
implemented. Configure Render's additional build-spend limit to USD 0 separately.
Public API/address config remains null. Next: fund the dedicated account privately,
verify the guard version, then real-wallet payout/replay/restart checks before
public activation. Preserve SQLite, WAL and pending transaction journals.


## Faucet hosting preparation — 2026-10-04

`render.yaml` and [the Render runbook](../faucet/RENDER.md) describe one paid
managed Node 24 instance, persistent SQLite disk and operator-provisioned secret
file. This is deployment preparation only: no hosting account, wallet funding,
live payout or real-wallet E2E has been completed. `juno-faucet-config.mjs`
continues to disable payout/donation with null API/address until activation.

## People update — 2026-10-03

The shared People section supersedes the different Contributors screens.
Members uses the configured membership adapter; Contributors is a common planned
state. Operations uses a weighted cw4 group, the main DAO uses staked NETA,
and native Juno uses bonded delegations. No real contributor-role or assignment
service is enabled. Read [People implementation and release evidence](PEOPLE_MEMBERS_CONTRIBUTORS_2026-10-03.md).


Latest review: [maintenance checkpoint, 2026-10-03](MAINTENANCE_CHECKPOINT_2026-10-03.md).


Baseline review 2026-10-02 against `main`, including application controllers,
contract source, tests and workflows. Baseline checkout: `936af0cedc16a8b797c194796f2b0534eb359de5`.
That baseline included PR #97 (`4ca74ff`) and Treasury retry PR #98 (`ccd7998`).
Security integration through #103, documentation #104 and Treasury bot commit
`11fa3c1ff447ed1722e78ba8bb310f23d384019a` were rechecked on 2026-10-03. Automated snapshots advance
`main` frequently. Dates here describe evidence, not perpetual network availability.

## Main DAO onboarding — implementation update 2026-10-03

See [the integration record](DAO_ONBOARDING_2026-10-03.md) for release evidence and
[the reusable onboarding checklist](DAO_ONBOARDING_CHECKLIST.md). PR #118 adds the
main Neta DAO alongside Operations and native Juno through a central directory.
The main DAO has read-only historical proposals, core Treasury snapshots, verified
staking participants and RELAY following. Every DAO has a Directory profile;
unknown profiles do not fall back to Operations. New DAO writes remain disabled.
Directory names under `.dao.neta` are labels, not active NNS registrations.

Main DAO events remain UNAVAILABLE because verified historical indexing is missing;
this is not evidence of zero activity. NNS revenue remains null/inactive. Unknown
native/IBC decimals are represented as raw units. An independent 30-minute workflow
owns main DAO snapshots, retaining previous successful outputs on source failure;
the Operations/Community Pool workflow retains ownership of its existing files.
Operations examples are hidden for other DAOs. Native Juno participation has an
explanation, not a fabricated member list. Further details below include historical
release records; this section supersedes the prior two-DAO scope.

## Repository and source map

Design decision 2026-10-03: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) records the selected
graphite/mint theme, small voxel module illustrations and the assembly-plaza Home
hero. It applies to all current/future DAO pages. The shared-theme/Home rollout loads `neta-ui.css` on the workspace and auxiliary
RELAY pages, replaces the legacy terminal base stylesheet and uses optimized WebP
assembly/module artwork. Module CSS colors refer to shared semantic tokens. Existing
feature copy remains present; concept sections gain local illustrative-data notices.
Routing adds programmatic current-page state and respects reduced motion. Wallet,
crypto and data logic are unchanged.

Home/shared foundations shipped in PR #108, merge `93638a8d13c838659ceec78aec2f0e2162a01709`.
Before merge, Contract/frontend run 151 and RELAY browser run 43 succeeded.
Pages run `37116415492` succeeded; live `index.html`, `neta-ui.css`, `ux-draft.js`
and both WebP assets matched the integrated source byte-for-byte on 2026-10-03.
Home hero, module cards and status sections were visually inspected at desktop width.
Fixed 320/768 px review frames had no document-level horizontal overflow (content
widths 303/751 px with classic scrollbars). The review exposed joined words in the
mobile heading and a cramped chain selector; this follow-up supplies whitespace
and increases the selector minimum width. PR #109 shipped that follow-up; the live
320 px frame confirms normal word separation and a 100 px selector without
document overflow. Proposals filtering and existing-proposal selection were also
smoke-checked on desktop. Full per-page interaction/accessibility
review is not complete. The later Names integration and maintenance checkpoint
supersede that initial page-by-page continuation order. Mainnet messaging remains disabled.

This repo owns `dao.netareborn.com`. `cristianoneta/neta-website` owns the main
site and the legacy Operations governance contract source. No duplicated DAO
frontend should be added there. `index.html` loads `neta-governance.js`,
`ux-draft.js`, `treasury.js`, `relay.js`, `relay-mailbox-status.js` and `names.js`.
It does not load `relay-uni7-lab.mjs` or the CoreCrypto runtime.

Home copy was refreshed on 2026-10-03 while preserving the existing layout and
four core component cards. Its status cards distinguish mainnet reads/Operations
voting, UNI-7 review, Treasury snapshots/history, RELAY proposal notifications and
planned Delivery/Contributors/Names. Private messaging and review-to-mainnet
submission are explicitly unfinished. Latest updates describe the shipped security
improvements without claiming a messaging release. Dates are curated copy, not a
live health monitor; maintain `index.html` when user-visible capabilities change.

## Governance: two different APIs

| Item | Operations | Juno community review |
| --- | --- | --- |
| Workshop network | UNI-7 | UNI-7 |
| Configured address | `juno1d2xdlvy23am07twe046zzxxndjtccgpwwl3pyu5g98u07qu3nyqqkaz65h` | `juno18d3mzk3ver06zfr5nf752aycss75vtcqd8fsdcuuzmh5mzj4cm6qrgx3fw` |
| Source | Other repo: `contracts/neta-governance/` (legacy) | This repo: `contracts/neta-proposal-workshop/` v0.3.0 |
| Publish / revise / finalize | Positive configured voting power | At least 1 delegated JUNOX and 1 staked test NETA via access mock |
| Comments | Strictly greater than 10 active NETA threshold | Same dual gate; 30-second comment cooldown |
| Finalization | `finalize_and_submit` sets UNI-7 status `voting` only | `finalize` records latest version/hash, closes discussion |
| Withdrawal UI | Discussion author must also be config owner; `set_status: declined` | Discussion author may `withdraw`; contract allows broader pre-submission withdrawal than UI |
| Thread encoding | Body markers `[[NETA_THREAD:…]]` / `[[NETA_REPLY:…]]` | Native title/parent/version fields |

Recorded Juno code ID 114, access mock
`juno10739807rjqkf4kmtvpu5ll5e67dkch82xzgph83cmn5h8n0fxmnszasg86`,
review checksum `6eb604c255d01414880bdcb9cc1d1df69dc2507f25ffc6e6d51388945ff63f22`.
The canonical Juno address is in `neta-governance.js`, not just localStorage.
No new on-chain deployment/state verification was performed in this docs review.

Mainnet Operations history comes from
`juno1m9skms04ymmhsyc2q9cguja47d07mljsfnvm8f584dc645urxvjsjc9ep0`.
For an open, non-native proposal, `selectChain` exposes vote buttons and
`mainnetSigner` requests `juno-1` before a module `vote` execute. Native Juno
history/parameters use `x/gov`; its vote buttons are hidden and native deposit/
submission is absent. No review-to-mainnet submission adapter exists.

Drafts are stored per DAO in browser localStorage. Published revisions/comments
are chain records. `dao_deliverable_v1` records in `actions_json` are plans, not
executable Cosmos messages; future adapters must separate them.

Completeness and implementation limits: Operations mainnet history stops after
20 pages of 30; workshop pagination stops after 100 pages of 100. Legacy revision queries ignore cursors; the frontend now queries them once and
shows an explicit potential truncation warning at 100 records. Recovery queries for some writes inspect only 100
records. Do not promise unlimited/full history without these qualifications.
The legacy contract has no v0.3.0 hash/JSON-array/cooldown/withdraw hardening, and
converts failed access reads to zero. Frontend checks are not contract guarantees.

## Treasury: live snapshots, limited accounting

| Owner | Inputs / outputs |
| --- | --- |
| `scripts/update_treasury.py` | Operations Juno DAO core `juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl`, Osmosis proxy `osmo1xjfyz4f7da2yu43c0ptlswyln50wqyj53495sesaq40ja5megq4qms9f80`, native Juno Community Pool; writes `current.json`, `history.json`, `juno-community-pool.json`, `juno-community-history.json` |
| `scripts/update_treasury_events.py` | Juno core/Osmosis proxy TX indexes; writes `events.json` |
| `data/treasury/token-registry.json` | Versioned input mapping, not an output staged by the scheduled workflow |
| `treasury.js` | Refetches committed JSON on load, Refresh and every 60 seconds; renders assets, history and Operations events |

The 15-minute workflow publishes only after balances and event collection
succeed. Event collection and push each retry three times; pushes rebase with
`-X theirs`. Preserve collector ownership and review overlapping-file changes
rather than assuming this conflict strategy is a general safe merge.

Daily history is captured during Berlin hour 21 with `TREASURY_DAILY_SNAPSHOT=auto`,
replacing the entry for the same UTC date on each successful run in that hour.
It retains at most 730 records; no backfill guarantees a missed day. The frontend
replaces today's history point with the current snapshot in memory.

Assets include native/IBC coins, configured CW20s and eight configured WYND LPs
including direct/staked/claim shares. LP USD value is counted once via underlying
reserves. Unpriced assets and sub-USD-50 assets/warnings remain inspectable.
Core balance failures fail collection; unresolved asset prices can yield a
`PARTIAL` snapshot and are excluded from the USD total. The UI labels this a
priced-assets subtotal and shows warnings outside the collapsed asset details.

History market effect revalues opening quantities at closing implied prices;
the remainder is labeled net flow. `economicAssets` groups by **symbol**, not a
verified universal asset ID. It can consolidate internal transfers but is not
transaction-derived cash flow and can be distorted by symbol collisions,
LP composition and changing coverage not captured by the available records.
History metrics/chart are withheld when excluded-price coverage changes across
the selected range; missing prices must never be interpreted as a cash outflow. Balances are fetched at latest endpoints;
the recorded Juno height is context, not height-pinning of every query/chain.
Native metadata uses a persisted exact-denom registry and traces. Unknown IBC
base names no longer inherit USDC/DAI/ATOM prices; they remain unpriced until
reviewed. Unreviewed native/IBC decimals now remain unknown and quantities display raw units. Unpriced LP underlying
assets now also make the snapshot PARTIAL. Registry changes are not automatically persisted.
The five reviewed Osmosis routes are explicitly chain-scoped in the registry; see
[Treasury valuation correction](TREASURY_VALUATION_FIX_2026-10-03.md). Collector or
registry changes on main now trigger a fresh bot collection. PR #110 passed both
relevant CI runs and shipped; bot run 940 and Pages run 1043 succeeded. The
2026-10-03 12:47 Berlin live snapshot retained nine holdings with USD 4,040.81
priced subtotal. Only `testingaten` remains unpriced; no custody quantities were
lost. See the incident record for exact commits and verification limitations.

Event ledger: schema v2, chain/hash deduplication and proposal-title enrichment.
The continuation adds height-bounded scans, a verified block-hash anchor, 100-block
overlap and 20-block tip delay. Missing anchors use full replay. Changed anchors,
truncated pages or loss of recorded historical TXs fail without replacing exports.
`TREASURY_EVENTS_FULL_REPLAY=1` requests a full replay; it preserves prior records. Monetary extraction is
native `transfer` event based; contract activity alone is not complete CW20/LP
cash flow. Missing historical timestamps remain null with exact block heights.
Juno historical indexing is required; absent legacy Osmosis matches are allowed.
The frontend shows three latest non-technical movements and expanded filters.
There is no Juno Community Pool transaction feed or treasury execution.

`treasury.js` now aborts superseded requests, bounds fetch time to 15 seconds and
checks a request epoch before changing shared state or the UI. Late responses
cannot overwrite a newly selected DAO snapshot. See the security audit for tests.
Recurring cash flow, obligations, milestone payments and runway remain future work.

## RELAY: main inbox versus encrypted lab

Main `relay.js` polls followed, configured DAO proposal modules (at most 4 × 30 records each) and
native Juno proposals (latest 100) every 60 seconds and on visibility restoration.
It does **not** poll the UNI-7 workshops. Change detection can report new/status/
content updates from those sources; a `NEW REVISION` branch is not proof of a
connected workshop revision feed. First load seeds up to eight already-read
current notices, not an unread flood. Up to 200 events, favorites, baselines and
read state stay browser-local. No push, service worker or cross-device sync.

Inbox has feed and reader with current summary/activity. Favorites are managed
in Directory using Follow buttons and the Followed filter. RELAY has one navigation
level: Inbox, Directory, Contacts, My profile and .neta name. The old Names and
Following links redirect to Directory; browser Back/Forward restores destinations.
Operations and Juno Governance subscriptions use the existing browser-local storage
key, with synchronized follow controls in the Operations profile. There is **no
watchlist sidebar** in `index.html`. Zero unread badges
are hidden. Composer input lives temporarily in DOM; submit only prevents default,
Discard clears/closes, and SEND is disabled. Main UI contains no private messages.

Recorded mailbox identity: UNI-7,
`juno13uft9dl34x9wdzcxnm80q8m8sh5cw04lkskzknm9vc0wduxchdxsrnr4pa`,
creator `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`, label
`NETA RELAY mailbox v0.1 · UNI-7`, code hash
`e02c7918d1f8da0f662a0720fc3668765d79ededce8e9e9dcccff9aae2b9e64a`.
The pinned deployed mailbox is v0.1: hardcoded UNI-7,
no funds, no stake gate, one current device, max 16 prekeys, max 4096 ciphertext
bytes, 10-second sender cooldown and inbox pages up to 50. There is no historical
device registry, mainnet network configuration or mainnet 5-NETA implementation.

| Page / module | Actual capability |
| --- | --- |
| `relay-mailbox-status.js` | Read-only identity check when main composer opens |
| `relay-testnet-setup.html` | Admin Keplr upload/instantiate helper; existing deployment recorded |
| `relay-uni7-readiness.html` | Public two-address identity/device/inbox-header diagnostic; no register/decrypt/send |
| `relay-uni7-client.mjs` | Identity and wallet binding, public queries, prepared-device registration; loaded by lab, not main index |
| `relay-uni7-lab.html` / `.mjs` | Separate real Keplr-capable lab: create/unlock, register, encrypted send/receive, local archive/reload |
| `relay-uni7-archive.mjs` | Wallet-scoped AES-GCM readable-history archive, separately HKDF-derived key |
| `spikes/relay-corecrypto/` | Native/browser fixtures, key vault, DB backup experiment, lock/outbox/envelope/transport, mocked integrated lab |

Lab uses Wire CoreCrypto 10.5.3 Proteus, GPL runtime/license in `assets/relay-crypto/`,
eight initial prekeys and 1800 UTF-8 bytes of text. It persists registration,
outbox and inbound intents before sensitive state changes; incomplete state
blocks continuation. No silent rotation or automatic off-device backup exists.
Current receive queries need the sender's **current** generation; messages from
rotated generations fail closed. The lab does not expose revoke/block/add-prekey
or rotation UX. Inbox fetch is one page per check; repeated checks can advance.
Failed send/receive intents have no complete user-facing reconciliation flow.
Follow-up sends in an established current-generation session no longer require
an unused recipient prekey. First contact still requires one.

Two mocked browser profiles exchanged/replied and reloaded successfully in PR #97.
No real two-Keplr UNI-7 E2E evidence is recorded. The older DB backup fixture
restores an unread message in a fresh profile; the integrated lab restores local
already-read archive after reload. Neither implements automatic remote recovery.
GPL was chosen for the isolated lab; production distribution/security review is
still a separate gate. `spikes/relay-corecrypto/package.json` is private/UNLICENSED;
do not infer a blanket repository license from the vendor license.

## Names and concept modules

Names & Contacts is integrated into the main RELAY page at `index.html#relay/directory`.
`names-workspace.js` owns directory search, DAO detail/address copy, navigation and
the USD fee calculator. It uses shared `names.css`/`neta-ui.css` foundations.
The separate prototype link and simulated accounts/actions are removed. The old
prototype URL redirects here. Contacts, profile edits, DAO profile proposals and
payments have honest unavailable states pending their backing services. The fee
calculator is not an availability check or a live NETA quote. Names v1 remains
inactive and is not wired to the new fee form. See `NAMES_MAIN_PAGE_INTEGRATION.md`.


`names.js` has `REGISTRY=null`; no active name registry is configured. Existing
handlers request `juno-1` and pin the exact NETA token address as well as
treasury/token metadata before CW20 payments;
there is no wired UNI-7 Names flow. Prepared metadata checks are not a substitute
for pinning exact token/registry/code identity before activation.
The inactive v1 source uses fixed 5-NETA first registration and an admin-set renewal
quote, with 30-day grace. This is superseded product behavior. The accepted v2 plan
prices registration AND renewal at USD 640/160/5 for 3/4/5+ characters, paid in NETA
using a fresh quote from the selected JUNO/NETA reference. No v2 quote service or
registry is deployed. Fees target the NETA DAO treasury, not Operations. See the
v2 plan and Names implementation boundary for transfer, term and activation gates.
Delivery/Contributors remain concepts; deliverable records do not release funds.
AtomOne remains prior research only; no AtomOne adapter or active integration exists.

## Verification and CI scope

2026-10-02 documentation review: 41 Node tests and 8 Treasury Python tests passed.
The later security audit adds regression tests and fixes; see
[SECURITY_EFFICIENCY_AUDIT_2026-10-02.md](SECURITY_EFFICIENCY_AUDIT_2026-10-02.md).
No new wallet write, Rust execution or browser E2E is claimed by those checks.
The main contract/frontend CI, WASM build and crypto-browser CI are path-filtered;
Root README/HANDOFF/ordinary docs alone do not trigger them; contract Markdown
matches contract/frontend and WASM CI, and the RELAY security doc matches the
former. Inspect each PR's actual paths and checks. Existing
mainnet/sample snapshots in frontend tests are assertions, not live-chain checks.
`relay-client-assets.yml` is a branch-specific preparation writer for the old
integration branch, not a recurring main runtime publisher. Browser crypto
workflow actions are now SHA-pinned; that does not establish a repository-wide
immutable dependency policy for every workflow and build image.
Check Actions and actual served files again at the next session.

## Security audit continuation

Read [the security and efficiency audit](SECURITY_EFFICIENCY_AUDIT_2026-10-02.md)
before enabling messaging or extending transaction flows. Mainnet Operations
voting now explicitly selects `0.075ujuno`; UNI7 keeps `0.2ujunox`. The shared
signing bundle accepts an explicit gas price. Governance guards rapid proposal
selection, malformed thread markers and context changes before transaction calls.

## Continuation inventory — 2026-10-03

RELAY receive in PR #101 is shipped and adversarial browser CI run 34 passed.
`relay-uni7-checkpoint.mjs` snapshots/restores the pinned CoreCrypto encrypted IDB
layout while handles are closed and the device lock is held. The archive encrypts
its checkpoint journal. Unlock rolls pending receive state back before reopening
CoreCrypto and retries the original chain ciphertext. Cryptographic envelope checks
run inside the transaction. Quarantined messages advance the inbox cursor without
blocking unrelated processing. Storage failures preserve a pending journal and lock.
The normal exchange/reply/reload test also passes. This is **local receive recovery**,
not an automatic backup service or proof of live Keplr E2E.

V0.2 mailbox source is in PR #102; the shipped v0.1 WASM checksum/address remains
pinned. Do not infer the deployed contract implements source-only consent or
historical identities. A new deployment and adapter pinning are separate gates.

Discussion moderation hides both title and body in DOM with a reason placeholder.
Forward/self parent markers become roots; nesting display is limited to 32 levels
with an explicit omission notice. Legacy revisions are queried once because the
legacy API does not support pagination; this avoids repetitive non-advancing queries
but cannot provide missing records. Native review pagination remains bounded.

Full consistent fresh-profile backup/restore, sender rotation handling and v0.2
consent/prekey UX remain unfinished. Mainnet messaging stays disabled.

2026-10-03 RPC compatibility check: the public Juno gateway rejects height-range
queries with an explicit strict-equality policy. Collector selection now probes
the selected usable index for range capability and falls back to full replay
when that endpoint rejects the feature. The optimization is conditional on node support, not a guarantee
of incremental scans on every endpoint. Snapshot ownership/data remain unchanged.

Known optional Osmosis legacy index gaps preserve all cached events and emit an
explicit coverage warning; they do not block fresh balances. Required Juno history
gaps still fail publication. Seven independent address queries run with a bound
of three workers; capability probes have eight-second timeouts and run only on the selected node.


## Current security checkpoint — 2026-10-03

DAO #100–#103 and Website #137/#138 are merged after their relevant final CI
checks passed. Documentation PRs DAO #104 and Website #139 are also merged.
The resumed verification confirmed the exact PR-head checks and compared 23
production files with GitHub, including both shared signing bundles and the
published Treasury event ledger. See [the evidence](SECURITY_CONTINUATION_2026-10-03.md).

Treasury run 934 successfully executed the final collector source and retained all
57 cached events. Both selected public RPCs required full replay; three historical
Osmosis transactions remain absent from the index and are retained from cache.
Unpriced assets still yield PARTIAL balance snapshots. Successful collection is
not proof of complete accounting. Preserve the subsequent bot commits.

Mainnet messaging remains disabled. Local receive recovery and sender-scoped
archive identities are shipped; v0.2 consent/historical identities are tested
source only. The pinned UNI-7 v0.1 address/artifact has not changed. Automatic
off-device recovery, historical sender resolution, consent/refill integration and
the full rotation/exhaustion/restore matrix remain release blockers. Never discard
pending ratchet/archive/outbox or transaction-journal state to unblock the UI.



RELAY navigation follow-up (2026-10-03): the owner removed the separate Following
page and promoted Names functions into the RELAY section navigation. No registry,
payment, messaging or profile-write gate changed. The browser regression covers
direct routes, Back/Forward, legacy links, persistent follow preferences and
320/390/768/1440 px layouts. See the change PR for final CI/deployment evidence.

RELAY visual consistency follow-up: the shared masthead remains visible on all
five destinations. A common content-card class unifies Inbox/Directory/Contacts/
Profile/Name registration surfaces and section headings. Browser regression
compares nav coordinates and computed card/title styles across each destination
at 320/390/768/1440 px. No feature gates or subscription storage change.


## Juno testnet faucet — 2026-10-03 implementation

`juno-faucet.html` is a separate English UNI-7 tool, linked from the workspace
footer with `target=_blank` and `noopener noreferrer`. It reuses `neta-ui.css`.
Keplr, live validators/commission, wallet balances/delegations/unbonding/rewards,
stake/unstake and reward withdrawal are implemented. Browser writes use the
existing origin-wide transaction journal semantics. Mainnet is not supported.

**Payouts and donations are not activated.** The durable Node 24/SQLite payout
service in `faucet/service` requires a host, HTTPS origin and a dedicated funded
UNI-7 wallet provisioned privately by the operator. The page visibly disables
these actions while its API/address config is null. Fixed payout is 10 JUNOX per
wallet every rolling 24h, verified server-side with ADR-36 ownership proof;
donations accept whole JUNOX only. See `faucet/README.md` for activation/recovery.
Automated wallet/chain tests are mocked, not a real-payout attestation.

Faucet release evidence: PR #123 merged as `5d047f630e742c5eac92aa07673b90e0a34a2cd6`
after all three exact-head checks passed. Pages run `37156018654` succeeded.
Eight production files were compared with the implementation, including the
published bottom footer link and signing bundle. See the complete
[next-chat handoff](HANDOFF_NEXT_CHAT_FAUCET_2026-10-03.md). Payout/donation
activation and real-wallet E2E remain pending.
