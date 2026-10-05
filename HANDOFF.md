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

Owner update on 2026-10-05: **pause live validator tests until later**. The next
immediate wallet step is the NNS tariff update, if not yet confirmed on-chain.
Approved annual registration AND renewal: 3 characters USD 99, 4 characters USD 19,
5–32 characters USD 5, paid in NETA. Mainnet pricing remains unlaunched; UNI-7 uses
mock NETA. Main UI/calculator/default quote arithmetic are updated. The existing
registry requires its admin to review and sign `set_tariff` in the lab's Annual
pricing section. Check current config/version before claiming activation; no
admin receipt has been recorded for this change yet. Use the original manifest
and admin `juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt`. Do not redeploy.

The normal `.neta name` and `My profile` pages now expose the existing UNI-7
registration, renewal, transfer and public contacts through the shared header
wallet. Choose Read test registry, connect Keplr, then Load my name. This reuses
the existing deployment, test quote key and journals; do not set up another one.
Browser tests are synthetic; the integrated owner-wallet journey is the next UX
check after the tariff update. Test purchases still require the original setup
browser's local quote key. The owner selected WYND, confirmed 99/19/5 and requested
moving toward mainnet on 2026-10-05. A WYND quote service and separate Render
Blueprint are implemented in `names/` but not hosted yet. They use a 30-minute
WYND JUNO/NETA cumulative average, timestamped CoinGecko JUNO/USD, two providers
agreeing at one height, persistent server-only Ed25519 custody and usage limits.
Next: create the **separate** Render service using `names/render.yaml` in observe
mode, retain its disk, record the public key and verify live averaging/restart.
See [quote service runbook](names/README.md) for the proposed limits and launch steps.
Then prepare reviewed mainnet uploads/instantiations and the DAO tariff proposal.
Mainnet admin and treasury are the main NETA DAO, not the UNI-7 personal admin.
`names/mainnet-plan.mjs` generates unsigned deployment material and a version-bound
tariff message; it does not broadcast or bundle purchase activation. Mainnet
frontend/wallet integration, actual deployment receipts and separate DAO unpause
remain open. The new server is not a live mainnet launch.
See [main-page integration](docs/NAMES_MAIN_PAGE_INTEGRATION.md).

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
