# Security and efficiency audit — 2026-10-02

## Scope and assurance

Review of first-party website and DAO contracts, wallet transaction flows, RELAY cryptography integration, data collectors, browser rendering, dependency manifests and CI. DAO baseline: `ce12e579c9035e898964d3a9e7d62ca6def29ef3`; website baseline: audit branch parent in `cristianoneta/neta-website`. This is a source review with targeted regression tests, not a formal cryptographic audit or certification of deployed chain state. Third-party chains, wallets and contracts are outside the assurance boundary. No real wallet secrets or live attack transactions were used.

## Findings

| ID | Severity | Status | Finding and evidence |
| --- | --- | --- | --- |
| R1 | High, prototype availability | Open; release blocker | `relay-uni7-archive.mjs` and UNI7 receive flow persist an archive intent before authenticated decryption completes. A malformed mailbox ciphertext can leave a pending intent that blocks local receive/send after reload. The contract checks byte lengths, not cryptographic validity. The optional local adversarial browser test exercises this failure without chain transactions. Do not skip the record blindly: Ratchet state and archive state must remain consistent. |
| R2 | High, prototype availability | Open; release blocker | Initial sends consume recipient prekeys. An attacker can register multiple funded sender accounts and consume the lab's finite prekey inventory with invalid messages. Per-sender rate limits do not stop account rotation. Add authenticated acceptance/replenishment and bounded abuse handling before release. |
| R3 | Medium, prototype availability | Open | Contract deduplication includes sender and message ID, whereas local archive identity uses recipient wallet and message ID. Malicious senders can choose colliding IDs. Migrate storage and authenticated envelope identity together; add adversarial collision and migration tests. Current-generation-only sender lookup also creates availability problems for unread messages after sender rotation. |
| T1 | Medium | Fixed | `treasury.js` allowed a slow response for the previously selected DAO to overwrite the current view. Abort superseded fetches and guard every state update by load epoch; parse responses before committing them. |
| T2 | Medium, financial display integrity | Fixed | `scripts/update_treasury.py` assigned prices to unreviewed IBC assets using base-denom names/substrings. Exact reviewed denom mapping now determines prices; unknown traces stay unpriced. Unpriced LP components now force PARTIAL even when other components have a value. Display totals are not custody guarantees. |
| G1 | Medium | Fixed | Mainnet votes used the shared signing client's default `ujunox` testnet fee. The client accepts an explicit gas price; mainnet uses `0.075ujuno`. Rebuilt shared bundles are synchronized across repositories. |
| G2 | Medium | Fixed | Slow proposal detail responses and wallet/DAO context changes could cross operation boundaries. Selected-proposal and epoch checks prevent stale rendering; signing rechecks wallet accounts and context. Malformed percent-encoded public thread markers no longer abort rendering. |
| N1 | Medium, activation gate | Fixed; activation still gated | Names registry token validation now pins the exact canonical NETA contract rather than trusting symbol/decimals. Registry remains unset. Verify chain, registry address/code identity and treasury configuration before enabling mainnet writes. |
| D1 | High advisory; limited local exposure | Fixed | RELAY spike Playwright 1.55.0 affected by GHSA-7mvr-c777-76hp. Updated to 1.63.0; audit now reports zero advisories. Advisory concerns insecure installer downloads on macOS; no production wallet exploit was established. Source: https://github.com/advisories/GHSA-7mvr-c777-76hp |
| W1 | Medium | Fixed in website | Swap/IBC bind signing to reviewed parameters, freeze controls during signing and recheck wallet identity. See website audit for details. |
| W2 | Medium | Open in website | An RPC timeout after submitting a transaction can leave acceptance ambiguous. A subsequent user retry may duplicate a spend. Persist signed transaction hash/sequence and reconcile pending transactions before allowing a retry. |
| G3 | Medium, policy/availability | Open | Legacy governance permits eligible members to revise/finalize shared proposals; this is the current collaborative policy, not demonstrated outsider access. Revision growth and incomplete pagination can degrade queries. Decide explicit ownership/review policy and bounded pagination before expanding use. DAO comment display also does not enforce the workshop moderation-hidden flag. |

## RELAY release requirements

Implement transactional authenticated receive with safe Ratchet rollback or commit, per-session quarantine and independently progressing cursors. Provide authenticated backup/recovery rather than deleting unresolved intents. Namespace identities by sender and generation; retain historical sender proof resolution. Add prekey replenishment and abuse resistance. Run malformed-ciphertext, collision, rotation, exhaustion and crash/reload tests. Mainnet messaging remains disabled; this review does not approve enabling it.

## Efficiency and remaining data risks

