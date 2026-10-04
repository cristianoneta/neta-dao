# NETA DAO handoff

## NNS validator profiles — 2026-10-04 source slice

Read [the profile checkpoint](docs/NNS_VALIDATOR_PROFILES_2026-10-04.md). The owner
paused Delegation Programme planning to add optional public contacts (Discord,
Telegram, X, email, homepage) and proof-backed mainnet/testnet operator links.
A purchased active `.neta` name is required **only for testnet bonus points**,
not general participation. Active testnet membership earns the bonus without an
additional uptime requirement. The checkpoint preserves the programme decisions.

Implemented: integrated unpublished profile preview, strict field/address rules,
ADR-36 proof collector and a separate v2-bound profile contract with two operator
signatures, exclusive bindings, identity lifecycle invalidation and revocation.
No profile deployment or live wallet flow is claimed. `PROFILE_DEPLOYMENT=null`.
The accepted NNS v2 registry/quote service remains missing: legacy v1 cannot
substitute for it. Public profile publishing and purchases stay disabled until
registry, deployment identities and journaled transaction integration are ready.
The user does not run a validator: synthetic wallets suffice for development;
one consenting mainnet/UNI-7 operator is needed for final live E2E. No outreach
was sent. Next implement v2 identity/registration, then wire UNI-7 profile writes.


## Faucet platform banner — 2026-10-04

Owner-approved header promotion uses the existing voxel assembly plaza, the
label **dao.netareborn.com**, and “Create · Discover · Govern DAOs”. The label
promotes the platform for multiple DAOs, not NETA DAO alone. The whole tile
opens https://dao.netareborn.com/ in a new tab with noopener/noreferrer.
Desktop places it between Community tools and the UNI-7/wallet controls;
narrow layouts give it its own row. CSS uses shared theme tokens and the
existing decorative asset. Payout, wallet and transaction logic is unchanged.
Release evidence is tracked in the associated PR and Pages workflow. The
owner-signed payout and restart/cooldown verification below remain pending.

## Payout integration for first real test — 2026-10-04, 13:58 Berlin

The owner completed the Render manual deployment. Fresh `/status` now reports
UNI-7, expected dedicated address, balance 15000000, ready true,
`protection:usage-guards-v1`, `confirmation:uni7-exact-hash-v1`, and
`gasPolicy:bank-send-gas-v1`. Cross-origin POST preflight from
`https://dao.netareborn.com` returns 204 with the expected origin/method/header.
The previously verified donation was 15 JUNOX (receipt recorded below).

The page now pins `https://neta-junox-faucet.onrender.com` in its config and CSP.
Get 10 JUNOX is available after Connect only while validated service status says
ready and this wallet has no pending payout/cooldown. The frontend requires all
three deployed protection/confirmation/gas-policy markers; an old or mismatched
backend disables payouts. Donation availability remains independent. GET status
requests no longer add an unnecessary JSON content-type/preflight.

This enables the first owner-driven payout test, not a claim that payout E2E is
complete. Next: click Get 10 JUNOX and confirm the ADR-36 ownership signature in
Keplr. Verify the resulting transfer hash and exactly 10 JUNOX, repeated-request
rejection, then the persisted 24h cooldown after an owner-triggered Render restart.
An empty fresh recipient-wallet test and real unstake still need evidence.
With 15 JUNOX, one payout plus fee leaves less than the 12-JUNOX ready reserve;
additional payouts require replenishment. Never clear SQLite/WAL or pending
browser/backend journals. Hosting protections are still not a dollar invoice cap.


## Donation gas correction — 2026-10-04

The owner attempted a 10-JUNOX donation through the page. Exact signed bytes and
UNI-7 receipt were verified for
`E4E0C8918FA87CDAFBF2ADDB7E010B9E5F39524CA92ABB3ED9628BE9260331D7`,
height 18526822, SDK code 11: out of gas at WritePerByte. Gas limit 136997,
consumed 137382 at failure; fee 27400 ujunox (0.0274 JUNOX). The 10 JUNOX were
not transferred. This is a confirmed failure, not an ambiguous broadcast.

