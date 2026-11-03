# Code review and maintenance — 3 November 2026

This is a targeted internal review of the current runtime and the pending proposal
size work, with reproduced failures and regression fixes. It is not an external
security audit or a guarantee that the repository has no defects. Publication and
service installation remain separate from source readiness.

## Changes

| Component | Reproduced issue | Correction |
| --- | --- | --- |
| Native governance signing | A signer could change a referenced fee object; malformed wallet output could reach the pending journal before chain rejection. | Snapshot reviewed inputs independently, verify canonical transaction bytes and the direct signature against the expected signer, chain, account and sequence before storing signed bytes as pending. |
| Review-to-native resolution | Missing or malformed pagination could be treated as a complete proposal list. | Require explicit pagination, canonical unique proposal IDs and bounded non-repeating cursors; incomplete evidence cannot resolve a submission. |
| Discussion HTTP server | A malformed raw request target could reject the asynchronous listener and terminate the process. | Return a bounded 400 response and close the unread request. This was reproduced against the backend directly; public reachability through the supplied proxy was not established. |
| Discussion replies | Invalid, locked, blocked or rate-limited posts performed external identity reads before being rejected. | Run shared admission checks first and repeat them transactionally after the external read. Preserve idempotent receipts and moderation races. |
| Main DAO, membership and delegation collectors | Required child failures could still produce a successful process exit; an existing daily checkpoint could mask failed delegation receipts. | Preserve independent results and verified evidence, publish status atomically, then fail the parent run when required work is incomplete. |
| Treasury polling | Full Treasury snapshots were refreshed on unrelated views and in hidden tabs. | Refresh only in the visible Treasury view, allow one current request, invalidate stale replies on scope changes and resume correctly after visibility or page restoration. |
| Names signing loader | A duplicated loader could remain pending indefinitely or treat a load without its expected global as success. | Reuse the shared loader, with a 30-second timeout, retry and concurrent-load coalescing. |
| Runtime linting | Undeclared runtime references were not checked. | Enable `no-undef` with separate browser, Node and worker environments and narrow intentional bundle-global exceptions. |
| Backup regression test | A fixed 30 ms sleep could test request capacity before requests actually arrived; cleanup then produced unhandled socket errors. | Wait for observed partial bodies and settle outstanding responses, retaining all rate-limit, authentication, deadline, recovery and size assertions. |

Native governance voting, contributions and submissions already require direct
signing. These changes retain that boundary; they do not add Ledger support or
change the separate DAO, faucet or Amino signing paths. Existing pending journals,
review hashes, rule semantics and historical evidence are preserved.

The Treasury change avoids repeatedly processing the four packaged Juno Treasury
files, totalling 1,325,362 uncompressed bytes, when that view is inactive. This is
an input-size observation, not a measured network or performance saving: caching,
compression and selected DAO affect actual traffic.

## Validation

Combined source validation after integration with PR #339:

- `npm run verify`: formatting, runtime linting, checked JavaScript, **490** root
  JavaScript tests, executable syntax/artifact checks and **250** Python tests
  (**14** environment skips) passed.
- Faucet/signing suite: **134** tests passed, including actual pinned CosmJS
  submit/deposit/vote signatures and exact-byte preservation.
- Discussion suite: **11** tests passed, including raw malformed HTTP and
  moderation changes while identity evidence is loading.
- Encrypted backup suite: **14** tests passed. Deliberately delayed request
  admission reproduces the old timing failure and passes the corrected test.
- Existing Rust 1.81 toolchain, locked/offline: profiles **12**, relay **33**,
  released workshop **10**, candidate workshop **13** tests passed. Names v2
  could not run offline because `anyhow 1.0.104` was not cached; CI remains its
  acceptance gate.
- Public Pages artifact and Worker compiled successfully. Docker is unavailable
  locally, so image/runtime and isolated-chain acceptance remain CI gates.

Regression coverage includes failed collector children and actual Treasury/router
integration under view, visibility and DAO changes. Six separate lint probes
also confirmed undeclared names and cross-environment globals are rejected while
legitimate browser, Node and worker globals remain accepted.

## Remaining work

- Large orchestration modules still mix rendering, data fetching and workflow
  state. Extract one tested boundary at a time; broad rewrites would make review
  and preservation of pending operations harder.
- Checked JavaScript types currently cover only two governance modules. Expand
  coverage around transaction, policy and collector interfaces incrementally.
- Some UI tests inspect source text. Keep replacing these with observable
  behavior at the boundaries being changed.
- Retire obsolete Names registration code only after checking its shared RELAY
  gates and pending-operation dependencies.
- The root development toolchain still reports four moderate transitive
  ESLint/minimatch findings, with no high or critical npm findings. Do not apply
  the audit suggestion to downgrade ESLint to an incompatible major release.
  The faucet, encrypted backup and relay crypto JavaScript lockfiles report no
  npm advisories at this checkpoint; this does not audit an embedded WASM binary.
- The existing, scoped Rust dependency exception expires on 24 November at
  00:00 UTC. Its compatibility repair and verification remain required; this
  review does not extend or broaden that exception.

Contract source review found no new established critical/high exploit in the
inspected Names, validator profile, workshop and relay authorization paths. The
workshop migration weakness in the current base is already corrected by the
pending proposal-size change, which preserves pending ownership and restricts
the accepted source version. The attachment candidate remains undeployed.

## Publication boundaries

The browser changes need the normal manual website release. Discussion changes
need a separately reviewed service update; collector changes need a collector
source update. A website release does not install either server change. This
review performs no production installation, contract migration, wallet signature
or fund movement.
