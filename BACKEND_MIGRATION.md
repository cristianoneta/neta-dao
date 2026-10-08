# Backend migration operator procedure

Prepared 7 October; updated 8 October 2026. Render still owns the production
databases and signing identity. The OVH VPS is now purchased and bootstrapped;
no production data is exported and no DNS/API change is made. Cloudflare frontend
deployment d89506f6 already succeeded. [Host checkpoint](docs/OVH_SETUP_2026-10-08.md).

## Prepare the target and transfer

Use the existing Compose/Caddy configuration in `deploy/cosmoot`, Node 24 for the
operator tool, and a reviewed source checkout. The Dockerfile's missing
`faucet/src/transfer-fee.mjs` is corrected in this preparation branch. Docker build and
backend container startup still need verification on the host. The snapshot-only
Caddy edge is pinned, running and verified over HTTPS; it does not run the API.

The Render connector can inspect service metadata; it cannot execute the export
or retrieve its private secret file. Arrange authenticated operator shell access
and a private transfer destination before stopping any service. Never paste the
mnemonic, database contents, recovery codes or access tokens into chat or CI logs.

For a preliminary snapshot, run from the reviewed checkout on the source host:

```sh
umask 077
node scripts/backend-state.mjs export \
  /var/data/faucet.sqlite \
  /var/data/relay-backup/relay-backup.sqlite \
  /var/data/cosmoot-export-2026-10-07
node scripts/backend-state.mjs verify /var/data/cosmoot-export-2026-10-07
```

The destination must not exist and its parent must exist. The tool reads both
sources through SQLite's backup API, including committed WAL pages. Only new copies
are normalized to standalone databases. It verifies integrity, table roles, sizes,
checksums, row counts and a fingerprint of unresolved payout records. It retains
signed bytes, claim locks, quotas and encrypted envelope revisions. It does not
read or transfer the signing mnemonic. Exports/manifests are private; retain their
checksum receipt through an authenticated channel and never commit them to Git.

These are two independently consistent snapshots, not an atomic pair while the
service is writing. For the final export, quiesce **all** source writes first and
use a new destination. `FAUCET_PAUSED=true` alone does not freeze reconciliation,
quota writes or encrypted backup writes. Do not kill/suspend Render before the
operator has verified that the export can still run with its disk accessible.

Transfer the complete private directory over an authenticated encrypted channel.
Run `verify` again on the untouched target copy before starting a writer. A missing
receipt, modified database, WAL/SHM sidecar, symlink or public permissions fail the
check. This detects transfer damage; the manifest is not a substitute for an
authenticated source. Preserve a separate off-server copy before target startup.

## Restore and cut over

1. Restore the two verified files under `/srv/cosmoot/state/faucet.sqlite` and
   `/srv/cosmoot/state/relay-backup/relay-backup.sqlite`, privately owned by UID 1000.
   Never overwrite existing target state without an explicit operator decision.
2. Transfer the existing Faucet mnemonic privately to `/etc/cosmoot/faucet-mnemonic`;
   the application must derive the same configured public address. Preserve tighter
   live limits and the pilot allowlist. No replacement identity or emptied ledger.
3. Keep `FAUCET_PAUSED=true` and `RELAY_BACKUP_ENABLED=false` during initial startup.
   Validate Compose, build the image, then check identity, process readiness, target-origin CORS
   and origin-bound authentication. Health alone does not prove backup recovery.
   `/health` returns 503 while backups are disabled; Compose now uses a TCP probe
   so this intentional state does not prevent the edge proxy from starting.
4. Use a separate synthetic identity for an off-server restore drill. Do not read or
   replace real users' encrypted backups. The real fresh-browser drill stays deferred.
5. Coordinate `api.cosmoot.com`, frontend endpoint/CSP and pinned artifact manifests.
   Retain `dao.netareborn.com` for existing browser storage. Enable one writer only;
   never re-sign an uncertain payout or clear its saved journal.
6. Retain Render for the agreed rollback window. After new writes on the target,
   rolling back requires migrating that newer state; an old snapshot is insufficient.

## Preparation evidence and blockers

`node --test tests/backend-state.test.mjs tests/backend-image.test.mjs` passes four
tests using synthetic databases. Real production export/restore and container
runtime evidence remain open. No hosted CI or merge request was started for this
preparation batch. The branch has not been pushed; local base e188db6 is content-
equivalent to the last published release changes, not the remote merge SHA.

Source transfer and snapshot-only HTTPS are complete. The Pages proxy release is
prepared locally. Backend prerequisites remain a private Render export/secret
transfer and independent backup.
The latest owner decision consolidates backend and collectors and removes Render
after verified cutover. [Compact setup, prices and activation](deploy/cosmoot/README.md)
supersedes the earlier unavailable CX33 recommendation. Branch
`deployment/compact-server` adds both-domain authentication and safe public data
publication; 89 Node tests and two Python publication tests pass locally.
