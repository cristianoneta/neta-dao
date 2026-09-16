# Proposal Review Architecture

## Product boundary

The current GitHub Pages MVP exercises the complete review interaction locally. It must not claim that a locally published draft is shared with other DAO members.

The production review system will use a hybrid model:

- proposal bodies, version snapshots, threads, replies, and author decisions live behind a versioned API;
- every write requires a wallet challenge and a verified Juno signature;
- the API resolves current voting power against the whitelisted DAO core before accepting member writes;
- immutable version hashes can later be anchored on Juno without putting every comment body on-chain;
- transaction execution remains exclusively in the DAO's existing on-chain proposal flow.

## Core records

### Proposal

- `id`
- `dao_id`
- `author_address`
- `status` (`draft`, `published`, `frozen`)
- `current_version`
- timestamps

### Proposal version

- `proposal_id`
- monotonically increasing `version`
- immutable title, summary, body, and action snapshot
- required change note after version 1
- content hash
- author address and timestamp

### Review thread

- `id`
- `proposal_id`
- root author address
- version and section anchor
- status (`open`, `incorporated`, `not_incorporated`)
- optional author decision reason and decision version
- timestamps

### Reply

- `id`
- `thread_id`
- member address
- body and timestamp

## Authorization

- Reading published drafts and discussions is public.
- Creating threads and replies requires current positive voting power in the selected whitelisted DAO.
- Publishing and revising requires the proposal author to remain a DAO member.
- Only the proposal author may change a thread decision status.
- A decision never deletes, hides, locks, or moderates a thread.
- The frontend owner-testing override is forbidden in the production API.

## Integrity rules

- Versions are append-only.
- Replies are append-only; corrections become a later reply.
- Decisions are auditable state transitions and retain their reason, author, time, and proposal version.
- Threads remain linked to the version and section that existed when feedback was submitted.
- The client presents root threads and proposal revisions as a single chronological event stream. Version 1 remains the baseline document; revisions from version 2 onward can render word-level additions and struck-through deletions directly inside the title, summary, and body.
- Rate limits and maximum body sizes are enforced by the API, not only by the browser.
