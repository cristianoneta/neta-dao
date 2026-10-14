# Juno validator history

14 October 2026. Read-only collector candidate; server installation and scheduled
acceptance are separate from source integration. No frontend or allocation gate
is enabled by collecting these observations.

## Owner decisions

Complete the Juno Delegation Programme before DEX, token creation and launch work.
V1 eligibility now requires **continuous active-set membership throughout the
immediately preceding 90 days**. This supersedes the earlier plan to include
standby validators brought into the set by the proposed allocation. V2 additionally
requires at least 95% participation over that same window and no jail episode.
Current jailed/tombstoned exclusions and the other approved planning constraints
remain. These decisions are not yet implemented in the allocation policy schema;
existing saved rules must not be silently reinterpreted or approved.

The SDK `AfterValidatorBonded` hook resets `SigningInfo.StartHeight` on reentry.
This is a useful V1 input, not a validator creation date. Zero heights, changes
across chain upgrades, identity mapping, consensus activation delay and independent
source agreement need explicit handling before using it to authorize allocation.
The collector preserves raw signing info; it does not certify that input as a
complete 90-day proof. See the pinned [SDK hook](https://github.com/cosmos/cosmos-sdk/blob/v0.53.7/x/slashing/keeper/hooks.go).

## What is collected now

| Evidence | Frequency | Purpose / limit |
| --- | --- | --- |
| Exact consensus roster, absent/commit/nil flags, proposer and commit round | Every finalized block, in sequence | Active-set continuity, participation, recovery after upgrades; no sampled-day approximation |
| Entry/exit heights and observation times | Every roster change | Distinguish a first observation from a proven entry; reentry resets the observed streak |
| Slash/jail events and successful unjail actions | Every block result | Preserve occurrences even between state snapshots; unsupported historical event formats must be reviewed |
| Governance vote/weighted-vote, proposal and outcome events | Every block result | Future governance-participation index; no score yet, and no votes from failed transactions |
| Upgrade and consensus-parameter/validator updates | Every block result | Future upgrade-response evidence; block signatures do not prove binary installation time |
| Operator-to-consensus-key mapping, moniker, staking status, stake and commission configuration | Hourly, height-pinned | Historical identity and concentration context; min-self-delegation is not actual self-bond |
| Signing info, tombstone/jail state, staking and slashing parameters | Hourly, same height | Current safety inputs and interpretation of changing chain parameters; not long-term uptime counters |
| Block/hash continuity, source, retained bounds, cursor, lag and metadata failures | Every run | Data quality and auditability; missing data is never zero downtime |

Participation is `commit flags == 2 / expected signatures`. Absent (1) and nil (3)
remain separately stored; nil is not participation in the committed block. This
is observed canonical commit inclusion, not a server availability probe or an
exact copy of the SDK's slashing formula. A chain halt creates no expected blocks
and must not be attributed as downtime to every validator. Partial UTC days stay
partial; a 90-day calculation must use exact retained block timestamps at its edges.

Data is kept for **all active validators**, independently of current programme
holdings, exclusions or commission limits. Metadata includes inactive validators.
Do not apply today's names, commission or operator links retroactively without a
height-matched observation. Signatures remain keyed by consensus identity.

## Additional data to consider later

1. **Actual self-delegation and delegation concentration:** useful for operator
   commitment and dependence on a few delegators; more pagination and clear
   account-to-operator linkage are needed. Do not substitute the minimum setting.
2. **Completed-governance proposal inventory:** join the archived vote events with
   complete native proposal history and eligibility windows; Abstain counts as
   participation, weighted votes retain all weights. The last 20 completed
   proposals remain a planning window, not a newly enacted score.
3. **Testnet identity and participation:** separate chain stream plus an explicit
   verified mainnet/testnet operator link; names alone are insufficient.
4. **Public RPC/archive availability:** probe voluntarily registered endpoints
   from independent locations, measuring correctness/freshness and historical
   coverage as well as response time. Do not scan private infrastructure.
5. **Hosting/geographic diversity:** declared and verifiable operator information;
   a public RPC's location does not locate a validator's consensus machine.

No new score, weighting, validator ban or hosting requirement is activated here.

## Collector and integrity model

`scripts/validator_history.py` uses Python's standard library and one configured
RPC/REST provider pair. Its default sources are already used by the project.
REST state is pinned to a block height and matched against the RPC block identity.
The consensus roster is complete, paginated, and hashed using CometBFT v0.38's
SimpleValidator protobuf/RFC-6962 construction before comparison with the header.
Absent signature slots are mapped by the matching set order; sorted roster storage
then avoids confusing changed power order with changed membership.

The collector accepts only canonical commits, checks heights/chain, key/address
mapping, signature shape, quorum weight and parent hash continuity. These are
consistency checks: it **does not cryptographically verify commit signatures or
provide independent two-provider agreement**. Provider observations must not be
treated as an authorization proof. ABCI result digests and selected raw events
are retained; full raw block results and signature bytes are not archived.

The database transaction includes a block, its events, daily counters, membership
changes and the cursor. A failed/missing block prevents all subsequent advancement;
restart retries it without double counting earlier blocks. A pruned gap is a
visible blocker, never permission to reset the start or jump to the current head.
Changing the source or start time of an existing database is rejected. A future
source migration requires an explicitly verified overlapping checkpoint procedure.

The initial UTC boundary is explicit. Installation can backfill from that boundary
while the provider retains all required blocks/results. Initial time-to-height
resolution can consume a run; it retries safely. Current state snapshots are taken
before backlog work, so current identity/commission data can accrue during catch-up.
Metadata failure is reported separately and does not erase collected blocks.

## Resource and retention boundaries

- Two fetch workers; shared cap of four RPC operations/second, 8 MiB response limit,
  bounded pagination, per-request timeout and per-run deadline.
  Small JSON-RPC batches contain at most nine operations (three blocks); responses
  may arrive out of order but must contain every exact requested ID once.
- Default at most 120 blocks / 90 seconds per run; timer waits 30 seconds after a
  run finishes. A separate lock prevents manual/timer overlap.
- The service is unprivileged and read-only outside its own state directory, has
  256 MiB maximum RAM, 40% of one CPU and a 120-second outer timeout. No credentials.
- SQLite retains exact block evidence, selected events and hourly snapshots for
  120 days. Pruning is bounded per run; daily aggregates and current streaks remain.
  Freed pages are reused rather than fully vacuuming the database each run.
- A two-GiB database ceiling and 512-MiB minimum free disk fail visibly. Total
  state includes the WAL and receipts; the database ceiling is not an exact bound
  on all filesystem bytes. Real footprint and catch-up throughput need host measurement.

At the observed few-second block interval, the three main RPC reads per block
are roughly one request per second averaged across time, plus pagination and
hourly state. This is a workload estimate, not a provider quota agreement or a
server performance benchmark. Check sustained throughput before increasing rate.

## Installation and acceptance

Use the reviewed service/timer templates in `deploy/cosmoot/systemd`. Install only
the new script and units from an exact checked commit with SHA-256 verification;
use the private operator handoff for actual access and installation commands.
No existing collector, publisher, snapshot allowlist or frontend file needs changing.
The service uses its own `StateDirectory`; history is not publicly served.

1. Verify the existing collector account and root-owned code path, available disk,
   Python/SQLite and unit names. Do not overwrite an unexpected existing file.
2. Install the verified files; validate systemd units and run one bounded collection.
3. Inspect `status.json`: exact first height/time, advancing cursor, explicit lag,
   metadata height and absence of errors. Initial `catching-up` is not full freshness.
4. Enable the timer and verify at least two scheduled runs advance the cursor.
   Run `validator_history.py --state-dir <state-directory> --check` after catch-up.
5. Include the private SQLite state in the operator's independent backup procedure,
   using SQLite's online backup API or a stopped service; copying a live `.sqlite3`
   alone can omit WAL data. External alarms are not installed by these units.

Disabling the timer stops new observations; keep the database and original start.
Use `--check` for a read-only local freshness check. Existing health services are
unchanged; this check must be added to ongoing operator monitoring separately.

Local and CI tests cover missing/changed sets, canonical commits, absent/nil
identity, quorum, failed transaction events, duplicates, gaps, restarts, membership
reentry, source/start preservation and retention. Live probes demonstrate source
compatibility only, not a running VPS timer or a completed 90-day window.
