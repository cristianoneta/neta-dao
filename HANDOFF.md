# NETA DAO handoff

Updated: **2026-10-05, 20:20 mainnet activation and first purchase checkpoint (Europe/Berlin)**. This is the continuation entry point, not an append-only session log.

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
- **Next:** load the existing mainnet name and continue ordinary profile use if
  requested. Mainnet renewal/transfer and live validator E2E are not claimed tested.
  Treasury stays deferred. The initial paused-state workflow must not be rerun
  unchanged against the now-active registry.

Upgrade transfer (`MsgUpdateAdmin` on each contract) and registry `set_admin`
are separate future owner actions. No transfer or removal of authority is authorized.
UNI-7 contracts, completed lifecycle, local key and journals are preserved.
Validator live tests stay deferred. Treasury P&L work is explicitly deferred until
NNS is finished; the shared collapsed-warning fix is already published in PR #160.

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
