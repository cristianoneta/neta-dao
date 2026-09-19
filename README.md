# NETA DAO Proposal Workshop MVP

This branch contains the first reviewable frontend slice for `dao.netareborn.com`.

For the current handoff state, agreed product decisions, and the next implementation step, read [`PROJECT_CHECKPOINT.md`](PROJECT_CHECKPOINT.md).

## Included

- Searchable, explicitly whitelisted DAO workspaces with the last selected workspace restored after a reload.
- A separate governance-chain selector filters the available DAO workspaces, allowing the Juno-based tooling to expand to reviewed DAOs across Cosmos.
- Live membership verification through the selected DAO core contract's voting-power query; no stale member allowlist.
- Compact workbench UX with a reviewed-DAO selector and wallet menu.
- A clearly labelled local owner-testing override for the project owner address. This is not an authorization mechanism.
- DAO-scoped local proposal drafts with immutable revision snapshots and mandatory change logs. A saved private draft appears in the proposal index only in the browser that created it.
- An explicit five-step proposal workflow: private draft, local save, review publication, discussion/revision, and combined finalization/on-chain submission.
- A unified proposal index that merges local workshop drafts with the complete live NETA Operations on-chain proposal history, ordered by latest activity. Selecting an on-chain proposal renders its status, text, votes, and execution messages inside the workspace without sending the user to DAO DAO.
- Proposal filters for `All`, `In Progress`, `Approved`, and `Rejected / Withdrawn`.
- Status-backed proposal cards distinguish discussion, voting, passed, executed, rejected, failed, and withdrawn records.
- Open on-chain votes show their remaining voting time and can be voted on with `Yes`, `No`, or `Abstain` through Keplr. The enabled NETA Operations module does not support veto votes.
- Discussion-first review mode: version 1 remains the visible baseline while titled threads and later revisions form one chronological activity stream.
- Each revision can be expanded in place and compared directly with its preceding version using inline additions and struck-through deletions; a prominent notice links from version 1 to the latest revision.
- Flat, titled member discussion threads with replies, status filters, and open-thread counts.
- Author decisions (`open`, `incorporated`, `not incorporated`) with mandatory reasoning and version linkage.
- Native bank sends, CW20 transfers, and Juno CosmWasm execute actions.
- Collapsed human-triggered transaction-code view.
- Local member-gated comments.
- Version comparison and draft freezing.
- Local drafts can be deleted; published workshop proposals are withdrawn instead so their audit history is retained. The workshop contract enforces author-only withdrawal before DAO submission.

## Deliberately not included yet

- Shared/public persistence and on-chain publication.
- The combined finalization/on-chain submission flow is deliberately incomplete until the reviewed DAO proposal adapter is connected. Local finalization remains available for testing within the same final workflow stage.
- Treasury views and management. This is the separately reviewed next phase.
- Submission to the legacy NETA DAO proposal module.
- IBC transfers.
- Osmosis cross-chain accounts or swaps.
- AI generation, review roles, temperature checks, or other unapproved features.

Local browser storage is explicit in the UI. It must not be represented as public publication. The next approved step is a dedicated, versioned workshop contract and adapter after the exact live DAO module interfaces have been verified.

The owner-testing override exists only to exercise this browser-local MVP. Any shared or on-chain implementation must enforce permissions in its contract/backend and must never trust this frontend flag.
