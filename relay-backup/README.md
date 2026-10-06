# Personal RELAY encrypted backup candidate

The actual Inbox-shell browser regression now uses the real cross-origin HTTPS,
ADR-36 and SQLite service with real CoreCrypto state. It exposed and fixed native
fetch binding; it also verifies deliberate reauthorization after the bounded
120-request session, without changing quotas or automatically signing.
Chain execution, wallet UI and the session factory are simulated. The fixture
uses disposable local TLS/test keys; it is not a hosted service or mainnet test.

Not deployed. No paid resources, remote user backups or real-wallet transactions
were created. The owner deployment helper and next steps are in
[the deployment runbook](../docs/PERSONAL_MAINNET_DEPLOYMENT_RUNBOOK_2026-10-06.md).
Provider/budget approval, actual mailbox and consenting pilot wallets, exact
service/CSP pins and real two-wallet mainnet evidence remain open.

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

1. Review the final candidate and use the prepared owner upload/instantiate flow
   described in the runbook; no actual deployment is recorded.
2. Obtain provider/budget approval and the second consenting pilot wallet. Deploy
   the reviewed service with its actual mailbox and allowlist; verify live health,
   authentication, backup, restart persistence and origin policy.
3. Pin the exact contract/service in `relay-personal-release.mjs`, and add only the
   actual backup origin to `index.html` connect-src. Never permit arbitrary origins
   or activate from URL parameters/local storage. Retain owner upgrade custody.
4. Run the consenting two-wallet mainnet exchange/reply/reload/restore checks with
   the real session, wallet and HTTP transport before public activation.

No deployment or service approval is implied by local or hosted candidate tests.
