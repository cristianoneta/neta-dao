# NETA DAO handoff

Last verified: 2026-09-21

Read this file and `README.md` before changing the application. The deployed site is
`https://dao.netareborn.com`; this repository is the canonical source for the DAO
workspace. `cristianoneta/neta-website` owns `https://netareborn.com`.

## Product state

- The header selects a chain and then a DAO. Both current DAOs live on Juno; the
  split is deliberate preparation for DAO tooling that can control other chains.
- Proposals supports private browser drafts, public UNI-7 review, revisions,
  threaded discussion, withdrawal and structured deliverables.
- NETA Operations uses its DAO voting/staking contracts. Publishing requires DAO
  voting power; comments require strictly more than 10 actively staked NETA.
- Juno Governance reads native mainnet governance but uses the dedicated UNI-7
  workshop `juno18d3mzk3ver06zfr5nf752aycss75vtcqd8fsdcuuzmh5mzj4cm6qrgx3fw`
  for community review. Review writes require 1 delegated JUNOX plus 1 staked test
  NETA. Native mainnet deposit, submission and voting are intentionally disabled.
- Delivery, Treasury and Contributors communicate the intended product model.
  Delivery and Contributors are still UX concepts. Treasury balances and daily
  value history are live and read-only; forecasting, commitments, recurring cash
  flow and runway are sample UX only.
- Deliverables are stored inside `actions_json` as `dao_deliverable_v1`. They are
  planning records, not executable Cosmos messages.

## Treasury architecture

- `.github/workflows/treasury-snapshot.yml` runs every 15 minutes and commits only
  changed snapshots. `scripts/update_treasury.py` is the collector.
- NETA Operations combines the Juno DAO core
  `juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl` and its
  DAO-controlled Osmosis Polytone proxy
  `osmo1xjfyz4f7da2yu43c0ptlswyln50wqyj53495sesaq40ja5megq4qms9f80`.
- Juno Governance displays the native distribution-module Community Pool.
- Denom identities and IBC traces are persisted in
  `data/treasury/token-registry.json`. Never guess an unresolved denom.
- LP tokens stay visible as positions and expand into proportional reserves. Their
  reserve value is counted exactly once; do not also count the underlying as free
  treasury assets.
- Assets below USD 50 and unpriced assets are collapsed by default together with
  technical warnings. They remain inspectable and are not silently discarded.
- The collector is fail-closed and records source, block height and timestamp.
  Current Juno REST fallbacks come from the Cosmos Chain Registry.

## Operational rules

- Never request or enter a seed phrase. All user transactions go through Keplr.
- Do not enable a mainnet write merely because a UNI-7 flow works. Mainnet messages
  require exact simulation, review and explicit user approval.
- Preserve DAO/chain identity in every state key and asynchronous response; changing
  the selector must never leak the prior DAO's data into the current view.
- Use a feature branch, run the relevant tests, open a PR and merge only green CI.
- Generated treasury snapshots may advance `main` while a PR is open. Rebase or
  recreate the documentation commit on current `main`; never overwrite snapshots.

## Verification

```bash
cargo test --locked --manifest-path contracts/neta-proposal-workshop/Cargo.toml
cargo clippy --locked --all-targets --manifest-path contracts/neta-proposal-workshop/Cargo.toml -- -D warnings
cargo test --locked --manifest-path contracts/workshop-access-mock/Cargo.toml
node --test tests/frontend-smoke.test.mjs
python -m py_compile scripts/update_treasury.py
```

Running `scripts/update_treasury.py` writes snapshots. Use it only when a fresh
collection is intended; syntax and frontend tests are non-mutating.

## Current incidents and open work

- On 2026-09-21 two snapshot runs failed because Polkachu returned 502 while the old
  Lavender endpoint no longer resolved. Later runs succeeded. The stale endpoint was
  replaced with STAVR and PublicNode fallbacks; failures must still remain visible if
  every provider is unavailable.
- A Pages deployment timed out in GitHub's `updating_pages` phase after a successful
  build. Later deployments succeeded; this was not an application build defect.
- Treasury history uses the daily snapshots plus the current verified state. It
  shows total value, chain and asset composition, and attributes changes between
  comparable holdings to price effect versus net token flow. Fewer than two daily
  observations remain explicitly unavailable rather than using sample values.
- Next Treasury work: transaction-backed cash flow, recurring income/expenses,
  proposal-linked obligations, open milestone payments and derived runway.
- AtomOne is research only. Its reserved treasury address is not an active DAO;
  AtomOne lacks CosmWasm for native Polytone deployment. ICA would create a separate
  host-chain account and needs host support plus an adapter/controller design.

## First steps for the next AI

1. Read `README.md`, this file, `neta-governance.js`, `treasury.js` and the snapshot
   workflow before proposing changes.
2. Check current GitHub Actions and deployed pages; do not infer production from a
   local branch.
3. Confirm whether the task concerns NETA Operations, Juno Governance or both.
4. Keep live/read-only, testnet-write and future/sample states visibly distinct.
