# NETA DAO handoff

Last verified: 2026-09-23

Read this file and `README.md` before changing the application. The deployed site is
`https://dao.netareborn.com`; this repository is the canonical source for the DAO
workspace. `cristianoneta/neta-website` owns `https://netareborn.com`.

## Product state

- The header selects a chain and then a DAO. Both current DAOs live on Juno; the
  split is deliberate preparation for DAO tooling that can control other chains.
- The active workspace section is encoded in the URL hash and retained locally,
  so refreshing or directly opening `#treasury`, `#contributors`, `#delivery`
  `#governance`, `#relay` or `#names` preserves the selected view.
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
- RELAY is the unified inbox. Its live read-only layer polls Operations and native
  Juno governance, creates local notifications for new proposals, status changes
  and content/revision changes, and opens the matching proposal in this workspace.
  The compact inbox groups updates per proposal, supports search and a responsive
  reading pane. Its Composer performs a read-only UNI-7 contract identity check.
  DAO favorites, comparison baselines, notifications and read state are browser-local.
  The first load establishes a read baseline instead of creating a false unread flood.
- The RELAY mailbox v0.1 is instantiated on UNI-7 at
  `juno13uft9dl34x9wdzcxnm80q8m8sh5cw04lkskzknm9vc0wduxchdxsrnr4pa`.
  Its setup page `relay-testnet-setup.html` includes the pinned WASM, verifies its
  checksum, and reported the deployed address after the user's Keplr signatures.
  RELAY independently queries network, creator, label and code hash; if RPCs are
  inaccessible it reports an unavailable check rather than claiming verification.
  The message composer is UI-only until a reviewed Double Ratchet client is
  connected. It does not transmit or persist plaintext. UNI-7 has no NETA stake
  gate; the separate mainnet configuration
  must require at least 5 actively staked NETA. See
  `docs/RELAY_SECURITY_ARCHITECTURE.md`. The composer action reads `SEND MESSAGE`
  and stays disabled while messaging is not active; there is no plaintext send.
- `spikes/relay-corecrypto/browser-smoke.mjs` runs in GitHub Actions Chromium,
  using pinned Wire CoreCrypto 10.5.3 in an isolated test fixture. It exercises
  identity fingerprints, encrypted exchange/reply, out-of-order delivery, replay,
  reload and a fail-closed outbox. The additional `browser-key-vault.mjs` creates
  random CoreCrypto database keys, wraps them with a separate password, scopes
  them to the UNI-7 wallet and rejects wrong password, cross-wallet reuse and
  corrupted encrypted backup. The green PR #82 proves the browser fixture only.
  It is not integrated with the site, and its encrypted key export alone cannot
  restore the CoreCrypto database or message history.
  The later `browser-device-backup.mjs` fixture snapshots CoreCrypto 10.5.3's
  encrypted IndexedDB blocks plus that wrapped key. Chromium restored a device
  in a fresh profile, matched its original fingerprint and decrypted a message
  that had been encrypted before backup. This is an isolated layout-dependent
  proof, not a shipped device backup UI or a reviewed production mechanism.
- NETA Names UI and contract draft were introduced in PR #69. Verify the live
  Pages deployment before claiming the UI is available on the deployed site.
  Its contract charges 5 NETA for first-year registration and forwards all fees to
  the NETA DAO treasury `juno1c5v6jkmre5xa9vf9aas6yxewc7aqmjy0rlkkyk4d88pnwuhclyhsrhhns6`.
  Annual renewals use a manually adjustable NETA quote targeting USD 5; there is
  no automatic price oracle or universal wallet/DNS support. The shared-layout
  `#names` page includes lookup and prepared Keplr registration/renewal flows,
  all gated until the registry is verified and deployed. See `docs/NETA_NAMES_DESIGN.md`.

## Treasury architecture

