# Backend migration procedure

Updated 8 October 2026. This public runbook describes the process and its safety
boundaries. Real host access, database paths, export locations, transfer receipts
and signing-key locations belong in the private operator handoff. The paths in
deployment source are template defaults, not a verified live inventory.

Current progress: a preliminary encrypted database copy was transferred and
verified. Render remains the production backend writer; Faucet identity transfer,
application restore checks and final cutover are still open. See the
[public checkpoint](docs/OVH_SETUP_2026-10-08.md).

## Prepare and export

Use the reviewed Compose/Caddy configuration in `deploy/cosmoot`, Node 24 for the
operator tool, and the private operator inventory. Confirm authenticated source
and destination access before pausing any service. Never paste secrets, database
contents, recovery codes or access tokens into chat, Git or CI logs.

The following is a template, not a command with live paths. Supply these variables
privately after identifying the actual source files and a new private destination:

```sh
umask 077
: "${COSMOOT_FAUCET_DB:?Set the source Faucet database path privately}"
: "${COSMOOT_RELAY_DB:?Set the source encrypted-backup database path privately}"
: "${COSMOOT_EXPORT_DIR:?Set a new private export directory}"
node scripts/backend-state.mjs export \
  "$COSMOOT_FAUCET_DB" "$COSMOOT_RELAY_DB" "$COSMOOT_EXPORT_DIR"
node scripts/backend-state.mjs verify "$COSMOOT_EXPORT_DIR"
```

The destination must not exist and its parent must exist. The tool uses SQLite's
backup API, including committed WAL pages, then checks the new copies' integrity,
table roles, sizes, checksums, row counts and unresolved payout records. It retains
signed bytes, claim locks, quotas and encrypted envelope revisions. It does not
read or transfer the signing mnemonic. Keep the export and its receipt private.

These are independently consistent snapshots, not an atomic pair while the source
is writing. For the final export, quiesce **all** source writes and use a new
private destination. `FAUCET_PAUSED=true` alone does not freeze reconciliation,
quota writes or encrypted backup writes. Preserve operator access to the source
disk and export tool while quiescing the application.

Transfer over an authenticated encrypted channel. Verify the untouched copy on
the target before starting a writer and retain an independently held encrypted
copy. The tool rejects missing receipts, changed files, WAL/SHM sidecars, symlinks
and public permissions; its manifest does not replace source authentication.

## Restore and cut over

1. Restore both verified databases to the privately reviewed target locations,
   using the runtime ownership required by the deployment configuration. Never
   overwrite existing state without an explicit operator decision.
2. Privately transfer the original Faucet identity and verify the same configured
   public address. Preserve live limits, pilot admission and unresolved journals.
   Never generate a replacement identity or initialize an empty production ledger.
3. Keep `FAUCET_PAUSED=true` and `RELAY_BACKUP_ENABLED=false` during initial startup.
   Validate Compose, the real application image, identity, readiness, CORS and
   origin-bound authentication. The TCP probe only proves that the process listens;
   `/health` intentionally returns 503 while the backup service is disabled.
4. Use a separate synthetic identity for an isolated application restore drill.
   Do not read or replace real users' encrypted backups. The real fresh-browser
   drill stays deferred; infrastructure checks cannot substitute for that evidence.
5. Coordinate the public API, frontend endpoint/CSP and pinned artifact manifests.
   Retain the old website origin for existing browser keys/storage. Enable one
   writer only; never re-sign an uncertain payout or clear its journal.
6. Keep the old service through the agreed rollback window. After new target
   writes, rollback requires migrating the newer state. Do not use an old snapshot
   as though it includes those writes.

## Evidence boundaries

Local export/image tests use synthetic data. The later preliminary production copy
passed decryption and database/receipt verification, but application restoration,
final quiesced export and cutover remain unverified. Recurring independent backups
and private signing-identity backups are separate requirements.

See [deployment templates](deploy/cosmoot/README.md) and
[encrypted backup recovery](docs/BACKUP_RECOVERY.md). Consult the private operator
handoff for exact commands and completed steps before resuming.
