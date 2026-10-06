# Juno Treasury onboarding — 2026-10-06

## Identity and scope

Display name: **Delegation Programme** (British English). On-chain config name:
**Secondary Community Pool**; original contract label: **Council**. Core:
`juno1nmezpepv3lx45mndyctz2lzqxa6d9xzd2xumkxf7a6r4nxt0y95qypm6c0` (code 4047).
Read-only adapter; the directory does not grant any new signing permission.
Juno's main unit is named **Community Pool**, remains first, and keeps the stable
`?dao=juno&subdao=main` route. `?dao=juno` consolidates these two units.

## Holdings evidence

Public-state inspection: [read-only run 37473502144](https://github.com/cristianoneta/neta-dao/actions/runs/37473502144).
Final priced collector validation: [run 37475015072](https://github.com/cristianoneta/neta-dao/actions/runs/37475015072).
At the collector observation (see the generated snapshot for the exact height/time),
observed holdings were approximately 2.917m available JUNO, 15.000m delegated JUNO,
3.830m claimable JUNO rewards, no unbonding, 2.097 available ATOM plus 0.140 claimable
ATOM rewards, 0.001403 USDC, and 686.021124 BTSG. The exported height/time and latest
collector output supersede these rounded historical observations.

BTSG identity: Juno denom
`ibc/008BFD000A10BCE5F0D4DD819AE1C1EC2942396062DABDD6AE64A655ABC7085B`.
The observed v10 denomination is `transfer/channel-17/ubtsg`; its SHA-256 is checked.
The [chain registry channel record](https://github.com/cosmos/chain-registry/blob/master/_IBC/bitsong-juno.json)
links that channel to `bitsong-2b`, and the [BitSong asset metadata](https://github.com/cosmos/chain-registry/blob/master/bitsong/assetlist.json)
sets six decimals. The reviewed pricing entry is scoped to Juno's exact denom.
No price is inferred for unknown ticker/route combinations. ibc-go v10's
`/ibc/apps/transfer/v1/denoms/{hash}` is supported when the old trace route is unavailable.

The collector checks core code/name, voting and enabled proposal module identities;
queries money state at a confirmed fixed height; paginates native balances,
delegations/unbonding and the DAO CW20 list; verifies reward totals. Native delegation
balances already contain redelegating stake. Claimable rewards are truncated per
validator to avoid counting unwithdrawable dust. External withdrawal destinations
are excluded and flagged. Empty CW20 list was observed, not assumed forever.
Unlisted contracts, NFTs and unrelated DeFi positions are not discovered.

## Accounting and refresh

The existing 15-minute Treasury workflow also runs `update_delegation_treasury.py`.
It owns `juno-delegation.json`, `juno-delegation-history.json`,
`juno-delegation-events.json` and `juno-delegation-accounting.json`. Keep generated
records; do not edit amounts manually. Snapshot history follows the shared daily
policy. Failed collection retains prior evidence. The source is independent of
Operations' cross-chain custody.

Transactions start at 1 October 2026 UTC. The initial scan found one recorded
transaction; this is provider-index coverage, not proof of full activity. Staking
accrual/slashing/module reconstruction and historical USD pricing remain incomplete.
Accrued rewards count as holdings, never automatically as operating income.

## Community Tax

The native parameter is **Community Tax**, `community_tax`, observed **0.10 / 10%**.
The native collector stores its source and observation time. Community Pool Income
expands into **Community Tax** and **Other income**; the account is included in Juno
consolidation and absent from unrelated DAOs.

The deployed node reported Juno v30.0.0 / Cosmos SDK v0.53.7. The
[distribution allocation implementation](https://github.com/cosmos/cosmos-sdk/blob/v0.53.7/x/distribution/keeper/allocation.go)
allocates the validator share after Community Tax and assigns the remainder to the
pool. Distribution includes minting and transaction fees, plus rounding effects.
Current parameters are not historical receipts. No complete daily block accruals,
drips/payouts or immutable payment-time prices are claimed. Consequently Community
Pool and consolidated Juno P&L totals remain unavailable instead of fabricated zeros.

## Validation and release

PR [#183](https://github.com/cristianoneta/neta-dao/pull/183). Local Node/Python checks,
hosted collector and browser tests cover unit selection, separate custody,
consolidated totals, non-JUNO assets, reward truncation, wrong-address rejection,
incomplete P&L and 320/390/768/1440px layouts. Merged as
`33ef6db9da688c75be1dd323dcab94b96735ffd4`. Main CI
[37475921659](https://github.com/cristianoneta/neta-dao/actions/runs/37475921659),
production collector [37475921767](https://github.com/cristianoneta/neta-dao/actions/runs/37475921767)
and Pages [37476007738](https://github.com/cristianoneta/neta-dao/actions/runs/37476007738)
passed. The deployed snapshot at height 42,428,202 is LIVE; ten served application
files matched reviewed source and production UI confirmed both units and the
income split. See the [published handoff checkpoint](HANDOFF_NEXT_CHAT_2026-10-06.md)
for dated balances, deployment commit and next work. No wallet transaction occurred.
