# NETA Names v2 — decisions and first implementation slice

2026-10-03. This document records the owner's decisions from the Names planning
session. It supersedes the v1 product choices below, not the current deployment
inventory. See `NETA_NAMES_DESIGN.md`, `CURRENT_STATE.md` and `HANDOFF.md` for the
still-disabled production registry. No v2 contract or pricing service is deployed.

## Current implementation

The owner rejected the separate preview mode. PR #114 integrated Names into the
main application, #115 flattened RELAY navigation, and #116 unified its persistent
heading and cards. Entry: `index.html#relay/directory`; Contacts, My profile and
.neta name are direct RELAY sections. The old prototype redirects into this UI.

Directory search, supported DAO details/address copy, browser-local DAO follows
and the USD fee calculator work. Registration, renewal, transfer, profile writes,
contact persistence, DAO profile proposals, lifecycle messages and payments remain
unavailable. The calculator does not check availability or quote NETA. No v2
contract or quote service is deployed; `names.js` still has `REGISTRY=null`.
See [the main-page integration](NAMES_MAIN_PAGE_INTEGRATION.md).

The previous prototype review is historical evidence, not the current production
capability inventory. The accepted decisions below remain the implementation target.

## Accepted product decisions

### Personal names

- Allowed label length: 3–32 ASCII characters, with lower-case letters, digits and
  interior hyphens. Normalize case. Block 1–2 characters and reserved system labels.
- Prices per year for registration AND renewal: USD 640 / 160 / 5 for labels of
  3 / 4 / 5+ characters. Eliminate v1's fixed initial 5-NETA charge.
- Settle in NETA; all name fees go to the configured NETA DAO treasury, distinct
  from the Operations DAO. Gas is additional and must be displayed separately.
- One active personal name per owner initially, with explicit transfer support.
- Initial term 1–5 years; renewal max five years remaining. Active names extend
  from expiry; grace-period renewal starts at the current block time. Define year
  as 365 days in the contract and show an exact timestamp in the UI.
- Retain 30-day grace. Resolution is inactive after expiry, exclusive renewal
  remains during grace, and re-registration afterward creates a new generation.
- Allow third-party renewal payment without changing ownership or profile.

### Price quote integrity

- The owner explicitly chose the existing JUNO/NETA pool as the initial sole
  NETA reference. Do not require another NETA market or change the source silently.
- Derive NETA/USD using that pool and a fresh JUNO/USD reference. Verify exact pool
  and token identities, decimals, positive reserves, timestamps and rate units.
- Fresh data are required when purchasing/renewing; Treasury JSON is not a
  transaction oracle. Determine freshness and jump thresholds before activation.
- Proposed mechanism: an automated service signs a short-lived quote (initial
  design target five minutes), verified by the registry. Bind registry, chain,
  operation, payer, owner, label, registration generation, term, tariff version,
  integer amount, nonce and validity. Prevent replay and cross-operation reuse.
- Price signing is a declared trust component. DAO-controlled signer rotation,
  key custody, availability, observations retention and failure response must be
  designed before deployment. A price key must never authorize profile transfers.
- Enforce tariff arithmetic and rounding in integer/fixed-point units. Display
  the exact NETA debit. Requote on expiry, not silently after wallet approval.
- Unknown broadcast results require reconciliation; preserve transaction intents
  and commitment secrets before sending and across reloads.

### Names, profiles and receiving chains

- Distinguish owner from chain-specific address records in the data model.
- ONE user-facing preferred-chain setting; it also selects the default receiving
  network. No separate per-token preference control in the first release.
- Only supported chains with valid confirmed addresses can become active receiving
  defaults. No silent fallback or prefix-only address conversion.
- Store exact chain IDs and typed account proofs. Bind proof challenges to the
  name, generation, registry, chain, address, purpose, nonce and expiry. Contracts
  require a contract-authorized action rather than an EOA signature assumption.
