# NETA DAO Workspace

> New maintainers and AI agents: start with [`HANDOFF.md`](HANDOFF.md) for the
> verified deployment state, safety gates, data ownership and current backlog.

Static governance workspace for DAO collaboration on Juno. The frontend combines private browser drafts, public UNI-7 review contracts and read-only mainnet governance data.

## Current product boundary

### NETA Operations DAO

- Private drafts are stored only in the current browser.
- Public review, revisions and discussions use the configured UNI-7 workshop contract.
- Publishing, revising and finalizing require positive Operations DAO voting power.
- Comments and replies require strictly more than 10 actively staked NETA.
- Existing Operations proposals and voting state are read from Juno mainnet.

### Juno Network Governance

- Mainnet proposals and current deposit/voting parameters are read-only.
- Community review uses the canonical UNI-7 workshop contract `juno18d3mzk3ver06zfr5nf752aycss75vtcqd8fsdcuuzmh5mzj4cm6qrgx3fw`, deployed from reviewed v0.3.0 Wasm, unpaused and committed to the DAO registry in `neta-governance.js`.
- Review writes require at least 1 delegated JUNOX and 1 actively staked test NETA.
- Mainnet deposit, `MsgSubmitProposal` and native Juno voting remain disabled until the exact transactions have been simulated and reviewed.

### RELAY

- RELAY is a unified local-first inbox for watched DAOs. It currently reads NETA
  Operations and native Juno proposals and detects new proposals, status transitions
  and changed content/revisions while the page is open.
- Favorites, the comparison baseline, generated notifications and read status stay
  in this browser. There is no push service, user account or cross-device sync yet.
- `CREATE NEW MESSAGE` opens a composer above the inbox. Until the UNI-7 message
  contract and reviewed Double Ratchet client are connected, input is neither
  transmitted nor persisted and the UI reports that activation is required.
- UNI-7 messaging is intentionally open for testing without a NETA stake gate.
  A later, separately instantiated mainnet contract must require at least 5 actively
  staked NETA. The threat model and release gates are documented in
  [`docs/RELAY_SECURITY_ARCHITECTURE.md`](docs/RELAY_SECURITY_ARCHITECTURE.md).

### UX concepts

Delivery and Contributors remain visual drafts. Treasury asset balances are collected read-only from the NETA Operations DAO core address `juno1excm…mancl`, its DAO-controlled Osmosis Polytone proxy `osmo1xj…9f80`, and Juno's native distribution-module Community Pool. Chain custody and IBC representations remain explicit. USD prices are refreshed centrally, while planning, commitments and runway remain explicitly marked sample values until their accounting model is connected.

LP positions remain visible as LP-token holdings. Each position expands into its proportional underlying reserves, and its USD value is calculated from those reserves exactly once; underlying amounts are not added again as free treasury tokens. The collector fails visibly on unavailable providers and retains source, timestamp and block height.

The Treasury history view uses the retained daily snapshots and the current
verified state for 7/30/90-day and all-time views. It focuses on total USD value
and change attribution without repeating the live asset list. For consecutive observations, opening
quantities are revalued at closing prices to isolate market movement; the
remaining value change is reported as net token flow. Transfers between
DAO-controlled Juno and Osmosis custody consolidate under the same asset identity
and do not create an external inflow or outflow. Chain and custody address remain
available on each asset row by hover or keyboard focus and are shown inline on
mobile.

Known native and IBC-denom mappings are versioned in `data/treasury/token-registry.json`. Each generated snapshot also retains the full on-chain denom, resolved base denom and IBC path. Unknown hashes are queried from Juno at collection time and remain visibly unpriced instead of being assigned a guessed identity.

Transaction-backed NETA Operations activity is retained in
`data/treasury/events.json`. The collector monitors both the Juno DAO core and its
DAO-controlled Osmosis Polytone proxy, combines indexed contract activity with
confirmed native transfers, deduplicates by chain and transaction hash, and stores
a block-height watermark for each chain. Proposal IDs are enriched with the title
from the canonical Operations proposal module.
Because the historical Juno index only permits strict height equality for filtered
queries, every scheduled run replays the complete, still-small DAO address index.
Delayed runs and short RPC outages therefore cannot create gaps. Historic block
timestamps remain explicitly unavailable when public RPC archives have pruned the
corresponding block body.

The Treasury Events card consumes that ledger directly. Its compact view shows the
three latest non-technical native movements; `VIEW ALL` exposes all confirmed
inflows and payments with filters. Historical rows without an archive timestamp use
their exact block height. Transaction and counterparty links open the appropriate
chain explorer, while the proposal title is shown inline and its badge opens the
corresponding NETA Operations proposal inside this workspace. The unpriced
`testingaten` movement remains visible only in the expanded
ledger and is never presented as treasury income.

### Proposal deliverables

Drafts and public revisions can contain structured deliverables with a milestone title, deadline, responsible party, required confirmer and expected evidence. They are embedded in the existing `actions_json` array as entries with `type: "dao_deliverable_v1"`. This keeps the format backward-compatible with the deployed workshop contract while allowing the Delivery view to consume approved milestones later. Submission adapters must separate these planning records from executable chain messages.

When a connected user opens a discussion but lacks the configured comment stake, the workspace exposes that DAO's configured staking destination. The action is contextual; it is not shown when comment access is already satisfied, and staking does not imply DAO membership or publishing rights.

## Security properties

- User-provided content is rendered through DOM text nodes, not HTML injection sinks.
- Contract writes enforce authorization on-chain; frontend state is not trusted.
- The workshop rejects attached funds, starts paused and supports two-step owner transfer.
- Revision hashes are computed in the contract from stored canonical proposal content.
- Unverified `MarkSubmitted` calls are blocked until an on-chain submission adapter exists.
- Published revisions and comments are immutable; finalization closes discussion.
- The shipped Wasm is checked against `assets/neta_proposal_workshop.sha256` before browser deployment and in CI.

## Development

Rust is pinned in `rust-toolchain.toml`. Both contracts contain committed lockfiles.

```bash
cargo test --locked --manifest-path contracts/neta-proposal-workshop/Cargo.toml
cargo clippy --locked --all-targets --manifest-path contracts/neta-proposal-workshop/Cargo.toml -- -D warnings
cargo test --locked --manifest-path contracts/workshop-access-mock/Cargo.toml
node --test tests/frontend-smoke.test.mjs
```

Build the review contract reproducibly:

```bash
bash scripts/build-wasm.sh neta-proposal-workshop
```

UNI-7 deployment behavior, known API compatibility constraints and the state-based transaction recovery procedure are documented in [`UNI7_DEPLOYMENT_RUNBOOK.md`](UNI7_DEPLOYMENT_RUNBOOK.md).

## Deployment rule

Changes go through a pull request and must pass contract/frontend CI. Do not enable native Juno submission or treasury execution from frontend-only validation.
