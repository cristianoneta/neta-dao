# Personal RELAY encrypted backup

Current pilot: active on the existing Faucet Render service, with two admitted wallets.
[Current state](../docs/CURRENT_STATE.md) owns activation/evidence status;
[recovery runbook](../docs/BACKUP_RECOVERY.md) owns restart/export/restore procedures.
Public Inbox remains gated. The standalone Blueprint is a deferred separation template,
not authorization to create another paid service.

## Implemented boundaries

`relay-personal-backup.mjs` encrypts a versioned snapshot in the browser using a
256-bit generated recovery code, HKDF and AES-GCM. Scope (chain, mailbox, wallet)
and revision are authenticated. The encrypted payload packs checkpoint bytes as base64, including retired and
in-flight generations; prior numeric-array snapshots remain readable. Quotas are
unchanged and no history/keys are discarded. The codec requires ratchet blocks, wrapped key,
descriptor, archive, send/transaction/registration journals and cursor. The browser controller captures those stores consistently in its real-CoreCrypto
crash/restore tests; the codec alone is not that evidence.
Never include the recovery code in public metadata, an HTTP request or chain data.

ADR-36 challenges bind the service domain, web origin, exact mailbox/wallet, nonce
and expiry. Single-use challenges expire after two minutes; memory-only bearer
sessions expire after fifteen minutes or 120 requests. Sessions are not persistent
credentials; reconnect requires another wallet authentication. This is not yet a
background backup experience across browser restarts.

Only `https://dao.netareborn.com` is accepted as the web origin. A private pilot
allowlist limits admission. Challenge/IP/session capacity is bounded; four anonymous requests and four authenticated requests have separate capacity; each wallet may occupy only one authenticated slot. The service
ignores forwarded IP headers, so a shared proxy may conservatively rate-limit
multiple users together; review proxy behavior before a public release.

SQLite stores only the latest encrypted envelope for each scope. Writes compare
an expected revision atomically, and identical replay after a lost response returns
the original acknowledgement. Differing stale writes fail. Maximum envelope size
is 8 MiB; aggregate live envelope quota is 256 MiB, leaving disk space for database
and WAL overhead. Quotas are availability controls, not a hosting-cost guarantee.
No deletion API, plaintext history, wallet private keys or payout capability exists.

The client verifies upload acknowledgements and recovers a lost acknowledgement
by reading the exact digest; it does not overwrite a conflicting revision. Errors
remain visible to its caller. Last-confirmed status must only advance on a matching
revision/digest. The controller supplies automatic snapshots and visible pending/error states.

Restoration authenticates the complete envelope and rejects versions below a
locally known minimum. Every returned snapshot is explicitly **read-only**.
A malicious provider can serve a valid older snapshot to a fresh profile without a
prior watermark; these modules do not solve that by themselves. Safe resumption
needs coherent state import/reconciliation and a reviewed new device generation.
The controller enforces read-only restoration and requires a confirmed new device
generation before sending; a green codec test alone is not that evidence. Public Inbox SEND remains disabled; the restricted two-wallet pilot is active.

## Verification

`npm ci --ignore-scripts && npm test` in this directory. Tests cover real ADR-36
signatures, replay/origin/authentication checks, authenticated snapshot contents,
wrong code/scope/revision, read-only restore, SQLite restart/CAS/idempotency,
quota preservation and lost HTTP acknowledgement. Synthetic snapshot data is used;
this is not proof of coherent restoration of a real CoreCrypto browser profile.


## Remaining operating evidence

Hosted restart, off-service export and isolated restore remain open. The owner deferred
fresh-browser recovery. Local tests are not hosted evidence. Before expanding beyond
ten pilot wallets, separate the backup process/service.
