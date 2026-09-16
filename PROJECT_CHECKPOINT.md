# NETA DAO Workshop Checkpoint

Updated: 2026-09-16

## Resume instruction

In a new chat, start with:

> Read `PROJECT_CHECKPOINT.md`, `README.md`, and `REVIEW_ARCHITECTURE.md` in `cristianoneta/neta-dao`, then continue the NETA DAO Workshop from the documented next step. Do not add new product features without confirming them with me first.

## Repository and deployment

- Repository: `cristianoneta/neta-dao`
- Production URL: `https://dao.netareborn.com`
- Hosting: GitHub Pages from `main`
- Current implementation: static HTML, CSS, and browser JavaScript
- Current storage: browser `localStorage` under `neta-dao-workshop-mvp-v2`
- Selected chain: Juno mainnet (`juno-1`)

## Product decision

The product is a focused DAO proposal workshop, not a complete DAO DAO UI fork. Its primary job is to improve proposals collaboratively before they enter the existing on-chain governance system.

Only explicitly reviewed DAO configurations are supported. The initial workspace is **NETA Operations**.

## Reviewed DAO configuration

- Name: NETA Operations
- DAO core: `juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl`
- Membership adapter: `cw4-voting`
- Membership check: live `voting_power_at_height` query against the DAO core
- Temporary local owner-test address: `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`

The owner override is frontend-only test scaffolding. It must never be accepted as authorization by a production backend or contract.

## Agreed proposal lifecycle

1. **New Draft** — write a proposal privately.
2. **Save Locally** — create an immutable local revision snapshot.
3. **Publish for Review** — expose the proposal to DAO members for review.
4. **Discuss + Revise** — members create titled threads and replies; the author creates V2, V3, and later revisions.
5. **Finalize** — lock the exact final version intended for submission.
6. **Submit On-Chain** — create the real DAO proposal and begin the vote.

The frontend now visualizes these six stages and updates the current/completed states. In the local MVP, “Publish for Review” only opens a local preview. It does not yet share anything with another browser or wallet. The on-chain submission button is deliberately disabled.

## Implemented UX and behavior

- Compact workbench instead of a marketing-style hero.
- DAO workspace selector with whitelisted configurations.
- Keplr connection, wallet menu, address copy, and disconnect.
- Live membership verification plus clearly labelled owner test access.
- Private local drafts and append-only revision snapshots.
- First save uses **Save Draft Locally**; later saves use **Save Revision Locally**.
- Proposal title, 300-character summary, full body, change note, and executable actions.
- Supported draft actions: native bank send, CW20 transfer, and Juno CosmWasm execute.
- Transaction code remains collapsed behind an explicit control.
- Version 1 always remains the original proposal at the top of the review.
- A notice links to the newest revision when later versions exist.
- Discussion threads and V2+ revisions share one chronological activity stream.
- Threads have user-defined titles, replies, and statuses: open, incorporated, or not incorporated.
- Only the proposal author may record a thread decision; incorporated/not-incorporated decisions require a reason.
- Each revision expands in place.
- Word-level inline comparison shows deletions in red with strikethrough and additions in green.
- Finalization replaces the old “Freeze” language, locks editing and discussion, and marks the proposal ready for the future submission adapter.
- Old locally frozen drafts are still rendered as finalized review records.

## Recent merged work

- PR #7 — chronological proposal review feed
- PR #8 — inline proposal text changes
- PR #9 — state-aware proposal lifecycle

## Security and integrity decisions

- Published proposal reading should eventually be public.
- Writing threads/replies requires a current DAO member.
- Publishing and revising requires the proposal author to remain eligible.
- Versions and replies are append-only.
- Thread decisions do not moderate, hide, or delete member feedback.
- Untrusted content must be rendered as text, not injected as HTML.
- The inline diff has a bounded comparison workload to avoid blocking the browser on very large edits.
- On-chain execution remains within the DAO's governance contracts; the workshop must not directly move treasury funds.

## Current hard boundary

The UI is a functional interaction prototype, but all proposals, revisions, threads, and replies remain in one browser. Other DAO members cannot see them yet. No proposal can currently be submitted on-chain from this frontend.

Do not describe local publication as shared publication. Do not enable the on-chain button before the exact proposal-module messages, authorization model, simulation, and transaction review have been verified.

## Next agreed step

Design and implement the persistent workshop layer so published drafts and discussions can actually be shared.

Proceed in this order:

1. Re-inspect the live NETA Operations DAO DAO modules and identify the exact proposal module, voting module, pre-propose configuration, and execute-message schema.
2. Decide the smallest production persistence architecture: a dedicated versioned workshop contract, a signed backend API, or the documented hybrid. Keep execution in the existing DAO proposal flow.
3. Specify wallet challenge/signature authentication and server-side/on-chain membership checks. Never trust the owner frontend override.
4. Specify immutable records, indexes, pagination, limits, rate limiting, and recovery/backup behavior.
5. Review the architecture with the user before writing or deploying contracts/backend services.
6. Only after approval, replace local publication with shared persistence.
7. Add and test the final DAO DAO submission adapter last.

## Explicitly deferred

- Treasury dashboard and treasury management
- IBC transfers
- Osmosis cross-chain accounts and swaps
- AI proposal generation
- Review-role systems or temperature checks
- General support for arbitrary, unreviewed DAOs

These are not part of the current MVP unless the user explicitly approves them.

