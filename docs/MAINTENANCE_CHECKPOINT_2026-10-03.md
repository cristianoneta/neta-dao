# Maintenance checkpoint — 2026-10-03

## Scope and evidence

Reviewed both repositories' current main, open PRs/issues, recent Actions, production
data timestamps, workflow configuration, Names state and documentation. This is a
focused maintenance review, not a complete security or accessibility audit.
Initial DAO UI baseline: `97698f2d06b90f7478d9ae30c18b4126bffbc95f` (#116).
Its Contract/frontend, RELAY browser and Pages checks succeeded. No open PRs or
DAO issues were present at the initial inventory. Preserve subsequent bot commits.

## User-facing state

#114 integrated Names into the main page; #115 removed Following/nested navigation;
#116 made the RELAY heading, navigation position and section cards consistent.
Canonical entry is `#relay/directory`. Inbox, Directory, Contacts, My profile and
.neta name remain direct peers. Search, supported DAO details/address copy,
browser-local follows and USD fee calculation work; profile/contact persistence,
registration/renewal/transfer, payments and DAO profile proposals remain unavailable.
The separate prototype is historical and redirects to the main experience.

This change reuses the existing four Home voxel motifs in the right-hand desktop
introductions for Proposals, Delivery, Contributors and Treasury. RELAY reuses the
assembly plaza across all sections. Shared CSS reserves a 136 px slot; at 960 px
and below decoration is hidden while action/status controls remain visible. No
new image files or graphics runtime are introduced. Browser regression coverage
checks desktop/mobile artwork, document overflow and the stable RELAY shell.

## CI maintenance

- All four contract format checks are now non-mutating `--check`; existing Names
  and Mailbox source/tests are formatted with pinned Rust 1.81.0. No semantic
  contract change or on-chain deployment is intended.
- Cache Rust dependencies/build outputs and the exact cargo-audit 0.22.1 binary;
  pin official cache action v4.2.3 by SHA. Keep every contract test, Clippy check,
  frontend/Treasury test and all four dependency scans. Advisory data are refreshed.
- Cancel superseded runs per branch and bound runtime to 20 minutes. Cover changes
  to the CI workflow on main; remove duplicate path entries. Include `relay.js`
  in the browser workflow trigger.
- Cache benefits depend on a warm cache; no measured speedup is claimed here.

## Data freshness

The previous Treasury snapshot was 14:46 UTC. Rerunning collector job from run
[37130819607](https://github.com/cristianoneta/neta-dao/actions/runs/37130819607)
succeeded (latest job 111259868304). Bot commit
`3a91cac545fea5caf0899c365c1a76fe33983d62` contains balances generated
18:00:14 UTC and events 18:00:33 UTC. Valuation remains PARTIAL; retained cached
historical events and missing-index limitations are not resolved by a refresh.
Generated data were not hand-edited in this change.

Website refresh also succeeded; see its maintenance checkpoint. Old green jobs do
not establish current data freshness. The cause of the afternoon schedule gap was
not established; continue checking timestamp freshness independently of CI status.

## Next work and deferred items

1. Implement a small Names v2 functional slice: normalization, USD tariffs,
   terms/expiry/generations and quote interface with synthetic tests. Keep the
   chosen JUNO/NETA reference and resolve quote freshness/signer gates before sales.
2. Preserve messaging release blockers, disabled mainnet composer and all pending
   journals. UI changes are not a crypto release.
3. Website issue #122 remains open: parallel collectors behind one validated atomic
   publisher. Do not replace the current safe single writer with competing bots.
4. Measure shared signing-bundle transfer cost before restructuring bundles.
   Consider pausing background RELAY polling when hidden as a separate tested change.
5. Continue proposal/dialog/keyboard and full module accessibility review. This
   checkpoint does not certify the entire website as fully optimized or audited.
