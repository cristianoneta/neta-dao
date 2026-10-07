# NETA DAO code-backed current state

## Current continuation — 7 October 2026

Community Tools follow-up: the owner approved publishing the compact tracker under
`/community-tools/validator-upgrades/juno-v31/`, alongside
`/community-tools/juno-faucet/`. The shared footer opens `/community-tools/`.
The new first-signature column uses recorded precommit timestamps, not a claim of
actual software readiness. See the tracker document for the collector and evidence.

Published in PR #208, merge `d8172c1d383761ac069d328388ca99127194b933`;
all four PR workflows passed and Pages run `37596259987` succeeded.
Live browser verification at 08:50 UTC showed 17/25 signing validators and
76.68% voting power, with both observers agreeing. The first automated archive
run `37596259838` saved history through 42,452,320; its Pages run
`37596335635` succeeded and that checkpoint was served publicly.

**Start with the [7 October handoff](HANDOFF_NEXT_CHAT_2026-10-07.md).** It supersedes older
status/next-step instructions below, which are retained as history.

- Live Juno tracker: https://dao.netareborn.com/community-tools/validator-upgrades/juno-v31/ (PR #208; old URL redirects).
- Wallet feedback/RPC timeout fix is published (PR #205); gzip upload fix is merged (PR #204).
- Draft PR #195 at `39feff397f600a25057087285e7710d032326aca` has five successful
  hosted workflows, including browser run `37589126376`; it remains unmerged.
- Actual owner deployment receipts, live shared Render backup and the real
  two-wallet pilot remain unverified. Both personal release/deployment pins are null.
- `.neta` is required only to send. Receiving/reading one's own messages requires
  no name. Use the existing Faucet Render service for the pilot, then separate later.
- Next: recheck Juno block progress/providers, recover the pending deployment,
  complete personal mainnet messaging, then DAO inboxes/recovery and payment requests.

The historical 54.77% block-prevote observation is not a current network status.

## Wallet connection outage — 7 October 2026

At 07:26 UTC, read-only probes still showed both STAVR and PublicNode at
Juno height 42,452,000, block time 06:56:31 UTC. This is the scheduled v31
upgrade height (governance proposal 379); STAVR reports v31.0.0. PolkaChu RPC
and REST returned HTTP 502, and the WhisperNode connection failed. These
observations indicate an upgrade-related network interruption, not proof of
a Keplr defect. A reachable alternative RPC also served stale blocks; changing
providers alone would not make deployment safe. Recheck fresh blocks and both
verification providers before attempting the owner deployment.

The owner page now shows connection progress and errors next to its button,
distinguishes successful wallet authorization from failed network verification,
and tries the next approved RPC after a 12-second connection timeout. Late
clients are disconnected. Freshness checks, two-provider verification, reviewed
WASM and pending transaction journals are unchanged. No transaction was signed
or broadcast during diagnosis. Tests cover outage/journal preservation, stalled
RPC fallback/cleanup, stale/provider failure and the browser error/retry flow.

PR #195's automatic-poll test race and the independent outage-related
community-accounting browser assertion are now fixed. All five hosted workflows
pass for application head `39feff397f600a25057087285e7710d032326aca`, including
browser run `37589126376`. The earlier failed run `37586913733` is superseded.
PR #195 remains draft, unmerged and inactive; green CI is not live pilot evidence.

## Upload HTTP 400 fix and sender-only name requirement — 7 October 2026

The owner hit HTTP 400 after reviewing the personal mailbox upload. A read-only
mainnet simulation reproduced it: the 513,331-byte raw WASM becomes a 1,027,263-byte
hex-encoded ABCI request; PolkaChu returns `request body too large`. The same code
with gzip is 127,833 bytes, yields a 256,267-byte request and simulates successfully
(2,913,204 gas at the observed block). No probe signed or broadcast anything.

The shared signing bridge now compresses large store-code messages before fee
simulation and signing, checks decompressed code byte-for-byte with a bounded
reader, and still recovers legacy raw transactions. Pending request identities,
signed-byte journals and the reviewed WASM checksum stay unchanged. No dependency
was added. A failed HTTP simulation explicitly explains that no broadcast occurred;
only recorded evidence can settle the attempt through **Check pending transaction**.
Reload the owner page after the fixed bundle is published, reconnect the same
wallet and recover the existing attempt before reviewing another upload. Never
clear site data or repeat an unknown transaction. Confirm the public Pages artifact
and CI before directing the owner to retry.

Owner clarification: **only sending requires an active owned .neta name**.
Registration, contact permission, receiving and reading one's own messages do not.
An additional contract regression demonstrates an unnamed recipient receiving
and querying ciphertext, while unnamed sending is rejected. Plaintext remains
protected by the recipient's messaging keys; no public-read change is introduced.
The contract production source and v0.4 WASM are unchanged; only its tests changed.

Local verification: 159 root Node tests, 62 Faucet/signing tests, 33 mailbox tests,
the owner-page browser regression and the new real-bundle browser gzip/recovery
test. Live owner deployment and the actual receipt JSON are still outstanding.
The shared Faucet backup decision, inactive public release and PR #195 remain.

## Shared pilot and simpler Inbox — 7 October 2026

Owner decision: use the existing `neta-junox-faucet` Render service for RELAY
backups while there are no users; separate it after adoption. This supersedes the
earlier separate-service proposal. See [the implementation and operating plan](RELAY_SHARED_PILOT_2026-10-07.md),
including the explicit separation to-do and preservation/restore procedure.

[PR #195](https://github.com/cristianoneta/neta-dao/pull/195), application commit
`dbb32a9f8845250f7caa1aaf981f88f58f0ea234`, integrates main through `7c52b36` and adds
state-selected setup/unlock/restore, contextual backup renewal, automatic idle
receive/reconciliation, verified `.neta` contacts and non-authorizing invitation
links. Wallet signing, consent, generation checks, exact-byte journals and the
15-minute/120-request backup bounds remain explicit and unchanged. Passkeys and
unattended signing are deferred. The root Blueprint reuses the existing service,
disk and faucet secret, with a separate backup database and routes. RELAY defaults
to disabled until the actual mailbox and consenting wallets are configured.

Local checks pass: 180 root Node tests, 62 Faucet tests, ten backup tests, the
real-CoreCrypto HTTPS recovery suite and the new responsive Inbox UX regression.
Hosted checks are recorded on PR #195 for the application commit above.

No live Render redeploy or real owner transaction is evidenced here. Both release
pins remain null, public messaging and DAO writes stay inactive. Next: complete
the release review, verify owner upload/instantiate receipts, update the existing Render
service's root/build/start settings, configure the real mailbox and allowlist,
verify live persistence/authentication and the two-wallet pilot. Preserve all
keys, journals, faucet SQLite/WAL and generated Treasury snapshots.

## Adversarial contract review — 7 October 2026

The owner asked for a whitehat-style check. See the scoped
[personal mailbox v0.4 security review](PERSONAL_MAILBOX_SECURITY_REVIEW_2026-10-07.md).
No exploitable critical/high defect was confirmed in the reviewed contract
paths. Ten new adversarial tests pass alongside the existing 22; Clippy passes,
and the pinned release rebuild remains byte-identical to the published WASM.
Only tests and documentation changed. This is an internal source review, not an
independent external audit or an approval to activate public messaging.

Confirmed boundary: the active `.neta` gate applies to sending, not device
registration; rotations/history can grow state against chain fees without a
contract-level total quota. Public metadata, client ciphertext authentication,
owner upgrade custody, registry trust and the explicit dependency-audit exception
are documented. No owner transaction occurred; deployment/release pins remain
null, PR #195 remains draft, and the private-pilot/backup/independent-review gates
remain open. Preserve pending keys and transaction journals.

## Owner deployment publication — 7 October 2026

The owner asked to continue with the reviewed owner deployment page. [PR #200](https://github.com/cristianoneta/neta-dao/pull/200), merged as
`0a6de50a878ce38f2b60d2a8a8dc03ddb5dfd301`, publishes the v0.4
contract/source, artifact and standalone setup helper from PR #195 onto current
main. The shared signing bundle and production Inbox are unchanged. This avoids
publishing the unfinished personal runtime while making owner deployment concrete.

The setup retains the two explicit wallet confirmations, owner upgrade authority,
exact-intent recovery without resending and two-provider receipt verification.
Both personal deployment/release pins remain null. No contract, real signature,
backup service, cost or public messaging activation was created by this work.

Local checks: 159 root Node tests and the owner browser regression passed. The
latter simulates chain/signing and covers reload/recovery, wallet invalidation,
public export, keyboard focus and 1440/768/390/320 px; desktop/mobile screenshots
were inspected. The artifact hash remains
`835323a60b0d418d0ef88e1fe12c02f8d65cc5c84fcf593135fdb18977f86708`.
All three PR checks passed: browser **37576257783**, frontend/contracts
**37576257803**, and reproducible WASM **37576257837**. Pages **37576743695**
succeeded. Eight served files, including the WASM, matched source SHA-256.
The [owner deployment page](https://dao.netareborn.com/relay-personal-deploy.html)
is now live. Source publication is complete; no owner transaction has been made.

Next: use the live `relay-personal-deploy.html` page with the owner
wallet. Upload and instantiate are separate Keplr confirmations; save the exported
public JSON and independently recheck its exact transactions/code/address. Do not
repeat an unresolved action or clear site data. Provider/budget agreement and a
second consenting pilot wallet remain open. The full personal runtime still lives
in draft PR #195; integrate current main into it before continuing. After personal
mainnet evidence: DAO shared recovery/inbox, then payment requests/invoices and
Treasury linkage.

## Overnight continuation — 6 October 2026, owner deployment and real backup transport

Continue **draft [PR #195](https://github.com/cristianoneta/neta-dao/pull/195)** on
`codex/personal-messaging-recovery-mainnet`. Application head:
`0f1d3b419b3c18964debeb5d956f5d151446121b`. The owner asked to finish preparation
and update the handoff while offline. No paid service or owner transaction was
performed. **The application PR remains draft, unmerged and inactive.**

Completed in this continuation:
- Added `relay-personal-deploy.html` and its owner-only controller: separate upload
  and instantiate reviews, the existing exact-byte signing bridge, durable setup
  intent, reload/unknown-response recovery without resending, wallet-change review
  invalidation and public receipt export after two independent fresh-provider
  checks. Owner upgrade custody and `mainnet:true` / NNS-only / DAO-disabled policy
  are explicit. The helper is source on the draft branch, not a published live page.
- Reproduced and shipped separate v0.4 mailbox WASM at
  `assets/relay-mainnet/neta_relay_mailbox_v04.wasm`, SHA-256
  `835323a60b0d418d0ef88e1fe12c02f8d65cc5c84fcf593135fdb18977f86708`.
  CI compares source build and shipped bytes. The deployed v0.1 asset is untouched.
- Replaced the browser test's fake backup RPC with actual cross-origin local HTTPS,
  native browser fetch/CORS, disposable ADR-36 signatures and the real SQLite
  service. This exposed a real native-fetch receiver bug, now fixed. Read/reply,
  fresh-profile restore, repeated rotations, exact signed-byte backups, storage
  reopen, lost acknowledgement and failures pass with this real transport.
- Kept 15-minute/120-request sessions bounded. Exhaustion now invalidates the token
  and tells the user to authorize backup again, then recover. The browser regression
  proves that expiry preserves the backup and does not broadcast; renewal is explicit.
- Integrated current main through `d1b7798`, preserving generated Treasury data.

Validation: **176 root Node tests, nine backup server tests, the real-HTTPS personal
recovery browser test and the owner deployment browser test passed locally**.
Deployment layout/keyboard checks cover 1440, 768, 390 and 320 px; desktop/mobile
screenshots were inspected. Local pinned Rust build matches the shipped hash.
The browser still simulates chain execution, transaction signing, wallet UI and
session factory; this does not establish real Keplr/mainnet/provider deployment.
All five hosted checks passed for this application head:
[frontend/contracts](https://github.com/cristianoneta/neta-dao/actions/runs/37529752239),
[backup](https://github.com/cristianoneta/neta-dao/actions/runs/37529752408),
[faucet/signing](https://github.com/cristianoneta/neta-dao/actions/runs/37529752279),
[reproducible WASM](https://github.com/cristianoneta/neta-dao/actions/runs/37529752332),
and [full browser suite](https://github.com/cristianoneta/neta-dao/actions/runs/37529752243).
The following handoff-only commit changes no application code. This checkpoint
is also published on main for continuation; PR #195 itself remains draft/unmerged.

### Exact next session

Read the [deployment runbook](https://github.com/cristianoneta/neta-dao/blob/codex/personal-messaging-recovery-mainnet/docs/PERSONAL_MAINNET_DEPLOYMENT_RUNBOOK_2026-10-06.md).
Review latest PR-head checks/source and publish the deliberate owner helper before
asking for its two real wallet confirmations. Save and independently verify the
real code ID, contract address and exported public receipts. The owner wallet
`juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57` remains upgrade administrator.

The separate Render backup proposal (previously recorded USD 7.25/month base,
not a billing cap) still needs provider/budget agreement and a second consenting
pilot wallet. No service exists. Configure the actual mailbox and allowlist,
verify hosted TLS/CORS/authentication/backup/restart behavior, then pin only the
real deployment and exact HTTPS origin, including the workspace CSP. Neither
production pin was changed; public SEND and DAO writes remain disabled.

Use a private consenting two-wallet mainnet pilot to verify registration, mutual
consent, send/read/reply, reload and fresh-browser recovery with explicit rotation
before public activation. No fabricated address, hostname or pilot evidence is
allowed. Unknown transactions remain locked without proof; a new browser cannot
independently prove a malicious provider's backup freshness. Private history is
still separate from the DAO/system filters and unread counts.

After personal release: shared DAO inbox/recovery and direct mainnet testing,
compact inbox selector/shared handling states, then **payment requests/invoices**,
project/milestone evidence, reviewed proposals, duplicate-payment prevention and
Treasury linkage. Preserve all existing keys, transaction journals and SQLite/WAL.

## Production Inbox connection — 6 October 2026

Continue **draft [PR #195](https://github.com/cristianoneta/neta-dao/pull/195)** on
`codex/personal-messaging-recovery-mainnet`. This supersedes older statements that
only the standalone browser fixture is connected. Do not recreate from main.

`index.html` now loads the personal workspace host. With a reviewed release pin it
uses the existing Inbox card, Compose action and shared wallet header; there is no
second wallet selector. The default release and deployment are **null**, so normal
page load cannot open a crypto runtime, authenticate to backup or enable sending.
The inactive preview now accurately says Juno mainnet preparation, without making
an unnecessary UNI-7 mailbox request. Backup authorization is visible during setup.

The shared wallet publishes its actual connected chain. Inbox connection requests
Juno mainnet. Disconnect, keystore changes and leaving Inbox immediately clear
visible messages, recovery codes and reviews. Late connections are disposed; the
real session adapter guards wallet, signing and backup calls against the original
shared session even when Keplr still exposes the same account. Encrypted stores,
pending transactions and in-flight recovery evidence are retained. The disposable
crypto iframe now uses an external module and a restrictive local-only CSP; the
workspace's script policy is unchanged.
A subsequent repeat exposed a generation-2 local fingerprint mismatch after
reading with a retired device. Every crypto database open and new-device creation
now uses a fresh WASM realm, and a new device must survive a cold fingerprint read
before registration review. The regression additionally cycles through repeated
rotations with delayed reads and new-generation replies. The assertion was retained;
check the final repeated/hosted results before claiming this follow-up is green.
The repeated-rotation test also exposed quota exhaustion from decimal byte arrays.
Checkpoint blocks now use compact base64 inside the authenticated encrypted payload,
including retired/prepared/inbound states. The existing 5-MiB plaintext and 8-MiB
server limits stay in place; no history or keys are discarded. A captured legacy
numeric-array envelope and a multi-generation size regression pass round-trip tests.

Validation: **170 root Node tests and nine HTTP/ADR-36/SQLite backup tests passed**.
The real-CoreCrypto recovery suite now runs the first participant inside the actual
`index.html` shell and exercises header disconnect/reconnect, navigation, a late
connection, encrypted unlock and the existing crash/restore/rotation/send tests.
Wallet, chain, backup transport and the session factory in that browser test are
simulated; the real factory/adapter cancellation behavior has separate Node tests.
The existing workspace security suite also passed. Layouts checked at 1440, 768,
390 and 320 px. Hosted checks must be verified on the latest PR head before merge.
The earlier `b89cb49` head had five green checks; those do not certify this update.

**Not merged, hosted or activated.** Next: finish the release review and prepare the
owner-reviewed store/instantiate flow; obtain agreement for the separate backup
provider/budget, configure its actual mailbox and consenting pilot wallets, then
verify the real HTTP/browser transport. Pin the verified deployment and exact HTTPS
backup origin in `relay-personal-release.mjs`, and add that exact origin to the
workspace CSP (never a wildcard). Perform the owner-signed mainnet two-wallet
exchange/reply/reload/fresh-profile restore before public activation. The private
history currently stays in its own section within Inbox; it is not yet indexed by
the DAO/name-update filters or unread counts. No fabricated mailbox or service URL
belongs in production. Owner upgrade admin, NNS-only sender eligibility and disabled
DAO writes remain unchanged. No service, cost or real signature was created.

After personal messaging: shared DAO inbox/recovery and mainnet testing, then
payment requests/invoices, reviewed proposals and Treasury linkage.

## Browser integration checkpoint — 6 October 2026

Continue draft [PR #195](https://github.com/cristianoneta/neta-dao/pull/195),
branch `codex/personal-messaging-recovery-mainnet`. This checkpoint supersedes
older statements below that the controller and real-profile restore are absent.

The personal browser controller now connects real CoreCrypto, the encrypted local
checkpoint, archive, cursor, outbound journal, lifecycle actions and exact-byte
signing bridge. Automatic encrypted snapshots cover all these records together.
The bridge requires a successful backup of the exact signed bytes before broadcast;
failed or ambiguous uploads preserve the attempt and block continuation. Recovery
uses receipts and never automatically retransmits. Restored profiles remain
read-only, including after a rejected rotation, until an explicitly reviewed new
key generation is confirmed. Old generation keys remain available for delayed reads.

A pinned CoreCrypto cache issue was found by the interrupted-decryption test.
Restoration now creates a fresh disposable same-origin WASM runtime before copying
checkpoint blocks; reopening the old runtime could retain an advanced ratchet.
The iframe is runtime isolation, not a security boundary. The unmounted Inbox
component provides recovery-code setup, unlock/restore, history, contact permissions,
review/confirm actions and pending recovery. `relay-personal-session.mjs` wires the
actual wallet/query/backup adapters; its default deployment still fails closed.

Local evidence: **166 root Node tests, 59 signing/faucet tests, seven backup tests
and 22 mailbox Rust tests**. The real-browser integration test exercises create,
registration, send/read/reply, exact ciphertext retry after rejection, pre-ready and
inbound crashes, wrong recovery code, interrupted fresh-profile import, historical
and unread messages, rotation/retired keys, unknown accepted transactions, exact
signed bytes in backup before broadcast, failed backup, lost acknowledgement,
concurrent tabs/profiles and wallet switching. The tested UI creates/registers a real
local crypto profile; desktop/tablet/mobile layouts (1440/768/390/320) were inspected.
Wallet, chain and remote backup transport in this browser test are simulated.
Actual HTTP/ADR-36/SQLite behavior is covered separately by the backup suite.
Inspect the latest PR-head Actions results before integration; local evidence is
not a claim that a newer hosted run passed.

The contract candidate now requires mainnet `sender_generation` and
`expected_previous_generation` at execution, fencing delayed sends and competing
rotations. Candidate v0.4 WASM SHA-256 (Rust 1.81.0):
`835323a60b0d418d0ef88e1fe12c02f8d65cc5c84fcf593135fdb18977f86708`.
The deployed v0.1 WASM asset and UNI-7 pin are unchanged.

**Still not live:** production Inbox mounting/runtime review, backup provider and
budget approval, owner-reviewed mainnet deployment and the consenting two-wallet
mainnet test remain. The deployment pin is null and production SEND is disabled.
No service, cost, wallet transaction or real remote backup was created. Restoring
an unknown transaction without provable inclusion/non-broadcast remains locked;
a fresh profile cannot independently prove a malicious provider's freshness.
Owner upgrade admin, active owned .neta sender policy and disabled DAO write routes
are unchanged. After personal release: shared DAO recovery/mainnet testing, then
payment requests/invoices and Treasury linkage.

## Latest continuation — 6 October 2026, personal recovery candidates

Continue **draft [PR #195](https://github.com/cristianoneta/neta-dao/pull/195)**,
branch `codex/personal-messaging-recovery-mainnet`, saved head
`2b4523fb9de9437947b656f04243accaeea8082e`. Do not recreate its implementation
from main. [Detailed candidate note](https://github.com/cristianoneta/neta-dao/blob/codex/personal-messaging-recovery-mainnet/docs/PERSONAL_MESSAGING_MAINNET_2026-10-06.md)
and [backup proposal](https://github.com/cristianoneta/neta-dao/blob/codex/personal-messaging-recovery-mainnet/relay-backup/README.md).

The browser failure was a missing recipient after the test's deliberate reload;
it is fixed without removing assertions. All three original checks passed at
`3e678e1`. New lifecycle/transport/crypto candidates passed all three checks at
`188fbe8`, including real CoreCrypto generation isolation and historical sender
identity. Backup/authentication/codec candidates passed hosted backup CI at
`772dd77` and `c4da6ec`; the latter also passed browser/frontend CI. Local tests:
**166 Node + six backup integration tests**; backup dependency audit reports zero
vulnerabilities. The final follow-up bounds simultaneous backup requests. Inspect
all latest-head workflow results before integration; earlier results are not a
claim that newer in-flight runs passed.

Source candidates now cover reviewed consent/block/refill/rotation, generation-
separated encryption, exact signed-transaction attempt recovery and an isolated
encrypted backup service/client. **They are not yet connected to one production
personal crypto controller.** Next: integrate those modules with durable browser
state and the existing signing bridge, automate quiescent snapshots, enforce
read-only staged restoration and test real fresh-profile ratchet/archive/outbox/
cursor recovery, rotation and concurrent profiles. Synthetic backup tests do not
close those gates. Then production review, owner-reviewed mainnet deployment and
the consenting two-wallet test. No mainnet signing/deployment/hosting/backup exists.

Separate Render Blueprint is prepared; proposed base is **USD 7.25/month** before
tax/possible workspace charges/overages. Provider/budget approval remains open.
No service was created. Existing faucet credentials, keys, pending journals and
generated Treasury snapshots are preserved. Mainnet SEND is still disabled,
deployment pin null, owner upgrade admin unchanged, and active owned .neta
replaces the former stake prerequisite. DAO routes remain disabled.

After personal messaging: shared DAO recovery/direct mainnet testing, compact
Inbox selector/shared handling states, then milestone payment requests/proposals/
Treasury linkage. Do not lose the invoice requirement.

## Continuation — 6 October 2026, personal messaging recovery candidates

Continue **draft PR #195**, branch `codex/personal-messaging-recovery-mainnet`.
The former failing browser regression is fixed: its sender recipient field was
empty after the deliberately exercised reload. The adversarial branch now selects
the recipient again. All three checks passed at `3e678e1`; no test was skipped or
weakened. This supersedes the preceding checkpoint's still-running CI wording.

Additional implemented candidates (not mounted in the production Inbox):
- `relay-personal-transport.mjs`: reviewed exact-ciphertext attempts through the
  existing exact-byte signing bridge, durable attempt binding, origin lock,
  generation/consent/block/prekey checks and evidence-only reconciliation. A
  proven rejected signature or included failure allows a separately reviewed
  retry of identical ciphertext; RPC errors/null receipts do not. No automatic
  resend, ratchet rewind after ready, or disposal of an unresolved intent.
- `relay-personal-lifecycle.mjs` and `relay-personal-protocol.mjs`: reviewed
  consent/block/refill/rotation adapters, monotonic prekey checks, immutable
  historical sender identity and generation/mailbox-separated Proteus sessions.
  Local crypto preparation is required through a host callback. The complete
  browser host and rotation activation are still open, not implied by these APIs.
- `relay-backup/` plus `relay-personal-backup.mjs`: isolated provider/codec/client
  candidate, real ADR-36 authentication, client AES-GCM encryption, revision CAS,
  identical-write recovery, quotas and a separate optional Render Blueprint.
  Pilot wallet allowlist required; no faucet environment or signing key is used.
  Provider/cost approval is still outstanding. No service or upload was created.

Validation: 166 root Node tests and six backup integration tests pass locally.
The lifecycle/protocol application head `188fbe8` passed all three hosted checks;
its new real-CoreCrypto browser test covers generation isolation, delayed old-device
reads, new-device reply, replay rejection and historical identity. Backup candidate
head `772dd77` passed hosted backup CI 37516185694 and frontend/contract CI
37516185612; check all final-head runs before integration. Local Chromium download
failed, so browser evidence comes from hosted CI, not a claimed local browser run.

**Still not mainnet-test-ready.** The next implementation is to connect these
modules to one recovery-aware personal controller and its existing signed-byte
journal bridge, capture actual quiescent browser stores automatically, and prove
coherent fresh-profile restoration with real ratchet/archive/outbox/cursor state,
rotation and concurrent profiles. The backup tests use synthetic complete snapshot
objects; they do not prove real-profile restore. Returned restore snapshots are
read-only by default, and that restriction still needs controller enforcement.
A fresh profile has no trusted prior revision watermark; provider CAS alone does
not solve malicious/stale-server rollback. Production runtime/UI review, owner-
reviewed deployment and consenting two-wallet mainnet evidence remain open.

The separate Render proposal is **USD 7.25/month base** (USD 7 compute + USD 0.25
for a 1-GB disk, before tax/possible workspace charges/transfer overages), not a
billing cap. Its README records exact settings and boundaries. Approval does not
make the client release-ready. No mainnet contract, wallet write, remote backup,
hosting cost or authority change occurred. Mainnet deployment pin is still null.
Owner upgrade admin, active owned .neta sender rule and DAO-write lock are retained.
After personal messaging: shared DAO inbox recovery/direct mainnet testing, compact
selector/handling states, then project/milestone payment requests and Treasury links.

## Continuation checkpoint — 6 October 2026, personal messaging first

**Owner decisions supersede older next-step wording below:**
1. Prepare/test personal messaging on **Juno mainnet first**.
2. Afterwards finish shared DAO inbox recovery, test directly on mainnet, integrate
   the Inbox selector/shared handling states, then implement payment requests.
3. **Remove the 5-NETA staking prerequisite from messaging contracts.** Sending
   requires an active, currently sender-owned .neta name. Recipient consent,
   blocking and existing protocol payload/cooldown bounds remain.

### Saved code — draft PR #195, not deployed
[PR #195](https://github.com/cristianoneta/neta-dao/pull/195) holds the current work
on `codex/personal-messaging-recovery-mainnet`, current head `33aaae1e7c47e025a4503a00eeca3f2388458c56`.
**Continue that branch/PR; do not rebuild from main or treat its code as live.**
Its [implementation note](https://github.com/cristianoneta/neta-dao/blob/codex/personal-messaging-recovery-mainnet/docs/PERSONAL_MESSAGING_MAINNET_2026-10-06.md)
describes the implementation and exact open gates.

Implemented candidate: authenticated encrypted pre-send journal/checkpoint,
pre-ready crash rollback with retained intent, exact-receipt recovery after ready
ciphertext without automatic resend, interrupted-registration reconciliation,
immediate plaintext clearing on wallet switch, separated network identity checks,
and v0.4 explicit mainnet contract configuration with current NNS ownership checks
and **no staking query**. Mainnet DAO execute routes remain disabled.
The owner wallet remains the intended upgrade administrator.

Candidate WASM SHA-256:
`ec8650278f5ce4dd3c587154581caeec20f7ff9e0d6d6d5903f4cb2712720c45`.
Local: 155 Node tests, 20 mailbox Rust tests, format/Clippy and WASM build passed.
Hosted CI status must be checked on the latest PR head. An initial added browser
assertion observed stale UI status before rendering completed; the follow-up waits
for the actual recovered message. That updated personal browser exchange/recovery
step has now passed in run 37513496120; the complete workflow and other latest-head
checks were still running at this checkpoint. Check their final results before
integration. Do not describe the earlier failed run as passing.

**Still not mainnet-test-ready:** consent/refill/rotation and generation-aware
crypto-controller integration, ready-but-unconfirmed transaction reconciliation,
automatic off-device backup/provider and coherent fresh-profile restore, production
runtime/security review, and owner-reviewed deployment/two-wallet evidence remain.
The client deployment pin is null, main Inbox SEND is disabled, and no new contract,
mainnet transaction, hosting service or remote backup has been created. Existing
v0.1 deployment, keys and unresolved transaction/crypto journals are preserved.

### Sidequest — published
[PR #194](https://github.com/cristianoneta/neta-dao/pull/194) merged as
`15d2c836a65297c77d91ba5f8e455573c9e9d261`. It hides only the exact Juno UNI-7
workshop #1 “Make Cristiano the new Senator” and #2 “Testing 1” by default.
“Show test reviews” reveals them. No on-chain record was deleted; mainnet proposals
are unaffected. Both applicable PR checks passed. The served HTML, controller and
CSS were verified byte-for-byte against the reviewed source.

Payment requests/invoices remain explicitly next after DAO inboxes: project and
milestone, evidence, fixed payee/amount/token/accounting category, accepted request
to prefilled proposal, distinct governance approval/execution/payment confirmation,
duplicate-payment prevention and Treasury linkage. No automatic payout or new fee.


## Verified checkpoint — 6 October 2026, 20:16 Europe/Berlin

[PR #192](https://github.com/cristianoneta/neta-dao/pull/192) is merged as
`943124f5d2aff0af6503fa5ae04df0df0f798758`. All three PR checks passed:
[contract/frontend](https://github.com/cristianoneta/neta-dao/actions/runs/37508878784),
[browser crypto](https://github.com/cristianoneta/neta-dao/actions/runs/37508878528),
and [WASM build](https://github.com/cristianoneta/neta-dao/actions/runs/37508878514).
The subsequent [main CI](https://github.com/cristianoneta/neta-dao/actions/runs/37509330946)
and [Pages deployment](https://github.com/cristianoneta/neta-dao/actions/runs/37509330024)
also succeeded. The published protocol, client, component and implementation note
match the reviewed source byte-for-byte; the live index matches merged main and
does not mount the DAO inbox. The CI WASM hash matches the local reproducible build.

**Merged source candidate, not an activated mailbox.** No new contract was deployed,
no real DAO was enabled, and mainnet messaging remains disabled. Operations'
`neta-operations.dao.neta` is still a curated directory identity, not an active
personal NNS registry name.

Continue with coherent multi-recipient recovery: interrupted outbound/inbound
crypto, authenticated archive, cursors, history reload, prekey refill and rotation.
Preserve unresolved preparation/transaction journals; never clear them to retry.
Then prepare the new UNI-7 instance and reviewed wallet-signing steps, perform real
wallet/member-replacement E2E and only then connect the component to the main Inbox.
The agreed upgrade administrator remains the owner's wallet. Existing RELAY
recovery and mainnet release gates still apply.

### Next product track: payment requests / invoices — planned, not implemented

Do not lose this requirement when continuing the mailbox work. An active .neta
identity should be able to send an invoice/payment request to an enabled DAO inbox.
For an assigned project, the contributor selects the project and completed milestone,
attaches evidence and requests payment. The responsible DAO (for example Operations)
reviews the invoice and evidence; its acceptance prepares the corresponding
prefilled payment proposal. Governance approval and actual execution remain separate
steps. Acceptance alone must not transfer funds or mark an invoice paid.

Reuse the shared conversation and a compact request detail view rather than adding
another top-level module. Carry the agreed amount, token, fixed payee, project,
milestone and accounting category into the reviewed proposal; visibly flag deviations.
Prevent duplicate requests/payments for the same milestone and connect the request
to proposal ID, execution transaction and Treasury entry. Decide explicitly which
invoice/evidence fields become public on-chain before proposal submission.

This is product direction and continuation work, not a delivered invoice system.
Detailed invoice fields, partial payments, disputes, storage and pricing remain to
be designed. No additional NNS fee or automatic payment has been approved.

## DAO inbox implementation candidate — 2026-10-06

Source implementation and local tests now exist for opt-in DAO mailbox authority,
immutable DAO-name assignment, current CW4 readers, NNS-only senders, blocking,
shared conversation state, multi-recipient Proteus packets and a compact Inbox
selector. **Not deployed or mounted in the main workspace.** Existing v0.1 pins
and mainnet send locks remain unchanged. No real DAO has been opted in.

See [implementation, tests and release gates](DAO_MAILBOX_IMPLEMENTATION_2026-10-06.md).
A real crypto failure test found partial session persistence after callback errors;
the new durable preparation journal keeps such sends locked. Coherent recovery,
a new signed UNI-7 deployment, real-wallet E2E and adapter activation still remain.
No fake DAO inboxes are published. Operations' current name is still directory-only.

## Inbox simplification and DAO mailbox decisions — 2026-10-06

The separate Names inbox filter is removed. Existing NNS system notices appear
under Messages, All and Unread; their verified source, lifecycle links, ownership
boundaries and read state are preserved. They remain locally generated system
notices, not encrypted peer messages. Mainnet messaging is still disabled.

Design decisions for future implementation are recorded in
[DAO mailbox design](DAO_MAILBOX_DESIGN_2026-10-06.md). Shared DAO inboxes,
blocking, NNS-only sending, role subaddresses and milestone payment requests are
not live. Do not expose a working mailbox switcher until its access controls exist.

## DAO structure — 2026-10-06

People opens with DAO structure, ahead of Members and Contributors. The graph
uses the canonical organization/unit directory and explicit parentDaoId links;
Main and every configured SubDAO sit inside the same consolidated-scope frame.
Node selection and the consolidated button use the existing guarded DAO selector,
keeping the header, URL, saved scope and other modules synchronized. Mint and a
Selected label identify the current unit; consolidated selection highlights the
outer frame. Direct Members/Contributors and legacy links keep their behavior.

The approved layout reuses the existing colorful assembly-plaza and contributor
voxel artwork. Branches, multiple roots and deeper parent relationships are supported;
cycles, duplicate identities or out-of-group parents show an unavailable state,
not invented links. Reporting structure grants no on-chain authority. No fictional
units, additional wallet actions or live Delivery functionality are introduced.

Validation: 36 targeted Node tests and the browser hierarchy suite passed, including
both organizations, click/keyboard selection, scope persistence, Members navigation,
320/390/768/1440 px layouts and test-only multi-level branches. Generated Treasury
and member exports are preserved. This section supersedes older People defaults.

## Delivery placeholder for every DAO — 2026-10-06

Owner requested removal of fictional Delivery records. Every DAO and SubDAO now
uses the same UX DRAFT / NOT LIVE DATA header and scoped no-live-data placeholder.
The former Operations sample mandates, budgets, paid amounts, owner, milestones,
evidence and inactive action buttons are removed from HTML, not merely hidden.
Delivery and its Home summary describe planned functionality; there is no live
mandate tracking, acceptance or payment release. DAO switching cannot restore
sample records. Other income is always the last income row in the shared statement,
including consolidated views, while named income sources keep their relative order.
Treasury token quantities (assets, LP underlyings and accrual events) display two
decimal places; USD values remain visible and accounting precision is unchanged.
Existing Treasury exports and transaction flows are unchanged.

## Daily staking accrual, recorded zeros and Home — LIVE, 2026-10-06

Owner requested daily accrued staking income, no duplicate revenue on claims, and
zero values/sums for accounts without recorded movements, including consolidation.
[PR #187](https://github.com/cristianoneta/neta-dao/pull/187), merged as
`2fcf43c8ba236f2feeb609e199864a11afa5c41c`, adds a daily, claim-adjusted ledger:
closing withdrawable rewards minus opening rewards plus intervening withdrawals.
Both explicit claims and automatic withdrawals during staking changes are captured
from SDK events. Exact matched claim transfers are settlements, outside revenue.
Unknown movements, unexplained decreases, stale sources and missing USD quotes
block recorded totals. The normal 15-minute holdings/receipt refresh is retained;
reward sampling advances once per UTC day to the previous day's closing block.

Historical state at 1 October was unavailable from the inspected public providers.
The earliest existing pinned reward snapshot is **6 October 13:57:10 UTC**.
The first recorded accrual ends **15:21:23 UTC**: **454.025905 JUNO / $4.19**.
Opening stock is not income. Earlier October staking revenue remains unavailable;
it must not be described as zero. Daily periods use historical opening USD quotes,
never current repricing. The archive and quote cache are new collector-owned files.

Community Pool outflows were checked against matching SDK withdrawal events by
transaction message and denomination. No unmatched outflow was found in the
current archive. Recorded zero expense accounts and recorded surplus can therefore
be shown provisionally. Zero Other income means no other *recorded* income;
unmeasured withdrawal dust and validator-removal remainders remain excluded.
Consolidated sums require every unit's recorded review to pass; missing/failed
sources or unknown payments must not silently become zero. No complete module
balance reconciliation or full October staking P&L is claimed.

Validation: **144 Node tests and 65 targeted Python tests passed**. Final PR #187
head `163a32e756b1c3f65702a6b688ba9705324133bd` passed
[frontend/contract CI 37490902889](https://github.com/cristianoneta/neta-dao/actions/runs/37490902889),
[browser CI 37490903045](https://github.com/cristianoneta/neta-dao/actions/runs/37490903045)
and onboarding check 37490902854. Browser coverage includes Community Pool,
Delegation Programme and consolidated statements; mobile and desktop screenshots
were inspected. [Production Treasury run 37491282504](https://github.com/cristianoneta/neta-dao/actions/runs/37491282504)
succeeded, including the dedicated Delegation collector. Production frontend CI
37491282485 and [Pages deployment 37491472688](https://github.com/cristianoneta/neta-dao/actions/runs/37491472688)
succeeded. Deployed data/code commit at verification: `516af0cc8047da7dda5fa903ef30c779351fad38`.
Live browser checks confirmed **Delegation income/result $4.19, expenses $0.00**,
and **Juno consolidated income/result $168.03, expenses $0.00**, as a dated,
provisional checkpoint. Existing bot exports and holdings history are preserved.

Home copy is updated to 6 October: DAO/SubDAO navigation, Community Tax, daily
staking accrual and recorded-total limitations. The Home element/attribute sequence
(except article dates), layout, CSS and artwork are unchanged and checked live.
A verification follow-up corrects the consolidated event label: non-transaction
staking accrual and SDK reward settlements are not labelled internal treasury
transfers merely because the distribution module also holds Community Pool assets.
The existing internal cash-transfer accounting logic is unchanged.

Daily accrual failures retain existing entries and block provisional totals. If a
later receipt replay changes claims in a recorded interval, collection stops for
reconciliation rather than silently rewriting income. Missing historical state or
missed UTC boundaries need source recovery; never move the opening baseline forward
or count existing claimable holdings as new revenue.

## Community Pool October tax accounting — LIVE, 2026-10-06 15:25 UTC

[PR #185](https://github.com/cristianoneta/neta-dao/pull/185) is merged as
`7ca484404c6a8e30a4cd68cda271abc9c7e6ce80`. Community Tax now appears in the
shared Income statement and Treasury events on the live Community Pool page.
The initial October backfill is complete …6952 tokens truncated…s.
Lost/unknown submissions stay locked until reconciled; no automatic resend occurs.
The published PR #169 purchase UI combines registry verification with Check availability,
and local preparation with Start registration. Buy name / Buy and confirm in Keplr
explicitly label payment; renewals use corresponding renewal labels. Load my name
verifies the registry on demand. Commitments are non-exclusive and valid for one
hour; the matching on-chain deadline is displayed and checked before purchase.

The accepted annual tariff is USD 99/19/5 for 3/4/5–32 characters, for both
registration and renewal, 1–5-year terms, 365-day years and 30-day grace. Mainnet
fees target the main NETA DAO, not Operations. The owner subsequently approved reusing the existing Treasury WYND NETA price,
with scheduled 30-minute refresh and up to 24 hours of signed validity. Registry
source v0.3.1 accepts shared-price hooks in addition to legacy individual quotes;
its new WASM is pinned separately under `assets/names-mainnet/`. Existing deployed
UNI-7 code and historical artifacts are unchanged. `names/publish-snapshot.mjs`
signs the collector's explicit `nns_price` offline in the main DAO job; no new
market polling or Render service is needed. `snapshot-client.mjs`, shared core
validation and `NamesV2Client.snapshotQuote` support reviewed snapshot payments
and existing recovery. The normal page/reader/wallet now supports both chains; UNI-7 retains
its old local individual-quote flow. Mainnet adapters and browser price-key setup
are implemented and synthetically tested. The owner supplied the public price key, now pinned in the separate deployment page.
Owner decision: registry/profile upgrade rights initially belong to
`juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`, transferable to the DAO later.
The owner wallet also controls tariffs, purchase pause and price-key rotation;
the main DAO is the fee recipient. Registry v0.3.1 makes application admin
independent of that recipient and starts with USD 99/19/5 while paused. Upgrade
authority is set separately in the outer instantiate message. A synthetic
migration test verifies authority, state preservation and subsequent DAO transfer.
The owner completed four mainnet transactions and exported matching two-provider
paused observations at 13:54 Berlin. Registry code 5168 and profile code 5169 are
recorded in `deployments/nns-mainnet.json`; exact receipts and verification procedure
are in [deployment evidence](NNS_MAINNET_DEPLOYMENT_2026-10-05.md). PR #161 is merged with
all four checks passed, including live verification run `37307194424`. The owner corrected the PEM delimiters in the existing Actions secret at 19:38 Berlin.
Fresh Main DAO run `37350238171` published the first signed price; Pages run
`37350292762` passed and the served file matched. Signature, deployment binding,
source rate and 24-hour observation-based validity were independently verified.
The two-provider check passed via GitHub Actions at 19:49:53 (run `37307194424`,
job `111902537250`): Polkachu and STAVR agreed on code/config and paused state.
Use that read-only workflow if direct assistant requests are blocked; normal
page reads use one verified provider with fallback. See the recovery section in
[deployment evidence](NNS_MAINNET_DEPLOYMENT_2026-10-05.md).
PR [#158](https://github.com/cristianoneta/neta-dao/pull/158), merge
`62f12f1a0c672a776a5f3500ab4e8e8a09b93e42`, passed all 11 final PR checks,
three main checks and Pages `37302003843`; 15 served assets matched SHA-256.
The [targeted review](NNS_SECURITY_REVIEW_2026-10-05.md) records 210 passing
Rust/Node tests and browser evidence, with remaining trust/launch gates.
The main Names page now provides owner-only reviewed purchase opening/pausing
using the existing exact-transaction journal and Keplr bridge. Opening requires
a valid signed price; review/config/wallet are rechecked before signing and after
wallet return before broadcast. Tariff editing has no dedicated mainnet panel yet.
Owner-confirmed activation (18:17:20 UTC) and first mainnet registration
(18:20:13 UTC) are now recorded. `cristiano.neta` belongs to the approved owner,
generation/revision 1, expiry 2027-10-05T18:20:13Z. Successful STAVR REST receipts
show 4.755098 NETA debited to the registry and forwarded to the main NETA DAO;
fresh identity/resolve reads agree. See [launch evidence](NNS_MAINNET_DEPLOYMENT_2026-10-05.md)
for hashes and the single-provider verification boundary. Mainnet renewal/transfer
and validator E2E are still unverified; Treasury receipt accounting is published with partial coverage.
See [runbook](../names/README.md) and [historical snapshot evidence](NNS_SNAPSHOT_RELEASE_2026-10-05.md).
The earlier continuous WYND server is deferred, not hosted. Its stricter policy
is not the policy of the approved snapshot system.
The existing UNI-7 registry needs an explicit admin `set_tariff` transaction via
the lab Annual pricing section; source/UI changes do not alter deployed config.
Its activation remains unverified until that wallet receipt/config is checked.
`names/mainnet-plan.mjs` prepares unsigned mainnet deployment and admin-wallet tariff
review material. The approved owner wallet can set the mainnet tariff or purchase availability. Deployment transactions are
separately recorded in the production manifest and receipt bundle.
Original WASM/bootstrap tariff and signed historical fixtures remain unchanged;
new installations also apply the approved tariff before purchasing. Quotes read
the current on-chain tariff/version.
Free DAO namespaces, verified receiving addresses, private contacts and
DAO-authorized profile proposals remain later work. Browser-local lifecycle
notifications are published in PR #169; hosted checks, Pages and served files were verified on 2026-10-06.

## UNI-7 faucet

`juno-faucet.html` is a separate tool linked from the common footer. It supports
Keplr, validators/commission, balances/delegations/unbonding/rewards, reviewed
stake/unstake/reward transactions, whole-JUNOX donations and 25-JUNOX requests (PR #147; Pages assets and Render `/status` verified 2026-10-05).
The public API/address are pinned in `juno-faucet-config.mjs` and the HTML CSP.

Render uses durable SQLite, ADR-36 ownership proofs, rolling 24-hour per-wallet
cooldown and aggregate request/payout/concurrency limits. The frontend requires
`usage-guards-v1`, `uni7-exact-hash-v1` and `bank-send-gas-v1`. These are application
limits, not a hard hosting invoice cap. Render auto-deploy is off; backend changes
need a manual deploy, while static Pages changes do not.

Reward and 15-JUNOX donation receipts were verified. Real payout/repeated-request/
restart/fresh-empty-wallet checks and stake/unstake evidence remain unrecorded.
Fresh service readiness alone does not close these gates. Read [faucet handoff](HANDOFF_NEXT_CHAT_FAUCET_2026-10-04.md)
for current observations and [faucet README](../faucet/README.md) for operation.

## Governance: two different APIs

| Item | Operations | Juno community review |
| --- | --- | --- |
| Workshop network | UNI-7 | UNI-7 |
| Configured address | `juno1d2xdlvy23am07twe046zzxxndjtccgpwwl3pyu5g98u07qu3nyqqkaz65h` | `juno18d3mzk3ver06zfr5nf752aycss75vtcqd8fsdcuuzmh5mzj4cm6qrgx3fw` |
| Source | Other repo: `contracts/neta-governance/` (legacy) | This repo: `contracts/neta-proposal-workshop/` v0.3.0 |
| Publish / revise / finalize | Positive configured voting power | At least 1 delegated JUNOX and 1 staked test NETA via access mock |
| Comments | Strictly greater than 10 active NETA threshold | Same dual gate; 30-second comment cooldown |
| Finalization | `finalize_and_submit` sets UNI-7 status `voting` only | `finalize` records latest version/hash, closes discussion |
| Withdrawal UI | Discussion author must also be config owner; `set_status: declined` | Discussion author may `withdraw`; contract allows broader pre-submission withdrawal than UI |
| Thread encoding | Body markers `[[NETA_THREAD:…]]` / `[[NETA_REPLY:…]]` | Native title/parent/version fields |

Recorded Juno code ID 114, access mock
`juno10739807rjqkf4kmtvpu5ll5e67dkch82xzgph83cmn5h8n0fxmnszasg86`,
review checksum `6eb604c255d01414880bdcb9cc1d1df69dc2507f25ffc6e6d51388945ff63f22`.
The canonical Juno address is in `neta-governance.js`, not just localStorage.
No new on-chain deployment/state verification was performed in this docs review.

Mainnet Operations history comes from
`juno1m9skms04ymmhsyc2q9cguja47d07mljsfnvm8f584dc645urxvjsjc9ep0`.
For an open, non-native proposal, `selectChain` exposes vote buttons and
`mainnetSigner` requests `juno-1` before a module `vote` execute. Native Juno
history/parameters use `x/gov`; its vote buttons are hidden and native deposit/
submission is absent. No review-to-mainnet submission adapter exists.

Drafts are stored per DAO in browser localStorage. Published revisions/comments
are chain records. `dao_deliverable_v1` records in `actions_json` are plans, not
executable Cosmos messages; future adapters must separate them.

Completeness and implementation limits: Operations mainnet history stops after
20 pages of 30; workshop pagination stops after 100 pages of 100. Legacy revision queries ignore cursors; the frontend now queries them once and
shows an explicit potential truncation warning at 100 records. Recovery queries for some writes inspect only 100
records. Do not promise unlimited/full history without these qualifications.
The legacy contract has no v0.3.0 hash/JSON-array/cooldown/withdraw hardening, and
converts failed access reads to zero. Frontend checks are not contract guarantees.

## Treasury: live snapshots, limited accounting

The [accepted P&L draft](TREASURY_PNL_DRAFT_2026-10-05.md) remains the design reference.
The [2026-10-06 receipt-accounting implementation](TREASURY_ACCOUNTING_2026-10-06.md)
adds period/category views and an isolated NNS receipt collector in the existing
main DAO job. NNS subtotals use the transaction’s accepted conversion rate;
complete income, paid-expense and result coverage and reconciliation remain unavailable.
The follow-up below adds explicitly provisional totals for reviewed recorded activity.
The old fictional Treasury forecasts, allocations and payments are removed from
the live page source. Publication status belongs to the implementation record.

| Owner | Inputs / outputs |
| --- | --- |
| `scripts/update_treasury.py` | Operations Juno DAO core `juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl`, Osmosis proxy `osmo1xjfyz4f7da2yu43c0ptlswyln50wqyj53495sesaq40ja5megq4qms9f80`, native Juno Community Pool; writes `current.json`, `history.json`, `juno-community-pool.json`, `juno-community-history.json` |
| `scripts/update_treasury_events.py` | Juno core/Osmosis proxy TX indexes; writes `events.json` |
| `data/treasury/token-registry.json` | Versioned input mapping, not an output staged by the scheduled workflow |
| `treasury.js` | Refetches committed JSON on load, Refresh and every 60 seconds; renders assets, history and Operations events |

The 15-minute workflow publishes only after balances and event collection
succeed. Event collection and push each retry three times; pushes rebase with
`-X theirs`. Preserve collector ownership and review overlapping-file changes
rather than assuming this conflict strategy is a general safe merge.

Daily history is captured during Berlin hour 21 with `TREASURY_DAILY_SNAPSHOT=auto`,
replacing the entry for the same UTC date on each successful run in that hour.
It retains at most 730 records; no backfill guarantees a missed day. The frontend
replaces today's history point with the current snapshot in memory.

Assets include native/IBC coins, configured CW20s and eight configured WYND LPs
including direct/staked/claim shares. LP USD value is counted once via underlying
reserves. Unpriced assets and sub-USD-50 assets/warnings remain inspectable.
Core balance failures fail collection; unresolved asset prices can yield a
`PARTIAL` snapshot and are excluded from the USD total. The UI labels this a
priced-assets subtotal and groups valuation warnings inside the collapsed small/unpriced
asset details (owner UI decision, 2026-10-05).

History market effect revalues opening quantities at closing implied prices;
the remainder is labeled net flow. `economicAssets` groups by **symbol**, not a
verified universal asset ID. It can consolidate internal transfers but is not
transaction-derived cash flow and can be distorted by symbol collisions,
LP composition and changing coverage not captured by the available records.
History metrics/chart are withheld when excluded-price coverage changes across
the selected range; missing prices must never be interpreted as a cash outflow. Balances are fetched at latest endpoints;
the recorded Juno height is context, not height-pinning of every query/chain.
Native metadata uses a persisted exact-denom registry and traces. Unknown IBC
base names no longer inherit USDC/DAI/ATOM prices; they remain unpriced until
reviewed. Unreviewed native/IBC decimals now remain unknown and quantities display raw units. Unpriced LP underlying
assets now also make the snapshot PARTIAL. Registry changes are not automatically persisted.
The five reviewed Osmosis routes are explicitly chain-scoped in the registry; see
[Treasury valuation correction](TREASURY_VALUATION_FIX_2026-10-03.md) for dated
incident evidence. Current data timestamps/status belong to the exported JSON.

Event ledger: schema v2, chain/hash deduplication and optional proposal-title
metadata. Main NETA and Operations Juno/Osmosis now use REST receipt queries with
fresh chain identity, exact receipt timestamps, anchored watermarks, 100-block
overlap and 20-block tip delay. Daily replay starts at a verified recent floor
before 1 October and filters by the exact UTC cutoff; no older backfill. Existing
older records stay intact. Empty native indexes no longer prevent CW20 discovery.
Missing known receipts, changed amounts/identity, corrupt prior JSON and truncated
pages fail without replacing valid exports. `TREASURY_EVENTS_FULL_REPLAY=1` replays
from this accounting floor, not chain inception. Atomic writes preserve collector
ownership. Supported native/CW20-shaped movements are observations; unknown token
contracts retain raw units without guessed prices/decimals. Failed attempts do not
become payments. This is not a complete CW20/LP or module-distribution ledger.
The 2026-10-06 release runs retained all 57 older Operations records and found one
main NNS payment; no new Operations receipts were returned in the scanned range.
That empty result is not a proof of zero economic activity. The exact NNS Treasury
leg is cross-referenced to its payment-time ledger entry once; remaining movements
stay unreviewed. Full P&L, balance reconciliation and native Community Pool
accounting remain unavailable. See [release evidence](TREASURY_CUTOFF_2026-10-06.md).

`treasury.js` now aborts superseded requests, bounds fetch time to 15 seconds and
checks a request epoch before changing shared state or the UI. Late responses
cannot overwrite a newly selected DAO snapshot. See the security audit for tests.
Recurring cash flow, obligations, milestone payments and runway remain future work.

Main DAO snapshots use a separate 30-minute workflow and collector
`scripts/update_main_dao.py`; `data/daos/neta-status.json` must be read alongside
underlying snapshot timestamps. Membership has its own 30-minute workflow.
Neither replaces Operations exports. Scheduled cadence is not a freshness guarantee;
check latest timestamps and actual runs. The maintenance checkpoint records the
observed data lag and successful latest collector runs without claiming live data.


## RELAY: main inbox versus encrypted lab

PR #169 (published and verified on 2026-10-06) gives NNS system notices a Names filter, unread state and identity-scoped
history: first-registration welcome, renewal confirmation, outgoing and incoming
transfer notices, 6/3/1 calendar-month and 14/7/1-day reminders, expiry and grace-end
notices. Links open the correct profile/renewal menu without signing. Each observation
verifies registry/name identity; renewal supersedes previous expiry reminders and
transfer stops the old owner's reminders. Browser-local storage is scoped to
wallet, chain and registry. Updates occur with a connected wallet, on confirmed
actions and every 15 visible minutes; there is no offline push/email delivery.
Missed reminders catch up to the current stage. See [release evidence](NNS_FLOW_NOTIFICATIONS_2026-10-05.md)
for tested behavior and publication status. This is separate from private messaging.


Main `relay.js` polls followed, configured DAO proposal modules (at most 4 × 30 records each) and
native Juno proposals (latest 100) at most every 60 seconds while visible.
Visibility restoration respects that interval; fetch timeouts now abort the request.
It does **not** poll the UNI-7 workshops. Change detection can report new/status/
content updates from those sources; a `NEW REVISION` branch is not proof of a
connected workshop revision feed. First load seeds up to eight already-read
current notices, not an unread flood. Up to 200 events, favorites, baselines and
read state stay browser-local. No push, service worker or cross-device sync.

Inbox has feed and reader with current summary/activity. Favorites are managed
in Directory using Follow buttons and the Followed filter. RELAY has one navigation
level: Inbox, Directory, Contacts, My profile and .neta name. The old Names and
Following links redirect to Directory; browser Back/Forward restores destinations.
Operations and Juno Governance subscriptions use the existing browser-local storage
key, with synchronized follow controls in the Operations profile. There is **no
watchlist sidebar** in `index.html`. Zero unread badges
are hidden. Composer input lives temporarily in DOM; submit only prevents default,
Discard clears/closes, and SEND is disabled. Main UI contains no private messages.

Recorded mailbox identity: UNI-7,
`juno13uft9dl34x9wdzcxnm80q8m8sh5cw04lkskzknm9vc0wduxchdxsrnr4pa`,
creator `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`, label
`NETA RELAY mailbox v0.1 · UNI-7`, code hash
`e02c7918d1f8da0f662a0720fc3668765d79ededce8e9e9dcccff9aae2b9e64a`.
The pinned deployed mailbox is v0.1: hardcoded UNI-7,
no funds, no stake gate, one current device, max 16 prekeys, max 4096 ciphertext
bytes, 10-second sender cooldown and inbox pages up to 50. There is no historical
device registry, mainnet network configuration or mainnet 5-NETA implementation.

| Page / module | Actual capability |
| --- | --- |
| `relay-mailbox-status.js` | Read-only identity check when main composer opens |
| `relay-testnet-setup.html` | Admin Keplr upload/instantiate helper; existing deployment recorded |
| `relay-uni7-readiness.html` | Public two-address identity/device/inbox-header diagnostic; no register/decrypt/send |
| `relay-uni7-client.mjs` | Identity and wallet binding, public queries, prepared-device registration; loaded by lab, not main index |
| `relay-uni7-lab.html` / `.mjs` | Separate real Keplr-capable lab: create/unlock, register, encrypted send/receive, local archive/reload |
| `relay-uni7-archive.mjs` | Wallet-scoped AES-GCM readable-history archive, separately HKDF-derived key |
| `spikes/relay-corecrypto/` | Native/browser fixtures, key vault, DB backup experiment, lock/outbox/envelope/transport, mocked integrated lab |

Lab uses Wire CoreCrypto 10.5.3 Proteus, GPL runtime/license in `assets/relay-crypto/`,
eight initial prekeys and 1800 UTF-8 bytes of text. It persists registration,
outbox and inbound intents before sensitive state changes; incomplete state
blocks continuation. No silent rotation or automatic off-device backup exists.
Current receive queries need the sender's **current** generation; messages from
rotated generations fail closed. The lab does not expose revoke/block/add-prekey
or rotation UX. Inbox fetch is one page per check; repeated checks can advance.
Legacy/uncertain outgoing intents still lack complete user-facing reconciliation.
PR #101 adds transactional local receive rollback and invalid-ciphertext quarantine;
storage failures preserve the journal and lock. It is not remote backup.
Follow-up sends in an established current-generation session no longer require
an unused recipient prekey. First contact still requires one.

Two mocked browser profiles exchanged/replied and reloaded successfully in PR #97.
No real two-Keplr UNI-7 E2E evidence is recorded. The older DB backup fixture
restores an unread message in a fresh profile; the integrated lab restores local
already-read archive after reload. Neither implements automatic remote recovery.
GPL was chosen for the isolated lab; production distribution/security review is
still a separate gate. `spikes/relay-corecrypto/package.json` is private/UNLICENSED;
do not infer a blanket repository license from the vendor license.

## Remaining release gates and evidence

Mailbox v0.2 consent/historical-identity source is tested, but the deployed v0.1
artifact/address above remains pinned. Sender-generation history, consent/refill
integration, coherent off-device backup/anti-rollback and rotation/exhaustion/restore
coverage remain open. Keep mainnet messaging and the main composer disabled.
See [security continuation](SECURITY_CONTINUATION_2026-10-03.md),
[security audit](SECURITY_EFFICIENCY_AUDIT_2026-10-02.md) and
[recovery decision](RELAY_RECOVERY_DECISION.md). Delivery records are plans, not
executable payment instructions. AtomOne remains research, with no active adapter.

PR #145 passed 84 root Node tests and applicable contract/frontend, faucet and
browser checks. Browser tests use synthetic chain/wallet adapters, not live operator
consent. Screenshots were inspected at 320/390/768/1440 px. Main and Pages passed;
eight changed public assets matched after deployment. Exact run IDs are in the
NNS handoff and PR. No full repository security re-audit is claimed by this cleanup.

CI is path-filtered; ordinary README/HANDOFF/docs edits do not trigger application
suites. Contract Markdown and the RELAY security document do match some filters;
`faucet/**` also triggers faucet CI. See `.github/workflows/` and actual checks.
`relay-client-assets.yml` is a branch-specific preparation writer, not a recurring
main publisher. Follow the local verification commands in [README](../README.md).

## Owner mainnet preparation

`names-mainnet-setup.html` creates/restores an owner-controlled Ed25519 price key
locally, downloads a private PEM backup and a public deployment plan, and links
to the repository Actions-secret form. It stores only the public key and has
`connect-src 'none'`. Private-key export/copy requires an explicit click. It does
not install the secret, deploy contracts or enable purchases. Public-key continuity
and matching backup restoration avoid silently replacing an existing authority.


### Treasury follow-up — 2026-10-06 (published in PR #177)

Provisional zeros and Income/Expenses/result now require a successful recent receipt
refresh and exact movement review; partial index coverage remains explicit.
Treasury event tags come from exact NNS receipt matches; unknown legs remain
Unclassified. Proposal actions expose shared spending categories, retained as
`dao_accounting_v1` metadata in local drafts and workshop revisions, bound to the
unchanged action. Mainnet spend execution/matching is still not connected, so a
planned category alone never posts an expense. See [the implementation record](TREASURY_CUTOFF_2026-10-06.md)
for the schema and boundaries. PR #177 evidence is recorded at the top of this document.