- Public profile fields: description, avatar/link references and approved chain
  addresses. Confirm network/source when querying membership. Escape content,
  constrain lengths and URL protocols; do not render arbitrary HTML or SVG.
- Membership badges are derived from supported DAO voting/access modules, not
  self-entered. Distinguish DAO membership, stake and native delegation. Failed
  queries are unknown, never proof of no membership. Show source and observation.
- Private contacts are separate from public on-chain profiles. First release is
  wallet-scoped browser-local storage with export/import; encrypted sync is later.
- Pin contact identity/generation and confirmed addresses. An expired/reassigned
  name or changed owner/address requires reconfirmation before payments.

### Transfer

- Offer / accept / cancel / expiry protocol. Receiver must accept; sender remains
  owner until then. Respect one-personal-name limit at acceptance.
- Preserve paid expiry. Invalidate old address proofs/primary mappings and require
  fresh profile/address confirmation on ownership transfer. No reputation, private
  contacts, tokens, chat history or keys transfer with a name.
- DAO receivers accept by an authorized governance execution. An ordinary wallet
  cannot impersonate a DAO by setting its address in a form.

### Free DAO namespace

- Format `<slug>.dao.neta`, automatically assigned on admission to the reviewed
  supported-DAO directory. No charge, expiry, trading or reassignment to a new DAO.
- Identity key: exact chain ID + DAO core address. Same display names are allowed
  for different identities but resolved names must remain unique.
- Read actual on-chain display name. Remove ONLY one terminal standalone `DAO`,
  normalize to lower case and separators. Keep meaningful `NETA` in the label.
  Example, conditional on the observed contract name: `NETA Operations DAO` becomes
  `neta-operations.dao.neta`. Define Unicode, maximum length and empty-label policy
  before assigning; unresolved cases need directory review.
- If occupied, append a deterministic short digest of the identity; lengthen on
  collision and atomically ensure uniqueness. Existing assignments remain stable
  when a DAO renames itself. Migration requires a verifiable authorized transition.
- Example Operations core (read from current documentation):
  `juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl`.
- Basic badge: DAO. Provenance detail: directory-created vs DAO-confirmed, linked
  to evidence. Neither a name nor a badge is a blanket trust endorsement.
- Directory authority handles initial allocation; after binding, profile/address
  writes must come from the controlling DAO or a narrowly specified migration
  process. Do not grant the price service or directory editor arbitrary rerouting.

### DAO profile proposals

- Member edits fields -> before/after preview + reason -> Create proposal draft
  -> existing Proposals workspace -> actual submission -> voting -> execution.
- Proposal contains exact executable profile update data and expected profile
  version. Text discussion alone is not an executable action. Guard stale drafts,
  mismatched summary/payload and concurrent profile changes.
- Authorization is checked by the profile contract against the DAO core. Frontend
  membership checks are explanatory only. Respect actual proposal/pre-propose
  rules, deposits, network and execution permissions.
- Mainnet review-to-proposal adapter does NOT exist today; add and test it as an
  explicit dependency. Preserve distinction between legacy Operations review
  `voting` on UNI-7 and actual mainnet proposals.
- Profile is unchanged while proposal is draft/review/voting/passed-but-unexecuted.
  Successful on-chain execution advances the profile version and emits an event.

### RELAY system notifications

- Separate verified system events from encrypted personal messages. This work
  does not enable mainnet DMs or imply a shared encrypted DAO mailbox.
- Registration: name, exact expiry, usage guidance and My profile link. Also notify
  renewal, transfer offer/acceptance, and executed DAO profile updates.
- Reminder thresholds: six calendar months, three calendar months, one calendar
  month, 14 days, 7 days, 1 day, expiry, grace end. Specify UTC calendar subtraction
  and end-of-month clamping; display local time. On-chain expiry is authoritative.
- Personal recipients follow ownership/generation; reminders are recalculated on
  extension/transfer. Stop obsolete future reminders, retain relevant history.
