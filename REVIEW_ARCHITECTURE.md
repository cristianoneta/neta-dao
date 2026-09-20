# Review Architecture

## Sources of truth

| Data | Source of truth | Mutability |
| --- | --- | --- |
| Private draft | Browser `localStorage` | User can replace/delete |
| Public proposal review | UNI-7 workshop contract | Revisions/comments append-only |
| Finalized review | UNI-7 workshop contract | Terminal; hash computed on-chain |
| Operations governance result | Juno mainnet DAO proposal module | Read from chain |
| Native Juno governance | Juno mainnet `x/gov` | Read-only in this frontend |
| Delivery/Treasury/Contributors | UX sample data | No execution authority |

## Trust boundaries

- Wallet identity and eligibility are re-queried from the selected workshop contract.
- Operations and Juno use separate access policies.
- The frontend never grants membership or stake eligibility.
- Public reads work without a wallet.
- Mainnet Juno submission stays disabled.
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

## Remaining deployment gate

The Juno review address must be deployed from the reviewed Wasm and committed as the canonical `workshopContract`. A browser-local address is test scaffolding, not a shared production registry.
