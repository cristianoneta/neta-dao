# Maintenance checkpoint — 2026-10-04, end of session

## Scope

Focused review of `cristianoneta/neta-dao`: current main, open PRs/issues, recent
Actions, key workflow triggers, exported data timestamps, public faucet status,
Names deployment/configuration boundaries and the documentation entry points.
Baseline: `50c5814e048230507a1d03c3e7c8c03f97b537ee` (merged #145).
No open PRs at the initial scan. Issue [#119](https://github.com/cristianoneta/neta-dao/issues/119)
remains open for main DAO historical indexing and production NNS activation;
isolated UNI-7 tests do not close those gates. No separate neta-website audit,
full security/performance audit or new live-wallet test is claimed.

## Corrections

- Replaced competing chronological “current/next” blocks in root HANDOFF and
  CURRENT_STATE with one current inventory and next action. Preserved the original
  documents and faucet chronology as explicitly superseded archives.
- Updated README, checkpoint index, Names product boundary/protocol/runbook and
  faucet handoff. Removed obsolete instructions to deploy/activate again, finish
  already-wired adapters, recover the resolved checksum blocker or repeat owner
  name tests. Production null constants are distinguished from the live UNI-7 lab.
- Recorded final #145 checks, deployed-byte verification and its remaining real
  validator E2E dependency. Clarified that proofs currently remain within one tab;
  a remote volunteer uses their own test name/wallets, not shared credentials.
- Added a document map and an in-place maintenance rule. Older dated entry points
  retain URLs and historical evidence but point to current continuation.
- Refreshed verification commands for the added NNS crates/browser test. No runtime,
  contract, workflow, dependency, secret, journal or generated-data change is made.

## Observed release and service evidence

PR #145: all final checks succeeded. Main Contract/frontend run 37230567986,
faucet 37230567917 and Pages 37230567543 succeeded. Eight changed public files
matched after publication. The NNS handoff retains detailed test/receipt limits.

Closing read-only faucet status (approximately 22:11 Europe/Berlin) reported UNI-7,
expected address, balance 1039974213 ujunox, ready true, pause null, and all three
expected guards/confirmation/gas-policy markers. The earlier 15-JUNOX balance is
historical; this read does not prove the funding source or completed payout tests.

## Data freshness and efficiency follow-up

Latest collector runs returned in the 100-run Actions review were successful:

| Collector | Run | Export observation (UTC) |
| --- | --- | --- |
| Operations Treasury | 37222042208 | Balances 17:50:41; events 17:50:52; PARTIAL valuation |
| Main DAO | 37222971722 | Status 18:04:50; balances completed, events unavailable |
| Membership | 37222605961 | Status 17:59:41; all three configured adapters completed |

At the closing review these exports were approximately two hours old despite the
configured 15/30-minute schedules. Green older runs do not establish current
freshness. The reason for the schedule gap was not established; inspect current
Actions and timestamps before the next data-dependent task. Do not hand-edit
snapshot timestamps or infer missing history as zero. Generated files were preserved.

The concrete efficiency improvement in this cleanup is less duplicated working
context and one document owner per topic. No runtime speedup is claimed. Existing
measured-work candidates remain: shared signing-bundle transfer cost, hidden-tab
RELAY polling, and collector scheduling/freshness. Changes need specific evidence
and focused tests; do not replace safe single-writer publication speculatively.

## Verification and continuation

Check relative links in changed Markdown, diff whitespace, and consistency with
current config/source. Ordinary docs do not trigger application CI; touching the
faucet README does trigger faucet checks. Inspect actual PR results and Pages after
merge; the final PR description records that release evidence.

Next chat starts at [HANDOFF](../HANDOFF.md). Preserve mainnet-off gates, browser
and backend journals, test quote authority, existing worktrees and bot commits.
