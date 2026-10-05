# NETA DAO code-backed current state

Updated **2026-10-05** after owner-signed mainnet deployment and receipt export. Source-tested work and live deployments are distinguished below. This file owns the feature inventory;
[HANDOFF](../HANDOFF.md) owns the next action and working rules. Observed chain,
service and data states are timestamped evidence, not guarantees of future state.
The previous append-only inventory is retained in the [archive](archive/CURRENT_STATE_BEFORE_CLEANUP_2026-10-04.md).

## Repository and shared UI

This repository owns `dao.netareborn.com`; `cristianoneta/neta-website` owns
`netareborn.com` and legacy Operations workshop source. Do not duplicate the DAO
frontend there. `index.html` loads governance, Treasury, RELAY notifications, Names workspace/profile
controls and shared navigation. Names signing loads only on a deliberate
wallet action; the CoreCrypto runtime and separate wallet lab are not embedded.

The approved graphite/mint design uses shared `neta-ui.css`, the assembly-plaza
Home hero and existing voxel module artwork. Follow [DESIGN_SYSTEM](DESIGN_SYSTEM.md).
PRs #108/#109/#117 shipped shared styling, mobile fixes and module illustrations.
Full per-page interaction/accessibility coverage remains incomplete.
Wallet controls display the connected address and expose Disconnect; disconnect
preserves drafts, keys and transaction journals. Tests cover late connection replies.

## DAO directory and People

`data/dao-directory.json` owns identity/capability/source mapping; generated
`dao-directory.js` serves Operations, the main Neta DAO and native Juno Governance.
Use [DAO_ONBOARDING_CHECKLIST](DAO_ONBOARDING_CHECKLIST.md) for additions.
The main DAO has read-only proposals, Treasury, staking participants and following;
its writes remain disabled. `.dao.neta` directory labels are not registered names.
Main DAO historical events are UNAVAILABLE, not zero; NNS revenue is null/inactive.

People/Members uses Operations cw4 membership, main DAO staked NETA and the native
Juno bonded-delegation adapter. Native Juno participation is explained rather than
shown as a fabricated DAO member list. Contributors is a shared planned state;
there is no authoritative contributor assignment/role/payment service.
See [People evidence](PEOPLE_MEMBERS_CONTRIBUTORS_2026-10-03.md).

## Names: main workspace versus UNI-7 lab

| Surface | Implemented and connected | Boundary |
| --- | --- | --- |
| Main RELAY Names | Directory/DAO reads and follows; network-selectable mainnet/UNI-7 lookup, registration, renewal, transfer, public contact reads/updates and validator preview | Mainnet registry/profile manifest is recorded; purchases remain paused; UNI-7 purchases use the original local key |
| `names-mainnet-deploy.html` | Four owner-confirmed mainnet upload/instantiate actions with pinned public key and owner-wallet upgrade admin, persisted recovery and two-provider receipt export | Four owner-signed deployment receipts recorded; purchases remain paused |
| `names-v2-setup.html` | Explicit Keplr upload/instantiate/activation, local test quote key, manifest export and receipt recovery | Existing owner deployment is already complete; do not repeat setup |
| `names-v2-lab.html` | Verified manifest, mock-NETA registration/renewal, recipient-accepted transfer and public contacts | UNI-7 only; quote rate is fictional USD 2/mock NETA |
| Independent validator observation | Wallet-free entered-pair check; stored-link refresh checks both validator records and UNI-7 consensus keys at a displayed block | Public provider observations, latest staking records, no uptime or programme points; unavailable data stay unresolved |
| Validator ownership section | Exact contract-matched challenge, separate juno-1/uni-7 ADR-36 signatures, reviewed publication, owner unlink, unilateral revocation | Live consenting-validator E2E outstanding; no points or active-set attestation |

`names.js` retains inactive v1 with `REGISTRY=null`; `NAMES_V2_DEPLOYMENT` and
`PROFILE_DEPLOYMENT` are also null for production. These legacy constants do **not** disable or identify the manifest-driven deployments.
Mainnet uses `docs/deployments/nns-mainnet.json`; UNI-7 retains its own manifest. Codes 122/123/124 and the
registry/profile/token identities are in the [public manifest](deployments/nns-uni7-owner-2026-10-04.json).

My profile's validator preview has a labelled Network selector, currently Juno
only. Its network entry supplies the mainnet/testnet labels, chain IDs, address
prefix and validation. Unknown networks are rejected; selection edits invalidate
the preview. Future networks need their own verified adapters and contract support.
The current lab and ownership proof protocol remain pinned to `juno-1` / `uni-7`.

Owner-signed registration, contacts, renewal and transfer were checked through
latest-state reads on 2026-10-04. Current observed owner of `cristiano.neta` is
`juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`, generation 1, ownership revision 2,
expiry 2028-10-03T19:15:41Z. Old owner mapping/offer are cleared; visible contacts
are empty after transfer. See [NNS handoff](HANDOFF_NEXT_CHAT_NNS_2026-10-04.md) for
receipt limits, setup receipts and release verification through PR #145.

