# Juno chain governance and DAO DAO execution

Owner requirement, 23 October 2026. This is a required engineering reference;
AGENTS.md requires it for governance, DAO/SubDAO, staking and transaction changes.
Proposal 381 demonstrated why these layers must be checked separately.

## Different decisions, authorities and encodings

| Layer | Authority / meaning | What it does not establish |
| --- | --- | --- |
| Cosmoot community review | Review contract records and freezes the proposed content | No native vote, no control over the programme treasury |
| Cosmos SDK MsgSubmitProposal | The wallet submits and deposits; native Juno governance stores messages | Successful storage or simulation does not execute future messages |
| Native Juno vote and execution | Juno staking-based voting and chain parameters; accepted messages execute later with their required governance authority | A passed vote does not guarantee successful message execution |
| DAO DAO Core | Contract-specific ExecuteMsg schema and stored authorization | Chain support for a module does not imply the contract accepts every CosmWasm enum variant |
| DAO DAO proposal module | Its own voting module, members, thresholds and proposal identifiers | These are not Juno native governance voters, thresholds or proposal IDs |
| Cosmos SDK distribution handler | Executes a correctly routed MsgWithdrawDelegatorReward with the programme as delegator | A contract returning messages is not proof that these handlers succeeded |

A DAO DAO SubDAO is a contract with an admin relationship. Do not infer the
execution path from the product label, treasury label or where it was created.
Read the deployed core code/version, internal admin, enabled proposal module and
voting module. The internal DAO admin and the Wasm migration admin are separate
fields, even when the current addresses happen to be equal.

## Verified programme identities

- Chain: `juno-1`; incident node software Juno v31.0.0, Cosmos SDK v0.53.7,
  wasmd v0.61.15. Verify current software again before an execution change.
- Programme core / delegator / intended withdrawal destination:
  `juno1nmezpepv3lx45mndyctz2lzqxa6d9xzd2xumkxf7a6r4nxt0y95qypm6c0`.
- Native governance module and verified internal admin:
  `juno10d07y265gmmuvt4z0w9aw880jnsr700jvss730`.
- Core code 4047: `crates.io:dao-dao-core` v2.4.0;
  SHA-256 `cf70918a88a9e0654e6b439b8927e8d7897bf113f25909973910682af227e287`.
- Enabled DAO proposal module: code 4054, `dao-proposal-single`;
  voting module: code 4055, `dao-voting-cw4` v2.4.0. These do not run the native
  Juno vote used by proposal 381.

For this programme the native execution path is:
wallet submits MsgSubmitProposal; after an accepted native vote, governance
executes MsgExecuteContract against the programme; the core authorizes its
stored admin using execute_admin_msgs; its emitted messages run as the programme.
The outer MsgExecuteContract sender is governance. The inner distribution
message delegator is the programme. The submitting wallet is neither of those.

execute_proposal_hook is a different route: the core checks an enabled DAO DAO
proposal module as sender. Do not substitute it for native admin execution.
The core's migration admin does not grant execute_admin_msgs permission.
DAO admin execution can bypass the core's proposal pause check; Cosmoot may
nevertheless require an unpaused programme as its explicit product policy.

## Required message representation

Code 4047 rejects CosmWasm DistributionMsg (`distribution`) during JSON parsing,
before authorization or dispatch. Its compiled enum supports `stargate`.
Use CosmosMsg::Stargate with type_url
`/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward`; value is Base64 of
protobuf bytes containing the programme delegator and the reviewed validator.
Do not put protobuf JSON inside value, omit the delegator, use the governance
address as delegator, or mistake base64 JSON in the outer MsgExecuteContract
for the inner protobuf encoding.

Validate exact outer sender, target, zero funds, admin entry point, message type,
inner delegator and each distinct validator. Reject extra fields/messages and
noncanonical or malformed encoding. Verify code checksum, internal admin,
withdrawal address and current delegation set at consistent query heights.
Old published DistributionMsg reviews remain readable with their original hash;
read compatibility never authorizes submitting or financing that payload again.

## Evidence required before enabling a corrected execution

1. Confirm the exact public chain payload and independently reproduce its failure.
2. Compare versioned DAO DAO interface and staking reference implementation.
3. Decode the actual generated protobuf and verify all signer/address boundaries.
4. Run the original deployed Wasm binary and actual Juno chain handlers in an
   isolated local chain, including native governance execution after voting.
   Observe reward movement to the programme and unchanged delegations; reproduce
   rejection of the old format and unauthorized/wrong-delegator messages.
