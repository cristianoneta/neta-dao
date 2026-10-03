# People: Members and Contributors

Owner decision, 2026-10-03: use the same People section and peer navigation
**Members | Contributors** for every current and future DAO. Contributors is
not live. Its scope and data integration will be designed with the owner later.

## UI and routing

- `#people/members` shows the selected DAO's governance membership source;
  `#people/contributors` shows the shared planned-state page. `#people` and legacy
  `#contributors` resolve to Members. Direct links, reload and browser history
  preserve the chosen subpage. DAO switching preserves that subpage.
- The old Operations sample profiles, tasks and compensation are removed from
  the live interface. They remain in Git history as earlier concept work and
  must not be treated as approved contributors or real assignments.
- Directory profiles link to People/Members. All configured adapters can show
  membership in the profile as well, with the same identity checks.
- Members includes address search, 25-row incremental display, current power,
  percentage of listed power, copyable address/source details, refresh and
  source/height/timestamp. A snapshot older than two hours is marked stale.
- No active NNS registry or identity resolver exists. Addresses remain visible;
  no names or additional wallet relationships are invented. Future name-first
  presentation requires forward/reverse ownership verification against the
  pinned registry and proof for each linked wallet. Contributor permissions
  never follow from a name, a displayed role or staking alone.

## Membership adapters

`data/dao-directory.json` holds `membershipSource` (adapter, file, unit, decimals)
and verified contract identities; regenerate `dao-directory.js` after changes.
New DAOs automatically receive both People subpages. A DAO without a connected
adapter gets an explicit unavailable membership state and the same planned
Contributors view. Configuration does not grant signing rights.

- Main Neta DAO: legacy CW20 staking; exact `staked_balances` primary keys, positive
  active stake, six decimal NETA. Sum reconciles to voting module power at height.
- Operations: `dao-voting-cw4` at
  `juno1dq855g5vxesxjwh6np6wne9fmyljsezm3la0zka0xx3gey7revfqdwnplx`, with group
  `juno1r8emnt2yryvfcs0398vlsjrp0npy09yk928p8lk4zphk2v4zpmzshp9wa0`.
  Verified on-chain name is `Neta DAO Operations`; UI name stays `NETA Operations
  DAO`. Group pagination and sum reconcile to voting-module power. Weights are
  votes, not NETA stake. Initial read: five positive addresses, one vote each.
- Native Juno: bonded validators and their delegations, all pinned to one height.
  Validator token totals reconcile with the bonded pool; per-validator delegation
  shares reconcile and token rounding is bounded by delegation count. Addresses
  are aggregated across validators. Validator power is not added a second time;
  delegators override their validator vote by voting directly. Snapshot stake
  does not guarantee proposal-specific eligibility or final tally power.

Collectors reject unexpected chain/module/group/token identities, repeated
pagination, duplicate members and power mismatches. Failed reads preserve prior
verified snapshots; missing coverage is not zero participation.

## Scheduled refresh

`DAO member snapshots` owns configured membership files and
`data/daos/membership-status.json`, every 30 minutes at minutes 12/42. Each DAO
subprocess is bounded to nine minutes, with up to three concurrent collectors.
Snapshots are atomically replaced only after successful verification. New adapters
are picked up from the central directory. The status records handled failure
separately from successful source refresh.

`Main DAO snapshots` now owns balances/events plus `neta-status.json`, and no
longer writes membership. Operations Treasury ownership is unchanged. Avoid
staging membership files from other jobs or overwriting later bot updates.

## Release evidence

Local verification: 29 Python tests, 45 frontend tests and the complete browser
workspace/security test pass. Responsive People screenshots checked at 320, 768
and 1440px. Full source reads completed: main DAO 2,088 stakers at block
42,336,088; Operations 5 weighted members at block 42,335,628; Juno 38,372
bonded delegator addresses across 25 validators at block 42,336,088.
GitHub CI/deployment verification is pending.

The legacy contract REST endpoint caps pages at 100. The collector scans disjoint
Bech32 address-prefix ranges with five workers at the same fixed height, then
reconciles the complete sum. Native delegation pages request up to 2,000 entries.
Both avoid unnecessarily exceeding the short history window of pruned nodes.
