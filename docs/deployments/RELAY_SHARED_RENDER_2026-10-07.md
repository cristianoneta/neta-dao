# Shared encrypted-backup service — public deployment evidence

Historical record, 7 October 2026; operator inventory removed on 8 October under
[DOCUMENTATION_PRIVACY](../DOCUMENTATION_PRIVACY.md). Unredacted operational
records are retained privately. Current progress is in [CURRENT_STATE](../CURRENT_STATE.md).

The existing Faucet host deployed personal encrypted-backup support at commit
`052e736a87d44bbe3743524b1a547822bc6dbf81`, initially disabled, then enabled for
the consenting restricted pilot. The later backend release is `f5b21a5` from
PR #224, live at 14:01 UTC; see the
[release receipt](repo-remediation-release-2026-10-07.json).
The public origin is `https://neta-junox-faucet.onrender.com`. No new service, disk
replacement, private-key change or payout-ledger reset was part of this release.
Provider account/resource identifiers and actual environment inventory are private.

## Verified behavior and limits

[HTTP observations](shared-relay-render-verification-2026-10-07.json) at 11:15 UTC
record ten checks. The later [admission observations](shared-relay-faucet-admission-2026-10-07.json)
record four checks after the separately approved second pilot wallet was admitted.
Provider identifiers in those public receipts are redacted; results and public
application evidence are preserved.

- Faucet status confirmed UNI-7, readiness, the original public identity and
  25 JUNOX per 24 hours with the existing protection/confirmation policy.
- Backup health returned 503 when disabled and 200 when enabled over HTTPS.
- Exact-origin CORS permitted expected methods/headers; other/missing origins,
  unauthenticated reads and invalid-token writes were rejected.
- A nonallowlisted wallet was refused with 429. The initial smoke expectation of
  400 was corrected against source without changing the recorded response.
- Authentication challenges bound the public service/web origins, chain, mailbox
  and requesting wallet. Invalid signatures were rejected. Stored observations
  omit challenge nonces; no access token was issued by these probes.
- No warnings/errors were returned in the inspected startup interval. Healthy
  startup and an idle resource sample do not prove stored-data durability or
  production capacity.

These probes did not perform a valid wallet signature, authenticated encrypted
write/read, message transaction, payout, stored-envelope restart or off-service
application restore. Later pilot evidence, rather than this initial host record,
owns subsequent send/read/reload results.

## Continuing work

Retain the existing pilot admission and signing identity. Follow the
[shared pilot plan](../RELAY_SHARED_PILOT_2026-10-07.md) and
[backup recovery runbook](../BACKUP_RECOVERY.md). Use a synthetic identity for
infrastructure tests. Actual user fresh-browser restoration remains deferred.
Receiving/reading does not require `.neta`; sending does. Public Inbox pins remain
separate from restricted pilot activation. Do not auto-resend uncertain transactions.

Consult the private operator handoff before changing service configuration. An
environment update may itself trigger deployment; avoid duplicate deployments.
Health checks alone do not demonstrate restoration of stored encrypted messages.
