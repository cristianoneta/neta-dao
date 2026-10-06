# Treasury collection from 1 October 2026

Owner decision, 2026-10-06: start accounting for all DAOs on **2026-10-01**;
retain future transactions, avoid older backfill. Boundaries use the existing UTC
accounting convention: `2026-10-01T00:00:00Z`.

## Implementation

- Shared statement and NNS register exclude pre-cutoff receipts. January–September
  2026 are disabled; the 2026 annual choice means October–December. Earlier
  comparisons remain unavailable. Existing archived records are preserved.
- Main NETA and Operations (Juno core plus Osmosis proxy) use a shared REST receipt
  adapter. Empty native-transfer results no longer disqualify a working CW20 index.
  Every configured query is required to succeed before advancing its watermark.
- The first run verifies a recent block before the cutoff, scans from that safe
  floor and filters by exact receipt time. The floor is not claimed to be the
  first October block. Chain identity, tip freshness, bounded pagination, duplicate
  pages, unchanged receipts and block anchors are checked. Failed refreshes preserve
  prior exports. Writes are atomic. No wallet actions or new cron are introduced.
- Routine refreshes resume with a 100-block overlap, 20 blocks behind the tip.
  Daily replay from the accounting floor catches delayed indexing beyond the
  overlap. Page/time limits fail explicitly instead of silently skipping results.
- Failed transaction attempts stay activity only. Native transfers and CW20-shaped
  events are retained; unknown contracts have raw units and unverified identity,
  never guessed decimals or prices. Movement direction does not imply revenue.
- After the main DAO tasks finish, exact NNS Treasury legs are cross-referenced
  against the existing validated payment ledger using chain/hash/message, token,
  counterparty, amount and direction. The receipt is counted once. Other observed
  movements remain unreviewed with no USD value. This cross-reference is **not**
  opening/closing balance reconciliation.

## Boundaries

Full P&L, expenses/funding classification, payment-time prices for non-NNS movements
and opening/closing reconciliation remain unavailable. Public transaction indexes
cannot guarantee every economic movement; block-level/module distributions, omitted
provider events and unsupported token actions are not silently claimed as covered.
Native Juno Community Pool accounting still requires its own adapter. The common
start date applies to it, but this change does not invent a connected transaction
feed or an accounting total. All adapters should use this date when connected.

Main DAO collection remains in its existing 30-minute job, Operations in its
existing 15-minute job; actual freshness depends on successful workflow/provider
runs. A failed source must remain visibly unavailable, including retained records.

## Browser icon

The new mint voxel N favicon follows the graphite/mint design. A generated 512px
source, 16/32px PNGs, 16/32/48px ICO and 180px Apple touch icon live in the repository.
All root HTML pages reference the same assets. No layout or wallet flow changes.
Image prompt: a bold geometric N built from chunky architectural voxel strokes,
mint faces on graphite, strong silhouette readable at 16px, no extra text or imagery.
Generated with the built-in image generation tool; resized only for browser formats.

## Validation and publication

Local validation: 120 Node tests and 43 targeted Python tests passed. Regression
coverage includes the October boundary, empty native versus populated CW20 index,
truncated/duplicate pages, missing known transactions, daily replay, failed receipts,
changed amounts and exact NNS cross-reference. Existing browser tests now verify
that pre-start periods cannot be selected. A read-only local live scan via Polkachu found the real NNS receipt at block
42400450; provider coverage through block 42425219 remained explicitly PARTIAL.
Hosted checks and production collection are still pending; do not treat this document alone as deployment evidence.
