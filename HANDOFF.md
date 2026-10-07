# NETA DAO handoff

## Personal messaging continuation — 7 October 2026

Read the newest section of [the current handoff](docs/HANDOFF_NEXT_CHAT_2026-10-07.md).
PR #195 now integrates main through PR #213 at application head
`052e736a87d44bbe3743524b1a547822bc6dbf81`; all five hosted workflows passed.
Local root/Faucet/backup tests passed (200/66/10). Both verification REST providers
returned the same fresh Juno block at 10:23 UTC; primary PolkaChu RPC works,
WhisperNode returned 502. Seven served deployment files matched main exactly.
The published owner page was inspected without connecting a wallet.

Next: resume the saved attempt in the owner's original browser via **Check pending
transaction**, then obtain and verify the actual upload/creation receipts.
PR #195 stays draft/unmerged and both personal pins remain null. Live shared Render
backup, off-service recovery and the two-wallet pilot still need evidence. Preserve
later scheduled snapshots at final integration. Older PR-head/status entries below
are historical; DAO inboxes and payment requests remain subsequent work.

## Latest verified checkpoint — 7 October 2026, 12:10 Berlin

The owner requested a fresh handoff after another stalled chat. Read
[the current handoff](docs/HANDOFF_NEXT_CHAT_2026-10-07.md) for the exact continuation,
published URLs, timing evidence, automatic-update intervals and remaining gates.

- Community Tools, shared header within that section, recovered pre-quorum votes
  and combined first-participation evidence are published through PRs #208/#210/#211.
  The previous handoff was merged in #212. The broader request for the Faucet header
  on all subpages remains a domain-wide scope check; other pages are not verified
  by the Community Tools implementation.
- The saved archive at **09:57:31 UTC** covers every block through **42,453,915**,
  with **20/25 observed first signatures**. The same five records remain unknown.
  This is archive coverage, not the current number of signing validators.
  Collector `37603987812` and Pages `37604149174` succeeded for data commit
  `bfcc2afb210fbd763c19e7bd31d7ca9080dcc377`. Latest inspected main was
  `592beb63251a070afea4b1d04aa3a1bd50f0e069`, Pages `37604415482` successful.
- Current participation refreshes every 30 visible seconds; archive collection runs
  every ten minutes independently of an open page, and the browser reloads it at
  most every five minutes. Scheduler/provider/Pages delays may extend the wait.
  First evidence is an upper bound on readiness, not an exact installation time.
- PR #195 is still the only open PR, draft at
  `39feff397f600a25057087285e7710d032326aca`. Its prior five checks passed.
  Real owner receipts, shared Render backup verification and the two-wallet
  mainnet pilot remain outstanding. Issue #119 remains open and partly relevant;
  its unactivated-NNS wording is stale and should be reconciled separately.
- Next: integrate newer main into the personal candidate, recheck providers and
  recover the existing owner deployment with **Check pending transaction**.
  Complete personal messaging first, then shared DAO inboxes/recovery, then
  payment requests/invoices and Treasury linkage. Only sending requires `.neta`.

This refresh changes documentation only. No fresh live-browser audit, owner
transaction, paid service or mainnet messaging activation was performed.

## Current continuation — 7 October 2026

Community Tools follow-up: the owner approved publishing the compact tracker under
`/community-tools/validator-upgrades/juno-v31/`, alongside
`/community-tools/juno-faucet/`. The shared footer opens `/community-tools/`.
The default participation-evidence column combines saved votes and first block
signatures as upper bounds; actual software readiness remains unknown. See the
tracker document for the collector and evidence.

**Start with the [7 October handoff](docs/HANDOFF_NEXT_CHAT_2026-10-07.md).** It supersedes older
status/next-step instructions below, which are retained as history.

- Live Juno tracker: https://dao.netareborn.com/community-tools/validator-upgrades/juno-v31/ (old root URL redirects).
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
earlier separate-service proposal. See [the implementation and operating plan](docs/RELAY_SHARED_PILOT_2026-10-07.md),
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
[personal mailbox v0.4 security review](docs/PERSONAL_MAILBOX_SECURITY_REVIEW_2026-10-07.md).
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

