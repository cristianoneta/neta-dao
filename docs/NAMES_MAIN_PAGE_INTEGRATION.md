# Names inside the main workspace — 2026-10-03

The owner rejected a separate preview mode and requested direct integration before
further polish. The directory is now `index.html#relay/directory`; `#relay/names` remains a legacy alias.
The 2026-10-03 navigation follow-up promotes Directory, Contacts, My profile and
.neta name into the RELAY navigation, alongside Inbox. Following becomes directory
controls with the same saved subscriptions. There is no nested Names tab bar.

- Reuse the actual sticky workspace header, navigation, RELAY tabs and shared
  graphite/mint tokens. Suppress the duplicate RELAY marketing introduction only
  outside Inbox. Inbox keeps its existing introduction.
- Integrate Directory, Contacts, My profile, DAO detail and name fee calculation.
  No iframe, second app shell, preview banner or separate preview launch remains.
- Directory search uses the real Operations DAO and Juno Governance entries.
  The exact core address can be copied. Its proposed .dao.neta name is explicitly
  unregistered and does not imply on-chain identity verification or DAO endorsement.
- Do not present sample people, pretend registrations, fake quotes, fake wallet
  connections or synthetic RELAY confirmations as live user data.
- The USD fee calculator validates 3–32-character labels and applies $640/$160/$5
  per year for 3/4/5+ characters, 1–5 years. It does not check availability, reserve
  a name, determine the current NETA amount or accept payments.
- Contacts, profile editing, renewals/transfers, DAO profile proposals and payments
  stay locally disabled with explanations until ownership/registry adapters exist.
  No new wallet prompts or governance submission are added. Follow controls reuse
  relay.js and its existing local storage and governance reads.
- Existing names.js remains inactive (`REGISTRY=null`), available for existing
  RELAY resolver usage. Its old fixed-fee handlers are not connected to the new
  fee form. Existing pending transaction/crypto/name journals are untouched.
- The old prototype URL redirects to the integrated route. Its CSS/JS are no
  longer loaded by that URL or the main application.

Validation: syntax and local DOM checks; existing browser CI now exercises the
actual main-page Names navigation, fee tiers, invalid labels, HTML injection
resistance, unavailable registration/payments, primary text color and reflow at
320/390/768/1440 px. Both existing frontend/contract and RELAY browser workflows
include names-workspace.js in their path filters. Inspect final run results and
the deployed main route; source tests alone do not establish production activation.

Native browser zoom and full assistive-technology coverage remain separate QA.
