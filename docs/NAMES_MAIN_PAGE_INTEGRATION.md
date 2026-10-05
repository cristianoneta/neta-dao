# Names inside the main workspace — 2026-10-05

The normal RELAY `.neta name` and `My profile` pages now connect to the existing
UNI-7 registry and profiles contract. The owner asked to turn the tested lab flows
into usable main-page functionality; this does not launch mainnet registration.

## Implemented user flow

- Read test registry loads the pinned `nns-uni7-owner-2026-10-04.json` manifest and
  verifies chain freshness, contract identity/code and configuration with the
  existing reader. No new deployment or manual manifest import is needed.
- Connect/disconnect uses the shared header. Its wallet state is observable by
  Names; DAO read-only views do not block a UNI-7 wallet connection within RELAY.
  Names signing is lazy-loaded for a deliberate wallet action. Each session checks
  the exact wallet again and drops late connections after disconnect/switch.
- Load my name queries the connected wallet's active name, displays its expiry
  and offers renewal. A saved registration restores its fields instead; recovery
  always uses the same registry/wallet intent and exact-hash transaction journal.
- Name availability is a read, not a reservation. Registration separately prepares
  its local secret, reviews/confirms a reservation, then reviews/confirms the exact
  mock-NETA payment. Renewal uses the same signed quote and payment path.
- The fee display reads the actual on-chain tariff. Purchases block until the
  approved annual USD 99/19/5 tariff has been activated by the admin. Test quotes
  still require the original setup browser's non-exportable local key and use
  fictional USD 2/mock NETA. Other browsers can read and manage owned profiles or
  transfers, but cannot create a purchase quote without that existing authority.
- Offer/accept/cancel transfers have separate reviews. The recipient must accept;
  paid expiry is preserved and the previous profile/proofs are invalidated.
- My profile explicitly loads current contacts before editing when requested.
  Publication snapshots all optional fields before disabling controls, checks
  active owner/revision and shows a separate review. Validator address inputs
  remain preview-only and are not included in contact publication.

## Safety and scope

Form edits, routes and wallet changes invalidate reviews, including late read
responses. Unknown transaction outcomes block additional writes and survive
reloads/disconnects. No automatic resend, journal clearing, key replacement,
registration, renewal, profile publication or wallet signature happens on load.
Failed deployment reads disable writes and never substitute sample data.

Mainnet constants remain null; v1 Names handlers remain inactive. The normal
page explicitly labels UNI-7, mock NETA and the local synthetic quote. The lab
remains available for tariff administration and validator verification. Real
validator tests are deferred by the owner.

Directory and follow features remain separate: the three DAO profiles use their
reviewed directory records, and `.dao.neta` labels remain unregistered. No fake
personal directory entries, receiving-address verification, payments, private
contact storage or encrypted messaging are enabled by this integration.

## Validation

The browser integration suite exercises registration, real Ed25519 test quotes,
renewal, public contacts, recipient acceptance, route races, shared-wallet changes,
unknown outcomes surviving reload and 320/390/768/1440 layouts with screenshots.
Wallet execution and chain responses in that suite are synthetic. Existing live
UNI-7 operation evidence is recorded in the NNS handoff; integrated owner-wallet
E2E has not yet been performed. PR/CI/deployment evidence belongs in the release PR.
Native zoom and full assistive-technology coverage remain separate QA.
