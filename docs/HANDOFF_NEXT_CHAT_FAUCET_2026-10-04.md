# Next chat — finish the UNI-7 faucet — 2026-10-04

Current session priority moved to [NNS UNI-7 testing](HANDOFF_NEXT_CHAT_NNS_2026-10-04.md).
The faucet evidence and remaining gates below are retained; do not mistake this
older faucet continuation for the latest NNS test checkpoint.

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


## Verified donation — 2026-10-04, 13:55 Berlin

The owner supplied transaction
`9019CA5CE99FD3B9D31186083EB77856EA034B9A0BF5D7A4C0DAF5BC8658E2DF`.
Fresh STAVR exact-hash lookup verified SHA-256 of signed bytes, UNI-7 receipt
height 18530558, code 0. Transfer events show **15 JUNOX**, not 10, from
`juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57` to the dedicated faucet address
`juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt`. Fee 0.05 JUNOX; gas limit 250000,
gas used 144384. This confirms the actual donation flow after the gas correction.

Fresh Render `/status`: balance 15000000, ready true, usage-guards-v1 and
confirmation:uni7-exact-hash-v1. **gasPolicy is absent**, so the newest shared
bank-send gas correction is not yet deployed to Render. Do not treat ready:true
as evidence that the payout gas fix or a real payout has been verified.
Next: owner manually deploys latest main to the existing Render service; verify
`gasPolicy:bank-send-gas-v1` without replacing the SQLite/WAL/secret file. Then
pin the public API/CSP for the controlled payout test, verify a 10-JUNOX receipt,
repeat-request rejection and persistent cooldown after restart. Current 15 JUNOX
supports one test payout plus fee, then falls below the 12-JUNOX readiness reserve.
Public payout API remains disabled. No new payout/unstake evidence is claimed.

Gas release PR #135 merged as c1adfd298a8caa6c666165cc28e45b6cfa0c7c88.
PR checks 37191934429 / 37191934465 / 37191934433 passed. Main checks
37192015046 / 37192015066 and Pages 37192014821 passed; live HTML, CSS and
signing bundle matched source. Donation release #134 was also verified live.

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


This is the current continuation entry point. It supersedes older hosting-pending
and untested-rewards snapshots in the 2026-10-03 handoff.

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

## Release evidence — backend confirmation, 2026-10-04

PR #132 merged as `8ef4686d4228faf10aad214eec66d9d8e3e696fb` after faucet
CI `37190800126` passed on exact PR head `5120aa7b2b378c742245b4b0faf9c66b97cf857c`.
Main faucet CI `37190869479` and Pages `37190868955` both succeeded.
The read-only live lookup confirmed the previous reward hash at height 18525930,
code 0. The public config was freshly read and remains `api:null,address:null`.
Render status was freshly read: balance 0, ready false, usage-guards-v1, and no
confirmation marker yet. **Render has not deployed this correction.**

Immediate operator actions: existing Render service → Manual Deploy → Deploy
latest commit, then verify `confirmation:uni7-exact-hash-v1`; fund the dedicated
wallet with an owner-confirmed UNI-7 transfer (suggested 100 JUNOX). Retain the
existing disk/SQLite/WAL and secret file. Once both are verified, continue the
public integration and real-wallet/replay/restart checks below. No new payout,
donation, stake or unstake was signed during this continuation.

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

## Release evidence — checked 2026-10-04, approximately 10:48 Berlin

PR #129 merged as 342153f2c312abe1528a02422c1812fa3904da96; Pages run
37189385303 succeeded. PR #130 merged as
9006308e26757693d898652256b31fa36a59bfc5 after all three exact-head checks passed:
Contract/frontend 37189885556, faucet 37189885577, browser 37189885544.
Main checks 37190008451 and 37190008446 succeeded; Pages 37190008175 succeeded.
Six live files matched the new source byte-for-byte: index.html,
juno-faucet.html, juno-faucet.mjs, juno-faucet-transactions.mjs,
neta-governance.js, neta-ui.css. UI controls and recovery are now published.
Live /status still reports usage-guards-v1, balance 0, ready false.
The user's local pending journal cannot be inspected remotely; after a hard
refresh, Connect/Refresh should verify and recover it without another transaction.

