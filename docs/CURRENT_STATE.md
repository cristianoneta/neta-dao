# NETA DAO code-backed current state

Reviewed 2026-10-02 against `main`, including application controllers, contract
source, tests and workflows. Checkout: `936af0cedc16a8b797c194796f2b0534eb359de5`.
Latest application/lab documentation change: PR #97 (`4ca74ff`); later PR #98
(`ccd7998`) hardens Treasury collection/push retries. Automated snapshots advance
`main` frequently. Dates here describe evidence, not perpetual network availability.

## Repository and source map

This repo owns `dao.netareborn.com`. `cristianoneta/neta-website` owns the main
site and the legacy Operations governance contract source. No duplicated DAO
frontend should be added there. `index.html` loads `neta-governance.js`,
`ux-draft.js`, `treasury.js`, `relay.js`, `relay-mailbox-status.js` and `names.js`.
It does not load `relay-uni7-lab.mjs` or the CoreCrypto runtime.

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
20 pages of 30; workshop pagination stops after 100 pages of 100. Legacy revision
queries ignore cursors; a history of at least 100 legacy revisions can hit the
frontend pagination guard. Recovery queries for some writes inspect only 100
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
`PARTIAL` snapshot and are excluded from the USD total.

History market effect revalues opening quantities at closing implied prices;
the remainder is labeled net flow. `economicAssets` groups by **symbol**, not a
verified universal asset ID. It can consolidate internal transfers but is not
transaction-derived cash flow and can be distorted by symbol collisions,
coverage changes and LP composition. Balances are fetched at latest endpoints;
the recorded Juno height is context, not height-pinning of every query/chain.
Native metadata uses a persisted registry and traces, with fallback decimals and
substring USDC/DAI pricing heuristics. Do not describe unknown-denom identity or
pricing as universally verified. Registry changes are not automatically persisted.

Event ledger: schema v2, chain/hash deduplication, full address-index replay,
per-chain scan watermarks and proposal-title enrichment. Monetary extraction is
native `transfer` event based; contract activity alone is not complete CW20/LP
cash flow. Missing historical timestamps remain null with exact block heights.
Juno historical indexing is required; absent legacy Osmosis matches are allowed.
The frontend shows three latest non-technical movements and expanded filters.
There is no Juno Community Pool transaction feed or treasury execution.

`treasury.js` lacks a request epoch for overlapping DAO-switch/refresh loads;
an older response can update the newly selected DAO view. Governance's request
protection must not be claimed for Treasury. This is an unfixed code observation.
Recurring cash flow, obligations, milestone payments and runway remain future work.

## RELAY: main inbox versus encrypted lab

Main `relay.js` polls Operations mainnet module (at most 4 × 30 records) and
native Juno proposals (latest 100) every 60 seconds and on visibility restoration.
It does **not** poll the UNI-7 workshops. Change detection can report new/status/
content updates from those sources; a `NEW REVISION` branch is not proof of a
connected workshop revision feed. First load seeds up to eight already-read
current notices, not an unread flood. Up to 200 events, favorites, baselines and
read state stay browser-local. No push, service worker or cross-device sync.

Inbox has feed and reader with current summary/activity. Favorites are in
Following; **no watchlist sidebar** exists in `index.html`. Zero unread badges
are hidden. Composer input lives temporarily in DOM; submit only prevents default,
Discard clears/closes, and SEND is disabled. Main UI contains no private messages.

Recorded mailbox identity: UNI-7,
`juno13uft9dl34x9wdzcxnm80q8m8sh5cw04lkskzknm9vc0wduxchdxsrnr4pa`,
creator `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`, label
`NETA RELAY mailbox v0.1 · UNI-7`, code hash
`e02c7918d1f8da0f662a0720fc3668765d79ededce8e9e9dcccff9aae2b9e64a`.
Contract source is `contracts/neta-relay-mailbox/src/lib.rs`: hardcoded UNI-7,
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
Follow-up sends still require a nonempty recipient prekey list in the lab.

Two mocked browser profiles exchanged/replied and reloaded successfully in PR #97.
No real two-Keplr UNI-7 E2E evidence is recorded. The older DB backup fixture
restores an unread message in a fresh profile; the integrated lab restores local
already-read archive after reload. Neither implements automatic remote recovery.
GPL was chosen for the isolated lab; production distribution/security review is
still a separate gate. `spikes/relay-corecrypto/package.json` is private/UNLICENSED;
do not infer a blanket repository license from the vendor license.

## Names and concept modules

`names.js` has `REGISTRY=null`; no active name registry is configured. Existing
handlers request `juno-1` and validate treasury/token metadata before CW20 payments;
there is no wired UNI-7 Names flow. Prepared metadata checks are not a substitute
for pinning exact token/registry/code identity before activation.
First registration is 5 NETA for **365 days**, not a permanent name. Renewals use
an admin-set NETA quote targeting USD 5, with 30-day grace and no oracle. Fees go
to the NETA DAO (`juno1c5v6jkmre5xa9vf9aas6yxewc7aqmjy0rlkkyk4d88pnwuhclyhsrhhns6`),
not Operations. See the Names design for commit/reveal and deployment gates.
Delivery/Contributors remain concepts; deliverable records do not release funds.
AtomOne remains prior research only; no AtomOne adapter or active integration exists.

## Verification and CI scope

2026-10-02 local review: 41 Node tests and 8 Treasury Python tests passed.
No new wallet write, Rust execution or browser E2E is claimed by those checks.
The main contract/frontend CI, WASM build and crypto-browser CI are path-filtered;
Root README/HANDOFF/ordinary docs alone do not trigger them; contract Markdown
matches contract/frontend and WASM CI, and the RELAY security doc matches the
former. This reconciliation PR includes those paths and runs those checks. Existing
mainnet/sample snapshots in frontend tests are assertions, not live-chain checks.
`relay-client-assets.yml` is a branch-specific preparation writer for the old
integration branch, not a recurring main runtime publisher. Browser crypto
workflow uses version-tag Actions; do not claim all this repo's Actions are SHA-pinned.
Check Actions and actual served files again at the next session.
