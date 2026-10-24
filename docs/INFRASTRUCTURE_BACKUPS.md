# Independent infrastructure backups

This is an operator-run infrastructure backup, separate from browser message
recovery. The implementation uses SQLite's online backup API and a Restic v2
repository. Synthetic local tests exercise actual Restic encryption and download.
Production credentials, first external backup, another-machine application recovery,
scheduled cycles and retention acceptance remain separate operational gates.

## What is captured

| Source | Consistency / preserved content |
| --- | --- |
| Faucet SQLite | Read-only online export; all tables, unknown and pending payout journals retained. |
| Encrypted message-backup SQLite | Read-only online export of every scope, revision and encrypted envelope. |
| Collector data and evidence archives | Under the existing collector lock; original JSON and archive bytes preserved. |
| Validator SQLite and optional archive | Under the existing validator lock; original identity, cursor, evidence and archive preserved. No archive is expected before its first retention boundary. |
| Explicit recovery files | Operator-reviewed configurations, application secrets, units and drop-ins, copied as regular files. A nonempty inventory is required, but is not automatically a complete inventory. |

Each database and each locked group has its own snapshot time. This is not one
cross-service atomic transaction. Missing required sources, source changes during
copy, symlinks, special files, overlaps, incomplete Restic backups and integrity
failures are errors. No source initialization, journal repair or pruning occurs.
The shared RPC cache, redundant published snapshot generations, OS packages and
container layers are excluded. Rebuild those from the privately recorded source
versions and configuration; this is not a bootable full-disk image. Keep any other
non-reconstructible state in the reviewed inventory or extend coverage first.

The encrypted manifest records hashes, lengths, source paths and numeric ownership/
modes for exported files and source directories. Staged files are private copies;
restoring their staging permissions alone is not an application installation. Map
ownership to the intended service accounts and review permissions during recovery.
No automatic restoration to the recorded source paths is provided.

## Before installation

1. Read the private operator handoff and obtain a fresh read-only inventory. Confirm
   database paths, existing locks, archive roots, mounted backend configurations,
   environment-file paths, secret-file paths, price-signing credentials, service
   units/drop-ins and proxy configuration **without printing their contents**.
   Keep exact findings outside Git. Do not infer completeness from this template.
2. Create an R2 object read/write token scoped to the already selected private backup
   bucket. Copy its actual S3 endpoint, including jurisdiction if applicable. Do not
   configure public access or an object-expiry lifecycle: deleting individual Restic
   objects can break other snapshots. R2 read/write credentials can delete data;
   this is off-host storage, not immutable protection against host compromise.
3. Save a random repository password (at least 32 characters) independently in the
   operator's password manager, along with endpoint, bucket and access credentials.
   Never print secrets, place them in Git/commands, or rely on a copy only inside
   the repository that the password unlocks. Review independent account recovery.
4. Confirm free disk capacity for staging **and** a full fresh download, plus the
   configured reserve and 64 MiB working margin. The example caps one export at
   8 GiB and reserves 2 GiB; choose limits against actual host capacity/growth.
   Checks are conservative estimates, not filesystem quotas against other writers.
5. The Python interpreter must be at least 3.11. Pin Restic 0.19.1 on Linux amd64
   in a dedicated root-owned directory; do not replace a global installation.
   Official archive: `https://github.com/restic/restic/releases/download/v0.19.1/restic_0.19.1_linux_amd64.bz2`.
   Expected archive SHA-256:
   `f415415624dcc452f2a02b8c33641791a8c6d6d3b65bbb3543fcf9a25151585c`.
   Decompressed binary SHA-256:
   `20d4142678d0d95ec11a4759def1b73fd9190abc9ca19e4b62d067c0b387e639`.
   These pins were compared to the upstream release checksum; no independent PGP
   signature verification is claimed. Other architectures need their own review.

## Isolated installation and first run

Use the exact reviewed source revision after required CI passes. The following
paths are generic defaults, not an inventory or evidence of installation.

- Install only `scripts/infrastructure_backup.py`, `scripts/evidence_archive.py`
  and the verified binary into `/opt/cosmoot-backup`, root-owned and not writable
  by service accounts. Name the binary `restic-0.19.1`. Compare installed hashes
  to that reviewed checkout and the pin above. No collector/backend replacement.