## Owner's goal
Finish https://dao.netareborn.com/juno-faucet.html as an independent community
service: Keplr, 10 JUNOX per wallet per rolling 24 hours, whole-number donations,
validators, stake/unstake and rewards. The page keeps the DAO theme and opens from
the consistent bottom link on every workspace route. No local server is needed.

## Delivered and verified
- PR #125: uniform bottom faucet link across all workspace routes.
- PR #127: Render hosting configuration and private setup guide.
- PR #128: durable usage guards. Render /status now reports
  protection:usage-guards-v1, chainId:uni-7, balance:0, ready:false.
- PR #129: fixed HTTP 501 after Keplr connection. Correct stake route is
  /cosmos/staking/v1beta1/delegations/{address}; unbonding/distribution still use
  their separate delegators/{address} routes. Live old route 501, corrected 200;
  corrected production module compared with source.
- PR #130: shortened wallet address + explicit Disconnect in shared DAO header
  (all eleven workspace routes) and independent faucet. Full address in title and
  accessible label; faucet also displays it in the wallet section. Clears local
  connection/access but preserves drafts, keys and transaction journals. Late
  access replies cannot reconnect a disconnected wallet. Responsive 320–1440 px
  browser checks passed. Existing read-only DAO connection restriction remains.
- PR #130 also fixes reward confirmation/recovery. NodesHub accepts transactions
  but returns "transaction indexing is disabled". STAVR confirmed the user's claim.
  juno-faucet-transactions.mjs queries allowlisted UNI-7 RPCs by exact hash,
  checks chain identity and SHA-256 of returned signed bytes. Signing confirmation
  polling uses this lookup. Connect/Refresh can clear only a confirmed exact
  pending journal under its existing account lock. No signing/rebroadcast during
  recovery; unknown/tampered/interrupted-signature records remain locked.
- The user signed a real reward claim:
  hash 72AA75539747AE522BBBEF06F6149F08252112CA15948E07F9BAE8F5FC2A8387
  UNI-7 height 18525930, code 0; rewards 173.075836 JUNOX; fee 0.037690 JUNOX.
  Recipient juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57.
  Independently confirmed through STAVR, including new lookup signed-byte hash.
  This proves this reward claim succeeded; it does not prove stake/unstake or payout.

## Live service / activation boundary
Backend: https://neta-junox-faucet.onrender.com
Status: https://neta-junox-faucet.onrender.com/status
Dedicated faucet address: juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt
Public juno-faucet-config.mjs pins the dedicated address but keeps api:null.
Donations are enabled independently; payouts remain disabled. Last checked
balance was 0 JUNOX; recheck after the owner donates.

The recovery phrase was provisioned privately by the owner as Render secret file
/etc/secrets/faucet-mnemonic. Never request/read/print it. Earlier invalid seed
error handling was sanitized in PR #128. Persistent SQLite: /var/data/faucet.sqlite.
Keep SQLite/WAL and pending transaction/crypto journals across every deploy/restart.

## Immediate next steps (in order)
1. Verify fresh GitHub main, CI, Pages and live /status. Do not infer current state
   from historical snapshots.
2. Deploy/verify the BACKEND confirmation correction before activation. The
   new adapter checks indexed STAVR and the configured HTTPS RPC concurrently; no
   environment change is required. It uses one-shot broadcast and verifies exact
   signed-byte hashes on fresh UNI-7 receipts. Regression tests include durable
   restart/cooldown recovery. See the continuation section above for release state.
   Have the owner manually deploy latest main to the existing Render service and
   verify `/status` includes `confirmation:uni7-exact-hash-v1`. Keep the existing
   SQLite/WAL and private settings. Never clear locks or rebroadcast unknown payments.
