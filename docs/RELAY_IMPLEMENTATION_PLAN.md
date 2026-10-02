# RELAY implementation inventory and next work

Reviewed 2026-10-02. [CURRENT_STATE.md](CURRENT_STATE.md) owns the deployment and
code inventory; [RELAY_SECURITY_ARCHITECTURE.md](RELAY_SECURITY_ARCHITECTURE.md)
owns requirements. This is implementation planning, not an audit or release approval.

## Already implemented

| Layer | Source | Evidence / limit |
| --- | --- | --- |
| Main governance Inbox | `relay.js` | Mainnet Operations/native Juno reads; local notifications only |
| Mailbox contract | `contracts/neta-relay-mailbox/src/lib.rs` | Recorded UNI-7 deployment; ciphertext/prekeys only, no mainnet policy |
| Readiness page | `relay-uni7-readiness.html` / `.js` | Public identity/device/inbox headers; no writes/crypto |
| Keplr adapter | `relay-uni7-client.mjs` | Contract code/creator/label and account checks, durable-device registration intent |
| Crypto client lab | `relay-uni7-lab.html` / `.mjs` | Real Keplr-capable separate page; GPL CoreCrypto 10.5.3 Proteus |
| Readable local history | `relay-uni7-archive.mjs` | Wallet-bound AES-GCM archive under HKDF-separated key |
| Vault/outbox/envelope/locks | `spikes/relay-corecrypto/` | Browser fixtures used by lab; not production recovery |
| Two-profile lab | `browser-uni7-lab.mjs` | Mocked wallets/chain exchange, reply and reload, CI PR #97 |
| Full DB backup experiment | `browser-device-backup.mjs` | Fresh-profile device restoration and unread-message decrypt; layout-dependent, no remote backup |

The lab already loads the adapter and vendor runtime. It is inaccurate to say
that the adapter has no caller or registration UI remains to be built. The main
`index.html` does not load them and its SEND remains disabled.

## Current send/receive behavior

Create/unlock device → explicit Keplr registration → persisted outbox/archive
intent → Proteus encryption with authenticated inner envelope → ready ciphertext
→ Keplr send → chain message-ID/sequence check → confirmed local archive.
Receive reserves an inbound intent before decrypting, verifies public metadata
and the current sender generation/fingerprint, then commits readable local history.
Account changes close local state; same-origin database access uses Web Locks.

The lab creates eight prekeys, permits 1800 UTF-8 text bytes and fetches up to 50
inbox records per check. It has no rotation/revoke/prekey refill/block controls.
It requires recipient prekeys even for follow-up sends. Older sender generations
cannot be verified after rotation because the contract exposes only current
registration. Incomplete send/receive intents poison continuation; the lab has
no complete reconciliation UI or automatic recover-and-resend path. Registration
uncertainty is queried once and retains an unresolved intent if not confirmed.
These boundaries must remain visible; do not claim transparent crash recovery.

## Next implementation sequence

1. **Real UNI-7 E2E.** Use the existing [test runbook](RELAY_UNI7_E2E_RUNBOOK.md).
   Record two wallets, registrations, send/reply sequences, TX hashes when
   available, decrypted/reloaded outcomes and measured fees. Mock tests cannot
   supply this evidence. Diagnose endpoints/Keplr first; do not redeploy blindly.
2. **Identity and failure recovery.** Specify historical generation lookup or a
   reviewed rotation model, prekey lifecycle and authenticated envelope semantics.
   Reconcile uncertain registration/send/inbound state without silently rotating,
   regenerating ciphertext for the same ID or discarding unread data.
3. **Automatic backup.** Implement the agreed wallet-bound encrypted bundle of
   ratchet DB, separate archive, outbox/cursors and version. Decide provider,
   authentication, atomic/quiescent snapshot, anti-rollback and concurrency protocol.
   No provider is selected and no automatic remote backup exists.
4. **Recovery validation.** Already-read history plus newer inbound messages;
   wrong wallet/code, corruption, stale snapshots, rotation, tab conflicts and
   crash windows. Stale restore cannot send until reconciliation/new registration.
5. **Main application integration.** Review production runtime/license/build/CSP,
   client failure UX and recovery gates before enabling its SEND. A local unlock
   code does not meet the automatic backup requirement.
6. **Mainnet separately.** Implement a reviewed 5-active-NETA policy and contract;
   the current UNI-7-only crate has no configurable mainnet mode or stake query.
   Require independent review/audit and explicit activation approval.

## Reproduce existing checks

From repository root: `node --test tests/*.test.mjs`.
From `spikes/relay-corecrypto` after `npm ci`:

```bash
npm run test:transport
npx playwright install --with-deps chromium
npm run test:browser
node browser-uni7-lab.mjs
```

`.github/workflows/relay-crypto-browser.yml` runs these on relevant PRs or manual
dispatch; documentation-only edits do not trigger it. Browser availability must
be checked in the current environment; old local launch failures are historical.
Native `npm test` proves only the library spike.

## Runtime and licensing

The user selected GPL CoreCrypto for the isolated lab; it is already shipped
with its license. Production distribution obligations/security review remain
open; do not describe a vendor license as a blanket project license. Versions
are pinned in `spikes/relay-corecrypto/package-lock.json`. Rebuild browser assets
with `npm ci --prefix spikes/relay-corecrypto`, copy the package's
`dist/browser/corecrypto.js` and
`dist/browser/autogenerated/wasm-bindgen/index_bg.wasm` into `assets/relay-crypto/`,
and compare `assets/relay-crypto/SHA256SUMS`. The branch-specific preparation
workflow is historical infrastructure, not an active main publisher.
