# NETA Proposal Workshop

On-chain storage and access control for the public NETA DAO proposal workshop.

## Access model

- The contract supports two explicit access modes selected at instantiation.
- Queries are public and require no wallet.
- **Operations DAO mode:** publishing, revising, finalizing and marking a proposal submitted require positive voting power from `dao_voting_contract`.
- **Operations DAO mode:** comments and replies require an active NETA stake **strictly greater than** `minimum_comment_stake`.
- The production threshold is `10000000` raw units (10 NETA with six decimals), so exactly 10 NETA is not sufficient.
- **Juno community mode:** all writes require at least the configured native delegated stake **and** the configured active NETA stake. The intended thresholds are exactly 1 JUNO and 1 NETA.
- A global 30-second comment cooldown, owner block list and moderator tombstones are enforced on-chain.
- Revisions are immutable. Only the latest revision can be finalized.

## Operations DAO configuration

```json
{
  "owner": "juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57",
  "dao_voting_contract": "juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl",
  "stake_contract": "juno1a7x8aj7k38vnj9edrlymkerhrl5d4ud3makmqhx6vt3dhu0d824qh038zh",
  "minimum_comment_stake": "10000000",
  "community_gate": null
}
```

## Juno community governance configuration

This uses the same NETA staking contract, but replaces Operations DAO membership
with a dual stake gate. Both amounts use six decimal places.

```json
{
  "owner": "juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57",
  "dao_voting_contract": "juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl",
  "stake_contract": "juno1a7x8aj7k38vnj9edrlymkerhrl5d4ud3makmqhx6vt3dhu0d824qh038zh",
  "minimum_comment_stake": "0",
  "community_gate": {
    "native_denom": "ujuno",
    "minimum_native_stake": "1000000",
    "minimum_neta_stake": "1000000"
  }
}
```

Instantiation starts paused. Validate the configured cross-contract queries before explicitly unpausing.