3. Fund the dedicated faucet wallet with JUNOX via an ordinary owner-confirmed
   Keplr transfer (100 JUNOX is a useful start). The user's wallet received rewards.
   Funding through Donate JUNOX is now enabled after Connect Keplr. No mainnet tokens.
4. Prepare/test public integration: pin Render origin in juno-faucet.html CSP and
   juno-faucet-config.mjs API/address. Follow faucet/README.md activation gate;
   perform real fresh-wallet payout, chain receipt, repeated request and
   restart/persistent cooldown checks before making public payout claims.
   Existing limit is exactly 10 JUNOX per rolling 24 hours per wallet.
5. Verify the funding donation receipt, then test stake and unstake with Keplr confirmations;
   record transaction hashes. No such real tests were completed in this session.
6. Recheck Connect/Refresh recovery in the user's browser after hard refresh;
   its old rewards journal should clear only after confirmed exact transaction.
   Never ask the user to delete browser storage to bypass the retry lock.

## Spending protections — do not overpromise
Render usage-guards-v1 is live:
- aggregate admitted requests <=60/minute, 5,000/UTC day, 50,000/UTC month;
- new payout reservations <=100/day, 1,000/month; failed reservations count;
- 4 concurrent handlers, status RPC/result/failure cache 30 seconds;
- 8 KiB request bodies, connection timeouts, persistent SQLite counters;
- per-wallet 10 JUNOX/rolling 24 hours, fixed server-side amount;
- FAUCET_PAUSED=true manual pause; env limits can lower ceilings only.
These are application limits, NOT a hard USD 10 invoice cap. Rejected traffic,
instance and disk can remain billable. User accepted Render plus safeguards.
Additional build-spend limit USD 0 was recommended but not confirmed in dashboard.
Render auto-deploy is OFF; use Manual Deploy when changing backend source.
Do not tell the owner frontend Pages updates require a new Render deployment.

## Kintsugi faucet sidequest
https://github.com/kintsugi-tech/juno-faucet is full faucet source; advertised app
https://juno-faucet.vercel.app loads, but user's GitHub login reaches GitHub 404.
Redirect has client_id Iv23liRdIotSvzpKYKCY and the expected callback host.
Exact app configuration problem is unproven; requires operator inspection.
Treat as blocked funding source, not a working faucet. Never bypass GitHub auth.

## Funding precedent research
Juno Development Department proposal A39 was executed, transferring 2260 JUNO to
the RFP-003 support DAO for a 300 USDC-equivalent mixed work package.
June 10–17, 2024 report includes 3 general hours for a Discord faucet bot at
40 USDC/hour = inferred 120 USDC share, NOT a separate 120 USDC transfer.
Primary sources in CosmosContracts/council:
departments/development/rfp/003-dApp_Development_Support/agreement_01.md
departments/development/rfp/003-dApp_Development_Support/work_reports/20240610-20240617-work_report.md
No standalone recurring hosting payment or Kintsugi faucet-specific payment proven.

## Other completed work / preservation
Website nightly jobs: neta-website PR #142 fixed missed ranking schedule window;
docs #143 updated. DAO footer consistency was shipped in #125.
Do not reopen validator/whale research unless asked.
Read AGENTS.md, HANDOFF.md, docs/CURRENT_STATE.md; UI work also DESIGN_SYSTEM.md.
Use isolated worktrees, branch/PR and inspect relevant CI before merging.
Preserve all existing dirty worktrees and bot treasury data. Local working changes
may already be published through GitHub Git Data APIs despite local dirty status.
Current continuation workspace:
 /workspace/scratch/4e363f4326f5/neta-faucet-backend
Previous implementation workspace:
 /workspace/scratch/653b51d03138/neta-wallet-controls
Earlier worktrees neta-faucet-guards, neta-faucet-hosting,
neta-faucet-wallet-fix contain published dirty changes; do not reset them.
Mainnet messaging and other inactive feature gates stay disabled.
