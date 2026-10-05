# NETA Names — implementation boundary

Pricing amended by the owner on 2026-10-05: annual USD 99 / 19 / 5 for 3 / 4 /
5–32 characters. Existing registries require an explicit admin tariff update;
the deployed bootstrap code and historical signed fixtures are unchanged.

Updated 2026-10-04. The authoritative product specification is
[NETA_NAMES_V2_PLAN.md](NETA_NAMES_V2_PLAN.md). The earlier v1 pricing and ownership
model is superseded. Do not activate v1 as if it implements the accepted v2 plan.

## Current user interface

Names is integrated into RELAY: Inbox, Directory, Contacts, My profile and .neta
name share one persistent heading and navigation. Use `index.html#relay/directory`.
Legacy `#names`, `#relay/names` and `#relay/following` redirect there. There is no
separate preview experience or nested Names menu.

Directory search, supported DAO details/address copy, browser-local follow controls
and the USD fee calculator work. Contacts and profile writes are not connected. The 2026-10-04 profile slice adds
an explicitly unpublished in-memory contact/validator preview; see
[NNS validator profiles](NNS_VALIDATOR_PROFILES_2026-10-04.md). Its profile contract
and ADR-36 adapter are tested source, not a configured production service.
Registration, renewal, transfer, DAO profile proposals, lifecycle notifications and
payments are unavailable. The fee calculator is neither an availability check nor
a live NETA quote. See [integration details](NAMES_MAIN_PAGE_INTEGRATION.md).

## Legacy code, inactive

`names.js` has `REGISTRY=null`. Its prepared handlers target `juno-1` and pin the
exact NETA token address and configured treasury. `contracts/neta-names/` is the
v1 source: fixed 5-NETA first year, admin-set renewal price and 30-day grace. These
are legacy implementation details, not the accepted current commercial offer.
The separate manifest-driven UNI-7 v2 lab is wired and deployed; this inactive
v1 module is not its adapter. Metadata checks alone do not verify deployment.

## Separate UNI-7 test workspace

`names-v2-lab.html` verifies the reviewed deployment manifest and supports mock-NETA
registration/renewal, transfers, public contacts and validator proof publication,
unlink and revocation. Owner name tests are complete; consenting-validator E2E is
open. See [current test handoff](HANDOFF_NEXT_CHAT_NNS_2026-10-04.md). This does not
activate production constants or the main workspace's write controls.

## Accepted product scope

- Register AND renew: USD 99 for 3 characters, USD 19 for 4, USD 5 for 5+;
  settle in NETA from a fresh quote using the existing JUNO/NETA reference pool.
  Labels have 3–32 characters; 1–2 are unavailable. Fees go to the NETA DAO treasury.
- Explicit ownership transfers, 1–5-year terms, maximum five years remaining,
  expiry generations and 30-day exclusive renewal grace.
- One preferred chain also determines the receiving network. Start with verified
  Juno records; add Osmosis and explicit IBC routing only with supported adapters.
- Free DAO identities under `.dao.neta`, stable deterministic allocation and
  separate directory-verification / DAO-confirmation evidence. DAO profile changes
  become executable proposals authorized by the DAO, not unilateral member edits.
- Private contacts and public profiles are different records. Membership badges
  need chain/module evidence. Lifecycle notifications must be generation/owner-aware.

The v2 plan owns the precise allocation, quote binding, renewal reminders and
security requirements. Normalization, tariffs, lifecycle, quotes and the UNI-7
wallet path now exist. Resolve production price policy, feeds, service custody and
mainnet deployment before enabling real-NETA purchases.

Activation requires reviewed v2 source/schema, verified registry/token/treasury/code
identities, replay-resistant quotes, transfer and expiry tests, deployment evidence,
and wallet-confirmed end-to-end testing. Never enable writes through a UI change.
