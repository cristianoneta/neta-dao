# Personal RELAY encrypted backup candidate

Browser integration now exists in `relay-personal-browser.mjs`: coherent automatic
snapshots, signed bytes backed up before broadcast, enforced read-only fresh restore
and explicit new-generation activation. The new real-CoreCrypto browser test uses
an isolated simulated backup transport; this service's real HTTP/ADR-36/SQLite
suite remains separate. The gated production Inbox host is connected and tested. Hosting approval, live
transport verification, final release review and the mainnet two-wallet test remain open. No live backup service is configured.

Not deployed. No hosting resources, remote backups, payment or real-wallet action
were created. This is a separately testable provider/client candidate, not a
mainnet release approval. The browser controller and shell tests use a simulated
transport; the real HTTP service tests remain a separate layer.

## Concrete proposed deployment

- Repository: `cristianoneta/neta-dao`, reviewed PR #195 branch; Blueprint path
  `relay-backup/render.yaml` (NOT the faucet's root Blueprint).
- One Frankfurt Node 24.19.0 web service, `0.5c-512mb`, manual deployments,
  one 1-GB persistent disk mounted at `/var/data`.
- Proposed recurring base: **USD 7.25/month**, consisting of USD 7 compute and
  USD 0.25 disk, before tax, possible workspace charges and transfer overages.
  Checked 6 October 2026 against https://render.com/pricing and
  https://render.com/docs/compute-plans. This is not a hard billing cap.
- Deployment needs the actual reviewed personal mailbox contract and an explicit
  pilot allowlist of at most ten consenting wallet addresses. Empty configuration
  fails startup. The second test wallet is not invented.
- No faucet environment group, mnemonic, signing service or secret file is used.
  Never copy faucet credentials into this service.
- Provider/cost approval, source integration/review and real deployment identity
  remain prerequisites. The Blueprint alone does not create resources.

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
allowlist limits admission. Challenge/IP/session capacity is bounded; at most four requests may process concurrently. The service
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
generation before sending; a green codec test alone is not that evidence. The existing production SEND remains disabled.

## Verification

`npm ci --ignore-scripts && npm test` in this directory. Tests cover real ADR-36
signatures, replay/origin/authentication checks, authenticated snapshot contents,
wrong code/scope/revision, read-only restore, SQLite restart/CAS/idempotency,
quota preservation and lost HTTP acknowledgement. Synthetic snapshot data is used;
this is not proof of coherent restoration of a real CoreCrypto browser profile.

## Remaining before activation

1. Finish the release review and owner-reviewed contract upload/instantiate flow.
2. Obtain provider/budget approval and the second consenting pilot wallet. Deploy
   the reviewed service with its actual mailbox and allowlist; verify live health,
   authentication, backup, restart persistence and origin policy.
3. Pin the exact contract/service in `relay-personal-release.mjs`, and add only the
   actual backup origin to `index.html` connect-src. Never permit arbitrary origins
   or activate from URL parameters/local storage. Retain owner upgrade custody.
4. Run the consenting two-wallet mainnet exchange/reply/reload/restore checks with
   the real session, wallet and HTTP transport before public activation.

No deployment or service approval is implied by local or hosted candidate tests.