`names-v2-validator-status.mjs` separately checks fresh `juno-1`/`uni-7` block
identity, exact operator records, and the full paginated UNI-7 consensus set at
one recorded height. Latest staking records are not height-pinned; this is a
read-only diagnostic, not an eligibility snapshot or light-client verification.
Input/manifest changes cancel observations and prevent late result replacement.

`names-v2-workspace.mjs` integrates mainnet and existing UNI-7 adapters into the main
RELAY name/profile panels using the shared header wallet, pinned public manifests,
explicit reviews and chain-scoped persisted transaction journals. It does not deploy
new contracts or activate a public/mainnet quote service. Browser quote creation
still needs the original setup browser. See [integration](NAMES_MAIN_PAGE_INTEGRATION.md).

`names-v2-reader.mjs` verifies deployment and fresh data on the selected chain;
`names-v2-client.mjs` coordinates reviewed intents and exact receipt recovery;
`names-v2-wallet.mjs` bridges Keplr and the existing origin transaction journal.
`names-v2-validator-proofs.mjs` keeps unpublished proofs in tab memory across
deliberate wallet switches, with expiry/revision/identity checks;
`names-v2-validator-ui.mjs` handles the distinct signature/publication reviews.
Lost/unknown submissions stay locked until reconciled; no automatic resend occurs.

