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

The existing proposal is one separate Render service in Frankfurt, plan
`0.5c-512mb`, Node 24.19.0, manual deployments and a 1-GB persistent disk.
Blueprint: `relay-backup/render.yaml`; never use the faucet Blueprint or secrets.
The previously recorded proposal is USD 7.25/month base (USD 7 compute + USD 0.25
disk), before tax/workspace fees/overages, not a billing cap. Confirm the actual
provider quote with the owner before creating a service. Provider/budget approval
is outstanding; the owner's instruction to finish the preparation is not a paid
service approval.

Set `RELAY_MAILBOX_CONTRACT` only to the independently verified instance, and
`RELAY_BACKUP_WALLETS` to consenting pilot wallet addresses (maximum ten).
The second pilot wallet is still needed. Web origin remains exactly
`https://dao.netareborn.com`; the provider's exact HTTPS origin must match its
ADR-36 challenge domain. Do not invent a hostname. Preserve SQLite and WAL on
`/var/data`; no faucet signing key belongs in this service.

After an approved deployment, verify real health, CORS, ADR-36, encrypted writes,
restart persistence and quotas at that exact origin. Then prepare a reviewed
private-pilot client pin for the real contract/service and add only that origin
to the workspace CSP. The automated local test injects its disposable origin
into the served fixture HTML; it does not relax production CSP.

Sessions remain bounded to 15 minutes / 120 backup requests. Expiry or exhaustion
invalidates the client token and explains **Authorize encrypted backup**, then
**Recover pending actions**. This is a separate wallet authentication, never an
automatic signature. Reauthorization cannot clear or resend a transaction.

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
