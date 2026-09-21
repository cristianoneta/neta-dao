# NETA DAO Workspace Checkpoint

Updated: 21 September 2026

## Implemented

- Unified chain and DAO selectors for Juno-based governance.
- NETA Operations and native Juno governance views.
- Private per-DAO browser drafts.
- Public UNI-7 proposal review with revisions, titled threads and nested replies.
- Revision confirmation dialog requiring an explanation of what changed and why.
- Full cursor pagination for workshop proposals, revisions and comments.
- Mainnet Juno governance history and live funding/voting parameters.
- Home, Delivery, Contributors and Treasury pages; Delivery and Contributors remain UX concepts, while Treasury balances are live and read-only.
- Request race protection and Keplr account-change invalidation.
- Structured proposal deliverables with deadline, responsible party, confirmer and evidence requirements, stored revision-by-revision in the existing payload.
- Per-DAO contextual staking destinations shown only when a connected discussion participant lacks comment eligibility.

## Access rules

- Operations publish/revise/finalize: positive DAO voting power.
- Operations comments/replies: strictly more than 10 active staked NETA.
- Juno UNI-7 review writes: at least 1 delegated JUNOX and 1 active test NETA.
- Contract queries remain public.

## Contract v0.3.0 hardening

- Contract-computed SHA-256 revision hashes.
- JSON-array validation for proposal actions.
- Finalized or withdrawn proposals reject further discussion decisions.
- Authors can withdraw before submission even after losing current membership.
- Unverified submission marking is disabled.
- Two-step owner transfer and migration entrypoint.
- Fail-visible access queries instead of silently converting provider failures to zero balances.
- Treasury phase 1 reads the verified NETA Operations DAO core `juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl` and Juno's native distribution-module Community Pool on mainnet. Separate snapshots are selected globally with the DAO picker. Native/CW20 holdings and the validated WYND LP set are snapshotted every 15 minutes; IBC denoms are resolved through on-chain traces, and LP positions include direct, staked and claim-state ownership, remain visible as LP tokens, and are valued exactly once from proportional underlying reserves. Daily Europe/Berlin 21:00 snapshots are retained for history. Planning, commitments and runway remain draft values.
- Durable denom metadata is stored in `data/treasury/token-registry.json`; snapshots retain full denoms, base denoms and IBC paths. Unknown assets remain visibly unresolved rather than receiving guessed labels or prices.
- NETA Operations is consolidated across its Juno DAO core and the DAO-controlled Osmosis Polytone proxy `osmo1xjfyz4f7da2yu43c0ptlswyln50wqyj53495sesaq40ja5megq4qms9f80`. Every asset retains its source chain and custody address.
- Treasury history consumes the daily Operations or Juno Community Pool snapshots,
  appends the current verified state in-browser, and supports 7/30/90-day and
  all-time views. Snapshot assets retain symbol, source chain, quantity, price and
  USD value. Opening quantities revalued at closing prices produce the market
  effect; the remaining total-value change is shown as net flow. Internal
  cross-chain custody movements consolidate by asset symbol.
- Proposal-summary query removes frontend N+1 revision loading.
- Nine passing unit tests plus warning-free Clippy.
- RustSec audit passes with one documented Juno/CosmWasm 1.5 compatibility exception: `RUSTSEC-2024-0344` is in host-side `cosmwasm-crypto` and is not compiled into the deployed Wasm. The exception must be removed when Juno supports the newer CosmWasm dependency line.

## Deployment state

- `assets/neta_proposal_workshop.wasm` is built from v0.3.0 source.
- SHA-256: `6eb604c255d01414880bdcb9cc1d1df69dc2507f25ffc6e6d51388945ff63f22`.
- Operations UNI-7 workshop: `juno1d2xdlvy23am07twe046zzxxndjtccgpwwl3pyu5g98u07qu3nyqqkaz65h` (legacy contract API).
- Juno v0.3.0 review workshop: deployed, unpaused and configured as the canonical frontend contract at `juno18d3mzk3ver06zfr5nf752aycss75vtcqd8fsdcuuzmh5mzj4cm6qrgx3fw` using code ID `114`.
- The canonical Juno review address is committed in the `neta-governance.js` DAO registry; it is not browser-local scaffolding.
- Test administrator: `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`.
- UNI-7 access mock: `juno10739807rjqkf4kmtvpu5ll5e67dkch82xzgph83cmn5h8n0fxmnszasg86`.

## Intentionally locked

- Native Juno mainnet proposal deposit and submission.
- Native Juno voting through this frontend.
- Delivery milestone acceptance and payment release.
- Treasury execution and accounting feeds.
- Contributor claims as authoritative DAO records.

## Next product step

Continue with the remaining read-only Treasury phase 2 work:

1. transaction-backed historical and forecast cash flow;
2. recurring income and expenses;
3. proposal-linked obligations;
4. open milestone payments;
5. derived runway.

Proposal-workshop smoke tests remain a regression gate whenever review-contract behavior changes; they are no longer the primary continuation task. Native mainnet submission, voting, Treasury execution and payment release remain separately gated.
