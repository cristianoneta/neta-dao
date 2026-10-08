# Collector operating acceptance

Reviewed source and installed source are different evidence. Keep the actual host
inventory, command output, private receipts and access instructions in the private
operator record. These checks do not install source or activate timers.

## Read-only inventory

`python3 scripts/collector-host-report.py` reports the four timer states, three
collector services, health service, hashes of the installed collector/checker code,
private completion status and published observation freshness. Optional `--repo`,
`--state` and `--snapshots` arguments select an installation. The report deliberately
does not read environment configuration, keys, databases or journal contents.
Its successful exit means the inventory completed, not that all components passed.

Compare installed hashes and systemd units with reviewed source before updating.
Preserve generated data, the existing signing credential drop-in and active state.
Do not overwrite the collector checkout with a clean repository export.

## Acceptance and activation sequence

1. Establish installed code/unit versions and actual timer states. Do not assume
   timers are disabled because a historical handoff says so.
2. Install only the reviewed code/unit changes while preserving writable data and
   credentials. A code merge alone does not perform this installation.
3. Run each collector once, sequentially. Review successful completion, child-task
   results, source timestamps and published bytes. The shared lock remains required.
4. Run `server_job_status.py --snapshot-root <published-generation>` using the
   installation's private receipt directory. Enable the three collectors and health
   timer only after acceptance. Do not replay missed intervals in a burst.
5. Observe at least two actual scheduled cycles, including receipt timestamps,
   data ages and failed service states. A single manual run proves no cadence.

The freshness checker examines seven current Treasury/membership datasets, the
two refresh summaries and the signed-price observation. Treasury cadence allows
35 minutes; main and membership allow 65 minutes. These are operational thresholds,
not changes to the signed NNS price's 24-hour validity. An old price can still be
valid for purchase while collection is unhealthy. Expiry stays anchored to the
original observation; no date or signature is changed by these checks.

PARTIAL asset valuation remains a warning, rather than being mislabeled stale.
Missing/failed child refreshes, incomplete membership, stale/future observations
and missing/corrupt files fail the check. Success proves neither signature validity,
independent chain agreement nor complete historical accounting. The application
continues to enforce its own signed-price validation.

The health timer reports through systemd/journal. No external alert delivery is
configured. This is detection, not an operator notification guarantee.

## Controlled fallback boundary

The combined edge serves both API and public data. **Do not pause or stop that
container for a data fallback test:** that would also interrupt the active backend
endpoint. Plan a bounded, reversible fault affecting only a selected public-data
route, with a verified independent rollback before applying it. Allow for the
60-second proxy cache; cache hits do not prove an origin failure was exercised.
Confirm `static-fallback` and exact release bytes on both website origins, followed
by restored `server` responses. Keep API availability under observation throughout.
Until that controlled live exercise passes, live fallback remains unverified.

## Independent backups remain a separate gate

The existing database export tool makes standalone verified SQLite snapshots and
preserves unresolved journals. Scheduled exports must use new private destinations,
encryption and an authenticated independent destination; a second directory on the
same host is not independent retention. Live exports are individually consistent,
not a synchronized pair for migration. Export failure must not overwrite the last
good copy or be reported as success.

The proposed targets in [BACKUP_RECOVERY](BACKUP_RECOVERY.md) remain RPO 24 hours,
RTO 4 hours, seven daily and four weekly encrypted copies. Do not claim these targets
are met until scheduled transfer, retained generations and a timed independent
restore are verified. Select the independent destination privately before creating
a schedule; no new paid service or deletion of an existing backup is implied.
Keep Render in maintenance until the rollback window and these gates are resolved.
