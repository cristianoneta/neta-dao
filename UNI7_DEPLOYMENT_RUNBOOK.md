# UNI-7 CosmWasm Deployment Runbook

Updated: 20 September 2026

This runbook records the compatibility issues observed while deploying the Juno governance review workshop from a browser with Keplr. It applies to UNI-7 and may also be useful for older Cosmos SDK/CosmWasm chains.

## Confirmed deployment

- Network: Juno testnet `uni-7`
- Deployer/admin: `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`
- Wasm SHA-256: `6eb604c255d01414880bdcb9cc1d1df69dc2507f25ffc6e6d51388945ff63f22`
- Canonical uploaded code: code ID `114`
- Duplicate identical upload: code ID `115`
- Review contract: `juno18d3mzk3ver06zfr5nf752aycss75vtcqd8fsdcuuzmh5mzj4cm6qrgx3fw`
- Access mock: `juno10739807rjqkf4kmtvpu5ll5e67dkch82xzgph83cmn5h8n0fxmnszasg86`

The contract configuration was queried after deployment and confirmed:

- owner is the test administrator;
- voting and stake checks use the access mock;
- community gate requires `1 JUNOX` and `1` test NETA in minimal units;
- comment cooldown is 30 seconds;
- `paused` is `false`.

## Expected wallet transactions

When the Wasm is already uploaded, a fresh deployment produces two Keplr confirmations:

1. instantiate the review contract;
2. unpause the newly instantiated contract.

A store-code confirmation is only expected if no matching upload exists. The frontend must search by creator and Wasm checksum before requesting it.

## UNI-7 compatibility findings

### Transaction indexing is disabled

The RPC may broadcast a successful transaction and then fail while waiting for indexed transaction results with:

```text
Transaction indexing is disabled
```

This error may be nested in `error.data`, not only `error.message`. Treat it as an unknown post-broadcast result, not as proof that the transaction failed. Recover through chain state:

- after store code, search code metadata by creator and checksum;
- after instantiate, search contracts by creator and verify code ID, creator and label;
- only retry the write if the expected state is not visible after bounded polling.

This avoids duplicate transactions when broadcast succeeded but RPC result lookup failed.

### Use legacy-compatible REST pagination

UNI-7 rejected the CosmWasm code query using `pagination.reverse=true` with HTTP 400. Use forward `next_key` pagination instead:

```text
/cosmwasm/wasm/v1/code?pagination.limit=100
/cosmwasm/wasm/v1/code?pagination.limit=100&pagination.key=<encoded next_key>
```

Set a page safety limit and stop when `pagination.next_key` is empty.

### CosmWasm data hashes may be hexadecimal

UNI-7 returns `code_infos[].data_hash` as a 64-character hexadecimal SHA-256 value. Other APIs may expose Base64. Normalize both representations to lowercase hexadecimal before comparison.

Misreading UNI-7's hexadecimal value as Base64 caused the first successful upload not to be recognized and produced the duplicate code ID 115.

### REST error details matter

For a non-2xx REST response, retain a short, whitespace-normalized response body in the displayed error. An HTTP status alone was insufficient to distinguish incompatible query parameters from unavailable endpoints.

## Safe browser deployment sequence

1. Fetch the shipped Wasm and verify its SHA-256 against the reviewed checksum.
2. Search all code pages for the connected creator and normalized checksum.
3. Upload only if no match exists.
4. If RPC indexing fails, poll the code REST endpoint for the expected state.
5. Search contracts created by the wallet and verify code ID, creator and exact label.
6. Instantiate only if no verified match exists.
7. If RPC indexing fails, poll the contract REST endpoints for the expected instance.
8. Query contract config; unpause only when still paused.
9. Query config again and require `paused: false` before presenting success.

## Operational rule

Never automatically rebroadcast a transaction solely because RPC transaction lookup failed. State-based, idempotent recovery is required first. Cache-bust frontend JavaScript after changing deployment logic so browsers do not continue executing an older recovery path.
