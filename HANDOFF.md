# NETA DAO handoff

Updated: **2026-10-05 (Europe/Berlin)**. This is the continuation entry point, not an append-only session log.

## Start here

1. Read `AGENTS.md`, this file and [CURRENT_STATE](docs/CURRENT_STATE.md).
2. Fetch current `main`, open PRs and relevant Actions; preserve later bot commits.
3. For NNS, read [the detailed next-chat handoff](docs/HANDOFF_NEXT_CHAT_NNS_2026-10-04.md).
   For UI work also read [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md).
4. Use [the documentation index](docs/README.md) to find the owning runbook.
   Dated evidence and archives do not override the current state.

## Verified continuation checkpoint — 2026-10-05

The owner requested this handoff before continuing in a new chat. Implementation
PR [#158](https://github.com/cristianoneta/neta-dao/pull/158) is merged as
`62f12f1a0c672a776a5f3500ab4e8e8a09b93e42` and published. All 11 final PR checks,
all three main checks and Pages run `37302003843` succeeded; 15 served files
matched local SHA-256. The targeted internal security review records 210 passing
Rust/Node tests plus browser flows; it is not an independent external audit.
See [review and release evidence](docs/NNS_SECURITY_REVIEW_2026-10-05.md).

**No mainnet upload/signature has occurred according to the owner's last report.**
No production contract addresses or receipts are recorded. The next chat should
resume the reviewed deployment below, not repeat the audit or UNI-7 lifecycle.

## Completed today

- NNS UNI-7 setup/recovery, registration, public contacts, one-year renewal and
  accepted two-wallet transfer. Do not repeat deployment, activation or purchase.
- `cristiano.neta` now belongs to `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`;
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

The snapshot implementation adds registry v0.3.1, a separate pinned mainnet WASM,
shared signed-price verification/payment hooks, offline Actions publication and
the browser/client purchase preparation path. Existing UNI-7 contracts and WASMs,
local authority and transaction journals remain unchanged. Source and synthetic
tests are not a deployed mainnet or owner-wallet purchase. See [the owning runbook](names/README.md)
and [snapshot release checkpoint](docs/NNS_SNAPSHOT_RELEASE_2026-10-05.md).

**Next owner action:** force-reload (Ctrl+F5; discard the old unsent review) `https://dao.netareborn.com/names-mainnet-deploy.html`
and connect `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`. Review registry v0.3.1
upload/creation and profile upload/creation separately, then use **Verify and download public receipts** and share the public
`nns-mainnet-deployment-receipts.json` in the next chat. Each of the four actions
requires its own Keplr review/confirmation and real JUNO gas; deployment sends no NETA.
At 12:54 Berlin the owner explicitly confirmed **nothing has been uploaded or
signed**: only the old registry upload review was displayed. No chain recovery or
replacement deployment is needed. Do not treat the old review as a receipt.

Owner corrections on 2026-10-05: the wallet above initially holds **both contract
upgrade rights and registry administration** (tariffs, purchase pause and price-key
rotation). **Only name fees go to the main NETA DAO.** No current DAO proposal is
required for pricing or activation. Future transfers are possible and separate:
`MsgUpdateAdmin` for each contract's upgrade right; registry `set_admin` for its
application authority. Do not transfer or clear rights without a later instruction.
New production contracts require an explicitly agreed upgrade authority.

Registry v0.3.1 removes the old forced DAO application-admin condition while still
pinning the real NETA token and DAO fee destination. It starts paused with the
approved initial USD **99 / 19 / 5** tariff. The owner can change current prices;
mainnet purchase preparation follows the verified on-chain tariff. The new WASM
is `assets/names-mainnet/neta_names_v2_v031.wasm`, hash
`f25c982db217363c395a1c09c3028988cff390323b0aa852249016bbebe974fc`.
Historical mainnet v0.3.0/UNI-7 artifacts and journals remain intact.
See [targeted security review](docs/NNS_SECURITY_REVIEW_2026-10-05.md).
The owner supplied public price key
`XfqS2XMXgZKJ5fiU721D3XsuhPas+4U1idUujcintdU=` on 2026-10-05;
it is pinned in `names/mainnet-config.mjs` and the dated unsigned deployment plan.
Do not recreate it. Private backup custody and installation of the Actions secret
`NNS_PRICE_SIGNING_KEY` have **not been confirmed**. Never request the private key.
The deploy page needs no private price key and exports a version-3 manifest,
exact transaction receipts and two-provider paused-config and upgrade-admin observations. Reloads
preserve pending intents; recovery never automatically resends a transaction.
The page does not submit DAO proposals or activate purchases. No mainnet deployment
receipt has yet been received from the owner.
Prepare and owner-sign mainnet registry/profile deployment, record exact receipts
and a verified version-3 `docs/deployments/nns-mainnet.json`, then verify the initial tariff and public signed price while purchases stay paused.

The existing Treasury job signs only once the production manifest is present.
It reuses the collected WYND NETA price without new API polling. Old prices are
not re-dated; missing or expired prices stop purchase preparation. Authentic older
snapshots can remain usable until expiry; no on-chain price-update transaction is
introduced. See the runbook for this accepted approximation and key custody.

Mainnet reader/wallet/page integration is implemented. The Names network selector
chooses `juno-1` or the preserved UNI-7 deployment; the shared header requests the
selected chain. Mainnet checks both registry/profile artifact pins, real NETA,
DAO/key/config and fresh chain data; it uses the public signed Treasury snapshot.
Purchase/profile/transfer reviews and journals remain scoped by chain/registry.
Absent or unverified production manifests keep mainnet operations unavailable.
Browser suites exercise both networks with synthetic adapters, not live receipts.
After owner-signed deployment, verify the public price and real mainnet UI, activate
purchases through a separate admin-wallet transaction and verify an owner-signed purchase.
A dedicated mainnet owner panel for tariff changes/unpause is not yet implemented.
The contract authority and unsigned preparation helper exist; prepare the concrete
owner review only after the verified manifest and price are available.
No mainnet address or wallet/DAO receipt is recorded.

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
- Mainnet Names and messaging remain disabled. Operations review finalization is
  not submission of a mainnet proposal. Native Juno submission/voting remains absent.
- Generated Treasury/member files belong to their collectors; never hand-edit them.
- This repository owns `dao.netareborn.com`; `neta-website` owns `netareborn.com`.
- Update current sections in place. Put release chronology in dated evidence or
  PR descriptions; do not prepend competing “next steps” to every document.

Previous chronological handoff: [archive](docs/archive/HANDOFF_BEFORE_CLEANUP_2026-10-04.md).
Cleanup scope and observed service/data status: [maintenance review](docs/MAINTENANCE_CHECKPOINT_2026-10-04.md).
