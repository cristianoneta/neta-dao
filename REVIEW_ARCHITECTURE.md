# Review Architecture

## Sources of truth

| Data | Source of truth | Mutability |
| --- | --- | --- |
| Private draft | Browser `localStorage` | User can replace/delete |
| Public proposal review | UNI-7 workshop contract | Revisions/comments append-only |
| Finalized review | UNI-7 workshop contract | Terminal; hash computed on-chain |
| Operations governance result | Juno mainnet DAO proposal module | Read from chain |
| Native Juno governance | Juno mainnet `x/gov` | Read-only in this frontend |
| Delivery/Contributors | UX concepts | No execution authority |
| Treasury balances | Read-only Juno and Osmosis snapshots | Collector-generated |
| Treasury forecasts/commitments/runway | UX sample data | No execution authority |

## Trust boundaries

- Wallet identity and eligibility are re-queried from the selected workshop contract.
- Operations and Juno use separate access policies.
- The frontend never grants membership or stake eligibility.
- Public reads work without a wallet.
- Mainnet Juno submission and voting stay disabled.
- Treasury collection is read-only; the frontend has no treasury execution authority.
- A DAO proposal ID cannot be self-asserted as submitted; `MarkSubmitted` fails until verifiable forwarding or chain-query validation is implemented.

## Review lifecycle

1. Create and optionally save a private local draft.
2. Publish the first immutable public revision on UNI-7.
3. Add titled discussion threads, replies and further immutable revisions.
4. Finalize only the latest revision.
5. The contract computes and stores the revision hash and closes discussion.
6. A separately reviewed adapter may later create and verify the mainnet proposal.

## Contract operations

- Instantiation starts paused.
- Attached funds are rejected.
- Owner changes require proposal and acceptance by the new owner.
- Migration records and checks the prior contract identity.
- Moderator and block-list removal deletes obsolete storage records.
- Queries are cursor-paginated; the frontend follows all pages.

## Verified deployment state

The canonical Juno Governance community-review contract is deployed and unpaused on
UNI-7 at `juno18d3mzk3ver06zfr5nf752aycss75vtcqd8fsdcuuzmh5mzj4cm6qrgx3fw`
using code ID `114`. The address is committed as the Juno DAO registry entry in
`neta-governance.js`; it is no longer browser-local scaffolding.

The Operations workshop remains the legacy UNI-7 contract at
`juno1d2xdlvy23am07twe046zzxxndjtccgpwwl3pyu5g98u07qu3nyqqkaz65h`.
Neither workshop contract authorizes native Juno mainnet submission or voting.

## Remaining gates

- Run focused publish, revise, threaded-comment and finalize smoke tests whenever
  review-contract behavior changes.
- Keep native Juno submission and voting disabled until exact messages, simulation,
  verification and recovery behavior have been separately reviewed.
- Keep Treasury execution disabled; the next Treasury phase is read-only historical
  cash flow, recurring income/expenses, proposal-linked obligations, milestone
  payments, price history and runway.