The accepted annual tariff is USD 99/19/5 for 3/4/5–32 characters, for both
registration and renewal, 1–5-year terms, 365-day years and 30-day grace. Mainnet
fees target the main NETA DAO, not Operations. The owner subsequently approved reusing the existing Treasury WYND NETA price,
with scheduled 30-minute refresh and up to 24 hours of signed validity. Registry
source v0.3.1 accepts shared-price hooks in addition to legacy individual quotes;
its new WASM is pinned separately under `assets/names-mainnet/`. Existing deployed
UNI-7 code and historical artifacts are unchanged. `names/publish-snapshot.mjs`
signs the collector's explicit `nns_price` offline in the main DAO job; no new
market polling or Render service is needed. `snapshot-client.mjs`, shared core
validation and `NamesV2Client.snapshotQuote` support reviewed snapshot payments
and existing recovery. The normal page/reader/wallet now supports both chains; UNI-7 retains
its old local individual-quote flow. Mainnet adapters and browser price-key setup
are implemented and synthetically tested. The owner supplied the public price key, now pinned in the separate deployment page.
Owner decision: registry/profile upgrade rights initially belong to
`juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`, transferable to the DAO later.
The owner wallet also controls tariffs, purchase pause and price-key rotation;
the main DAO is the fee recipient. Registry v0.3.1 makes application admin
independent of that recipient and starts with USD 99/19/5 while paused. Upgrade
authority is set separately in the outer instantiate message. A synthetic
migration test verifies authority, state preservation and subsequent DAO transfer.
The owner completed four mainnet transactions and exported matching two-provider
paused observations at 13:54 Berlin. Registry code 5168 and profile code 5169 are
recorded in `deployments/nns-mainnet.json`; exact receipts and verification procedure
are in [deployment evidence](NNS_MAINNET_DEPLOYMENT_2026-10-05.md). PR #161 is merged with
all four checks passed, including live verification run `37307194424`. The first
Main DAO snapshots run `37307454347` found an Actions secret but failed to publish
the price; its public source and manifest validate. Fixed diagnostic labels now
distinguish key parsing/type/mismatch, source and signing errors without exposing
private material. Run `37308389038` at 12:16:44 UTC diagnosed **invalid PEM private-key format**.
The owner must privately replace the secret with the complete existing PEM backup;
no new key or deployment. A matching valid public signed price and backup custody
remain launch gates.
PR [#158](https://github.com/cristianoneta/neta-dao/pull/158), merge
`62f12f1a0c672a776a5f3500ab4e8e8a09b93e42`, passed all 11 final PR checks,
three main checks and Pages `37302003843`; 15 served assets matched SHA-256.
The [targeted review](NNS_SECURITY_REVIEW_2026-10-05.md) records 210 passing
Rust/Node tests and browser evidence, with remaining trust/launch gates.
There is no dedicated mainnet owner tariff/unpause panel yet; contract authority
and unsigned message preparation exist. A future owner-confirmed activation
still needs a concrete reviewed action after manifest and price verification.
See [runbook](../names/README.md) and [historical snapshot evidence](NNS_SNAPSHOT_RELEASE_2026-10-05.md).
The earlier continuous WYND server is deferred, not hosted. Its stricter policy
is not the policy of the approved snapshot system.
The existing UNI-7 registry needs an explicit admin `set_tariff` transaction via
the lab Annual pricing section; source/UI changes do not alter deployed config.
Its activation remains unverified until that wallet receipt/config is checked.
`names/mainnet-plan.mjs` prepares unsigned mainnet deployment and admin-wallet tariff
review material. The approved owner wallet can set the mainnet tariff or unpause; no mainnet activation or purchase is recorded. Deployment transactions are
separately recorded in the production manifest and receipt bundle.
Original WASM/bootstrap tariff and signed historical fixtures remain unchanged;
new installations also apply the approved tariff before purchasing. Quotes read
the current on-chain tariff/version.
Free DAO namespaces, verified receiving addresses, private contacts, lifecycle
notifications and DAO-authorized profile proposals remain later work.

## UNI-7 faucet

`juno-faucet.html` is a separate tool linked from the common footer. It supports
Keplr, validators/commission, balances/delegations/unbonding/rewards, reviewed
stake/unstake/reward transactions, whole-JUNOX donations and 25-JUNOX requests (PR #147; Pages assets and Render `/status` verified 2026-10-05).
The public API/address are pinned in `juno-faucet-config.mjs` and the HTML CSP.

Render uses durable SQLite, ADR-36 ownership proofs, rolling 24-hour per-wallet
cooldown and aggregate request/payout/concurrency limits. The frontend requires
`usage-guards-v1`, `uni7-exact-hash-v1` and `bank-send-gas-v1`. These are application
limits, not a hard hosting invoice cap. Render auto-deploy is off; backend changes
need a manual deploy, while static Pages changes do not.

Reward and 15-JUNOX donation receipts were verified. Real payout/repeated-request/
restart/fresh-empty-wallet checks and stake/unstake evidence remain unrecorded.
Fresh service readiness alone does not close these gates. Read [faucet handoff](HANDOFF_NEXT_CHAT_FAUCET_2026-10-04.md)
for current observations and [faucet README](../faucet/README.md) for operation.

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
priced-assets subtotal and groups valuation warnings inside the collapsed small/unpriced
asset details (owner UI decision, 2026-10-05).

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
[Treasury valuation correction](TREASURY_VALUATION_FIX_2026-10-03.md) for dated
incident evidence. Current data timestamps/status belong to the exported JSON.

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

Main DAO snapshots use a separate 30-minute workflow and collector
`scripts/update_main_dao.py`; `data/daos/neta-status.json` must be read alongside
underlying snapshot timestamps. Membership has its own 30-minute workflow.
Neither replaces Operations exports. Scheduled cadence is not a freshness guarantee;
check latest timestamps and actual runs. The maintenance checkpoint records the
observed data lag and successful latest collector runs without claiming live data.


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
Legacy/uncertain outgoing intents still lack complete user-facing reconciliation.
PR #101 adds transactional local receive rollback and invalid-ciphertext quarantine;
storage failures preserve the journal and lock. It is not remote backup.
Follow-up sends in an established current-generation session no longer require
an unused recipient prekey. First contact still requires one.

Two mocked browser profiles exchanged/replied and reloaded successfully in PR #97.
No real two-Keplr UNI-7 E2E evidence is recorded. The older DB backup fixture
restores an unread message in a fresh profile; the integrated lab restores local
already-read archive after reload. Neither implements automatic remote recovery.
GPL was chosen for the isolated lab; production distribution/security review is
still a separate gate. `spikes/relay-corecrypto/package.json` is private/UNLICENSED;
do not infer a blanket repository license from the vendor license.

## Remaining release gates and evidence

Mailbox v0.2 consent/historical-identity source is tested, but the deployed v0.1
artifact/address above remains pinned. Sender-generation history, consent/refill
integration, coherent off-device backup/anti-rollback and rotation/exhaustion/restore
coverage remain open. Keep mainnet messaging and the main composer disabled.
See [security continuation](SECURITY_CONTINUATION_2026-10-03.md),
[security audit](SECURITY_EFFICIENCY_AUDIT_2026-10-02.md) and
[recovery decision](RELAY_RECOVERY_DECISION.md). Delivery records are plans, not
executable payment instructions. AtomOne remains research, with no active adapter.

PR #145 passed 84 root Node tests and applicable contract/frontend, faucet and
browser checks. Browser tests use synthetic chain/wallet adapters, not live operator
consent. Screenshots were inspected at 320/390/768/1440 px. Main and Pages passed;
eight changed public assets matched after deployment. Exact run IDs are in the
NNS handoff and PR. No full repository security re-audit is claimed by this cleanup.

CI is path-filtered; ordinary README/HANDOFF/docs edits do not trigger application
suites. Contract Markdown and the RELAY security document do match some filters;
`faucet/**` also triggers faucet CI. See `.github/workflows/` and actual checks.
`relay-client-assets.yml` is a branch-specific preparation writer, not a recurring
main publisher. Follow the local verification commands in [README](../README.md).

## Owner mainnet preparation

`names-mainnet-setup.html` creates/restores an owner-controlled Ed25519 price key
locally, downloads a private PEM backup and a public deployment plan, and links
to the repository Actions-secret form. It stores only the public key and has
`connect-src 'none'`. Private-key export/copy requires an explicit click. It does
not install the secret, deploy contracts or enable purchases. Public-key continuity
and matching backup restoration avoid silently replacing an existing authority.
