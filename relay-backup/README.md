# Personal RELAY encrypted backup candidate

Not deployed. No hosting resources, remote backups, payment or real-wallet action
were created. This is a separately testable provider/client candidate, not a
complete integrated browser recovery system or mainnet release approval.

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
and revision are authenticated. The codec requires ratchet blocks, wrapped key,
descriptor, archive, send/transaction/registration journals and cursor. It cannot
prove that its caller captured these consistently; that integration is still open.
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
revision/digest. That UI/automatic snapshot integration is not implemented here.

Restoration authenticates the complete envelope and rejects versions below a
locally known minimum. Every returned snapshot is explicitly **read-only**.
A malicious provider can serve a valid older snapshot to a fresh profile without a
prior watermark; these modules do not solve that by themselves. Safe resumption
needs coherent state import/reconciliation and a reviewed new device generation.
Neither the read-only marker nor a green codec test is an enforcement mechanism in
a live crypto controller. The existing production SEND remains disabled.

## Verification

`npm ci --ignore-scripts && npm test` in this directory. Tests cover real ADR-36
signatures, replay/origin/authentication checks, authenticated snapshot contents,
wrong code/scope/revision, read-only restore, SQLite restart/CAS/idempotency,
quota preservation and lost HTTP acknowledgement. Synthetic snapshot data is used;
this is not proof of coherent restoration of a real CoreCrypto browser profile.

## Remaining before activation

1. Connect generation-aware crypto, reviewed lifecycle and exact-byte message
   transport to one recovery-aware personal browser controller.
2. Capture quiescent real browser stores automatically and prove coherent import
   into an empty profile, including unread messages, pending transactions, stale
   backups, rotation and concurrent profiles. Do not discard the existing journals.
3. Review the actual production runtime, UI recovery flow and provider assumptions.
4. Obtain provider/budget approval, deploy the reviewed contract/service and verify
   live identity/configuration. Owner retains contract upgrade administration.
5. Run the consenting two-wallet mainnet exchange/reply/reload/restore evidence.
