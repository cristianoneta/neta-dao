# NETA Proposal Workshop

On-chain storage and access control for the public NETA DAO proposal workshop.

## Access model

- The contract supports two explicit access modes selected at instantiation.
- Queries are public and require no wallet.
- **Operations DAO mode:** publishing, revising and finalizing require positive voting power from `dao_voting_contract`.
- **Operations DAO mode:** comments and replies require an active NETA stake **strictly greater than** `minimum_comment_stake`.
- The Operations-mode threshold used by the frontend is `10000000` raw units (10 NETA with six decimals), so exactly 10 NETA is not sufficient.
- **Juno community mode:** all writes require the configured native delegated stake. A positive `minimum_neta_stake` additionally requires active NETA stake; zero disables all CW20 stake queries in v0.3.1. Existing UNI-7 instances retain their 1 JUNOX + 1 test NETA policy. The owner-selected mainnet policy is 1 delegated JUNO with no NETA requirement.
- A global 30-second comment cooldown, owner block list and moderator tombstones are enforced on-chain.
- Revisions are immutable. Only the latest revision can be finalized.
- Finalization computes the SHA-256 content hash inside the contract and closes discussion.
- `MarkSubmitted` is deliberately disabled until a submission adapter can verify the target DAO proposal on-chain.
- Ownership changes use a two-step propose/accept flow; v0.3.0 also provides a migration entry point.

## Configuration examples (not current deployed instances)

The frontend Operations instance still uses the legacy API in the other repository.
These examples describe this crate's supported modes, not a deployed Operations
migration or enabled mainnet submission. The configured Juno UNI-7 deployment
uses an access mock and `ujunox`; see [current state](../../docs/CURRENT_STATE.md).

## Operations DAO mode example

```json
{
  "owner": "juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57",
  "dao_voting_contract": "juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl",
  "stake_contract": "juno1a7x8aj7k38vnj9edrlymkerhrl5d4ud3makmqhx6vt3dhu0d824qh038zh",
  "minimum_comment_stake": "10000000",
  "community_gate": null
}
```

## Prospective mainnet Juno community mode example

This uses the same NETA staking contract, but replaces Operations DAO membership
with native-only eligibility. The NETA minimum is zero; the retained stake/voting address fields are unused in this mode. JUNO uses six decimal places.

```json
{
  "owner": "juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57",
  "dao_voting_contract": "juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl",
  "stake_contract": "juno1a7x8aj7k38vnj9edrlymkerhrl5d4ud3makmqhx6vt3dhu0d824qh038zh",
  "minimum_comment_stake": "0",
  "community_gate": {
    "native_denom": "ujuno",
    "minimum_native_stake": "1000000",
    "minimum_neta_stake": "0"
  }
}
```

Instantiation starts paused. Validate the configured cross-contract queries before explicitly unpausing.

Mainnet v0.3.1 preparation and activation boundaries: [rollout](../../docs/JUNO_REVIEW_MAINNET.md). The existing `assets/neta_proposal_workshop.wasm` remains the v0.3.0 UNI-7 setup artifact; the mainnet artifact is separate and reproduced by CI.