5. Exercise the application review, finalization, signing and pending receipt
   flow. Preserve immutable old reviews and transaction journals.

State the limits: a local execution test proves the tested software and fixture;
mainnet state may change before the vote ends. Simulating MsgSubmitProposal alone
proves neither contract execution nor reward withdrawal. Do not promise guaranteed
execution, substitute mocked success for chain evidence, or remove a failed gate.

The [23 October repair report](PROGRAMME_CLAIM_REPAIR_2026-10-23.md) records the
real Juno execution regression, runtime pins and fixture limitations. The
required `programme_execution` CI job reruns it for source changes and releases.

## Staking execution

Native MsgVote continuation is separate from proposal execution: an explicitly
reviewed pending vote may resend only its identical signed bytes under the shared
account lock. Verify the direct signature, Juno chain/account, original proposal,
fee and unchanged ordered sequence; keep proposal/deadline/balance/wallet checks.
Hash lookup absence never authorizes a new signature or clearing a pending journal.
An explicitly reviewed gas replacement may create a new signature only for the
identical vote body, original account number and exact original ordered sequence.
Verify the higher fee and signature, archive the predecessor, and checkpoint the
new bytes before broadcasting. Never let the SDK select a newer sequence. A
CheckTx rejection is distinct from a failed included transaction; neither a
lookup miss nor one RPC rejection alone permits clearing an uncertain journal.
[Implementation and limits](NATIVE_VOTE_TRANSMISSION_2026-10-27.md).

The checked Rebalance path uses the same governance/admin/Stargate authority
boundaries for MsgDelegate, MsgBeginRedelegate and MsgUndelegate. It binds approved
rules, sufficient calculation evidence and exact movement amounts, and independently
checks current holdings, funds and staking locks. The required local Juno regression
now covers successful staking, unbonding records, non-unit share rates and atomic
rollback after a transitive-redelegation failure. [Specification and limits](REBALANCE_EXECUTION_2026-10-25.md).

## One-time replacement explanation

The first corrected claim after proposal 381 must explain the incompatible old
format and the new explicit programme-bound Stargate withdrawals. Base omission
from subsequent claims on complete, agreed native claim history, not a transient
browser flag or merely opening/discarding a draft. Freeze the explanation in the
reviewed proposal body. Never rewrite the immutable content of proposal 381.

## Community Pool conversion proposal

The one-off DAI template uses a native MsgCommunityPoolSpend inside
MsgSubmitProposal. Governance is the spend authority; the proposal submitter
only supplies the deposit. No DAO DAO contract, admin hook or programme delegation
is involved. The IBC asset is `transfer/channel-71/dai-wei`, with 18 decimals;
460.9 axlDAI is the integer amount `460900000000000000000`.

The template is limited to the exact reviewed denomination, amount and recipient
from proposal 382. URL parameters cannot provide transaction fields. Opening its
link does not connect a wallet or write to the chain. It preserves other drafts,
then uses the existing review, finalization and native submission flow. It has no
permanent site button. Publication and signing recheck the current pool balance,
governance authority and exact IBC trace through independent fresh chain sources.

The required execution regression seeds synthetic Community Pool DAI, passes a
native vote, checks the exact recipient credit and pool debit, and checks unchanged
programme delegations. Repeating the spend without funds must fail at execution
without crediting the recipient. This verifies the native handler only: the later
bridge, USDC swap on Injective and return to the pool are manual operations by the
recipient. They are neither executed nor guaranteed by this governance message.

## Primary references

- https://docs.daodao.zone/dao-management/subdaos/what
- https://docs.daodao.zone/dao-management/subdaos/act-on-behalf-of-subdao
- https://github.com/DA0-DA0/dao-contracts/blob/v2.4.0/packages/dao-interface/src/msg.rs
- https://github.com/DA0-DA0/dao-contracts/blob/v2.4.0/contracts/dao-dao-core/src/contract.rs
- https://github.com/DA0-DA0/dao-dao-ui/blob/d207ac875e6dae23469223687f6fbbc022852f01/packages/stateful/actions/core/actions/ManageStaking/index.tsx
- https://github.com/cosmos/cosmos-sdk/blob/v0.53.7/x/gov/abci.go
- [Incident evidence](INCIDENT_381_2026-10-20.md)