Browser donations and server payouts now share a bank-send fee policy: simulate,
require a positive safe estimate <=500000, then use max(250000, ceil(estimate*1.8))
gas at 0.2 ujunox/gas. At the floor the fee is 0.05 JUNOX. This adds headroom for
bank writes/new recipients; it is not a proof of a successful new donation.
Staking/reward gas calculation and shared journal semantics are unchanged. No
automatic retry occurs. Confirmed bank-send code 11 has a readable explanation;
long hashes wrap inside the dialog. Browser assets are versioned/rebuilt.
Backend `/status` adds `gasPolicy:bank-send-gas-v1`; this requires a manual Render
deploy before payout activation. Public payouts remain off; donations remain on.
The next step is one fresh owner-confirmed donation after Pages publication,
then verify its exact hash, amount and receipt. Do not clear browser storage.


## Donations before payout activation — 2026-10-04

The owner requested funding through the existing Donate JUNOX control. Donation
availability is now independent of the payout API: the public config pins
`juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt` while `api` remains null.
After Connect Keplr, a positive whole-number donation opens the transaction review
and uses the existing UNI-7 signing/confirmation journal. The exact recipient is
shown before signing; wallet/network, balance/fee room and pinned target are
rechecked. The faucet account cannot donate to itself. No Render deployment is
needed for this frontend change. Get 10 JUNOX remains disabled after funding.
This supersedes older snapshots saying both public values are null and donations
are unavailable. Payout deployment/activation gates remain in force. No real
owner-signed donation or payout is claimed by the mocked browser checks.


## Backend confirmation correction — 2026-10-04 continuation

The server now submits signed bytes once with `broadcastTxSync` and confirms
through indexed STAVR and the configured HTTPS RPC concurrently. Fresh UNI-7 identity,
exact hash, signed-byte SHA-256, height and execution code are checked. Unknown
outcomes stay pending; no automatic retry or journal deletion. Lookups are bounded
and concurrent checks of one hash share work. `/status` identifies this adapter as
`confirmation:uni7-exact-hash-v1`, separately from `protection:usage-guards-v1`.
Local verification: 30 service tests and 5 frontend tests passed; the signing
bundle rebuild is unchanged. New tests cover wrong-chain/tampered receipts,
index outages, one-shot broadcast, persistent pending outcomes, cooldown after
restart and included failures. A read-only live call of the new backend lookup
confirmed the owner's reward hash `72AA75539747AE522BBBEF06F6149F08252112CA15948E07F9BAE8F5FC2A8387`
at UNI-7 height 18525930, code 0. Real payout/stake/unstake E2E remains pending.

Render auto-deploy is off: merge/Pages alone does not deploy the backend fix.
Use the existing service's Manual Deploy, retain SQLite/WAL and private settings,
then verify the confirmation marker. Latest read-only status before deployment:
UNI-7, dedicated address unchanged, balance 0, ready false, usage guards present.
Public API/address stay null pending deployment, funding and activation tests.
See `faucet/RENDER.md` and the current faucet handoff for the next operator steps.


## Current continuation — 2026-10-04 final checkpoint

Read [the current faucet handoff](docs/HANDOFF_NEXT_CHAT_FAUCET_2026-10-04.md) first.
PR #129 (HTTP 501) and #130 (Disconnect/address and exact-hash rewards recovery)
are merged and live. All relevant PR/main checks and Pages succeeded; six live
files matched source. The owner’s real reward claim succeeded (code 0).
Frontend recovery does not fix the Render adapter's configured RPC: verify an
indexed backend RPC before funding/payout activation. Public payouts remain off.
This checkpoint supersedes earlier incomplete-release snapshots below.


## Wallet controls and rewards confirmation — 2026-10-04

The shared workspace header and separate faucet now provide a shortened connected
address (full address in title/accessible label) and explicit Disconnect. Local
signing clients/access are cleared; drafts, keys and transaction journals remain.
Disconnect is disabled during a transaction; late connection/access responses
cannot restore a disconnected account. All workspace routes share the header.
Read-only DAO connection restrictions and inactive feature gates are unchanged.

PR #129 fixed the faucet delegation route; production core was compared with the
corrected source. The owner then signed a real reward withdrawal, confirmed on
UNI-7 at height 18525930, code 0, hash
`72AA75539747AE522BBBEF06F6149F08252112CA15948E07F9BAE8F5FC2A8387`.
Rewards were 173.075836 JUNOX; fee 0.037690 JUNOX. NodesHub accepted the transaction
but has transaction indexing disabled, causing the frontend's retry lock.

