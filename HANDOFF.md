# NETA DAO handoff

Updated: **2026-10-05 (Europe/Berlin)**. This is the continuation entry point, not an append-only session log.

## Start here

1. Read `AGENTS.md`, this file and [CURRENT_STATE](docs/CURRENT_STATE.md).
2. Fetch current `main`, open PRs and relevant Actions; preserve later bot commits.
3. For NNS, read [the detailed next-chat handoff](docs/HANDOFF_NEXT_CHAT_NNS_2026-10-04.md).
   For UI work also read [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md).
4. Use [the documentation index](docs/README.md) to find the owning runbook.
   Dated evidence and archives do not override the current state.

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

Owner's latest direction on 2026-10-05: use **WYND JUNO/NETA** for NNS pricing,
annual USD **99 / 19 / 5** for 3 / 4 / 5–32 characters, then move toward mainnet.
Live validator tests stay deferred. The price service is merged in PR #153
(`837fa7942bec3e849a85fbb9863afbbbddb95395`); it is **not hosted or activated**.

**First action in the next chat:** help the owner create the separate Render
Blueprint for `cristianoneta/neta-dao`, branch `main`, path **`names/render.yaml`**.
Keep the faucet service and its disk intact. Start in observe mode, retain the new
persistent disk, then verify its public `/status`, quote public key, uninterrupted
30-minute average and restart behavior. See [service runbook](names/README.md) and
[release evidence](docs/NNS_WYND_RELEASE_2026-10-05.md). No service URL is known yet.

The service uses a 30-minute WYND cumulative average, timestamped CoinGecko
JUNO/USD, two providers agreeing at one height, server-only Ed25519 custody,
persisted limits and fail-closed checks. Operational thresholds are an initial
proposal to review against live observations before enabling paid issuance.
Observed pool liquidity was about USD 1,838 on 2026-10-05; averaging does not
eliminate manipulation risk in a thin market. Never use Treasury JSON as the feed.

Next dependencies: obtain the production public key, prepare and owner-sign the
mainnet registry/profile deployment, record and verify its manifest/receipts,
then execute the approved tariff through the **main NETA DAO**. The DAO is both
registry admin and treasury; the uploader's personal wallet is not the mainnet
admin. `names/mainnet-plan.mjs` prepares unsigned deployment material and an exact
version-bound tariff message. It does not broadcast or bundle purchase activation.
Mainnet frontend/wallet/quote integration still needs implementation and review;
the existing adapters are UNI-7-only. Activate purchases through a separate DAO
proposal only after those dependencies, then verify an owner-signed mainnet purchase.
No mainnet registry/profile address or wallet/DAO receipt has been recorded.

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
