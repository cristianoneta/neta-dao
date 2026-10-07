# RELAY shared Render pilot and immediate UX improvements

Owner decision, 7 October 2026: start RELAY backups in the **existing**
`neta-junox-faucet` Render service because the product currently has no users.
Use the existing compute plan/disk. Separate the services when usage is established.
This supersedes the earlier instruction to create a separate paid backup service.
It does not authorize a plan upgrade or activating an unverified mailbox.

## Implemented source

The maintained candidate is integrated by remediation PR #224; CURRENT_STATE owns
its actual publication/deployment status. PR #195 is the historical development PR.
Public deployment/release pins stay null; this work makes no wallet transaction.

- Inbox entry checks for an existing local encrypted checkpoint, then the remote
  backup after an explicit wallet authentication. It selects unlock, restore or
  creation. An on-chain device without an available backup cannot be silently
  replaced. Creation generates the code, asks the user to save it, backs up the
  coherent state and opens the registration review; signing remains explicit.
- `.neta` contact input resolves the active registry identity and reverse mapping
  against a fresh Juno block. The selected address is shown for review. Saved
  sends retain the chosen name and recheck its owner through the existing bridge
  before signing and after signing, before broadcast. A transfer never silently
  changes an already prepared packet's recipient.
- Public contact links carry only a validated wallet address. They merely prefill
  the contact field in an explicitly opened, enabled inbox. They cannot activate
  the release, create a device or grant consent. Contact permissions stay explicit.
- Visible open inboxes check for messages every 30 seconds when idle. Empty polls
  make no backup request or ratchet change. Pending actions are reconciled from
  their saved evidence, never automatically signed or resubmitted. Polling stops
  on lock, disposal, authentication failure, an unresolved error or hidden tabs.
- Backup renewal is offered in context and followed by recovery. A still-valid
  authorization is reused. The existing 15-minute/120-request bounds are unchanged.
- Device maintenance is grouped under settings; history has a bounded scroll area.
  Unknown transaction outcomes do not expose a resend shortcut. Passkeys, longer
  authorization periods, unattended signatures and automatic device rotation are
  not introduced.

## Verification

Local verification passes: 180 root Node tests, 62 Faucet tests and ten backup
tests. The real CoreCrypto/browser/HTTPS recovery suite passes, including restart,
read-only restore, device changes, lost responses and bounded authentication.
The additional Inbox UX browser regression passes at 1440/390/320 px; screenshots
were inspected. Chain execution and wallet UI remain simulated in these browser
tests. No live owner transaction or hosted Render activation is established.

## Existing Render service: preserve identity and data

Keep the service name, region, compute plan, disk name/mount, private faucet group,
`FAUCET_DB=/var/data/faucet.sqlite`, mnemonic secret file and pending payout ledger.
Do not create another faucet instance. Do not reset either database or remove WAL.

The root `render.yaml` now builds from repository root, installs the separately
locked `faucet` and `relay-backup` dependencies, and starts the same faucet entry
point. An updated Blueprint must apply that root/build/start change to the existing
service. A manual deploy alone does not necessarily update Dashboard settings.
Automatic deployments remain off. Do not copy a second Blueprint into the root.

The optional backup module is loaded only with `RELAY_BACKUP_ENABLED=true`.
Default is false. Its database is
`/var/data/relay-backup/relay-backup.sqlite`; it cannot use the configured faucet
file. Only `/v1/challenge`, `/v1/auth`, `/v1/backup` and `/health` belong to RELAY;
legacy `/status`, `/challenge` and `/claim` remain the faucet protocol. Disabled
or invalid backup configuration rejects backup routes without taking down the
faucet. Backup requests never enter payout handling or its admission counters.
The two protocols have distinct challenges, sessions and quotas.

Configuration after the owner has supplied verified mailbox receipts:

