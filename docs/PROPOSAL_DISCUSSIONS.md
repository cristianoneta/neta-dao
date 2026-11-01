# Proposal discussions — V1 implementation

Owner direction: a separate, focused discussion page in Cosmoot's graphite/mint
colours. The Phoenix/Discourse reference informs the three-column arrangement and
reading timeline, not a general-purpose forum or additional social features.

Status, 1 November: [PR #335](https://github.com/cristianoneta/neta-dao/pull/335)
is merged; the service and public API are active. Manual website publication and
real Keplr/mobile acceptance remain pending.
The complete application passed all 18 required jobs in
[CI 41296509948](https://github.com/cristianoneta/neta-dao/actions/runs/41296509948),
including the optional Compose overlay and Caddy route.
The separate operational acceptance is recorded below. Testnet reviews keep their
existing comments; V1 indexes the configured public Juno mainnet sources only.

## Operational acceptance — 1 November

The owner confirmed installation, persistence across service restart, current
data from every configured source group and an explicitly selected moderator.
The existing infrastructure backup now includes discussion data and recovery
configuration. A newly downloaded encrypted backup passed an isolated application
restore on the same host: public reading, synthetic ADR-36 sign-in, replies,
idempotency, moderation, durable reply receipts after reopening and SQLite integrity.
The isolated exercise used no network or production writes.

Public API activation passed direct and public TLS checks, both allowed website
origins, rejected foreign origins, body limits, unauthenticated-write denial and
authentication rate limits resistant to forged client-IP headers. Existing services
and production data were preserved. The final moderator/routing configuration was
verified in another fresh backup. Independent external GET requests subsequently
confirmed source freshness, both allowed origins and foreign-origin denial.

These checks establish API readiness. Website publication, actual wallet/browser
acceptance, mobile use and recovery on a different machine remain distinct steps.
Exact installation inventory and backup receipts remain in the private handoff;
do not repeat the completed installation to finish website publication.

## Product contract

- **Join the discussion →** belongs beside the proposal heading, with a reply
  count when nonzero. It replaces the bottom comment pane only after the exact
  source and its historical comments have been indexed. An unavailable service or
  unresolved legacy comment transaction retains the existing view and recovery.
- `/discussions.html?source=…` resolves one canonical topic. Public readers need
  no wallet. Left: proposal history. Centre: proposal summary, revisions, replies
  and composer. Right: mint timeline with current position/total, dates, first,
  latest, keyboard/click/drag navigation, Back and saved reading position. At small
  widths the history collapses and the timeline becomes a fixed horizontal rail.
- A public review creates its topic on the next successful index cycle. Local
  drafts create nothing. New native/DAO proposals without a review create a topic
  too. There is no user-facing create-topic API. A finalized review joins a native
  proposal only when the existing governance parser verifies its frozen content
  and exactly one native proposal matches metadata, title, summary and messages.
  Duplicate or altered matches remain separate. Old thread URLs and post IDs
  continue to resolve after joining; revisions and original comments survive.
- **Connect Keplr** signs a purpose-, domain-, origin-, wallet- and nonce-bound
  ADR-36 challenge. It is an off-chain sign-in, not a chain transaction. Challenges
  expire after two minutes and are consumed once; sessions expire after thirty
  minutes, remain in memory and are revoked on logout. A wallet change clears the
  visible composer and session, while retaining that wallet's local draft.
- The wallet is the permanent author. A currently verified `.neta` name links to
  its public profile; unavailable, expired or transferred ownership falls back to
  the wallet. A different name recorded at posting is labelled historical and
  does not link as though it still belongs to the author. Name observations use
  short caches (up to 90 seconds across layers); a refresh retrieves newer data.
- Each new reply records **bonded JUNO at posting**, with exact micro-unit amount,
  block height and timestamp. Only bonded-validator delegations count. Both
  independent providers must agree at the same height. Missing or inconsistent
  evidence displays unavailable and does not prevent posting. Imported comments
  never relabel historical `verified_stake` NETA values as JUNO.
- Replies, quotations, direct post links and local draft recovery are supported.
  No reactions, direct messaging, free topics, uploads or notifications in V1.
  Text is rendered literally with safe HTTP(S) links. Moderators can hide/restore
  posts, lock/unlock discussions and restrict/unrestrict wallets, always with a
  public reason and audit entry. Original on-chain moderation remains effective.
  Moderator wallets are explicitly configured, with no implicit default owner.

## Service and data

`discussions/server.mjs` is an independent Node 24 service with SQLite WAL and
full synchronous commits. It has no signing key, faucet journal, message-backup
mount or collector-write access. The Docker image reuses only the existing pure
ADR-36 verifier and pinned CosmJS dependency lock; it does not run the encrypted
message-backup service. The browser communicates with
`https://api.cosmoot.com/discussions`; origins are explicitly restricted.

The synchronizer reads native Juno governance, the pinned mainnet community review
contract and proposal modules from the public DAO directory. A non-overlapping
cycle starts sixty seconds after the preceding cycle finishes. Bounded pagination
follows provider/contract cursors through an empty/end page, including contracts
that clamp page sizes. Chain disagreement, incomplete imports or changed recorded
revisions fail closed. Already stored discussions remain readable during outages.
DAO proposal contracts expose creation height rather than wall-clock time; their
history date records first indexing, not an invented original date.

Posting has a 6,000-character limit, one reply per wallet per thirty seconds and
up to twenty per hour. The edge/client-IP boundary, per-IP request limits, bounded
body reads, active requests and identity workers are separate controls. Wallet
creation can bypass wallet-specific limits; moderation and edge monitoring remain
necessary. The service is a single operator-hosted discussion store, not immutable
on-chain publishing. Public reasons are auditable within that store, not a
cryptographic protection against a database administrator.

Every reply carries a wallet-scoped request ID and content digest. A lost response
retains the original request locally; **Check reply status** resolves the durable
receipt after reauthentication. A deliberate retry sends the same request ID and
cannot create another post. SQLite backups include these receipts, revisions,
thread aliases, name/stake observations and moderation records. Session tokens and
challenges are not backed up; recovery requires a fresh sign-in.

## Installation and rollout gates

Generic templates are in `deploy/cosmoot/compose.discussions.yaml`,
`discussions.env.example`, `Caddyfile.discussions.example` and the optional backup
unit drop-in. They are not evidence of a live installation. Exact host actions and
operator inventory belong in the private handoff.

1. Build the reviewed commit's independent image and create an owned private data
   directory for the image's non-root UID. Install the explicit origin and reviewed
   moderator configuration. Validate the combined existing compose file plus the
   optional `discussions` profile; preserve existing backend/network configuration.
2. Start only the new service. Verify persistent storage after restart, all source
   groups, complete comment imports, a real published proposal and exact review-to-
   native joining. `/health` distinguishes process response from fresh source
   readiness; inspect each source, not just the HTTP status.
3. Add the optional absolute `discussions` database field to the existing backup
   configuration and install its sandbox drop-in only after the file exists. Keep
   existing backup paths, credentials and journals. The backup tool exports live
   WAL contents and validates this additional schema, while accepting older
   backups that did not include discussions. Verify an encrypted backup, fresh
   download and isolated application restore before public enablement. No new
   deletion/expiry policy is introduced by this feature.
4. Add the exclusive Caddy `/discussions/*` route and preserve the existing backend
   fallback inside its own `handle`. Check origin denial, client-IP limits,
   TLS, body limits and a synthetic moderation/recovery exercise. Never mount this
   database in the public static-data directory.
5. Publish the website manually from the exact checked source. Verify both website
   domains, a mobile device, Keplr rejection/reconnect and public profile links.
   The proposal CTA appears only for indexed sources. Rollback removes the new
   route/navigation while retaining database and pending-reply storage; do not
   delete either to disable the feature.

## Validation

Backend regressions exercise actual ADR-36 signatures, nonce/origin isolation,
revoked/expired sessions, durable idempotency after reopening SQLite, merge aliases,
immutable revisions, historical moderation, bounded pagination, two-source block
checks, transferred/expired names, bonded versus inactive stake, unknown versus
zero and automatic topic creation with exact-match joining. Navigation regressions
cover late responses, missing service, incomplete migration and pending legacy
transactions. Infrastructure tests cover optional WAL exports and validated restore.

Browser acceptance uses the real local service and a synthetic Keplr signer. It
covers public reading, literal hostile text, profile links, quotes, a deliberately
lost successful POST response, reload/receipt recovery, moderation, wallet changes,
timeline navigation and 320/390/768/1440-pixel layouts. It also joins a review
and native thread while a successful reply is unresolved, preserving an unrelated
local draft and recovering the original receipt under the old URL. CI also imports the service
inside its independent Docker image and validates the combined optional Compose
overlay and Caddy route while preserving existing backend and edge configuration. These checks do not establish live provider,
server, backup or wallet acceptance; the rollout gates above remain separate.