`juno-faucet-transactions.mjs` reads exact-hash transactions through the allowlisted
RPCs, verifies UNI-7 identity and the SHA-256 of returned signed bytes. Signing
confirmation polling uses this lookup. Connect/Refresh can reconcile a pending
journal under the existing origin-wide lock; only exact included transactions
clear it, and no repeat signature/broadcast is performed. Unknown, tampered or
interrupted-signature records stay locked. Tests cover recovery and preserved
journals, disconnect/reconnect on all eleven routes, and 320–1440 px layouts.
Release status is recorded by the associated PR/CI/Pages run. No operator-side
wallet signing was performed. Faucet payouts/donations remain disabled and the
faucet account still needs funding. Real stake/unstake/payout E2E remains pending.


## Wallet-data correction — 2026-10-04

The owner reproduced HTTP 501 after connecting Keplr. The faucet reader used
`/cosmos/staking/v1beta1/delegators/{address}/delegations`, which is not the
SDK route. Live NodesHub requests returned 501 for that path and 200 for
`/cosmos/staking/v1beta1/delegations/{address}`. This change corrects the route,
versions the frontend modules and makes wallet fixtures reject the invalid path.
The withdrawal/unbonding routes still correctly use `delegators/{address}`.
Deployment evidence is the associated PR/Pages run; real signed wallet E2E
remains unverified. No payout/donation activation or transaction journal change.

Live Render status rechecked at 10:27 Berlin: `protection:usage-guards-v1`,
`balance:0`, `ready:false`. The guard update is deployed, superseding the older
manual-deployment gate below. Wallet funding and payout/replay/restart checks
remain pending. Quotas are not a dollar billing cap.


## Live backend / usage-guard continuation — 2026-10-04

This section supersedes older hosting-pending snapshots below. The owner created
Render hosting, corrected a recovery-phrase typo privately, and provided
`https://neta-junox-faucet.onrender.com`. Read-only `/status` verified `uni-7`,
`juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt`, balance `0`, `ready:false`.
No live signed payout, funding or browser transaction was performed.

The owner accepted keeping Render with additional abuse/usage guards. The update
adds persistent aggregate quotas: 60 HTTP requests/minute, 5,000/day, 50,000/month;
100 payout reservations/day, 1,000/month, plus the existing 10 JUNOX/rolling 24h
per wallet. Day/month boundaries are UTC; failed payout reservations count too.
Status RPC reads and failures are coalesced/cached for 30s; HTTP concurrency is 4.
Invalid mnemonic errors no longer echo input words or the BIP-39 dictionary.
See `faucet/README.md` and `faucet/RENDER.md` for configuration and limitations.

**Deployment gate:** manually deploy this update on Render and verify
`protection:usage-guards-v1`. Quota exhaustion pauses API work/payouts, not Render
billing. A hard USD 10 invoice ceiling and automatic provider suspension are NOT
implemented. Configure Render's additional build-spend limit to USD 0 separately.
Public API/address config remains null. Next: fund the dedicated account privately,
verify the guard version, then real-wallet payout/replay/restart checks before
public activation. Preserve SQLite, WAL and pending transaction journals.


## Faucet hosting continuation — 2026-10-04

