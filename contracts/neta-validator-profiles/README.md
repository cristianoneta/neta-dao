# NETA validator profiles

Source-only public profile contract for the planned NNS v2 identity interface.
See [the implementation checkpoint](../../docs/NNS_VALIDATOR_PROFILES_2026-10-04.md)
for product scope, exact trust boundaries, test commands and deployment gates.

This contract does not sell names, assign delegation points, query remote chains,
or modify delegations. An active name from the pinned **v2** registry is required
to update public contacts and link operator keys. Both operator accounts sign the
exact ADR-36 challenge; one-to-one bindings, lifecycle changes and revocation are
enforced by the contract. Legacy `neta-names` v1 is not a compatible registry.

No deployed address or mainnet activation is claimed. Tests use synthetic keys and
mock registry data. Multisig/contract operator accounts need a separate adapter.
