# NETA validator profiles

Public profile contract for the NNS v2 identity interface, deployed on UNI-7
and connected to the separate Names test lab.
See [the implementation checkpoint](../../docs/NNS_VALIDATOR_PROFILES_2026-10-04.md)
for product scope, exact trust boundaries, test commands and deployment gates.

This contract does not sell names, assign delegation points, query remote chains,
or modify delegations. An active name from the pinned **v2** registry is required
to update public contacts and link operator keys. Both operator accounts sign the
exact ADR-36 challenge; one-to-one bindings, lifecycle changes and revocation are
enforced by the contract. Legacy `neta-names` v1 is not a compatible registry.

Deployment identities, owner-test post-states and validator UI release evidence
are recorded in the [current NNS handoff](../../docs/HANDOFF_NEXT_CHAT_NNS_2026-10-04.md).
Real consenting-operator E2E remains open; automated proof tests use synthetic
keys/adapters. Mainnet activation is disabled. Multisig/contract operator accounts
need a separate adapter.
