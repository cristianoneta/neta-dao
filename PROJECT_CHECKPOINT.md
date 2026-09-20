# NETA DAO Workspace Checkpoint

Updated: 20 September 2026

## Implemented

- Unified chain and DAO selectors for Juno-based governance.
- NETA Operations and native Juno governance views.
- Private per-DAO browser drafts.
- Public UNI-7 proposal review with revisions, titled threads and nested replies.
- Revision confirmation dialog requiring an explanation of what changed and why.
- Full cursor pagination for workshop proposals, revisions and comments.
- Mainnet Juno governance history and live funding/voting parameters.
- Home, Delivery, Contributors and Treasury pages; the last three remain clearly marked UX drafts.
- Request race protection and Keplr account-change invalidation.

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
- Proposal-summary query removes frontend N+1 revision loading.
- Nine passing unit tests plus warning-free Clippy.
- RustSec audit passes with one documented Juno/CosmWasm 1.5 compatibility exception: `RUSTSEC-2024-0344` is in host-side `cosmwasm-crypto` and is not compiled into the deployed Wasm. The exception must be removed when Juno supports the newer CosmWasm dependency line.

## Deployment state

- `assets/neta_proposal_workshop.wasm` is built from v0.3.0 source.
- SHA-256: `5cd983bef2be826c0d13bbf426f3d2c34553df2fdf99f3743c551d65d4da3fc6`.
- Operations UNI-7 workshop: `juno1d2xdlvy23am07twe046zzxxndjtccgpwwl3pyu5g98u07qu3nyqqkaz65h` (legacy contract API).
- Juno v0.3.0 review workshop: not yet deployed/canonically committed.
- Test administrator: `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`.
- UNI-7 access mock: `juno10739807rjqkf4kmtvpu5ll5e67dkch82xzgph83cmn5h8n0fxmnszasg86`.

## Intentionally locked

- Native Juno mainnet proposal deposit and submission.
- Native Juno voting through this frontend.
- Delivery milestone acceptance and payment release.
- Treasury execution and accounting feeds.
- Contributor claims as authoritative DAO records.

## Next operational step

Deploy the reviewed Juno v0.3.0 Wasm on UNI-7 with the configured test administrator, verify publish/revise/comment/finalize with the dual stake gate, then commit the resulting contract address as the canonical Juno `workshopContract`. Until that commit, the address stored in a browser is not shared configuration.