The owner has no running server and wants to finish the faucet. The root
`render.yaml` and [Render setup guide](faucet/RENDER.md) prepare managed Node 24
hosting with persistent SQLite and a private secret file. No service, paid
hosting or wallet was provisioned. Next operator inputs are the assigned HTTPS
API URL and the funded, dedicated UNI-7 public address; the mnemonic stays out
of chat/Git. Only then pin the frontend API/CSP and run real-wallet/restart checks.
The shared footer consistency change is already live (PR #125).

## Latest continuation — faucet, 2026-10-03

Read [the next-chat faucet handoff](docs/HANDOFF_NEXT_CHAT_FAUCET_2026-10-03.md) first.
PR #123 adds the separate English faucet page and bottom footer link. The owner
asks to review this page now and continue in a new chat. Payout/donation backend
activation remains pending hosting and a privately provisioned, funded UNI-7
account. Do not claim actual payouts or real signed wallet E2E are verified.

## People update — 2026-10-03

Read [People / Members / Contributors](docs/PEOPLE_MEMBERS_CONTRIBUTORS_2026-10-03.md).
The owner approved one shared People navigation for every DAO. Members is backed
by verified governance data; Contributors stays planned pending a later product
decision. Do not resurrect sample contributor profiles as live assignments.


## Main DAO continuation — 2026-10-03

Read [the integration record](docs/DAO_ONBOARDING_2026-10-03.md) for current release
status and source limitations. The [original handoff](docs/HANDOFF_NEXT_CHAT_2026-10-03.md)
is a historical WIP snapshot; its code defects have been addressed in PR #118.
[DAO onboarding checklist](docs/DAO_ONBOARDING_CHECKLIST.md) and the GitHub issue
template define the repeatable process. Main DAO events need a verified historical
index; directory labels still need the planned NNS v2 registry and DAO adapters.
Check the integration record's release evidence before assuming this branch is live.

## Latest maintenance checkpoint — 2026-10-03

Read [the maintenance checkpoint](docs/MAINTENANCE_CHECKPOINT_2026-10-03.md)
first for current UI scope, refreshed data, CI changes and remaining work.
Older dated sections below retain their historical evidence.


Baseline review: **2026-10-02**; security integration rechecked **2026-10-03**. Canonical repository:
`cristianoneta/neta-dao`; site: <https://dao.netareborn.com>.

## Read in this order

1. [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md): exact connected features,
   source files, recorded deployments and limitations.
2. [README.md](README.md): verification commands and project boundary.
3. The relevant specialized document below; then its owning code and tests.
4. [PROJECT_CHECKPOINT.md](PROJECT_CHECKPOINT.md): current continuation priorities.

| Task | Read next | Owning implementation |
| --- | --- | --- |
| UI / new pages | [Design system](docs/DESIGN_SYSTEM.md) | Approved graphite/mint direction and assembly-plaza hero; shared theme/Home rollout; applies across every DAO page |
| Proposals / permissions | [REVIEW_ARCHITECTURE.md](REVIEW_ARCHITECTURE.md) | `neta-governance.js`; Juno v0.3.0 in `contracts/neta-proposal-workshop/`; legacy Operations source in the other repo |
| Treasury | CURRENT_STATE Treasury section | `treasury.js`, `scripts/update_treasury.py`, `scripts/update_treasury_events.py` |
| RELAY notifications / routing | CURRENT_STATE RELAY section | `relay.js`, `ux-draft.js`, `index.html`, `relay.css` |
| Encrypted messaging | [Implementation plan](docs/RELAY_IMPLEMENTATION_PLAN.md), [live test runbook](docs/RELAY_UNI7_E2E_RUNBOOK.md) | `relay-uni7-lab.mjs`, `relay-uni7-client.mjs`, `relay-uni7-archive.mjs`, `spikes/relay-corecrypto/` |
| Recovery | [Recovery decision](docs/RELAY_RECOVERY_DECISION.md) | Product direction only; no automatic backup service |
| Names | [Accepted v2 plan](docs/NETA_NAMES_V2_PLAN.md), [implementation boundary](docs/NETA_NAMES_DESIGN.md) | `names-workspace.js`; inactive legacy `names.js` and `contracts/neta-names/src/lib.rs` |
| UNI-7 deployment failure | [UNI7_DEPLOYMENT_RUNBOOK.md](UNI7_DEPLOYMENT_RUNBOOK.md) | Contract identity, checksum and state-based recovery |

## Evening checkpoint — 2026-10-03

- Owner wants page-by-page publication. Shared graphite/mint theme and assembly
  plaza shipped in #108; #109 mobile heading/selector corrections are live and
  inspected. Design rules remain canonical in `docs/DESIGN_SYSTEM.md`.
- Treasury #110 restores five verified, chain-scoped Osmosis price identities;
  missing-price coverage no longer becomes a false history outflow. Read
  `docs/TREASURY_VALUATION_FIX_2026-10-03.md` for incident, tests and live evidence.
  Both PR checks, bot run 940 and Pages run 1043 succeeded; the 12:47 Berlin
  snapshot showed USD 4,040.81 across nine holdings (one unpriced factory token).
- Home was inspected at desktop and 320/768 px frames. Proposals list/filter and
  existing-proposal selection worked on desktop; its narrow page had no document
  overflow. Full per-page interaction/accessibility checks are still outstanding.
- Historical UI review queue: Proposals detail/dialog/keyboard states and other
  module accessibility checks remain incomplete. Current product priority is the
  small functional Names slice described below.
- Mainnet messaging remains disabled. No real keys or live attack transactions
  were used. Preserve bot updates and pending crypto/transaction journals.
- Fetch fresh GitHub main/open PRs and workflow state before continuing; recorded
  totals and deployment hashes are timestamped evidence.

## Next concrete task

The owner wants small functional Names slices next. Keep the integrated RELAY
navigation and shared masthead; there is no separate preview mode. Read the
[accepted v2 plan](docs/NETA_NAMES_V2_PLAN.md), then implement/test normalization,
tariff and term/expiry rules plus the quote interface using synthetic fixtures.
The JUNO/NETA pool remains the chosen price reference. Do not deploy the legacy
v1 contract as the accepted v2 product or enable registry writes before its gates.

Desktop introductions reuse existing Home voxel artwork; mobile hides decoration.
Remaining per-page keyboard/dialog/accessibility review is still useful, but is
not a replacement for the owner's selected functional Names work. Mainnet messaging
remains disabled; preserve transaction and crypto journals.

## Rules for accurate continuation

- `index.html` is the main application; `relay-uni7-lab.html` is a separate test.
- Native Juno submission/voting is disabled. Operations mainnet voting has an
  existing UI path. Operations review `voting` is not a mainnet proposal.
- Operations legacy and Juno v0.3.0 are different APIs and permission models.
  Never apply v0.3.0 hardening claims to the legacy instance.
- Inbox polls mainnet proposals only; review-revision notifications are not connected.
  Directory owns follow controls; Inbox has no watchlist sidebar. RELAY directly
  exposes Inbox, Directory, Contacts, My profile and .neta name; no nested Names tabs.
- Names is under RELAY; `REGISTRY=null`. Mainnet Names signing code is prepared,
  not active. A requested UNI-7 Names test still needs explicit testnet wiring.
- Delivery/Contributors and Treasury forecasts/commitments/runway are concepts.
- Read timestamp and source for every data claim. A successful snapshot or Pages
  run does not prove a live crypto flow, full accounting or current contract state.
- Never request seeds/private keys. Wallet writes use explicit Keplr confirmation.
- Preserve snapshots and unrelated work. Use branches/PRs; no destructive reset,
  force push or silent transaction retry after an uncertain broadcast.
- Update static asset query versions in `index.html` for JS/CSS changes.
- CI is path-filtered. Inspect `.github/workflows/` for the checks actually triggered.
  This repo has no general docs CI and no root npm package. Contract Markdown
  and the RELAY security document still match existing CI path filters.

## Remaining work

Use [PROJECT_CHECKPOINT.md](PROJECT_CHECKPOINT.md) for the ordered release gates.
Outstanding areas include safe off-device restore, sender-generation history,
prekey consent/refill, legacy pending-state reconciliation, symbol-based Treasury
attribution, unknown-token decimals, incomplete historical queries and missing
RELAY review-revision notifications. The original receive-lock and ID-collision
defects have local fixes; do not confuse those with completed remote recovery.

## Current security checkpoint — 2026-10-03

DAO #100–#103 and Website #137/#138 are merged after their relevant final CI
checks passed. Documentation PRs DAO #104 and Website #139 are also merged.
The resumed verification confirmed the exact PR-head checks and compared 23
production files with GitHub, including both shared signing bundles and the
published Treasury event ledger. See [the evidence](docs/SECURITY_CONTINUATION_2026-10-03.md).

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




### Juno testnet faucet continuation — 2026-10-03

New independent English `juno-faucet.html`, footer link opens a separate tab.
Current UNI-7 validators, stake, commission, unstaking and rewards share the
NETA theme. Source/build/test instructions and deployment gates: `faucet/README.md`.
The payout backend is prepared with persistent 10 JUNOX / rolling 24h limits,
ADR-36 authentication and durable transaction reconciliation, but **is not hosted
or funded**. API/address remain null; payout/donation controls explain this.
Operator needs to provision a dedicated testnet key privately and provide backend
hosting. Never substitute a browser-only daily limit or silently activate a
third-party faucet. No real signed staking/payout transaction was performed.