- DAO profile confirmations: provable current members, proposer and followers,
  deduplicated. Default first implementation defines current as membership at the
  event's recorded height, when supported. Otherwise explicitly expose observation
  time and retry unknown states; do not claim complete membership delivery without
  coverage. Anonymous/unconnected members see their inbox when connecting.
- Persistent event collection, scheduling and member-resolution/indexing are new
  components. Current RELAY is browser-local polling of proposal sources.
- Idempotent key includes chain/registry, registration generation, event type and
  expiry revision or transaction/event index. Capped UI feed is not durable storage.
- Group events by name, emphasize latest actionable state after long absence,
  keep read state per wallet; no push/email delivery promised. System authenticity
  must be validated against registry events/state, not a supplied sender label.
- After grace: state is released, or re-registered if another owner has claimed it.

### Payments later

- Add NETA Juno/Osmosis routes only after exact CW20/IBC denom and channel identity,
  custody, fees, relaying, receipts and refunds are verified against implementation.
- Use preferred chain by default; show recipient, exact address, origin/destination,
  amount received and fees. Re-resolve before signing and reconfirm changes.
- Separate source confirmation from destination receipt; handle uncertainty,
  acknowledgement failure and timeout/refund completion without silent retry.
- Local transfer when funds and target share a chain. No automatic swap in v1.

## Delivery order and remaining deployment choices

1. Review this interactive UI draft, then integrate accepted layout into existing
   Names/RELAY components with current unavailable states intact.
2. Implement/test price policy and Names contract v2 with synthetic fixtures,
   including boundary expiry, 3/4-character fees, replay and failed CW20 forwarding.
3. Wire a separate UNI-7 registry/mock-token configuration. Test register, renew,
   transfer and forward/reverse resolution. Do not reuse the mainnet token pin.
4. Add free DAO allocation and the executable profile proposal path. Test contract
   senders, unauthorized writes, version conflicts and execution failures.
5. Add durable Names events, reminders, contacts/profiles and membership adapters.
6. Review/verify mainnet artifact, token, treasury, quote authority and actual
   wallet flows before activation. Add Osmosis payments as a separate release.

No additional product decision blocks the prototype. Before live operation we
must concretely choose service hosting/storage and signing-key custody, pin the
USD reference and quote thresholds, and verify DAO identity/recipient coverage.
Names v1 signing remains inactive. The site links to the preview and displays the
planned v2 tariff; contracts, production data and crypto journals are unchanged.


## DAO directory boundary — 2026-10-03

The onboarding integration supplies local directory profiles for Operations,
Neta DAO and Juno governance from `data/dao-directory.json`. Their `.dao.neta`
labels are not on-chain registrations and cannot receive name-based payments.
No registry, fee collector or profile-governance adapter is activated by this
integration. Main DAO Treasury displays NNS revenue as inactive, not zero.
See [the integration record](DAO_ONBOARDING_2026-10-03.md).


## Validator profiles — owner update 2026-10-04

The owner prioritised public contacts and mainnet/testnet validator linking as a
sidequest before continuing Delegation Programme planning. See
[NNS validator profiles](NNS_VALIDATOR_PROFILES_2026-10-04.md) for the source slice
and remaining v2/deployment dependencies. Optional public fields are Discord,
Telegram, X/Twitter, email and homepage. Do not imply verification of contacts.
Both operator wallets must sign a name/owner/generation-bound link; operator
addresses include exact chain IDs. An active paid `.neta` name is a requirement
only for testnet bonus points, never for all delegation candidates. The first
criterion is active UNI-7 consensus membership at the snapshot, without an uptime
minimum. Profile transfers do not transfer validator identity or contribution
credit. Name expiry affects new snapshots, not approved delegation transactions.
The v2 identity API must provide generation and ownership revision even after
expiry; both change exactly as specified in the profile checkpoint.
