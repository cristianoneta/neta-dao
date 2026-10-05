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

## Next task

The next NNS gate needs a **consenting operator who controls both a Juno mainnet
and UNI-7 validator**. The user does not run a validator; no operator has been
contacted. Do not send outreach without the owner's instruction.

Use the existing manifest and lab. The operator signs in their own Keplr;
publication needs the current name owner. For an independent operator test, use
an active test name they control; the current UI keeps unpublished proofs in one
tab and is not a remote signature-exchange tool. Never share wallets or keys.
Verify link, both bindings, owner unlink and unilateral revocation with exact
receipts and post-state. A stored link proves operator-key control only; validator
existence and active UNI-7 consensus membership need separate snapshot evidence.

Until an operator is available, retain this as an explicit external dependency.
Do not enable mainnet or describe synthetic tests as live validator completion.
The agreed delegation programme and deferred Smart Delegation research are in
[NNS_VALIDATOR_PROFILES](docs/NNS_VALIDATOR_PROFILES_2026-10-04.md) and
[SMART_DELEGATION_RESEARCH](docs/SMART_DELEGATION_RESEARCH.md); do not change their
criteria while cleaning documentation. Other open work is in [PROJECT_CHECKPOINT](PROJECT_CHECKPOINT.md).

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
