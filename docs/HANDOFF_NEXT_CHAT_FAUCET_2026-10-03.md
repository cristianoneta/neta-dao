# Next chat — Juno testnet faucet — 2026-10-03

## Owner's latest request / immediate goal

The chat became unstable. Owner asked: publish the bottom link and faucet page
so it can be reviewed now, then update the handoff and continue in a new chat.
Do not keep expanding the backend in this chat. Conversation is German; all
product/UI copy is English. The screenshot shows the very bottom of Home below
“OUR LONG-TERM VISION · BUILT ON JUNO · DESIGNED FOR COSMOS DAOS”. The footer link
must open the independent faucet page in a separate tab.

## Publication evidence

Feature PR: https://github.com/cristianoneta/neta-dao/pull/123
Feature head: `39537e09f43e930e73f8ffaefce9d2a2d7a52eb6`.
Merged to main as `5d047f630e742c5eac92aa07673b90e0a34a2cd6`.
Exact-head checks all passed before merge:
- Contract/frontend CI: run `37155888249`.
- UNI-7 faucet checks: run `37155888227`.
- RELAY browser crypto smoke: run `37155888188`.
Live verification is recorded at the end of this document.

Intended public URLs:
- https://dao.netareborn.com/index.html#home — bottom “Juno testnet faucet ↗” link.
- https://dao.netareborn.com/juno-faucet.html — separate English tool.

## What is implemented

- Footer after the main workspace, below the Home content, with `_blank` and
  `noopener noreferrer`. Shared `neta-ui.css` graphite/mint theme.
- Keplr suggests/connects `uni-7` (Juno Testnet); `ujunox`, six decimals. Mainnet
  is not supported. No wallet seed/private key belongs in frontend or Git.
- Live validator list (alphabetical), Active / All / My validators, search,
  commission and connected wallet stake; stake and unstake dialogs.
- Available, staked, unbonding and rewards balances; unbonding completion dates;
  reward withdrawal address is explicit. Claim rewards batches up to 20 validators.
- Exact integer micro-unit conversions; donations accept positive whole JUNOX;
  staking/unstaking allow six decimal places. Insufficient funds/stake fail before
  signing. Wallet changes invalidate old UI account state.
- Wallet writes use the SAME origin-wide journal prefix/Web Locks as DAO signing.
  Lost confirmation never silently creates a second signature. Do not clear
  pending transaction journals to unblock the UI.

## Crucial status: faucet payments are NOT active

`juno-faucet-config.mjs` has `{api:null,address:null}`. **Get 10 JUNOX and Donate
are disabled with visible explanations.** Do not describe payouts as live.
Validators, balances and wallet staking/reward actions are implemented separately.
No real payout, donation, stake, unstake or rewards transaction was signed in this
implementation session. Browser signing/chain tests use mocks.

A deployment-ready Node 24 / SQLite payout service lives under `faucet/service`:
- exactly `10000000 ujunox` (10 JUNOX) per wallet every rolling 24 hours;
- server pays gas, so recipients do not need an initial balance;
- ADR-36 wallet ownership proof, nonce/expiry/domain-bound challenge;
- SQLite transactional reservations, unique active signer slot, persistent signed
  bytes/hash before broadcast, exact-hash reconciliation after timeout/restart;
- interrupted signing and uncertain broadcasts remain locked for inspection;
- request limits, bounded bodies and exact UI-origin CORS; reverse proxy must add
  end-user abuse protection. One-wallet-per-day is not one-human-per-day.

**Missing operator inputs:** persistent backend hosting with HTTPS, a dedicated
UNI-7 wallet/key provisioned privately by the owner, and initial JUNOX funding.
No host/account was purchased or created; no secret was generated or requested
in chat. Do not reuse mainnet keys. GitHub Pages only serves files and cannot run
this service or safely hold a signer. A backend is a small continuously running
server/container, with durable storage for the limits and transaction history.
The owner asked what that means and whether we can do it; explanation was given.
Existing VPS/Docker hosting has not yet been confirmed. Next chat should help
choose/use hosting and provision it with the owner, then activate API/address/CSP
only after a real reviewed fresh-wallet payout and the 24h/restart checks.

Read `faucet/README.md` before deployment: environment variables, Dockerfile,
secret mounting, database backup/recovery, funding reserve, activation checklist.
The payout service intentionally has no admin withdrawal HTTP endpoint.

## Code and tooling

Repository: `cristianoneta/neta-dao` (DAO site). `neta-website` is a separate repo
for netareborn.com; do not edit it for this page.

- `juno-faucet.html`, `.css`, `.mjs`: standalone UI.
- `juno-faucet-core.mjs`: chain reads, pagination, exact amounts, message builders.
- `juno-faucet-config.mjs`: inactive service config; add its specific HTTPS origin
  to the HTML CSP when activation is actually ready.
