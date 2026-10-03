# Main Neta DAO integration — 2026-10-03

Published in PR #118 on 2026-10-03; verified release evidence is recorded below.
The original `HANDOFF_NEXT_CHAT_2026-10-03.md` is a historical WIP snapshot.

## Connected scope

Three entries share `data/dao-directory.json`: Operations, Neta DAO and native Juno
governance. The browser generator has a drift check. Profiles and RELAY follows
use those entries; links preserve the selected DAO. Unknown profiles fail visibly.

Neta DAO core is `juno1c5v6jkmre5xa9vf9aas6yxewc7aqmjy0rlkkyk4d88pnwuhclyhsrhhns6`.
Its legacy proposal module supplies three recorded historical proposals. Local
drafts are allowed; public review/mainnet signing for this DAO remain unconnected.
Operations signing and the native Juno review setup path remain distinct.

`neta.dao.neta`, `neta-operations.dao.neta` and `juno-governance.dao.neta` are directory
labels, not active NNS registrations. Juno's profile identifies native governance;
it does not present an ordinary receiving address. NNS registry and mainnet
messaging remain disabled. Profile change proposals remain planned.

Members: height-pinned legacy staking state, exact namespace, chain/core/voting/
staking/token checks and total reconciliation. The fresh read at height 42334218
returned 2088 positive staking addresses with 4075.135927 NETA total power. This
proves active stake at that height, not legal membership or contributor roles.

Treasury: only core holdings, excluding member stake; native coins plus configured
NETA/WYND CW20s and eight configured WYND LPs. This is not automatic discovery of
all possible contracts. Fresh read retained four holdings including 1402.010133
JUNO and 2.571312 NETA. Two unresolved IBC denoms are unpriced and display exact
raw units, not guessed decimals. Balance calls use latest endpoints; the recorded
height is context, unlike the height-pinned membership snapshot.

Delivery and contribution records remain unavailable for newly added DAOs.
Operations examples do not appear as their treasury planning or contributor data.

## Historical transactions and revenue

Main DAO history is **unavailable**, not empty/complete. PublicNode, Pocket,
Polkachu and Stavr returned zero matches for the core using five event-key probes
(`wasm._contract_address`, `wasm.contract_address`, `transfer.recipient`, `wasm.to`,
`wasm.from`); WhisperNode returned 502. This does not establish zero activity or
prove exactly why historical indexing is absent. Current balances and proposals
come from contract/bank state and do not require the old transaction index.

The collector retains any previous verified events and anchors; failure adds an
UNAVAILABLE state without fabricating a successful timestamp or zero revenue.
Frontend checks scope, chain and treasury before displaying a main DAO ledger.
There is no verified NNS registry/fee source: revenue_raw stays null. Historical
accounting completeness is a follow-up task, not a condition silently declared met.

## Jobs and verification

Existing `Treasury snapshot` continues to own Operations and Community Pool files.
Independent `Main DAO snapshots` runs at minutes 7/37; its three read-only collectors
run concurrently, each bounded (members 180s, balances 300s, events 150s). Failed
sources preserve previous snapshots and publish `data/daos/neta-status.json`.
Successful job completion means the refresh attempt was handled; inspect source
status and snapshot timestamps for data coverage. New history is not backfilled.

The local real-source run completed in approximately 133 seconds: member/balance
reads succeeded; historical event indexing remained unavailable. Browser fixtures
exercise both historical details and unavailable states; they do not sign wallets.

Release verified on 2026-10-03 around 22:02 Europe/Berlin:

- PR #118 merged as `641b8bd8de27bbf5c4b60ecc934532b80095d039` after exact-head
  `f8bb037e2b2a07fc089be81efb1666946b55c207` checks succeeded: Contract/frontend
  [37149693420](https://github.com/cristianoneta/neta-dao/actions/runs/37149693420)
  and RELAY browser/crypto
  [37149693465](https://github.com/cristianoneta/neta-dao/actions/runs/37149693465).
- Main-push Contract/frontend run `37149787305` succeeded.
- Operations/Community Pool job `37149787273` succeeded, creating bot commit
  `eb6c2a68173e9207fadbd011415b6adfb5f9dc82`. Main DAO job `37149787307`
  succeeded, creating `e6a656e1becb908958c8422d54716fc55670e64a`.
  Source status at `2026-10-03T19:59:05Z`: members and balances completed,
  events unavailable. Successful workflow completion does not mean full history.
- Pages run `37149805937` succeeded for the Operations bot continuation; run
  `37149872156` succeeded for the main DAO bot continuation. Initial Pages run
  `37149786900` was superseded/cancelled by the newer bot deployment, not a defect.
- Eight served production files matched the checked source byte-for-byte:
  index.html, neta-governance.js, dao-directory.js, dao-members.js,
  names-workspace.js, relay.js, treasury.js and ux-draft.js.
- Live cloud-browser inspection loaded the main DAO profile and 2088 staking
  participants, its PARTIAL Treasury and explicit unavailable-history notice;
  all three real on-chain proposals loaded and Constitution #3 opened with
  executed status and actual description. Juno's native-governance profile
  correctly showed no ordinary receiving core address. No wallet writes.
- The browser initially retained an older unversioned index; release-query URL
  `index.html?release=641b8bd` served the new build. Reload if a client retains
  the previous two-DAO menu. Source asset query versions are updated.

Remaining work is tracked in issue #119. NNS registration, attributable fee
revenue and new main DAO signing remain gated; directory labels are not names
registered on-chain.

## Resumed verification after interrupted chat

Recovered the uncommitted continuation and reran 25 Python tests, 45 frontend
tests and the Playwright workspace regression successfully. Responsive screenshot
review uses actual snapshots at 320/768/1440 px; chain proposal queries are fixtures.
No wallet transactions were submitted. Remaining source/activation work is tracked
in [issue #119](https://github.com/cristianoneta/neta-dao/issues/119).

Owner follow-up: DAO selector results sort alphabetically by displayed name,
case-insensitively, including filtered results. Stored selection/default DAO
remains independent of the menu order.