- Prepare `/etc/cosmoot-backup` and its `credentials` directory as root:root 0700,
  and `config.json` as 0600. Adapt
  `deploy/cosmoot/infrastructure-backup.example.json` from the private inventory;
  replace every placeholder and enumerate every recovery file by a stable label.
  Include the reviewed backup config itself so the mapping is available after loss.
- Enter four credential files privately with hidden terminal input, never command
  arguments: `repository`, `password`, `access-key`, `secret-key`, all root:root 0600.
  Repository syntax is `s3:https://ACCOUNT_ENDPOINT/BUCKET/OPTIONAL_PREFIX`;
  copy the endpoint from the actual bucket. Reject unexpected existing files rather
  than overwriting them. The service uses systemd `LoadCredential`; no `.env` export
  or inherited Restic/AWS override is used. No credentials are included in receipts.
- Install the new `cosmoot-infrastructure-backup@.service` and timer after checking
  no prior unit with those names exists. Preserve every existing unit and drop-in.
  Adjust database directory allowances and read-only bind paths to the exact private
  config; `ProtectHome=yes` intentionally disallows home-directory sources.
  SQLite may need to create/update WAL shared-memory sidecars even with `mode=ro`;
  only source database directories and the dedicated work directory are writable.
  The main databases are separately bind-mounted read-only. Do not use `immutable=1`
  on live WAL sources. Do not stop or reinitialize the collectors/backends.
- Validate the units with `systemd-analyze verify`, then `systemctl daemon-reload`.
  The timer remains **disabled**. Check the effective unit privately before starting.
- For the explicitly chosen **new, empty** repository only, run
  `systemctl start cosmoot-infrastructure-backup@init.service`. Initialization is
  a separate command and must not be retried as a fix for authentication failure.
- Run `systemctl start cosmoot-infrastructure-backup@backup.service` and inspect
  its exit status plus private `last-attempt.json` and `last-success.json` in the
  configured work directory. Use `systemctl show ... -p Result -p ExecMainStatus`
  to inspect unit results without printing provider diagnostics or secrets.

A successful backup requires a full snapshot ID, repository structure check,
**uncached download of exactly that snapshot into a new temporary directory**,
Restic restore verification, the exact manifest/file set/hashes, SQLite quick-check
and required tables/columns. Only then is `last-success.json` replaced. Restic
exit 3 creates an incomplete remote snapshot and is deliberately a failure; it is
not automatically deleted. The service never deletes repository objects.

After the first real backup, run the separate
`cosmoot-infrastructure-backup@check.service` for `check --read-data`. An ordinary
`check` does not read every historical data pack; the per-backup download verifies
the new snapshot, while the full check covers repository data. Retain the exact
snapshot/repository IDs and timing privately. No public acceptance from local tests.

## Recovery on another machine

1. Retrieve credentials from independent custody; use a fresh isolated Linux host,
   the pinned Restic and the reviewed verification module. Record start time and
   the source/application release. Never start a second production writer.
2. Set up credentials privately. Use Restic's repository/password **file** options
   and securely supplied S3 environment, with no secrets in arguments/history.
   Check repository ID against the private accepted receipt; select its full
   snapshot ID, not an ambiguous `latest` from another host.
3. Run `restic --no-cache check --read-data`, then `restic --no-cache restore
   SNAPSHOT_ID --target NEW_EMPTY_PRIVATE_DIRECTORY --verify`. Confirm the target
   did not previously exist, then create it as 0700. Restic can overwrite files;
   never aim it at a live service path. The tested snapshot layout is `snapshot/`
   immediately under this target, independent of the original work-directory path.
4. Verify the downloaded manifest and SQLite files using the reviewed module in
   the isolated target (replace the example absolute paths):

   ```python
   import json
   import sys
   from pathlib import Path
   sys.path.insert(0, '/opt/cosmoot-backup')
   from infrastructure_backup import verify_restore
   snapshot = Path('/private/isolated-restore/snapshot')
   verify_restore(snapshot, json.loads((snapshot / 'manifest.json').read_text()))
   ```

   Restic authenticates the manifest; the in-run verification also compared it to
   the original local export. Compare full IDs with the independently held receipt.
