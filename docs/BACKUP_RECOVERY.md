# Encrypted backup recovery runbook

Status: local snapshot/restart/isolated-restore tests exist. Hosted durability,
external retention and real fresh-profile restore are not yet established.
Do not use the operator's or Faucet wallet's recovery code for infrastructure tests.

## Recovery targets before public release

Proposed operating targets: RPO at most 24 hours; RTO at most 4 hours. Retain 7 daily
and 4 weekly encrypted snapshots off the service and its disk, with access limited
to the operator. These targets are not a current SLA: they become verified only
after the export destination and scheduled process exist and a measured drill passes.
A snapshot on the same disk cannot protect against loss of that disk.

## Safe drill

1. Use a separately controlled synthetic identity in an isolated service/database;
   keep the existing production allowlist and live user scopes intact.
2. Authenticate through ADR-36, PUT an encrypted envelope and GET its exact revision
   and digest. Confirm a conflicting revision is rejected and leaves the prior one.
3. Restart the process with the same disk; old bearer tokens must fail. Reauthenticate
   and compare the saved encrypted bytes. Never print tokens, plaintext or recovery codes.
4. Export the live WAL database consistently with the operator-only command:
   `node relay-backup/snapshot.mjs SOURCE NEW_DESTINATION`.
   It refuses an existing destination and checks SQLite integrity. Never expose this
   command through HTTP and never use the Faucet ledger as source or destination.
5. Copy the encrypted snapshot to the approved independent destination. Verify its
   checksum after transfer. Start an isolated restore instance with a new database
   path; authenticate with the test identity and verify the same envelope.
6. Measure recovery time and record source/deploy, export/restore times, revision,
   digest, database integrity, retention evidence and cleanup. Do not record secrets.
7. A fresh browser restores read-only. Resuming writes requires the reviewed device
   generation flow; restoring infrastructure must not silently rotate any device.

`npm test --prefix relay-backup` proves local behavior only. The owner has deferred
real fresh-browser testing; do not label it passed or repeatedly request it.

## Access limitations

The connected Render tools expose deployment/health/logs, but not shell/database
export or authenticated test-identity signing. A hosted restart alone cannot prove
that a stored backup survived. Keep this gate open until the full drill is possible.
