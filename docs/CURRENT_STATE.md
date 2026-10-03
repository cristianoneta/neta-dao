# NETA DAO code-backed current state

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
