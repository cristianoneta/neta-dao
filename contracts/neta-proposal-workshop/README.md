# NETA Proposal Workshop

On-chain storage and access control for the public NETA DAO proposal workshop.

## Access model

- Queries are public and require no wallet.
- Publishing, revising, finalizing and marking a proposal submitted require positive voting power from `dao_voting_contract`.
- Comments and replies require an active NETA stake **strictly greater than** `minimum_comment_stake`.
- The production threshold is `10000000` raw units (10 NETA with six decimals), so exactly 10 NETA is not sufficient.
- A global 30-second comment cooldown, owner block list and moderator tombstones are enforced on-chain.
- Revisions are immutable. Only the latest revision can be finalized.

## Intended Juno mainnet configuration

```json
{
  "owner": "juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57",
  "dao_voting_contract": "juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl",
  "stake_contract": "juno1a7x8aj7k38vnj9edrlymkerhrl5d4ud3makmqhx6vt3dhu0d824qh038zh",
  "minimum_comment_stake": "10000000"
}
```

Instantiation starts paused. Validate the configured cross-contract queries before explicitly unpausing.

