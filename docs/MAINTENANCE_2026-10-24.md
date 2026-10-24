# Cosmoot maintenance — 24 October 2026

Owner-requested follow-up to the codebase review. One branch/PR groups the related
changes; production publication and backend installation remain separate.

## Behavior and structure

- Caddy overwrites the visitor header; backend admission trusts only the explicit
  edge IP on a dedicated API network. Direct connections cannot forge another
  identity. Persistent payout quotas and encrypted-backup authorization are unchanged.
- Proposal content validation, editor state, read adapters, review receipts and
  typed permission/context decisions are separate governance modules. The main
  controller still owns navigation/event composition; this is incremental extraction,
  not a claim that all architectural debt has disappeared.
- Main workspace native/legacy signing bundles load only on demand, with one shared
  concurrent request, a timeout and explicit retry. Previously they added 3,342,390
  uncompressed bytes to every root page load. This is file-size evidence, not a
  measured production latency/LCP improvement. Wallet and transaction checks remain.
- Text-presence tests for the review lock, code discovery and deliverable payload
  were replaced with behavior tests. Existing integrity/source guards retain their
  narrower purpose. Isolated Playwright Test cases exercise real lazy bundle loading
  and preserve failure traces; the full review/funding/voting flow remains mandatory.
- Automatic formatting covers hand-written JavaScript, with explicit generated and
  manifest-pinned exceptions. ESLint correctness checks and incremental typed
  review-state/context checks run through `npm run verify`. Whole-repository typing
  and a wholesale stylesheet/controller rewrite are not claimed.
- The pinned CosmWasm checker is cached. The root suite has one required CI owner
  instead of being rerun inside the Rust job. Contract, real-chain, browser and
  byte-reproduction gates are retained. CI exports a dependency/WASM inventory.

## Compatibility and verification

Original browser routes, storage keys, DAO/native authority distinctions and
on-chain contract identities remain. Historical reviews and pending transaction/
crypto journals retain their original meaning. All four signing bundles and the
personal pilot rebuild to the existing bytes; no contract or Cargo lock changed.
Type analysis must not alter runtime output (`alwaysStrict` emission is explicitly
false while strict type checks remain enabled).

Local verification records 382 root Node tests, 169 Python tests, 85 Faucet tests,
14 encrypted-backup tests and 22 Names tests passing. Format/lint/type checks,
source/inventory integrity, root npm audit and reproduced signing/pilot artifacts
also pass. Final GitHub CI results are recorded in the maintenance PR; update this
paragraph after final validation rather than appending another status block.

Local Chromium download returned an invalid archive. The retained local Juno binary
also failed the required checksum, so it was not executed. These local limitations
do not waive browser or real-execution checks: the final GitHub run must download
and verify the pinned binaries and pass both suites. Real Caddy/Docker validation
runs in the required general job.

## Documentation and rollout

CURRENT_STATE owns feature/publication status. HANDOFF is the concise development
continuation. Their former long checkpoint histories are preserved under
`docs/archive/*_2026-10-24_before-maintenance.md`; historical test counts and incident
records have not been recast as current evidence. README, source map, release and
host guidance now reflect GitHub/Cloudflare/OVH and the actual loading/tooling paths.

After final CI and integration, the owner publishes the exact merge commit through
the manual Cloudflare workflow. The proxy fix additionally needs the backend/Caddy
update and separate live acceptance. This maintenance task performs no mainnet
transaction and does not install production backend code.

The crypto-bigint exception still expires on 24 November 2026. The
[dependency work plan](DEPENDENCIES.md) defines evidence required for a compatible
upgrade or an explicit unresolved blocker. The library is not claimed patched.
