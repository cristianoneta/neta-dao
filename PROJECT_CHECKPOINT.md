# NETA DAO Workshop Checkpoint

Updated: 2026-09-18

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

Only explicitly reviewed DAO configurations are supported. The initial workspace is **NETA Operations**. **Juno Network Governance** is also available as a deliberately separate native `x/gov` workspace.

## Juno native governance workspace

- Reads proposals directly from the Juno `cosmos.gov.v1` REST API.
- Reads the deposit and voting parameters from chain state instead of hard-coding them.
- Current parameters at implementation time: 5,000 JUNO total minimum deposit, 20% minimum initial deposit (1,000 JUNO), 10-day deposit period, and 5-day voting period.
- Juno drafts use DAO-scoped local storage and do not leak into NETA Operations drafts.
- Native proposal submission and voting are intentionally read-only until the exact `MsgSubmitProposal` / `MsgVote` construction, fee/deposit handling, simulation, and transaction review are verified.
- The funding step is presented in the proposal workspace before submission, because a native Juno proposal begins in deposit period rather than immediately entering voting.
- The community-review workflow is intended to match Operations DAO through draft, publish, discussion, revisions, and finalization.
- Juno community workshop writes require both at least 1 delegated JUNO and at least 1 actively staked NETA. This is separate from the later native proposal deposit.

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
5. **Finalize + Submit** — lock the exact final version and submit it to create the real DAO proposal and begin the vote.

The frontend visualizes these five user-facing stages. Finalization and submission remain separately auditable technical operations, but they are one coherent user step. In the local MVP, “Publish for Review” only opens a local preview. It does not yet share anything with another browser or wallet. Local finalization remains testable; the proposal stays in the final stage until the on-chain adapter submits it.

## Unified proposal index

- The left workspace column is a proposal index rather than a local-drafts-only list.
- It combines local workshop entries with the full live history from the enabled NETA Operations proposal module.
- The default `All` view is ordered by latest activity. Local entries use their latest revision, discussion, decision, publication or finalization timestamp; historical on-chain proposals use their chain lifecycle order/time.
- `In Progress` contains workshop drafts, discussion-phase proposals, ready-to-submit proposals and active on-chain votes.
- `Approved` contains passed or executed on-chain proposals.
- Declined/rejected/closed proposals remain visible in `All`, matching the deliberately limited three-filter design.
- Status labels are normalized to the product vocabulary: `Draft`, `Discussion Phase`, `Ready to Submit`, `Voting Phase`, `Approved`, and `Declined`.
- Selecting an on-chain proposal renders the complete proposal, result, vote totals and proposed execution directly in the existing workspace. The proposal list does not link out to DAO DAO; reducing interfaces is an explicit product decision.

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

## Current UI follow-up

- Discussion threads sit outside the collapsible technical proposal details and remain visible below a selected workshop proposal.
- Every reply can itself be replied to; nested replies remain visible in their conversation context.
- The sticky header uses a balanced DAO selector / network / wallet layout across desktop and mobile.
- Opening the DAO selector always shows every whitelisted DAO before an optional search term is entered.
- A DAO selection is applied and displayed immediately, independently of whether its first network request succeeds.
- The last selected DAO workspace is stored in the browser and restored before the first request after a reload.
- DAO-scoped local drafts appear as private entries in the proposal overview and remain visible only in the browser that saved them.
- The header separates the target Cosmos chain from the DAO workspace. DAO tooling remains Juno-based while the chain selector can later expose reviewed governance workspaces for other Cosmos chains.
- The workflow bar marks completed stages and prominently identifies the current proposal stage.

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
