# Main Neta DAO integration — 2026-10-03

Implementation on PR #118; release evidence is recorded below after verification.
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

Release evidence: pending final PR checks and deployment verification.

## Resumed verification after interrupted chat

Recovered the uncommitted continuation and reran 25 Python tests, 45 frontend
tests and the Playwright workspace regression successfully. Responsive screenshot
review uses actual snapshots at 320/768/1440 px; chain proposal queries are fixtures.
No wallet transactions were submitted. Remaining source/activation work is tracked
in [issue #119](https://github.com/cristianoneta/neta-dao/issues/119).
