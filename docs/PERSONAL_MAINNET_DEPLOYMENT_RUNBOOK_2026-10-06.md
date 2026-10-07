# Personal mailbox deployment and private pilot

Prepared on 6 October 2026 in draft PR #195. No mainnet contract, backup service,
real-wallet signature or recurring cost has been created. This is a runnable
owner deployment candidate, not a completed production rollout.

## Publication split — 7 October 2026

The standalone owner helper, exact v0.4 artifact/source and null release modules
were published separately in [PR #200](https://github.com/cristianoneta/neta-dao/pull/200),
merged as `0a6de50a878ce38f2b60d2a8a8dc03ddb5dfd301`. The public Inbox and shared signing
bundle remain unchanged; PR #195 still holds the unmerged personal runtime.
All three PR checks passed and Pages run 37576743695 succeeded. Eight served
files matched source SHA-256. Use the [verified owner page](https://dao.netareborn.com/relay-personal-deploy.html). No real chain receipt or backup service exists.

## Reviewed source and identities

- Continue `codex/personal-messaging-recovery-mainnet`; do not rebuild from main.
- Deployment page: `relay-personal-deploy.html`, backed by
  `relay-personal-deploy-core.mjs` and the existing exact-byte signing bridge.
- Network: `juno-1`.
- Uploader, contract creator and upgrade administrator:
  `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`.
- Label: `NETA RELAY personal v0.4 · Juno mainnet`.
- Artifact: `assets/relay-mainnet/neta_relay_mailbox_v04.wasm`.
- SHA-256: `835323a60b0d418d0ef88e1fe12c02f8d65cc5c84fcf593135fdb18977f86708`.
- Instantiate message: `{"mainnet":true}`. Funds: none; real JUNO network fees apply.
- Contract policy: chain `juno-1`, registry
  `juno1pc8wrq89ljuhu2qt6rtk5lkkrptxajtf3un5llu8prg7r4z50vlszfhhza`,
  `dao_enabled:false`. Sending requires active sender-owned .neta eligibility,
  current generations, recipient consent and existing protocol bounds; no stake gate.
- Keep `PERSONAL_MAINNET_DEPLOYMENT` and `PERSONAL_MAINNET_RELEASE` null until
  actual deployment evidence and the approved service origin are available.

The shipped artifact was reproduced with the pinned Rust 1.81.0 toolchain and
`scripts/build-wasm.sh neta-relay-mailbox`. CI now compares the compiled mailbox
against this separate v0.4 artifact. The deployed v0.1 artifact and pin are unchanged.

## Owner deployment steps

1. Review final PR-head CI and source integration. Make the reviewed deployment
   page available on a deliberate HTTPS operator origin before asking the owner
   to use it. The draft branch is not a claim that this URL is already published.
2. Connect the agreed owner wallet. Both configured REST providers must show a
   fresh `juno-1` block. This step signs and broadcasts nothing.
3. Choose **Review mailbox upload**, verify checksum/network/owner, then
   **Confirm this transaction in Keplr**. Keplr displays the actual JUNO fee.
4. Wait for exact transaction inclusion and verified code creator/hash. If the
   response is lost, use **Check pending transaction**; never upload again or
   delete browser storage to escape an unresolved attempt.
5. Choose **Review mailbox creation**. Verify `mainnet:true`, the exact code ID,
   label and owner upgrade administrator; confirm this separate Keplr transaction.
6. **Verify and download public receipts**. The helper verifies both providers'
   code/instance/policy observations and exports
   `personal-mainnet-deployment-receipts.json` with the two matched receipts.
   Save the real public evidence under `docs/deployments/` and recheck it before
   setting any application deployment pin. No sample code ID/address is valid.

The setup journal is separate from Names and preserved across disconnect/reload.
The existing shared transaction journal still prevents concurrent wallet writes.
A changed review, account, stale/wrong chain, provider failure, code mismatch,
missing upgrade admin, policy mismatch or ambiguous event fails closed. Recovery
uses exact signed intent receipts and never broadcasts automatically.

## Backup service decision and configuration

Owner update, 7 October: use the existing `neta-junox-faucet` Render service for the
private pilot, preserving its disk, secret and payout ledger. The old separate
USD 7.25/month proposal is superseded. See
[RELAY_SHARED_PILOT_2026-10-07.md](RELAY_SHARED_PILOT_2026-10-07.md) for exact
settings, the accepted shared-process trade-off, consistent database exports and
the to-do to separate the service after adoption. No extra paid instance or plan
upgrade is authorized. No live configuration change is recorded.

The candidate in PR #195 updates the root Blueprint to install both locked
packages while retaining manual deploys.
Backup defaults off. Enable only with the independently verified mailbox and
consenting pilot wallet allowlist; verify existing service origin and startup,
CORS, bounded ADR-36 access, encrypted writes and restart persistence before
pinning it in the client. Keep both production pins null until the remaining
release evidence is complete. The code keeps 15-minute/120-request sessions and
never silently signs, overwrites a conflicting revision or resends a transaction.

## Evidence and remaining pilot gate

The actual Inbox-shell regression now uses real cross-origin local HTTPS,
browser-native fetch/CORS, disposable ADR-36 signing accounts, the real backup
server and SQLite, with real CoreCrypto/IndexedDB. It covers coherent signed-byte
backup before broadcast, read/reply, crashes, fresh-profile read-only restoration,
repeated rotations/retired keys, storage reopen, lost acknowledgement, server
failure and deliberate session renewal after the 120-request limit. The previous
fake backup RPC is removed. Chain execution, transaction signing, shared-wallet UI
and session factory remain simulated in this browser regression. Session factory
cancellation is separately Node-tested. Self-signed local TLS is accepted only
inside the test browser; this is not hosted-provider or real-Keplr evidence.

The new owner-page test covers two separate reviews, no signing on connect/review,
unknown response/reload/recovery without another write, owner admin/policy,
wallet invalidation, two-provider receipt export and responsive/keyboard behavior.
Its chain/signing adapter is also simulated.

Before public activation, the owner and a consenting second wallet must demonstrate:
registration, mutual consent, encrypted send/read/reply, reload, fresh browser
restore with the separately saved recovery code, read-only enforcement, reviewed
rotation and continued delayed/new-generation reads, using the real mailbox and
approved backup service. Record exact transaction hashes without private recovery
codes or plaintext messages. A fresh browser still cannot independently prove a
malicious provider's snapshot freshness; restoration stays read-only until a new
confirmed generation. Unknown transactions remain locked without proof.

After personal messaging: shared DAO inbox/recovery and direct mainnet testing,
compact Inbox selection/handling states, then payment requests/invoices,
project/milestone evidence, reviewed proposals and Treasury linkage.
