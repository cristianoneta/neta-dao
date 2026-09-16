# NETA DAO Proposal Workshop MVP

This branch contains the first reviewable frontend slice for `dao.netareborn.com`.

## Included

- Searchable, explicitly whitelisted DAO workspaces (initially NETA Operations only).
- Live membership verification through the selected DAO core contract's voting-power query; no stale member allowlist.
- Local proposal drafts with immutable revision snapshots and mandatory change logs.
- Native bank sends, CW20 transfers, and Juno CosmWasm execute actions.
- Collapsed human-triggered transaction-code view.
- Local member-gated comments.
- Version comparison and draft freezing.

## Deliberately not included yet

- Shared/public persistence and on-chain publication.
- Treasury views and management. This is the separately reviewed next phase.
- Submission to the legacy NETA DAO proposal module.
- IBC transfers.
- Osmosis cross-chain accounts or swaps.
- AI generation, review roles, temperature checks, or other unapproved features.

Local browser storage is explicit in the UI. It must not be represented as public publication. The next approved step is a dedicated, versioned workshop contract and adapter after the exact live DAO module interfaces have been verified.