See [implementation, tests and release gates](docs/DAO_MAILBOX_IMPLEMENTATION_2026-10-06.md).
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
[DAO mailbox design](docs/DAO_MAILBOX_DESIGN_2026-10-06.md). Shared DAO inboxes,
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
The initial October backfill is complete through the first production checkpoint:
**185,121 consecutive blocks**, 42,244,897–42,430,017, through
**2026-10-06 15:21:10 UTC**. The 188 tax entries total approximately
**18,135.997553 JUNO / $163.17**, using historical daily-opening USD references.
All observed tax allocations across six UTC dates have a quote. These figures
are a dated checkpoint; preserve newer bot exports. Full Pool accounting remains
partial, including other module income, expenses and operating result.

Validation and publication evidence:

- Local: **140 Node tests and 58 targeted Python tests passed**.
- Final application head `90a2d8a3b26f6adefaf51a911b2684681ab78312`:
  [frontend/contract CI 37486227103](https://github.com/cristianoneta/neta-dao/actions/runs/37486227103)
  and [browser CI 37486226828](https://github.com/cristianoneta/neta-dao/actions/runs/37486226828) passed.
  Community Pool browser coverage includes 320, 390, 768 and 1440 px, statement
  filters, explicit historical valuation and block-linked events.
- Production [Treasury run 37486842132](https://github.com/cristianoneta/neta-dao/actions/runs/37486842132)
  completed successfully. Its incremental scan added **382 blocks in four seconds**,
  and all three receipt/statement refreshes completed. The earlier local Operations
  refresh failure did not recur in this run. Bot data commit: `59403333ea1be8bcf0e89d972aeaa2d43dd15e0a`.
- [Production frontend CI 37486841987](https://github.com/cristianoneta/neta-dao/actions/runs/37486841987)
  and [data deployment 37486960908](https://github.com/cristianoneta/neta-dao/actions/runs/37486960908) passed.
- Live browser verification confirmed **Community Tax $163.17**, October 2026,
  “Historical daily USD references”, block-linked Treasury events and unavailable
  expense/result totals. The served accounting export is schema 3 with CURRENT
  block coverage through the height above. The provider warning about unavailable
  older governance pages remains visible; it is not silently removed.

Update cadence: Operations, Community Pool and Delegation Programme collectors
are scheduled every **15 minutes**; NETA Main every **30 minutes** at :07 and :37.
An open Treasury page reloads published exports every **60 seconds**. Collector,
GitHub scheduling and deployment latency apply; Refresh does not trigger a chain
collector. Existing holdings snapshots and published functionality are preserved.

- Community Tax is derived from each block's fee-collector transfer minus emitted
  validator rewards, using exact decimal arithmetic. It includes allocation
  rounding; the current 10% parameter and pool-balance differences are not used.
- The single existing Treasury workflow resumes the scan at the last checked block.
  The initial October backfill is the expensive step; normal runs read only new
  blocks. Checkpoints survive individual provider failures.
- Tax entries populate the shared Income / Community Tax row and Treasury events.
  They link to blocks, with explicit ranges, never invented transaction hashes.
- USD values use a cached historical UTC daily-opening market reference, explicitly
  indicative rather than an executed payment rate. Missing quotes stay unpriced.
- Full expenses/result remain unavailable: withdrawal rounding, validator-removal
  remainders, generic payment classification and balance reconciliation are open.
  A passed proposal does not establish a paid expense.
- Existing allocations survive a failed subsequent funding/price refresh. Duplicate
  denominations, overlapping ranges and mismatched coverage fail validation.

Owner asked whether tax could be estimated between snapshots. This is possible as
an explicitly labelled estimate only after correcting for payouts and other inflows.
The current saved daily snapshots do not align to UTC month boundaries; historical
state queries attempted here failed. No estimate is silently substituted into the
verified tax ledger. A future estimate must remain separate from evidenced actuals.

See [block accounting implementation](docs/COMMUNITY_POOL_BLOCK_ACCOUNTING_2026-10-06.md).

## Juno Delegation Programme and Community Tax — 2026-10-06

Owner named Juno's main reporting unit **Community Pool** and added
**Delegation Programme** under Juno. The supplied core is
`juno1nmezpepv3lx45mndyctz2lzqxa6d9xzd2xumkxf7a6r4nxt0y95qypm6c0`.
Public chain config identifies **Secondary Community Pool** (code 4047; original
contract label Council). Keep the requested display name separate from identity
checks. Organizational reporting does not confer contract authority.

The dedicated collector includes height-pinned bank balances, native delegated
stake, unbonding, per-validator truncated claimable rewards and DAO-listed CW20s.
Redelegations are already counted in delegated stake. This treasury contains small
non-JUNO bank assets as well; do not hardcode a JUNO-only portfolio. Other DeFi
positions/unlisted contracts are outside discovery coverage. Separate event and
accounting files begin at the shared 1 October cutoff. Staking classification,
slashing and payment-time pricing remain incomplete; accrued rewards are holdings,
not automatically booked revenue. Juno consolidated assets include both units;
incomplete Community Pool/module accounting still blocks consolidated P&L totals.

Community Pool income now has **Community Tax** (`community_tax`) and **Other
income**, shared into Juno consolidation but not other DAOs. The live parameter
read on 2026-10-06 was **10%**. Distribution rewards include minted inflation and
transaction fees. The collector records the current rate/source/date separately
from revenue; never apply today's rate retroactively or infer tax from balance
changes. Historical block-level accruals and payment-time prices remain open.

Implementation and source boundaries: [Juno Treasury onboarding](docs/JUNO_DELEGATION_TREASURY_2026-10-06.md).
Release PR: [#183](https://github.com/cristianoneta/neta-dao/pull/183).
Application `a1930ed4ef5605e00392dd05f880e56f51466ee7` passed contract/frontend
[37475015127](https://github.com/cristianoneta/neta-dao/actions/runs/37475015127),
browser [37475015023](https://github.com/cristianoneta/neta-dao/actions/runs/37475015023)
and live collector [37475015072](https://github.com/cristianoneta/neta-dao/actions/runs/37475015072).
136 JavaScript and 62 targeted Python tests passed locally. Browser screenshots for
both Juno units and consolidation were reviewed at 320/390/768/1440px.

### Published checkpoint — 2026-10-06, 16:10 Europe/Berlin (14:10 UTC)

PR #183 is merged as `33ef6db9da688c75be1dd323dcab94b96735ffd4`.
This is the current checkpoint; older sections below are historical context and do
not supersede the connected adapters or the remaining coverage gaps described here.

- Main contract/frontend CI [37475921659](https://github.com/cristianoneta/neta-dao/actions/runs/37475921659)
  and NNS CI [37475921688](https://github.com/cristianoneta/neta-dao/actions/runs/37475921688) passed.
- Production Treasury workflow [37475921767](https://github.com/cristianoneta/neta-dao/actions/runs/37475921767)
  passed every collection step, including Delegation Programme. Its LIVE snapshot
  is pinned to height **42,428,202**, observed **2026-10-06 14:03:56 UTC**.
- Pages [37476007738](https://github.com/cristianoneta/neta-dao/actions/runs/37476007738)
  successfully deployed bot snapshot commit `3d54ccd0fd54ecb0c17321c5637f26d083ea279a`,
  which includes the release. Preserve this and newer generated data when continuing.
- Ten served HTML/JavaScript/module files matched reviewed source byte-for-byte.
  Production browser inspection confirmed both unit names, **2/2 units** in Juno
  consolidation, separate liquid/delegated/reward positions, and the Community
  Pool's **Community Tax / Other income** rows. Its accounting basis displays the
  observed **10%** rate and the historical-coverage limitation. No wallet action.

Verified production entry points:
[Community Pool](https://dao.netareborn.com/index.html?dao=juno&chain=juno&subdao=main#treasury),
[Delegation Programme](https://dao.netareborn.com/index.html?dao=juno&chain=juno&subdao=juno-delegation#treasury),
[Juno consolidated Treasury](https://dao.netareborn.com/index.html?dao=juno#treasury).

At that production snapshot, Delegation Programme held **2,916,586.371620 JUNO
available**, **14,999,522.938953 JUNO delegated**, **3,830,019.995514 JUNO claimable**,
and no unbonding JUNO. Other assets: **2.096638 ATOM available + 0.140151 ATOM
claimable**, **686.021124 BTSG** and **0.001403 USDC**. These are dated observations;
subsequent generated snapshots supersede them.

### Next continuation

1. Start from fresh `origin/main`; preserve bot snapshots and use a branch/PR.
2. If continuing Treasury accounting, reconstruct Community Pool block/module
   accruals and payouts from **1 October 2026 UTC** and attach historical USD prices.
   Do not use today's Community Tax rate retroactively or infer revenue from
   changes in the pool balance. Do not restart pre-cutoff backfills.
3. Delegation Programme still needs staking-receipt/slashing classification,
   payment-time valuation and reconciliation; claimable holdings are not cash income.
   Generic proposal-category-to-executed-payment matching also remains open.
4. Keep Community Pool and consolidated P&L totals unavailable until the missing
   evidence is covered. Daily history will grow through the existing workflow;
   there is no need to initialize this DAO again or add another scheduled collector.


## DAO hierarchy and consolidated Treasury — 2026-10-06

Owner approved Chain → DAO → SubDAO. NETA is the organization; Main and Operations
are its units. **Operations is formally a SubDAO of NETA without an asserted
on-chain parent link.** The canonical directory stores this organizational
relationship separately from contract identities and signing capabilities.

- DAO selection defaults to Consolidated overview; Main is first in the unit
  group, remaining SubDAOs alphabetical. `?dao=neta` is the organization overview;
  `?dao=neta&subdao=main` selects Main. Old `?dao=neta-operations` links still select
  Operations. Scope is persisted separately; drafts and journals keep their IDs.
- Consolidated assets include each configured custody account once, including
  Operations' Osmosis proxy. Unit cards show source times, addresses and direct
  links. Missing/stale units remain explicit; unpriced assets remain partial.
- Consolidated P&L requires reviewed data from every included unit for period
  totals. An expandable unit breakdown preserves attribution. Exact reciprocal
  same-chain transfer legs can be eliminated only from the group view; unmatched,
  ambiguous or IBC legs without packet linkage remain unresolved. External gas
  and unknown movements are not silently eliminated. Source ledgers are unchanged.
- History uses common UTC snapshot dates only; no missing-unit forward filling.
  Snapshots may have different observation times. This remains estimated holdings
  attribution, not transaction-derived P&L or balance reconciliation.
- Other workspace sections continue to show the selected unit (Main in overview),
  with an explicit scope note. There is no combined governance authority or vote.
- Owner removed the network/testnet badge entirely from **Treasury**. Actual
  testnet areas retain their contextual indicator and transaction protections.

Remaining: generic expense execution/pricing and native Community Pool block/module
coverage stay incomplete as documented below. Consolidation does not close them.
Local validation: 135 JavaScript tests and 8 DAO onboarding tests; hosted browser
checks cover 320/390/768/1440 px, missing ledgers, race handling and scope navigation.
Release CI/deployment evidence belongs to the hierarchy PR.


## Treasury header refinement — 2026-10-06

Owner requested removal of USD/NETA buttons and the right-side “Live assets /
Partial accounting” badge on every Treasury page. The shared header now omits
both, moves the snapshot timestamp/source into its introduction and removes
the separate controls row. USD and coverage labels remain at the P&L.
Accounting adapters and the remaining native-module boundaries below are unchanged.

## Latest continuation — all-DAO accounting adapters (2026-10-06)

Owner asked to connect the remaining DAOs. Operations now has its own generated
accounting review for Juno core + Osmosis proxy. Native Juno has a separate direct
funding/governance adapter. Both are configured in the shared DAO directory and
loaded by the shared Treasury UI, with strict source identity and failure handling.

**Connected does not mean complete:** Operations can show provisional zeros only
for fresh reviewed recorded movements. Community Pool totals remain unavailable
because block allocations and drip/module payouts are not reconstructed. Approved
proposal-category-to-execution matching and historical USD pricing remain open.
The native adapter never books a passed proposal as a payment. Older Juno governance
pagination currently returns a provider server error; retained recent reads carry
an explicit partial-coverage warning. No live wallet write was performed.

See [adapter implementation and remaining boundaries](docs/TREASURY_ALL_DAO_ADAPTERS_2026-10-06.md).
Published in [PR #179](https://github.com/cristianoneta/neta-dao/pull/179), merged as
`15f53ebc99bffbe2c897878797671644d8a6384d`. Application head
`275f849d054471ffce297cbb3ad32ba55b71f16f` passed frontend/contract CI
[37466866330](https://github.com/cristianoneta/neta-dao/actions/runs/37466866330)
and browser CI [37466866353](https://github.com/cristianoneta/neta-dao/actions/runs/37466866353).
Main CI [37467182865](https://github.com/cristianoneta/neta-dao/actions/runs/37467182865)
and Pages [37467476267](https://github.com/cristianoneta/neta-dao/actions/runs/37467476267) passed.
Production Treasury collector
[37467182835](https://github.com/cristianoneta/neta-dao/actions/runs/37467182835)
completed both new adapters: Operations at **12:58:44 UTC**, native Juno at
**12:58:42 UTC**, with zero observed direct post-cutoff movements. This is not a
claim of zero native module income. Main collector
[37467182948](https://github.com/cristianoneta/neta-dao/actions/runs/37467182948)
also succeeded. Preserve newer generated snapshots on main.

Ten served application assets matched local SHA-256. Production browser inspection
confirmed Operations' provisional zero income/expenses/result and Juno's connected,
incomplete state without leaked NNS rows or fabricated zero totals. The hosted
browser suite covers 320/390/768/1440 px for both new adapters. No new wallet action.


## Latest checkpoint — 2026-10-06, Treasury categories and provisional totals

[PR #177](https://github.com/cristianoneta/neta-dao/pull/177) is merged as
`ca7160eb13aacbb1937b83e4c3e8abefe290c3dd`. It follows the cutoff/favicon release
[#176](https://github.com/cristianoneta/neta-dao/pull/176).

- Accounting starts **1 October 2026 UTC for every DAO**. Preserve earlier exports;
  do not restart pre-October backfills. Connected collectors continue on schedule.
- NETA's successfully refreshed, reviewed recorded activity can show **$5.00 income,
  $0.00 expenses and $5.00 provisional surplus**, plus zeros in empty accounts.
  These are snapshot totals, not a full coverage/reconciled-balance claim. Failures,
  stale current snapshots and unresolved movements block provisional totals.
- Treasury events show **Income · NNS registrations/renewals** when exact receipt
  evidence matches. Unknown legs remain **Unclassified**. Mixed transfers are visible.
- Each proposal action has a shared spending-category dropdown. Categories persist
  in local drafts and review revisions; changing a payment invalidates its category
  binding. Internal transfers have a separate non-expense option. No wallet write
  was performed to test this feature.
- **Still open:** automatic expense posting from executed mainnet proposals. The
  category is planned-purpose metadata; the execution adapter must match approved
  actions to actual treasury legs and payment-time prices before booking. Native
  Juno Community Pool and generic Operations accounting still need adapters.
- The mint voxel-N favicon/apple-touch icon from #176 is live.

Validation: **126 JavaScript + 43 targeted Python tests** pass. Final application
head `63d91447c2915f026cedb11ca3c9f1219e50a3b0` passed frontend/contract CI
[37462995391](https://github.com/cristianoneta/neta-dao/actions/runs/37462995391)
and browser CI [37462995304](https://github.com/cristianoneta/neta-dao/actions/runs/37462995304).
Treasury/proposal screenshots were inspected at **320, 390, 768 and 1440 px**;
browser checks cover category persistence/invalidation, zero/result display,
NNS tags, DAO isolation, identity/fetch failures and keyboard interaction.
Pages [37463261077](https://github.com/cristianoneta/neta-dao/actions/runs/37463261077)
succeeded. All **13 checked served files matched source SHA-256**, including
HTML, category/event/P&L modules, shared CSS, the NNS register and favicon.
Main frontend/contract CI [37463249064](https://github.com/cristianoneta/neta-dao/actions/runs/37463249064) also passed.

Fresh collector evidence: NETA receipt refresh **2026-10-06 12:23:42 UTC** succeeded,
with **1 matched receipt, 0 unreviewed observed movements** and PARTIAL index coverage.
Main collector [37462915165](https://github.com/cristianoneta/neta-dao/actions/runs/37462915165)
and Operations collector [37463193815](https://github.com/cristianoneta/neta-dao/actions/runs/37463193815)
succeeded. Preserve their newer main-branch snapshot commits when continuing.


## Continuation — 2026-10-06, accounting cutoff and favicon

Owner narrowed accounting to **1 October 2026 onward, for every DAO**. No older
backfill. The continuation implements a shared date-bounded receipt collector,
daily delayed-index replay, exact NNS movement cross-reference and a mint voxel N
browser icon. See [cutoff implementation](docs/TREASURY_CUTOFF_2026-10-06.md). Published in [PR #176](https://github.com/cristianoneta/neta-dao/pull/176);
all four PR checks and main frontend CI passed. Both production collectors succeeded.
The main DAO now has one matched NNS movement; coverage remains PARTIAL.
Complete P&L coverage and non-NNS classification/pricing/reconciliation remain open. Native Juno
Community Pool still has no accounting adapter. Preserve existing older exports.


Updated **2026-10-06, after PR #177 publication**. Current continuation entry point for
<https://dao.netareborn.com> and `cristianoneta/neta-dao`.

## Start here

Read [the new next-chat handoff](docs/HANDOFF_NEXT_CHAT_2026-10-06.md),
[AGENTS](AGENTS.md) and [CURRENT_STATE](docs/CURRENT_STATE.md).
For any UI change also read [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md).
[Documentation index](docs/README.md) and [project priorities](PROJECT_CHECKPOINT.md)
link the owning runbooks. Fetch current main; preserve newer snapshot commits.

## Current checkpoint

The standardized Treasury statement and separate NNS payment register are **live
and verified**: [PR #174](https://github.com/cristianoneta/neta-dao/pull/174), merge
`735e997eee313e7801347ac072f09ff3b5d970ea`. Shared expandable Income / Expenses /
Operating result; NNS sources only for NETA; years 2026–2028; compact layout and
period-preserving payment drilldown. The duplicate income tile and fixed receipt
sidebar are removed. [Implementation and release evidence](docs/TREASURY_STATEMENT_2026-10-06.md).

Full DAO accounting remains unavailable. NNS subtotals are explicitly partial;
next Treasury work is reviewed expense/funding classification, payment-time prices
and balance reconciliation from 1 October onward; no older backfill.
Provisional zeros require successful refresh and exact movement review (see below);
never classify every incoming transfer as revenue.

Names purchase/management UX and local lifecycle notices are published (#169,
#171, #172). Mainnet deployment, activation and first purchase are complete.
Do not repeat them. Mainnet renewal/transfer and live-validator E2E remain open;
validator tests stay deferred. Faucet 25-JUNOX service is live with outstanding
wallet-E2E evidence. Mainnet encrypted messaging remains disabled.

## Preservation rules

- Work through branches/PRs; inspect applicable CI and verify changed deployments.
- Preserve collector-owned data, browser keys/secrets, pending journals and Render SQLite/WAL.
- Unknown broadcasts require reconciliation, not automatic resend or journal deletion.
- Owner wallet retains NNS upgrade and application administration; main NETA DAO receives fees.
  Authority transfers and all live writes need explicit owner wallet actions.
- No duplicate DAO features in `neta-website`; that repo owns `netareborn.com`.

[Detailed next actions and evidence](docs/HANDOFF_NEXT_CHAT_2026-10-06.md) supersede
old session instructions. [Previous handoff](docs/archive/HANDOFF_BEFORE_TREASURY_CHECKPOINT_2026-10-06.md)
is retained as historical evidence.


### Treasury follow-up — 2026-10-06 (published in PR #177)

Provisional zeros and Income/Expenses/result now require a successful recent receipt
refresh and exact movement review; partial index coverage remains explicit.
Treasury event tags come from exact NNS receipt matches; unknown legs remain
Unclassified. Proposal actions expose shared spending categories, retained as
`dao_accounting_v1` metadata in local drafts and workshop revisions, bound to the
unchanged action. Mainnet spend execution/matching is still not connected, so a
planned category alone never posts an expense. See [the implementation record](docs/TREASURY_CUTOFF_2026-10-06.md)
for the schema and boundaries. PR #177 evidence is recorded at the top of this document.