| Variable | Value |
| --- | --- |
| `RELAY_BACKUP_ENABLED` | `true` only after configuration/review |
| `RELAY_BACKUP_DIRECTORY` | `/var/data/relay-backup` |
| `RELAY_WEB_ORIGIN` | `https://dao.netareborn.com` |
| `RELAY_MAILBOX_CONTRACT` | The independently verified personal-mainnet mailbox |
| `RELAY_BACKUP_WALLETS` | Comma-separated consenting pilot wallets, at most ten |
| Backup origin | Existing `https://neta-junox-faucet.onrender.com`; verify the actual service URL before pinning |

The backend derives its challenge domain from the same public service origin.
The client still requires a reviewed exact-origin release pin; it cannot be
activated with an invitation URL or browser storage. Keep the service disabled
when the actual mailbox or consenting pilot wallets are missing.

Verify the deployed commit/build settings, unchanged faucet identity/limits and
persisted payout history, backup CORS/authentication, quota/conflict behavior,
restart persistence and a real two-wallet recovery lifecycle before release.
No live Render configuration or deployment is evidenced by these source changes.

## Accepted pilot trade-off and costs

Separate routes, files and quotas **are not process isolation**. Both modules
share memory, CPU, disk, updates and outages. A process compromise can affect
both and may expose the dedicated testnet faucet signing key. The backup module
itself receives no signing adapter, mnemonic or user decryption code; that does
not establish an OS security boundary inside the shared process.

Existing limits remain: 8 MiB per encrypted envelope, 256 MiB aggregate live
backup envelopes, four anonymous plus four authenticated concurrent backup requests (one per wallet in the authenticated lane) and at most ten pilot wallets.
JSON/database/WAL overhead also consumes RAM/disk. Measure actual Render metrics
before broadening the pilot; no capacity or hard billing-cap guarantee is made.
No extra base compute/disk charge is expected **if the current plan and disk remain
sufficient**. Do not automatically upgrade the plan when a limit is reached.

## Consistent operator export and restore

`node relay-backup/snapshot.mjs SOURCE DESTINATION` uses SQLite's backup API,
checks database integrity and refuses to overwrite an existing destination.
Example in the shared service:

```sh
node relay-backup/snapshot.mjs /var/data/relay-backup/relay-backup.sqlite /var/data/relay-exports/relay-2026-10-07.sqlite
```

The file still contains only encrypted envelopes and their public metadata.
Copy it to separately protected storage outside this Render service; a copy on
its own disk does not protect against loss of that disk/account. External storage
and automatic export scheduling are not provisioned by this change.

Restoration is a deliberate maintenance operation: stop backup writes, retain the
current database and WAL, validate the export in a separate directory, and test
it before switching paths. Never overwrite the faucet ledger. A restored server
snapshot may be older than a browser's watermark: reject conflicts, preserve local
state and follow the existing read-only restore/new-generation flow. Do not reset
revisions or automatically resend signed transactions to make them agree.

## To-do: separate after adoption

- [ ] Review usage after the private pilot and whenever the allowed-wallet list
  expands. Use counts/Render resource metrics, not decrypted message content.
- [ ] Plan the split once people use RELAY regularly beyond the initial test pair.
  Complete it before opening admission beyond the ten-wallet pilot, or earlier
  if contention, disk growth or shared outages impair either service.
- [ ] Provision a separate backup runtime without faucet secrets after agreeing
  its cost. Reuse the standalone `relay-backup/render.yaml` as the future template.
- [ ] Quiesce writes, export/copy encrypted data consistently, retain revisions
  and digests, verify restore and move the exact origin/CSP pin deliberately.
  Changing the service domain requires new wallet authentication, not new keys.
- [ ] Verify both services independently and retain a rollback copy. Only then
  disable the shared backup routes. Do not delete user keys or pending journals.
- [ ] Finish independent off-service backup storage, monitoring and restore drills
  before representing the service as durable production recovery infrastructure.

The later DAO shared inbox/recovery and payment requests/invoices remain on the
roadmap after the personal-mainnet pilot. This continuation does not enable DAO writes.
