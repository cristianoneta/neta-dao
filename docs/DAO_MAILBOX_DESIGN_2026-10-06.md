# DAO mailboxes and NNS — design decisions, not live

Owner discussion: 6 October 2026. The separate Names inbox filter is removed.
A [source implementation candidate](DAO_MAILBOX_IMPLEMENTATION_2026-10-06.md) now
exists; DAO inboxes are not deployed or mounted. Sending remains disabled on mainnet.

## Confirmed product direction

- DAO reception is opt-in, disabled by default. The DAO chooses its recipients:
  designated members or explicitly all members. Governance membership alone does
  not automatically subscribe everyone to an inbox.
- A shared DAO conversation has one canonical history and shared handling state
  (open, assigned, answered), rather than independent copies per recipient.
- Sending to .neta identities requires an active .neta identity for the sender,
  including messages to DAO inboxes. This needs enforcement outside the UI.
- Group conversations by authenticated sender identity in each receiving mailbox;
  names are display labels, not stable identity keys. Show chronological messages
  in the reader. Block by underlying identity, so renaming does not evade a block.
- Start with blocking, without new product-level sending quotas or additional
  intake restrictions. Grouping reduces list clutter but does not remove storage,
  notification or processing load. Retain existing protocol payload bounds and
  safety gates; do not remove them under this product decision.
- Departed members lose access to future messages and the DAO mailbox disappears
  from their UI. Previously decrypted or archived copies cannot be recalled.
- New members may start with future messages only; access to old history is not
  required. Prefer this simpler initial approach.
- DAO names are assigned during curated onboarding and should not have ordinary
  user transfers. Organizational restructuring requires a reviewed reassignment.

## Proposed compact UI (requires implementation)

Place a labelled mailbox select beside the existing Inbox heading, using shared
graphite controls and mint selection. Options: My inbox, then only enabled DAO
mailboxes the connected account can access. On mobile, put it below the heading;
with no accessible DAO mailbox, omit the redundant selector. Keep existing RELAY
navigation and All / Messages / Governance / Unread filters.

Mailbox selection is separate from the global browsing DAO selector. A selected
DAO does not grant inbox access. Show the current mailbox explicitly in the reader
and any future reply/review. Avoid merging all DAO inboxes into one default view.

For DAO threads only, put the shared handling status and assignee in the reader
header. Keep block/unblock under a conversation actions menu; expose DAO-wide
blocking only to authorized inbox administrators. Individual read markers remain
personal; reading is not the same as assigning or answering a shared conversation.

## Current code findings and security boundary

Operations already has the curated directory name `neta-operations.dao.neta`.
DAO identities come from `dao-directory.js`; `names-workspace.js` explicitly labels
them directory entries, not on-chain registrations. The personal registry's
`policy::name` rejects extra dots and the reserved personal label `dao`, preventing
personal registration or transfer of the literal `.dao.neta` namespace through
that contract. There is no generic DAO registration/transfer record implemented
in this registry. Similar ordinary names can still exist; a DAO badge must come
from the authoritative directory/registry record, never a name pattern or bio.

Future DAO registry records should be explicitly typed and reject ordinary
offer/accept transfer operations. Reassignment should require a defined authority
and auditable process; the procedure is not designed or deployed yet.

Removing an inbox from the UI is insufficient revocation. Future shared encryption
must use membership-aware recipient/key updates, exclude departed recipients from
new encryption, and reject stale membership/key versions. Do not distribute one
unchanging shared secret. A new member can join the next key epoch without
historical keys. Exact protocol and authoritative membership adapters still need
review. Current DAO treasury/reporting relations confer no mailbox authority.

Names must resolve to stable chain/account identities. Transfers or re-registration
must not give a new name owner an old owner's history, permissions or reputation.

## Mainnet verification — 6 October 2026, approximately 17:17 UTC

Queried the configured mainnet registry
`juno1pc8wrq89ljuhu2qt6rtk5lkkrptxajtf3un5llu8prg7r4z50vlszfhhza`
through `https://juno.api.m.stavr.tech`:

- `name_of` for Operations core
  `juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl`
  returned that address with `name: null`.
- `identity` for `neta-operations.dao.neta` returned the contract error
  `invalid or reserved personal name`.

This confirms no active personal-registry name for the Operations core and no
registration of the curated DAO directory name through that registry. It does
not constitute activation of an on-chain DAO name or mailbox.

## Related payment-request concept (not implemented)

Assigned contributors select a project and milestone, attach evidence and submit a
payment request to its DAO. Keep submission, authorized acceptance, preparation of
a payment proposal, governance approval and executed payment distinct. Preserve
the project's agreed amount/asset, show deviations, confirm a fixed recipient,
prevent duplicate claims and reconcile payment only to actual execution. Invoice
attachments may be private; public evidence and proposal data must be separated.
Subaddresses and any pricing model remain future design work.
