# DAO onboarding checklist

Use one canonical entry in `data/dao-directory.json`; regenerate `dao-directory.js`
with `python scripts/build_dao_directory.py`. Shared configuration identifies a DAO;
it does not replace governance-specific adapters or grant signing permissions.

## Identity and capability gates

- [ ] Record chain ID, real on-chain name, core/version/creation height, all active
      proposal modules, voting module, staking contract and voting token.
- [ ] Verify module-to-core relationships at a recorded block height. Treat native
      chain governance separately; never invent a receiving core address.
- [ ] Allocate stable ID and unique `<slug>.dao.neta` directory label. Record
      collisions/reservations. A directory label is not a registered on-chain name.
- [ ] Default new adapters to read-only. Explicitly verify query versions,
      transaction types, wallet network, permissions and proposal snapshot rules
      before enabling any writes. Preserve existing DAO capabilities.

## Every workspace module

- [ ] Proposals: paginate history, open actual historical details, render status,
      retain local drafts per DAO; test empty, unavailable and unsupported writes.
- [ ] Treasury: list controlled accounts by chain; exclude member stake; verify
      native/CW20/IBC/LP coverage. Keep unverified decimals as raw units, missing
      prices as unpriced. Count LP value once. Document undiscovered asset types.
- [ ] History/events: separate each DAO's files; validate chain/account/scope.
      Preserve successful records and scan anchors on outage. Missing indexing
      means unavailable coverage, never an empty complete ledger or zero revenue.
- [ ] NNS: require deployed registry identity, DAO-approved fee recipient and
      attributable fee events/transaction evidence. Ordinary NETA inflows are not
      automatically naming revenue. Keep inactive revenue null, not zero.
- [ ] People: provide the shared Members and Contributors subnavigation. Configure
      `membershipSource` with the matching verified adapter, file, units and
      decimals; validate its refresh job. Unsupported adapters must fail visibly.
      Contributors stays planned until a real source and owner-approved scope exist.
- [ ] Contributors/participation: explain eligibility and voting weight, include
      timestamp, block and source, reconcile members against voting total. Do not
      infer legal membership or contributor roles from staking.
- [ ] Delivery/planning: use actual DAO data or a clear unavailable state. Never
      expose Operations example budgets as another DAO's current data.
- [ ] RELAY/Directory: profile, copy address where meaningful, follow/unfollow,
      persistent subscriptions, notifications, cross-module navigation and deep
      links. Unknown identity must not fall back to a different DAO's profile.

## Data operation and release

- [ ] Bound collector runtime and isolate optional/new sources from established
      exports. Record last attempt, successful source timestamps and limitations.
- [ ] Test DAO switching, reload, direct links, search, stale response races,
      identity mismatch, unavailable sources and historical proposal detail.
- [ ] Inspect 320/768/1440 px rendered screens; preserve shared design and keyboard
      access. Update asset cache versions and applicable workflow path filters.
- [ ] Update CURRENT_STATE, HANDOFF and a concrete follow-up issue. Use the
      `DAO onboarding` issue template for the next integration.
- [ ] Merge current main while retaining newer bot-owned files. Pass final PR
      frontend/contract/browser checks, then merge and verify Pages, each affected
      data job and actual served assets/UI. Record exact evidence; successful CI
      does not establish full accounting or enable registry/messaging gates.