- `faucet/src/signing.js`, `broadcast-journal.mjs`: bundled browser signing.
- `assets/faucet-signing.js`: generated from pinned `faucet/package-lock.json`.
- `faucet/service/{chain,ledger,server}.mjs`: payout backend.
- `.github/workflows/faucet-ci.yml`: reproducibility, audit, tests and browser flow.
- `faucet/test/*.test.mjs`, `tests/juno-faucet.test.mjs`,
  `spikes/relay-corecrypto/browser-faucet.mjs`: focused regressions.

CosmJS 0.38.1's encoding calls `fromBech32` with an Infinity limit. Newly resolved
`@scure/base@2.4.0` rejects that; `@cosmjs/encoding` transitive dependency is pinned
to `@scure/base@2.0.0` in overrides. Address decoding regression covers this.
Do not remove the pin without a verified compatible CosmJS upgrade. The shared
journal source is copied from neta-website with its blob provenance in its header.

## Verification performed

- 48 frontend Node tests passed.
- 8 payout ledger/signature/browser-journal tests passed.
- 29 Python DAO/member/treasury regressions passed.
- Existing workspace security browser test passed after the footer/style change.
- Faucet browser test passed: connection, sorted validators, wallet balances,
  staking messages, over-unstake rejection, rewards, stale-wallet rejection,
  mock daily payout status, whole donations, no overflow at 320/390/768/1440.
- Final 320 and 1440 screenshots inspected; amounts and wallet withdrawal
  addresses were adjusted to avoid narrow-screen overflow.
- `npm audit --prefix faucet --audit-level=high`: zero vulnerabilities.
- Read-only NodesHub and Stavr endpoints both returned `uni-7`, 22 validators,
  `ujunox` bond denom and `2419200s` (28 days) unbonding on 2026-10-03.
- These are read-only/automated checks, not real-wallet end-to-end evidence.

Useful local commands:

```sh
npm ci --prefix faucet --ignore-scripts
npm run build --prefix faucet
npm test --prefix faucet
node --test tests/*.test.mjs
npm ci --prefix spikes/relay-corecrypto
CHROMIUM_PATH=/tmp/chromium node spikes/relay-corecrypto/browser-faucet.mjs
```

Worktree used in this chat: `/workspace/scratch/e4c6a6dfca53/neta-faucet`.
Original repo: `/workspace/scratch/dc97368bd6c9/neta-dao`; it has an existing dirty
`data/daos/neta.json` from an older collector. That file was preserved untouched;
this feature used an isolated worktree. Preserve Treasury/membership bot commits.
Fetch current main before continuing. Git fetch works, local git push has no
credentials; use the GitHub connector Git Data/PR tools if this remains true.
Do not claim a local commit or prepared patch is a live release.

## Other continuity (do not regress)

People → Members / Contributors is already shared across all DAOs (PR #121);
Contributors stays planned, with no invented active-member records. Members shows
real voting participation; future .neta resolution must only replace addresses
when verified. DAO picker is alphabetical. Follow `AGENTS.md`, `HANDOFF.md`,
`docs/CURRENT_STATE.md`, `docs/DESIGN_SYSTEM.md` and the prior People/DAO records.
Main DAO transaction history remains unavailable from tested public indexes;
that does not mean no transactions existed. No mainnet RELAY sending is enabled.
Earlier Juno Delegation Programme labeling/community treasury research was not
implemented as part of the faucet. Keep that separate from this feature.

## Final live release check

PR #123 is merged; Pages deployment run `37156018654` completed successfully for
main commit `5d047f630e742c5eac92aa07673b90e0a34a2cd6`. Public HTTP retrieval
verified exact byte equality for `index.html`, the faucet HTML/CSS/controller/
core/config, `neta-ui.css` and the signing bundle. The published index contains
the bottom footer link to `juno-faucet.html` with `_blank` and both rel safeguards.
An initial index read raced deployment and returned the older page; a subsequent
cache-busted read matched exactly and confirmed the actual footer markup.

The owner was given the direct public faucet URL. The backend is still unhosted
and unfunded; the UI reflects that. This handoff, not an unseen previous chat,
is the starting point for the next continuation.

## Footer consistency follow-up — 2026-10-04

Owner selected the Proposals footer as the reference across all routes. The
shared footer now uses the same responsive width as main, explicit link styling
and a page shell that places it at the bottom on short pages. Its existing
new-tab behavior and disabled payout service configuration are unchanged.
No new hosting account or wallet was provisioned. Owner confirms no running
server; managed Node/container hosting with durable disk is the minimal-change
option. A serverless Worker/Durable Object alternative requires a storage and
runtime adaptation, followed by transaction/restart checks.

Local browser review covers 11 routes at 320/390/768/1440 px against Proposals,
plus keyboard focus and 200% reflow. Record final CI/deployment evidence after
integration. The separate website overnight data incident is tracked in
cristianoneta/neta-website PR #142.
