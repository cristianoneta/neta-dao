# Operations receipt collector — 31 October 2026

Source correction; production installation and recovery are separate acceptance
steps. No generated ledger, wallet state, validator history or backup is rewritten.

## Observed failure

The public Operations event feed returned `UNAVAILABLE` with a fresh attempt time
but retained its last successful observation from 29 October 01:15:30 UTC.
Operations accounting similarly reported `refresh_status: unavailable`.
Fresh balances and other successful Treasury tasks did not repair that feed.

Read-only reproduction against the published ledger identified the cause:
both configured Osmosis REST sources returned HTTP 500 for the original
accounting-floor block 71,411,294, reporting a newer lowest retained height.
The Juno portion completed. Both sources also failed the saved Osmosis watermark
73,422,374 during the diagnostic check; merely
switching to a recent checkpoint would not repair this incident.

The generic accounting wrapper caught subprocess failure, retained old evidence
and rebuilt an unavailable statement, but still exited successfully. The published
freshness checker omitted Operations events/accounting entirely. Together these
allowed a failed feed to coexist with a green completion/freshness result.

## Correction

- Prefer `https://lcd.archive.osmosis.zone` for Osmosis receipt collection, retaining
  the two existing fallbacks. The [official endpoint reference](https://docs.osmosis.zone/integrate/endpoints/)
  explicitly distinguishes recent-block nodes from this full-history archive.
  A shared four-request-per-second start limit covers concurrent archive queries,
  below its documented five-per-second limit.
- Keep the original accounting floor, block hashes, daily replay, overlap,
  pagination checks, prior-receipt retention and monetary immutability checks.
  Do not move the start date, erase records or turn missing evidence into zero.
- Return a failing process status after any failed/timed-out child or unavailable
  accounting statement. Complete other work and publish explicit states first.
- Check both Operations feeds, their identities and 35-minute freshness. The
  statement's last success must be fresh independently of its current attempt.
  PARTIAL accounting remains valid operationally; no complete P&L is claimed.

## Validation

Seven new regression tests cover the repair, including a concurrent archive rate
limit check. The six incident regressions fail against the original implementation and cover
the actual provider-pruning condition, loss of all providers, conflicting floor
hashes, preservation of records/cursors, child failure/timeout, unavailable data
after a zero child exit, and missing/foreign/stale feeds despite fresh balances.
They run under `npm run verify` in the required repository checks.

Local combined-branch verification passed 433 JavaScript tests and 227 Python tests, with 14
environment-dependent Python skips. The archive probe completed the existing
Osmosis replay in about 33 seconds, retaining all three legacy Osmosis records.
The corrected health check rejects the captured production incident specifically
for the two Operations feeds; the previous checker accepted the same capture.
A complete read-only Operations replay then succeeded in about 73 seconds,
retaining all 57 existing records with unchanged identity, timestamps and movements.
Both chain cursors advanced and rebuilding the statement returned
`refresh_status: completed`. Only temporary local copies were used; production
data were not changed by this replay.

## Deployment and acceptance

Install only the reviewed collector/checker source while preserving generated data,
credentials, locks, unit configuration and timer state. The affected runtime files
are `scripts/update_treasury_events.py`, `scripts/update_generic_accounting.py`
and `scripts/server_source_status.py`. Keep actual commands/receipts private.

After installation, verify one complete Treasury cycle, fresh successful Operations
events/accounting, retained prior records and passing process/public health checks.
Then observe the next scheduled cycle. A merged PR or local replay alone does not
establish production recovery. This change requires no Cloudflare website release,
contract action or new production writer. External alert delivery remains absent.

The owner confirmed source installation on 31 October; post-update collector runs
are in progress. Their completion, fresh published source data and the subsequent
scheduled cycle remain separate acceptance steps. The combined feature head
`ed0bac062b76b8a1b057d270a511064991630348` passed all 18 jobs in
[CI 41199076122](https://github.com/cristianoneta/neta-dao/actions/runs/41199076122).
Actual operator commands and installation receipts remain in the private handoff.
