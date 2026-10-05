# NETA DAO handoff

Updated: **2026-10-05, evening checkpoint (Europe/Berlin)**. This is the continuation entry point, not an append-only session log.

## Start here

1. Read `AGENTS.md`, this file and [CURRENT_STATE](docs/CURRENT_STATE.md).
2. Fetch current `main`, open PRs and relevant Actions; preserve later bot commits.
3. For NNS, read [the detailed next-chat handoff](docs/HANDOFF_NEXT_CHAT_NNS_2026-10-04.md).
   For UI work also read [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md).
4. Use [the documentation index](docs/README.md) to find the owning runbook.
   Dated evidence and archives do not override the current state.

## Verified continuation checkpoint — 2026-10-05

The owner requested a new-chat handoff after showing repeated GitHub failure
emails on the evening of 2026-10-05. Their cause is verified below: unreadable
NNS price-key PEM; Treasury collection/publication still succeeds. The user has
not yet confirmed a corrected secret. Resume with that correction, then price
verification; do not repeat deployment or completed UNI-7 tests.

Mainnet manifest/receipts were published in PR #161 after independent chain
verification; fixed secret-safe diagnostics and the correction gate shipped in
PRs #162/#163. The earlier security release #158 and its test evidence remain
recorded in [review and release evidence](docs/NNS_SECURITY_REVIEW_2026-10-05.md).
All four owner deployment transactions are complete; no activation or mainnet
purchase is recorded. The last verified live UI showed purchases paused.

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

### Mainnet checkpoint

The owner signed all four mainnet deployment transactions and supplied the public
receipt bundle on **2026-10-05 at 13:54 Berlin**. Do not repeat uploads or creation.

- Registry code **5168**: `juno1pc8wrq89ljuhu2qt6rtk5lkkrptxajtf3un5llu8prg7r4z50vlszfhhza`.
- Profiles code **5169**: `juno1y2yu66meq6p6wm0ur6wfwjr60ugaakjmefgjxqkw30l35kl45yhsywple6`.
- [Production manifest](docs/deployments/nns-mainnet.json) and
  [four public receipts](docs/deployments/nns-mainnet-receipts-2026-10-05.json).
- Both upgrade administrators and the registry application administrator are
  `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`. The main NETA DAO receives fees.
- Both exported provider observations agree: purchases paused, tariff version 1,
  annual USD **99 / 19 / 5**, signer version 1 and the approved public price key.
- Public key: `XfqS2XMXgZKJ5fiU721D3XsuhPas+4U1idUujcintdU=`.
  Never regenerate it or request its private backup. The Actions secret is present,
  but latest inspected runs `37343822798` and `37347330414` (18:50 / 19:18 Berlin)
  still fail to parse it as an unencrypted PEM private key.
  Owner must replace its value with the complete existing `nns-price-key.pem`,
  including BEGIN/END lines and real line breaks. Never send it in chat or create
  a replacement key. Backup custody and matching public-key validation remain open.
- PR #161 is merged (`7bdcb47e140c0efda768b5cae5fcd828a4526dc4`); all four checks
  passed, including exact chain payloads and two independent provider observations
  in run `37307194424`. See [deployment evidence](docs/NNS_MAINNET_DEPLOYMENT_2026-10-05.md).
- **Evening screenshot explained:** the recurring failure emails are the same
  NNS signing error on the existing `7,37 * * * *` schedule, not repeated deployments.
  Both latest inspected runs successfully collected and published Treasury data;
  only the price-signing step failed, making the overall job red. The latest
  inspected Treasury observation is 19:17:41 Berlin; `data/nns/price.json` is absent.
  See the evening evidence in the deployment document. No workflow suppression,
  schedule change, secret edit or chain transaction was performed for this review.
- **Next chat:** help the owner privately correct `NNS_PRICE_SIGNING_KEY` using
  the complete existing PEM backup. Do not ask for the key/file in chat, print it,
  regenerate it, or redeploy. The parse error alone does not establish whether the
  cause is incomplete contents, wrong contents, line breaks or encryption. Once
  saved, inspect a fresh Main DAO snapshots run, verify the public signed price
  against the pinned public key and original observation/expiry, then refresh
  both providers before preparing owner activation. No separate Render service.
- Only after a valid public price and verified live config: prepare a separate
  owner-wallet unpause review and a real owner purchase. There is no dedicated
  mainnet tariff/unpause panel yet; do not substitute the deployment helper or a
  DAO proposal. Neither activation nor a mainnet purchase is recorded.

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
- Mainnet Names purchases remain paused and mainnet messaging remains disabled. Operations review finalization is
  not submission of a mainnet proposal. Native Juno submission/voting remains absent.
- Generated Treasury/member files belong to their collectors; never hand-edit them.
- This repository owns `dao.netareborn.com`; `neta-website` owns `netareborn.com`.
- Update current sections in place. Put release chronology in dated evidence or
  PR descriptions; do not prepend competing “next steps” to every document.

Previous chronological handoff: [archive](docs/archive/HANDOFF_BEFORE_CLEANUP_2026-10-04.md).
Cleanup scope and observed service/data status: [maintenance review](docs/MAINTENANCE_CHECKPOINT_2026-10-04.md).
