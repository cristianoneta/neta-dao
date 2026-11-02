# Direct voting-power cap — 2 November 2026

The cap editor now accepts 0.01–100% in 0.01 percentage-point increments. Schema
10 stores `votingPowerCapBps` as an integer from 1 to 10,000. The new default is
6%, equivalent to the previous 1.5 factor at 25 validators. A direct percentage
stays fixed when the consensus validator count changes. There is no additional
30% ceiling. At 100%, the cap imposes no additional voting-power restriction.

The percentage limits each validator's projected network voting power, including
other delegators' stake; it is not a share of the programme budget. Eligibility,
commission, participation, scoring, exclusions and the liquid reserve still
apply. Fixed allocations are reserved first and remain exempt. Their stake
continues to count toward capacity for regular allocations.

Schemas 2–9 retain their original relative factors, ceilings, serialized policies
and frozen review hashes. Editing an old draft's cap explicitly changes it to a
fixed percentage. Merely opening, importing or changing another criterion does
not change cap semantics. Resetting the cap restores the approved cap mode while
preserving unrelated draft edits. Historical relative rules are labelled as such.

## Updating an existing discussion

A Juno allocation-rule review still in Discussion exposes a percentage field and
**Recalculate allocation**. The owner requested 100% for the current initial-rule
discussion; there is no approved new rulebook yet. This action prepares a revision
of the same review, rather than a new proposal or thread.

Recalculation verifies the existing frozen review, fetches our current collector
snapshot and upgrade evidence, and checks the approved baseline. It retains the
existing budget, criteria, fixed mandates, rationale, title and authored summary.
It rebuilds all allocation targets, observations and hashes. Missing calculation
evidence, stale/future/regressed snapshots, a changed approval, or changed review
state block replacement. Field/transport limits are checked before local saving.

The resulting comparison is visibly a local revision. The author can inspect it
and use the existing **Publish revision** wallet action with the generated change
note. Preparation performs no transaction. Publication records a new version
under the same review ID, so the forum retains its thread and picks up that
revision. Finalized or submitted reviews do not expose this editor. Rule approval
still moves no funds; actual allocation requires a separate proposal.

## Validation and publication boundary

`npm run verify` passes: formatting, lint, typecheck, repository/build checks,
467 JavaScript tests and 243 Python tests (14 environment skips). New regressions
prove actual allocations beyond 30%, 100% allocation without a hidden ceiling,
validator-count independence, input boundaries, fixed exceptions, old/new compact
review and native approval round trips, exact percentage summaries, and fresh-data
revision preparation with failure paths that preserve the original.

Browser coverage checks direct input, draft persistence, a stale-data refusal,
and recalculation inside the same discussion without publication. The required
isolated Juno check uses a schema-10 100% rule through workshop storage, native
submission and approval recognition. Those CI acceptance gates must pass before
integration. This environment has no installed Playwright browser, so no local
browser acceptance is claimed.

A manual website release is required. No collector, forum service, database or
contract installation is needed. The existing discussion has not been updated by
this code change; its new comparison becomes public only after the owner's signed
revision. No production wallet action has been performed.
