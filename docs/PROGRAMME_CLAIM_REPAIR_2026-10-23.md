# Programme reward claim repair — 23 October 2026

The corrected claim keeps native Juno governance as the administrator of the
programme's DAO DAO core. It replaces unsupported CosmWasm `distribution`
messages with supported `stargate` messages containing the protobuf
`cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward`. Each withdrawal names
the programme treasury as delegator. The outer contract sender remains native
governance. No contract migration or DAO voting-module change is required.

Read [the required execution semantics](GOVERNANCE_EXECUTION_SEMANTICS.md) before
changing this route. `AGENTS.md` makes this a continuing project requirement.

## Actual chain execution evidence

`scripts/check-programme-execution.mjs` starts an isolated Juno chain with a
fresh ephemeral local test account. It imports the original deployed DAO core
WASM and public contract state, and seeds synthetic delegations/rewards for all
37 validators in proposal 381, including positions outside the active set.
It submits proposals, votes and waits for native governance execution.

| Check | Result |
| --- | --- |
| Original proposal 381 messages | Submission and yes vote succeed; execution fails with the original unknown `distribution` variant error |
| Unauthorized direct core execution | Rejected; programme balance unchanged |
| Stargate withdrawal with governance as delegator | Native execution fails with `contract doesn't have permission: unauthorized`; programme balance unchanged |
| Corrected application-generated withdrawals | Native proposal passes and executes; 37 SDK `withdraw_rewards` events match all 37 validators |
| Destination and staking positions | Programme balance increases by at least the 37,000,000 seeded reward micro-units; every delegation remains unchanged |

Exact runtime pins:

- Juno v31.0.0, commit `de78774eb419f95ba5812d7a3446c4b2516d8f0a`.
- Official Linux binary SHA-256:
  `46fddb2c8c3fadcded48c63f72d88e9452cfd8a1da282892878a9f05d47f873c`.
- Cosmos SDK v0.53.7, wasmd v0.61.15, wasmvm v3.0.8.
- Original DAO DAO Core 2.4.0, code 4047, SHA-256:
  `cf70918a88a9e0654e6b439b8927e8d7897bf113f25909973910682af227e287`.

The received amount also includes local transaction-fee rewards accrued while
the test runs; it is not a prediction of mainnet income. This is a synthetic
state fixture using the original contract and runtime, not a full mainnet fork.
Current mainnet state can change before a future vote ends. No real wallet or
mainnet transaction is used. Test keys and the temporary chain are removed.

CI downloads the pinned binary from the official CosmosContracts/juno release,
verifies its checksum and runs the execution regression as a required job.
To reproduce, install the locked faucet dependencies and run
`node scripts/check-programme-execution.mjs /absolute/path/to/junod`.

## Application behavior

- New claims use only the exact checked envelope and canonical protobuf bytes.
  Independent SDK codecs verify the generated delegator and validator fields.
- Before signing, independent mainnet sources must verify code checksum,
  internal admin, pause policy, withdrawal destination and complete current
  delegation set. Successful submission simulation is not execution evidence.
- Historical reviews retain their original actions, hashes and display. The
  incompatible payload remains blocked for publication, finalization,
  submission and additional funding; receipt recovery remains available.
- The first corrected native claim includes one sentence explaining #381's
  failure and this repair. Complete mainnet history from independent sources
  determines when subsequent claims omit it. Local draft creation/discarding
  does not consume the explanation. Publication, finalization and signing
  recheck the claim context; published reviews are never silently rewritten.

This repair and the already merged review-size correction are intended for one
manual website release. The prior containment was not separately published.
This document records tested source behavior, not a production deployment.