5. Recreate service accounts and the reviewed application versions in isolation.
   Restore into **new** paths using manifest metadata and the private inventory;
   do not overwrite newer state, pair old databases with live WALs, replay unknown
   payouts, rotate keys, discard pending journals, or change browser device state.
   Confirm every recovery-file label and any external dependency before cutover.
   TLS certificates and cache/public generations are regenerated separately.
6. Inspect the restored Faucet pending/unknown rows without broadcasting. Confirm
   validator original identity/cursor/archives and run the archive verifier. Start
   an isolated relay service and use the documented synthetic authenticated
   envelope read/restore drill. Never use production wallet material for tests.
   Record recovered ranges/revisions, checks and elapsed recovery time privately.
7. A successful file restore is not a completed application recovery. Production
   cutover is a separate reviewed operation. The target RPO <=24h / RTO <=4h remains
   unverified until measured; browser recovery remains its own deferred gate.

## Schedule, retention and failures

After first-backup acceptance and another-machine recovery, enable the supplied
timer explicitly: daily at 03:40 UTC plus up to ten minutes jitter, with persistent
catch-up after downtime. Verify at least two unattended runs using service results,
last-attempt command/state/time and advancing successful receipt IDs. Monitor stale
receipts and failed units; the supplied timer is not an alert delivery system.
A manual backup alone does not prove scheduled operation.

`cosmoot-infrastructure-backup@retention-preview.service` writes only a private
`forget --dry-run` plan: keep the last snapshot, seven daily and four weekly points
for the configured host/tag. Rules overlap; this is not necessarily 11 snapshots.
No automatic forget/prune is included. Review the exact deletion set after the
recovery drill before authorizing a later retention implementation. There is no
storage-cost ceiling while destructive retention remains disabled.

All commands share one local nonblocking lock. Collector locks wait up to 21 minutes;
SQLite export up to two minutes; each Restic process up to 30 minutes; the unit
limits the total run to 50 minutes. Lock failure does not stop the active backup.
A parallel/rejected invocation cannot overwrite the active attempt record.

`last-attempt.json` records running/succeeded/failed plus command and times.
`last-success.json` remains the last **verified backup**, not the latest service
health. Read both and the unit exit state. Failures before a trustworthy config/work
path is available cannot update that file; systemd status is authoritative then.
A killed process may leave `running`: that is not success. Failures leave the prior
successful receipt intact and never claim that the latest attempt is protected.

SIGTERM/SIGINT terminate the child and clean this invocation's known staging and
restore directories. SIGKILL, host failure or disk errors may leave private plaintext
in `snapshot/` or `restore-*`; either blocks the next backup. Inspect those exact
paths privately and establish they are abandoned before approved removal. Never
recursively remove an arbitrary directory to make the check pass. Ordinary deletion
is not guaranteed secure erasure on SSDs; protect the host and backup work disk.

Provider diagnostics may include sensitive paths/credentials and are written only
as root-private `last-restic-error.json`, with a timestamp and bounded output.
Do not post that file, the raw manifest, receipts or configuration to Git/CI/chat.
Journal output contains only generic success/error type. If credentials are wrong,
fix the private configuration; do not initialize another repository or unlock a
repository without checking for an actual active client.

## Validation and references

Run `RESTIC_BINARY=/absolute/verified/restic python3 -m unittest discover -s tests
-p test_infrastructure_backup.py -v`. The required repository workflow downloads the
pinned archive and runs real local repository tests without production credentials.
Normal `npm run verify` also runs the unit cases; real integration cases are skipped
there unless `RESTIC_BINARY` is set, and are required in their own CI job.
These tests do not prove R2 access, effective target-host sandboxing or recovery on
another machine. Host service acceptance remains mandatory before enabling its timer.

- [Restic restore and overwrite behavior](https://restic.readthedocs.io/en/stable/050_restore.html)
- [Restic repository checks](https://restic.readthedocs.io/en/stable/045_working_with_repos.html)
- [Python SQLite online backup](https://docs.python.org/3/library/sqlite3.html#sqlite3.Connection.backup)
- [R2 API tokens and scope](https://developers.cloudflare.com/r2/api/tokens/)
- [Application message recovery](BACKUP_RECOVERY.md)
- [Documentation privacy](DOCUMENTATION_PRIVACY.md)
