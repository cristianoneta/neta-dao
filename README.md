# NETA DAO Workspace

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
- Community review is tested on UNI-7.
- Review writes require at least 1 delegated JUNOX and 1 actively staked test NETA.
- Mainnet deposit, `MsgSubmitProposal` and native Juno voting remain disabled until the exact transactions have been simulated and reviewed.
- A newly deployed Juno review contract is browser-local until its verified address is committed to the DAO registry in `neta-governance.js`.

### UX concepts

Delivery, Contributors and Treasury are visual drafts using sample data. They do not execute payments or read DAO treasury wallets yet.

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

The CI workflow validates CosmWasm compatibility and verifies that the built Wasm is byte-identical to the shipped browser artifact.

UNI-7 deployment behavior, known API compatibility constraints and the state-based transaction recovery procedure are documented in [`UNI7_DEPLOYMENT_RUNBOOK.md`](UNI7_DEPLOYMENT_RUNBOOK.md).

## Deployment rule

Changes go through a pull request and must pass contract/frontend CI. Do not enable native Juno submission or treasury execution from frontend-only validation.
