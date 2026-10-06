# NETA DAO handoff

Updated: **2026-10-06, Names UX follow-up**. This is the continuation entry point, not an append-only session log.


## Names UX optimization — 2026-10-06

Owner approved implementing the critical Names review. This revision adds:
- Owner-focused management: existing names show Edit profile, Renew and Transfer;
  registration/renewal forms open for the selected task. Availability is the first
  primary action, followed by Start registration and Buy name as appropriate.
- Read-only pending-journal discovery immediately after the shared wallet connects,
  before Names signing permission. Recovery opens automatically; records are never
  rewritten or removed by the presentation layer.
- Active, 30-day grace and released-name states. The registry only enumerates active
  names by wallet; expired names are discovered from local hints and verified live.
  On a fresh browser, use Find an expired name. Hints never authorize transactions.
- Automatic public-profile loading, Review changes as the primary action, and
  unsaved edits preserved across route/wallet switches within the current page.
  Reload published profile explicitly replaces edits; a browser reload does not
  preserve these in-memory profile drafts. Pending transaction journals stay durable.
- Readable transaction summaries with exact amount, term, Treasury destination,
  price timestamps and deadlines; complete transaction details remain available.
  Registry tariffs replace the hardcoded price footer. DAO search copy matches
  the available DAO directory. Shared graphite/mint styling and mobile wrapping remain.

Release tracking: branch `feat/nns-ux-20261006`; its PR owns hosted CI, Pages and
served-asset verification evidence. Local validation covers 115 Node tests,
mainnet/UNI-7 browser flows, administration, provider failure, wallet isolation,
late profile replies, saved pending work, grace boundaries and 320–1440 px layouts.
No real wallet transaction or contract change was performed. Existing welcome,
renewal and transfer notices and the Treasury P&L scope below remain unchanged.

## Compact Names account panel — 2026-10-06 follow-up

Owner approved simplifying the large Names network panel. The change replaces
the manual name-loading entry point with a read-only wallet summary and direct
Edit profile / Renew name shortcuts. Keep the compact network selector visible;
pricing/network diagnostics and owner administration stay collapsed. Account
reads do not enable Keplr, sign or overwrite drafts. Wallet/network changes abort
old reads; provider failure has an explicit retry state. Saved transaction
recovery remains separate and takes priority over switching forms.