* Shared explicit fees remove a second automatic simulation in website signing and keep the fee based on the gas estimate that passed the cap. Recovery clients disconnect after each attempt.
* Treasury history currently replays substantial chain history every refresh. Cache immutable ranges, advance cursors and validate reorganizations. Bound pool query concurrency and cache denom traces.
* Suspend view-specific refresh work when a view/tab is hidden; keep freshness labels accurate. Social author/ban checks should batch/cache rather than repeat per displayed record.
* Three separate signing bundles are roughly 1.6 MB each before compression. Measure transferred bytes and loading time before choosing shared chunks; keep signing code lazy-loaded. CoreCrypto remains isolated to the lab.
* Treasury RPC responses are trusted, not independent chain proofs. Unknown assets have approximate display metadata; cashflow grouping and event-derived labels require provenance. Add bank pagination and snapshot-height consistency before claiming complete accounting.
* CI now audits browser dependencies, pins browser workflow actions to commit SHAs and runs the new regressions. Other workflows and optimizer images still need a repository-wide immutable dependency policy.

## Validation and limits

Local DAO Node suite: 42 passing tests. Treasury Python suite: 11 passing tests, including unreviewed IBC price and partially valued LP regressions. Vendor CoreCrypto checksum verification passed. npm dependency audit passed after the Playwright update. Tracked-file scans found no PEM private-key/GitHub-token patterns; this is not a complete secret/history audit.

Browser scenarios were added for DAO switch races, malformed markers/proposal races and the RELAY lock blocker. Browser execution is still pending: the local Chromium download was invalid/truncated. Cargo is unavailable locally; contract source was not changed and Rust validation must run in CI. Do not claim these pending tests passed. No direct fund theft or wallet-key extraction was established, and absence of such a finding is not proof of safety.

## Continuation

Use CURRENT_STATE.md and HANDOFF.md together with this report. Resolve R1–R3 before any messaging activation; then W2 and moderation/pagination/data completeness. Re-run browser/contract CI before merging the audit branch. Keep report findings open until the repair and its adversarial regression have passed.

### CI evidence at continuation handoff

Website Test website run 307 passed, including browser integration and reproducible bundles. DAO RELAY browser crypto run 31 passed, including stale-response regressions and the optional adversarial test that intentionally reproduces the open persistent-lock blocker. DAO contract/frontend run 136 was still running; website production-data run 409 was pending. Check final outcomes before merging. Code checkpoint SHAs are recorded in HANDOFF.md; these follow-up documentation changes do not change the tested implementation.

## Verified continuation — 2026-10-03

Prior audit PRs Website #137 / DAO #100 merged after the current relevant checks
passed, preserving all bot updates. Served website swap/IBC/recovery bundles and
DAO Governance/Treasury/Names/shared bundle matched reviewed bytes.

R1: repaired in PR #101, merged as `bc7fb520cbb9626684ba04262b7a42835b497681`.
RELAY browser run 34 passes normal encrypted exchange/reply/reload and adversarial
malformed ciphertext, cross-sender ID collision, valid progression after quarantine,
reload and interrupted archive completion after ratchet commit. Rollback restores
an encrypted pre-receive checkpoint before retrying; unresolved older v1 intents
without checkpoints remain locked. Full off-device recovery is not implemented.

R3: new archive records use a SHA-256 routing tuple (chain, contract, sender and
recipient generations, sender/recipient, message ID). Confirmed legacy records keep
the original authenticated AAD so history survives. Historical generation lookup in
the lab still uses the current deployed device and remains a release blocker.

R2: PR #102 adds v0.2 source consent bound to recipient/sender generations, at most
one initial per approved pair and immutable historical identity queries. The deployed
v0.1 checksum/address is unchanged. No chain migration was attempted. Activation
requires new reviewed deployment/identity pinning and consent/replenishment UX;
source-level tests are not proof the deployed contract has changed.

G3 follow-up: moderated title/body no longer enter visible DOM, malicious forward/
self parent IDs cannot create reply cycles, and deep rendering stops at 32 levels
with an omission notice. Legacy revision queries no longer repeat an unsupported
cursor; a 100-record response shows potential truncation. Collaborative ownership
policy and full history completeness remain unchanged/open.

Efficiency follow-up: Treasury search bounds every query by height, rejects empty/
duplicate/inconsistent pagination, checks a stored block-hash anchor and replays a
100-block overlap after a 20-block tip delay. Missing anchors fall back to full replay;
a changed anchor or loss of a recorded transaction fails without publishing over the
existing ledger. This does not fix unindexed CW20/LP cashflow or guarantee RPC honesty.
Local continuation checks: 42 Node and 14 Python tests passed. Browser/contract CI
for this follow-up must pass before merge. Mainnet messaging stays disabled.

2026-10-03 RPC compatibility check: the public Juno gateway rejects height-range
queries with an explicit strict-equality policy. Collector selection now probes
range capability, prefers a compatible archive and falls back to full replay when
none is reachable. The optimization is conditional on node support, not a guarantee
of incremental scans on every endpoint. Snapshot ownership/data remain unchanged.

W2 shared adapter follow-up: website browser CI run 311 passes including an actual
bundle lost-response/reload regression. The synchronized DAO bundle adds the same
journal for mainnet votes and prepared Names/testnet executes. DAO's actual shared
bundle has its own browser regression. The scope and manual recovery limitations
are described in the website audit; upload/instantiate helpers remain outside it.
Mailbox v0.2 source PR #102 passed contract/frontend run 139 and all WASM jobs in
run 22 and is merged; the deployed mailbox remains v0.1.
