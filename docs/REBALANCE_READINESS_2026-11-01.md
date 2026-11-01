# Rebalance submission and execution readiness — 1 November 2026

Source correction; a separate manual website release is required. No contract
migration, collector installation or mainnet transaction is included.

## Problems corrected

Native submission passed the current block height but omitted its time from the
staking preflight. Fixed-allocation periods therefore failed validation even when
active. Both independent source checks now pass the queried block time; a changed
fixed-allocation window still blocks submission and additional funding.

The real local Juno regression also exposed a query-shape mismatch: the SDK puts
redelegation entry responses beside the identity-only `redelegation`, with each
completion date under `redelegation_entry`. The parser now reads that structure.
Malformed entries fail closed; incoming locks and maximum entry counts are retained.
The collector already preserves the original query response and needs no update.

A real execution also reproduced the SDK deleted-source edge case: redelegating
all remaining tokens from an unbonded validator removes its record before the
SDK reads it again, failing the entire proposal. Fresh chain status and the total
outgoing redelegation now block that case before signing. Approved targets are
never silently altered to leave dust. A separate unbonding plan needs review.
The regression preserves this failure and checks atomic rollback; the successful
large-plan fixture gives donor validators an independent delegator.

The previous proposal duplicated its complete frozen calculation in native text.
An observed 41-movement candidate used 9,819 native text bytes and 9,753 workshop
body characters. Its full-deposit local simulation, including the existing 1.4 gas
buffer, exceeded the unchanged 5,000,000 submission ceiling. Successful reward
submission tests had not covered this larger execution envelope.

## New proposals

New Rebalance drafts use `cosmoot-execution-reference-1`. Native governance receives
an understandable summary, an exact finalized workshop reference, and **every
executable staking message**. It does not execute a URL or fetch off-chain actions.
The reference binds chain, workshop contract, review ID/revision, content hash,
policy hash and complete execution-review hash. Both chain sources independently
resolve the exact revision and compare native title, summary, metadata and messages.
A withdrawn review cannot start a new submission; existing native decisions remain
readable against their immutable revision.

The summary states the approved rule proposal, movement count, JUNO to redelegate,
liquid JUNO to stake, JUNO to begin unbonding, fixed targets when space allows, and
that rules remain unchanged. Native text explains authorization and the distinction
between immediate staking actions and delayed unbonding. The linked allocation
view retains exact amounts, criteria, points, exceptions and fixed obligations.
After submission the same pinned link opens the verified native voting view.

The workshop retains the full frozen evidence. Transport version 3 compresses the
same canonical packet, uses bounded Z85 encoding with a checked length/padding,
and serializes actions without pretty-print whitespace. No observations, scores,
mandates or movements are removed. The full decoded review hash is unchanged.
Formats 1 and 2, historical rule schemas and their native payloads retain their
original meaning. Existing finalized reviews are never silently rewritten; create
a fresh Rebalance after the approved rule and current observations are available.

The audited 41-movement candidate now has 1,374 native text bytes, 8,723 workshop
body characters and 13,650 actions characters. These are measurements of that dated
candidate, not a universal capacity guarantee or approval of its pending rules. With the actual
new referenced content, its local submission simulation is 2,674,751 gas for a
partial deposit and 3,144,872 for a full deposit; including the 1.4 buffer,
3,744,652 and 4,402,821 respectively. Both fit the unchanged ceiling. The local
account is funded; this is not a mainnet execution claim.

## Limits and validation

The shared workshop limits are 100 title, 300 summary, 10,000 body and 20,000 action
Unicode characters. New execution generation, draft import and editor validation
use the same limits. The separate native text budget is 10,000 UTF-8 bytes, an
application budget rather than a claimed Juno chain character limit. Transaction
size and gas remain separate; the existing submission fee policy is unchanged.
Overlarge evidence blocks the draft without deleting information.

Regression coverage includes schema-9 referenced rule approval with fixed targets,
publication/finalization binding, native preflight, additional deposit checks,
fixed-date boundaries, mismatched/missing provider evidence, tampering, historical
formats, a published Z85 vector and malformed encodings. Portfolio fixtures cover
37, 55 and 58 held positions; an oversized complete portfolio is blocked.

The required local Juno v31 regression uses original deployed DAO DAO bytecode and
the released workshop bytecode with synthetic accounts, balances and histories.
It checks approval separately from staking execution, runs production submission
serialization/fee calculation for partial and full deposits, and compares resulting
delegations and liquid reserve. Existing corrected claims, non-unit shares,
transitive-redelegation failure, atomic rollback and Community Pool checks remain.
The full local suite passed with a 45-movement, 12-fixed-target execution. Target
balances and 301,000,000 ujuno of additional unbonding were checked, including
bounded share rounding and the 50 JUNO reserve. Full-deposit submission used
3,000,818 simulated gas before the 1.4 buffer. The deleted-source failure was
reproduced separately and rolled back atomically.

Local checks passed: 458 JavaScript tests, 242 Python tests (14 environment skips),
formatting, lint, type checks, repository/artifact checks and the Pages build.
Browser acceptance exercises fixed-target review, native submission guards, pinned
navigation and 320/1440 px layout. Current CI results determine release readiness.
The unrelated hierarchy and Treasury browser fixtures fix their clocks to the
month of their existing October receipts, preserving monthly and future-period
assertions across the November rollover.

Passing a local execution does not guarantee a future mainnet proposal: balances,
validator state, authority, staking locks and fixed periods must be checked again.
Fixed dates describe the approved observation window; the existing DAO contract
does not cancel transactions when a date expires during voting.

## Primary format references

- [Cosmos SDK query response definition](https://github.com/cosmos/cosmos-sdk/blob/v0.53.7/proto/cosmos/staking/v1beta1/staking.proto)
- [SDK redelegation response construction](https://github.com/cosmos/cosmos-sdk/blob/v0.53.7/x/staking/types/delegation.go)
- [SDK Unbond/BeginRedelegation source](https://github.com/cosmos/cosmos-sdk/blob/v0.53.7/x/staking/keeper/delegation.go)
- [Z85 specification and published vector](https://rfc.zeromq.org/spec/32/)
- [Governance execution boundaries](GOVERNANCE_EXECUTION_SEMANTICS.md)