Implementation, hosted checks and publication evidence are tracked in
[PR #171](https://github.com/cristianoneta/neta-dao/pull/171). The account summary
is a frontend change; no new registration or contract deployment is needed.
The P&L scope and earlier release evidence below remain unchanged.

## Current checkpoint — yesterday's NNS updates are live

Owner requested catching up the saved changes on 2026-10-06. [PR #169](https://github.com/cristianoneta/neta-dao/pull/169)
was merged at `2e0ef62243513383362eb664bf9e56df2c559203` after all four hosted
checks passed for head `dce666dce47f866883ef08c150a880c65106bab9`.
PR #168 is superseded and incorporated; do not merge it independently.

**Published and verified at 07:17 Berlin:** simplified buying, non-exclusive
one-hour commitment disclosure, welcome/profile/renewal links, separate renewal,
outgoing-transfer and incoming-transfer notices, 6/3/1-month and 14/7/1-day reminders,
expiry/grace-end notices, wallet isolation and reduced background polling.
These remain browser-local system notices, not email/push or private mainnet messages.

GitHub's runner incident is resolved. Price, faucet and contract/frontend checks
passed on main as well; Pages run `37417654224` succeeded. SHA-256 comparisons for
index, shared CSS, Names workspace, RELAY and both notice modules matched the
served files. The NNS price observed at 06:48:22 Berlin passed signature validation
and expires on 2026-10-07 at 06:48:22 Berlin. Scheduled Treasury/member/main-DAO
updates recovered without replaying stale jobs or editing generated data.
See [release evidence](docs/NNS_FLOW_NOTIFICATIONS_2026-10-05.md) and
[machine-readable verification](docs/deployments/nns-ui-release-2026-10-06.json).

The first resumed browser run found old assertions for Read registry / the removed
preparation button. Tests now assert Check availability and the combined action;
missing-manifest/provider fixtures also prove reads stay available while all
transaction confirmations stay blocked. Both affected browser tests passed locally,
then the complete hosted suite passed. Product/security gates were not weakened.

Next steps:
1. The owner can reload RELAY, connect the existing wallet and inspect the welcome
   message/profile/renewal links without buying again. Do not repeat deployment,
   activation or the first purchase. Real mainnet renewal/transfer and consenting
   live-validator E2E remain unverified and need deliberate owner wallet actions.
2. The accepted Treasury P&L design below is saved. Its real-data implementation
   remains open; NNS fees are not yet integrated into the Treasury event ledger.
   Historical main-DAO events still report UNAVAILABLE and must not become zero.
3. Preserve later bot commits and follow the ordinary checks/Pages verification
   for further changes. Do not rerun the old paused-registry launch workflow
   unchanged against the now-active registry.

No private RPC/server was purchased. [RPC options](docs/JUNO_RPC_OPTIONS_2026-10-05.md)
and [incident evidence](docs/ACTIONS_RUNNER_INCIDENT_2026-10-05.md) remain available.
GitHub main is the durable continuation source.

## Treasury P&L draft — owner accepted direction, 2026-10-05

The owner said the draft looks good and requested fixing black text on dark
backgrounds, then saving it for continuation. **Design only, not live accounting.**
The corrected [interactive preview](docs/design/treasury-pnl-draft.html),
[editable source](docs/design/treasury-pnl-draft.fragment.html) and
[requirements / validation / next steps](docs/TREASURY_PNL_DRAFT_2026-10-05.md)
are preserved in this branch.

Keep the P&L between Assets and Treasury events; default current month, with
month/year/full-year selection. Separate NNS registration/renewal income and
expense categories; show operating surplus/deficit and category/event details.
Transaction-time USD valuation is fixed. Own-wallet transfers, swaps and market
movements are not revenue; funding and valuation effects have a separate bridge.
Upcoming commitments remain outside paid expenses. Unavailable data is not zero.
No Reserve Policy. All preview figures and activity are fictional examples.

Scoped light foregrounds and dropdown colors now protect the dark draft from host
text-style leakage. Local light/dark checks (including black host-style injection)
measured at least 6.98:1 for visible text; period/category interactions and
1024/768/390/320 px reflow passed. Apply shared production tokens when implementing.
The NNS release is now complete; source-backed Treasury accounting is the next
planned implementation using this design. Approval of the mockup does not mean the P&L is implemented or deployed.

## Start here

1. Read `AGENTS.md`, this file and [CURRENT_STATE](docs/CURRENT_STATE.md).
2. Fetch current `main`, open PRs and relevant Actions; preserve later bot commits.
3. For NNS, read [the detailed next-chat handoff](docs/HANDOFF_NEXT_CHAT_NNS_2026-10-04.md).
   For UI work also read [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md).
4. Use [the documentation index](docs/README.md) to find the owning runbook.
   Dated evidence and archives do not override the current state.

## Verified continuation checkpoint — 2026-10-05

The NNS PEM-secret error is resolved. The first signed price was published and
verified on 2026-10-05 at 19:41 Berlin; the independent two-provider deployment
check passed via GitHub Actions at 19:49:53. The owner subsequently activated purchases and completed the first mainnet registration; see the receipts below. Treasury stays deferred.

Mainnet manifest/receipts were published in PR #161 after independent chain
verification; fixed secret-safe diagnostics and the correction gate shipped in
PRs #162/#163. The earlier security release #158 and its test evidence remain
recorded in [review and release evidence](docs/NNS_SECURITY_REVIEW_2026-10-05.md).
All four deployment transactions, purchase activation and the first mainnet
registration are complete. Fresh chain reads confirm purchases open and the name active.

## Completed today

- NNS UNI-7 setup/recovery, registration, public contacts, one-year renewal and
  accepted two-wallet transfer. Do not repeat deployment, activation or purchase.
- On **UNI-7**, `cristiano.neta` now belongs to `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`;
  ownership revision 2; expiry **2028-10-03T19:15:41Z**. Previous contacts are
  invalidated in current reads. These are observed post-states; exact operation
  receipts beyond setup still need archival. Historical chain data are not erased.
- Profile-preview correction #144 and validator ownership UI #145 are merged and
  live. Link preparation, separate operator signatures, reviewed UNI-7 publication,
  owner unlink and unilateral revocation are implemented. Latest release: merge
  `50c5814e048230507a1d03c3e7c8c03f97b537ee`; all applicable checks and Pages passed;
  all eight changed public assets matched. Detailed evidence is in the NNS handoff.
- Owner requested 25 JUNOX per rolling 24 hours on 2026-10-05. PR #147 is merged;
  Pages assets matched and the owner's Render deployment was verified on 2026-10-05:
  `/status.amount=25000000`, `intervalSeconds=86400`, `ready=true`.
  See the faucet handoff for the 27-JUNOX readiness threshold and preserved guards.
- Faucet frontend is connected to the funded Render service. Donation and reward
  receipts exist; payout/replay/restart/fresh-wallet E2E and real stake/unstake
  evidence remain open. See [faucet handoff](docs/HANDOFF_NEXT_CHAT_FAUCET_2026-10-04.md).

- Independent validator observations were added on 2026-10-05: check entered
  operator addresses without a wallet, or read a stored link to check its pair.
  The panel distinguishes existence, UNI-7 consensus membership and unavailable
  data; it does not award points or close the real operator test gate.

## Next task

Owner's latest direction on 2026-10-05 **supersedes the WYND Render plan**:
reuse the existing Treasury NETA price; ordinary deviations are acceptable. Price
updates target the existing 30-minute main DAO job; a signed observation remains
valid for at most 24 hours. **Do not create a separate Render NNS service.**
Live validator tests stay deferred. Annual USD **99 / 19 / 5** is unchanged.

### Mainnet checkpoint

The owner signed all four mainnet deployment transactions and supplied the public
receipt bundle on **2026-10-05 at 13:54 Berlin**. Do not repeat uploads or creation.

- Registry code **5168**: `juno1pc8wrq89ljuhu2qt6rtk5lkkrptxajtf3un5llu8prg7r4z50vlszfhhza`.
- Profiles code **5169**: `juno1y2yu66meq6p6wm0ur6wfwjr60ugaakjmefgjxqkw30l35kl45yhsywple6`.
- [Production manifest](docs/deployments/nns-mainnet.json) and
  [four public receipts](docs/deployments/nns-mainnet-receipts-2026-10-05.json).
- Both upgrade administrators and the registry application administrator are
  `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`. The main NETA DAO receives fees.
- Both initial exported provider observations agreed: purchases paused, tariff version 1,
  annual USD **99 / 19 / 5**, signer version 1 and the approved public price key.
- Public key: `XfqS2XMXgZKJ5fiU721D3XsuhPas+4U1idUujcintdU=`.
  The owner corrected the existing PEM secret at 19:38 Berlin; never regenerate
  the key or request its private backup. Fresh Main DAO run `37350238171` and
  Pages `37350292762` succeeded. The first served signed price matched its source
  and passed independent signature validation (19:41:02 Berlin, 24-hour validity).
- Fresh two-provider verification succeeded **via GitHub Actions** at 19:49:53
  Berlin: run `37307194424`, job `111902537250`; Polkachu and STAVR agree on the
  reviewed deployment, owner administrators, key, USD 99/19/5 and purchases paused.
  Direct assistant-environment 403/502 errors are not proof of provider outages.
  Use runner-based read-only verification when direct access fails; the original
  paused-state workflow now needs reviewed expectations before reuse. Two-provider checks are
  a launch/deployment gate, not required for every normal read or price refresh.
- After a secret correction, start a fresh Main DAO snapshots workflow on main:
  repeating an old run can conflict with newer generated data. Never hand-edit
  collector output to resolve this. See [recovery evidence](docs/NNS_MAINNET_DEPLOYMENT_2026-10-05.md).
- **Completed:** owner-confirmed activation at 18:17:20 UTC and first mainnet
  purchase at 18:20:13 UTC. `cristiano.neta` belongs to the approved owner wallet,
  generation/revision 1, expiry **2027-10-05T18:20:13Z**. The successful receipt
  records **4.755098 NETA** from owner to registry and onward to the main NETA DAO.
  See [launch evidence](docs/NNS_MAINNET_DEPLOYMENT_2026-10-05.md) for all three hashes
  and the single-provider verification boundary. Do not repeat activation or payment.
- **Purchase UX (PR #169; live 2026-10-06):** Check availability now includes registry verification. Start
  registration combines local preparation with the commitment review; Buy name
  opens the explicitly labelled payment confirmation. Commitments last one hour
  and do not reserve a name exclusively. Saved secrets and pending journals remain.
- **Inbox update (PR #169; live 2026-10-06):** welcome, renewal confirmation, transfer sent/received and
  renewal/expiry reminders are implemented with profile/renewal deep links. Local
  system notices remain distinct from disabled private messaging. See
  [implementation and release evidence](docs/NNS_FLOW_NOTIFICATIONS_2026-10-05.md).
  RPC/run assessment: [options](docs/JUNO_RPC_OPTIONS_2026-10-05.md).
- **Next:** load the existing mainnet name and continue ordinary profile use if
  requested. Mainnet renewal/transfer and live validator E2E are not claimed tested.
  Treasury stays deferred. The initial paused-state workflow must not be rerun
  unchanged against the now-active registry.

Upgrade transfer (`MsgUpdateAdmin` on each contract) and registry `set_admin`
are separate future owner actions. No transfer or removal of authority is authorized.
UNI-7 contracts, completed lifecycle, local key and journals are preserved.
Validator live tests stay deferred. Treasury P&L production implementation remains open;
the NNS UI release is complete and the accepted draft above is saved for that work; the shared collapsed-warning fix is already published in PR #160.

The main `.neta name` and `My profile` pages already reuse the existing UNI-7
manifest, shared header wallet and journals for registration/renewal/transfers and
public contacts. Browser tests are synthetic; integrated owner-wallet UX remains
open. Do not redeploy or repeat the completed owner lifecycle tests. Test quotes
need the original setup browser's local key. The separate UNI-7 tariff update is
still unverified: use the lab Annual pricing section and original admin
`juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt` if completing that test gate. Chat
approval/source changes are not an on-chain tariff receipt. See
[main-page integration](docs/NAMES_MAIN_PAGE_INTEGRATION.md).

When validator testing resumes, use the existing manifest and lab with a consenting
operator controlling both a Juno mainnet and UNI-7 validator, using their own
active test name and wallets. No operator has been contacted. Proofs live in one
tab, without remote signature exchange. Verify link, both bindings, owner unlink
and unilateral revocation with exact receipts and post-state. The independent
read-only chain check in PR #149 is published; all PR/main checks and Pages passed,
and all four public files matched. It does not close the live operator E2E gate.

The owner likes the directory's mint DAO initials and wants separate identity
colours for users and verified active validators. Light blue for users and lavender
for validators were proposed, not yet approved or implemented. The validator colour
and label require verified address control AND chain-specific active-set evidence.

My profile's Validator addresses section now has an explicit Network selector,
currently Juno only (`juno-1` / `uni-7`). The preview uses the selected network's
chain pair and validator. Adding a network requires its own validation and proof
support; this selector does not expand the UNI-7 lab or deployed contract protocol.

Keep programme criteria and deferred Smart Delegation research unchanged. See
[NNS handoff](docs/HANDOFF_NEXT_CHAT_NNS_2026-10-04.md) and
[PROJECT_CHECKPOINT](PROJECT_CHECKPOINT.md) for other open work.

## Working rules

- Use isolated branches/PRs; inspect applicable checks and served files after merge.
- Keep browser site data, local test quote authority, registration secrets and
  pending transaction/crypto journals. Unknown outcomes are reconciled, never resent
  automatically or cleared to unblock the UI. Keep Render SQLite/WAL across deploys.
- Never request seeds/private keys. All live writes need the user's explicit wallet
  confirmation. Test operator proofs are off-chain; publication consumes UNI-7 gas.
- Mainnet Names purchases were opened by the owner; mainnet messaging remains disabled. Operations review finalization is
  not submission of a mainnet proposal. Native Juno submission/voting remains absent.
- Generated Treasury/member files belong to their collectors; never hand-edit them.
- This repository owns `dao.netareborn.com`; `neta-website` owns `netareborn.com`.
- Update current sections in place. Put release chronology in dated evidence or
  PR descriptions; do not prepend competing “next steps” to every document.

Previous chronological handoff: [archive](docs/archive/HANDOFF_BEFORE_CLEANUP_2026-10-04.md).
Cleanup scope and observed service/data status: [maintenance review](docs/MAINTENANCE_CHECKPOINT_2026-10-04.md).