- `.github/workflows/treasury-snapshot.yml` runs every 15 minutes and commits only
  changed snapshots. `scripts/update_treasury.py` collects balances and
  `scripts/update_treasury_events.py` collects transaction-backed Operations events.
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
- `data/treasury/events.json` monitors the Juno DAO core and the DAO-controlled
  Osmosis Polytone proxy, deduplicates on `chain_id:tx_hash`, and keeps a durable
  per-chain scan cursor. The scheduled collector safely replays both still-small
  address indexes and merges idempotently. Juno providers must expose the historical
  index; the Osmosis proxy is monitored even when a provider has no retained legacy
  matches so new activity is captured immediately.
- The Treasury Events frontend now reads that ledger. The default list is the three
  latest non-technical value movements; `VIEW ALL` filters all confirmed inflows and
  payments. Proposal titles are displayed inline and proposal badges open the
  matching Operations proposal in the local Governance view. TX and counterparty
  links use Atomscan for Juno and Mintscan for Osmosis. Pruned timestamps are
  represented by exact block heights rather than estimates.

## Operational rules

- Never request or enter a seed phrase. All user transactions go through Keplr.
- Do not enable a mainnet write merely because a UNI-7 flow works. Mainnet messages
  require exact simulation, review and explicit user approval.
- Preserve DAO/chain identity in every state key and asynchronous response; changing
  the selector must never leak the prior DAO's data into the current view.
- Use a feature branch, run the relevant tests, open a PR and merge only green CI.
- Generated treasury snapshots may advance `main` while a PR is open. Rebase or
  recreate the documentation commit on current `main`; never overwrite snapshots.
- Increment the query version in `index.html` whenever changing a static CSS or JS
  asset. The production site is aggressively cached; reusing `relay.css?v=1` and
  `relay.js?v=1` previously left users on the obsolete three-column RELAY layout.

## Verification

```bash
cargo test --locked --manifest-path contracts/neta-proposal-workshop/Cargo.toml
cargo clippy --locked --all-targets --manifest-path contracts/neta-proposal-workshop/Cargo.toml -- -D warnings
cargo test --locked --manifest-path contracts/workshop-access-mock/Cargo.toml
cargo test --locked --manifest-path contracts/neta-names/Cargo.toml
node --test tests/frontend-smoke.test.mjs
node --test tests/relay-mailbox-status.test.mjs tests/relay-testnet-setup.test.mjs
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
  shows total value and attributes changes between comparable holdings to price
  effect versus net token flow. It deliberately does not duplicate the live asset
  list or add a separate custody-by-chain panel. Asset rows expose their chain and
  custody address on hover/focus and inline on mobile. Fewer than two daily
  observations remain explicitly unavailable rather than using sample values.
- Operations Treasury Events and the Osmosis proxy are connected to the UI. Remaining
  Treasury work is higher-level accounting: cross-chain IBC correlation beyond the
  current custody consolidation, recurring income/expenses, proposal-linked
  obligations, open milestone payments and derived runway.
- RELAY notifications currently update while the page is open or regains focus.
  There is no service worker, push delivery, backend account or cross-device read
  state. Next: independently review CoreCrypto's GPL-3.0 browser distribution
  implications, review and harden the layout-dependent full encrypted database
  backup and restore flow, isolate wallets and concurrent tabs, bind decrypted envelope
  identity to the on-chain registration, and prepare a test-only registration
  UI. Then test two real Keplr wallets on UNI-7. Do not enable `SEND MESSAGE`
  until this end-to-end flow passes; mainnet still needs the separate stake gate
  and audit. See `docs/RELAY_IMPLEMENTATION_PLAN.md`.
  A test-only Web Locks fixture now serializes same-origin tabs by physical
  CoreCrypto database path and holds the lock through device backup. Production
  wallet binding and crash lifecycle are still open.
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
5. For RELAY messaging, continue from the deployed UNI-7 contract and isolated
   browser crypto fixture. Do not mistake the fixture's wrapped key export for a
   complete device backup or enable a fake send path.
