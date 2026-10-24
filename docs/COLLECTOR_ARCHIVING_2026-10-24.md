# Collector efficiency and evidence archiving

24 October 2026. Source changes; host installation, scheduled acceptance and
independent storage remain separate gates. No generated source data is rewritten.

## Retained observations

| Dataset | New behavior | Meaning and limits |
| --- | --- | --- |
| Treasury daily history | Each successful scheduled observation updates its original UTC day; the latest observed value wins | Removes the single local-hour dependency. Missing days stay missing; no synthetic closing balances. |
| Treasury beyond 730 observations | Archive exact old rows before trimming the working JSON | Without an archive destination all rows remain. Invalid history fails instead of resetting it. |
| Validator evidence | Before pruning the 120-day working window, export at most 5,000 old blocks with selected events, membership transitions, snapshots and referenced rosters | Exact typed SQLite rows, including BLOBs. Daily aggregates, streaks, cursor and collection identity remain. Previously uncaptured raw signatures/results are not added. |
| Juno, NETA and Operations membership | Preserve the first successfully archived observation of each original UTC day | Exact source bytes and completeness flags. Not an intraday change log or end-of-day membership proof. |
| Delegation planner | Preserve the first successfully archived observation per original UTC day | Original heights, timestamps and evidence limits. |
| Signed NNS prices | Preserve every distinct price file produced by the main collector | Exact signed bytes, deduplicated. No extension of validity or re-signing. |

The runner supplies `COSMOOT_ARCHIVE_DIRECTORY` under its private state directory.
Validator exports use `archive` under the validator state directory. Neither is in
the public snapshot allowlist. Public generation retention stays current plus two
previous generations; it is not a history archive.

## Write and recovery guarantees

`evidence_archive.py` writes canonical JSON in gzip bundles named by SHA-256 of the
uncompressed document. Exclusive linking prevents replacement. File/directory fsync
and read-back verification precede deletion. Corrupt existing bundles cause failure.
Bundles are bounded to 64 MiB decoded; writes require a 512 MiB free-disk reserve.
New archive directories/files are private to the service account. No automatic
archive expiry is configured.

Validator export and pruning use one SQLite write transaction. A file surviving a
rolled-back transaction is reused on retry. Missing destinations, export errors,
corrupt files or SQL failures retain original rows. Tests restore all exported
tables into isolated SQLite and compare exact values; this is not an off-server
restore or a production database replacement.

`python3 scripts/verify-evidence-archive.py <archive-root>` verifies local hashes,
original observation bytes, block continuity within each validator bundle and
daily catalog references. It reports counts and compressed bytes. It does not prove
completeness across all bundles/days, chain truth, signature validity or independent
retention. A young working window legitimately has no expired validator bundle.

Monitor archive growth and disk space. The validator two-GiB database ceiling is
not a ceiling on archives or the whole state directory. A full disk stops progress
rather than authorizing evidence loss.

## Shared RPC results

Both collectors optionally use `COSMOOT_BLOCK_CACHE_DIRECTORY` for `block_results`,
keyed by exact provider, chain and height. Expiry is two hours; compressed payloads
are bounded to 128 MiB. SQLite has a 256 MiB page limit plus WAL/sidecar overhead.
This disposable cache needs no backup. Corruption, locks or unavailable storage
fall back to RPC. No latest state, credentials or failed RPC responses are cached.

Commit, roster, header/checkpoint and event checks remain at the consumers. The
validator fetches and validates commits and rosters even on cache hits. Run counters
expose hits, misses, writes and errors. Fixtures demonstrate a skipped duplicate
request, not measured production savings. The daily full Treasury receipt rescan
remains until an independently tested reconciliation replacement exists.

## Installation and acceptance

1. Obtain a fresh read-only host report from this exact source. Compare installed
   Python hashes and both service templates; preserve local unit drop-ins.
2. Stage only the changed Python files and two service templates. Preserve generated
   data, state, credentials, original source/start identity and timer enablement.
   The initial validator installer refuses differing existing files: it is not an
   overwrite-based upgrade tool.
3. Pause affected timers, let active runs finish, and hold both collector locks
   before replacing code. Retain old code/unit bytes for rollback, never old data
   over newer observations. Validate units, reload systemd and resume previously
   active timers. Exact host commands require that inventory.
4. Run bounded collectors sequentially; check original timestamps, completion
   receipts, archives and publication. Verify two actual scheduled cycles and
   record disk growth, runtime and cache counters privately.
5. Include both archive roots in independent encrypted backups. Local archives do
   not satisfy the recurring external backup/recovery gate.

## Further work

- Configure the privately selected independent destination, encrypted transfers,
  retention and timed recovery. This source change creates no R2 account, bucket,
  credential, upload or schedule.
- Define complete governance proposal/tally/outcome capture and optional intraday
  membership deltas. Selected block events and daily snapshots are not that history.
- Measure growth before choosing monthly partitions and an archive lifecycle.
- Complete the pending manual homepage release and controlled live fallback drill.

Validation: local failure/recovery and cross-collector cache regressions;
repository verification and CI results are recorded on the pull request.
