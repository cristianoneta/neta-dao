# Next chat — finish the UNI-7 faucet — 2026-10-04

This is the current continuation entry point. It supersedes older hosting-pending
and untested-rewards snapshots in the 2026-10-03 handoff.

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
Public juno-faucet-config.mjs still has api:null,address:null. Payout/donation
controls are intentionally disabled. Last checked balance was 0 JUNOX.

The recovery phrase was provisioned privately by the owner as Render secret file
/etc/secrets/faucet-mnemonic. Never request/read/print it. Earlier invalid seed
error handling was sanitized in PR #128. Persistent SQLite: /var/data/faucet.sqlite.
Keep SQLite/WAL and pending transaction/crypto journals across every deploy/restart.

## Immediate next steps (in order)
1. Verify fresh GitHub main, CI, Pages and live /status. Do not infer current state
   from historical snapshots.
2. Fix/verify BACKEND confirmation RPC before activation. The blueprint/default
   FAUCET_RPC is https://juno.test.rpc.nodeshub.online, whose TX index is disabled.
   faucet/service/chain.mjs still uses its configured client.getTx(hash) with no
   fallback. The frontend fix does not repair this server adapter. Use an indexed
   UNI-7 RPC (STAVR https://juno.rpc.t.stavr.tech confirmed the real claim), or add
   a chain-verified exact-hash fallback with meaningful regression tests.
   Have the owner apply any necessary Render configuration/deploy, then verify.
   Never solve this by clearing locks or rebroadcasting unknown payments.
3. Fund the dedicated faucet wallet with JUNOX via an ordinary owner-confirmed
   Keplr transfer (100 JUNOX is a useful start). The user's wallet received rewards.
   Funding through our Donate control is not enabled yet. No mainnet tokens.
4. Prepare/test public integration: pin Render origin in juno-faucet.html CSP and
   juno-faucet-config.mjs API/address. Follow faucet/README.md activation gate;
   perform real fresh-wallet payout, chain receipt, repeated request and
   restart/persistent cooldown checks before making public payout claims.
   Existing limit is exactly 10 JUNOX per rolling 24 hours per wallet.
5. Test real whole-number donation, stake and unstake with Keplr confirmations;
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
Current implementation workspace:
 /workspace/scratch/653b51d03138/neta-wallet-controls
Earlier worktrees neta-faucet-guards, neta-faucet-hosting,
neta-faucet-wallet-fix contain published dirty changes; do not reset them.
Mainnet messaging and other inactive feature gates stay disabled.
