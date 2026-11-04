# Delegation rule composer — 4 November 2026

The public homepage introduces Cosmoot and leads directly to the Delegation
Programme. Its rule editor assigns each supported criterion exactly one role:
Eligibility, Bonus or Unused. This source change is pending review and manual
website publication; it does not alter any published proposal or approved rules.

## Rule contract

Schema 11 stores the role and its settings together. Uptime, commission,
governance participation and the existing upgrade observation can be an admission
requirement or a bonus. Active-set history supports eligibility or unused only;
its available history window remains 90 days. RPC, testnet and archive criteria
remain unavailable until verified evidence is implemented.

Eligibility criteria must all pass for a regular allocation. A bonus threshold
affects earned points only. Numeric bonus curves are linear between zero and full
score, clamped outside those bounds. Commission rewards lower values. Uptime's
new bonus defaults are 95% for zero and 99.5% for full score; both are editable.
Moving a criterion presents the destination role's settings. A criterion cannot
silently retain an additional admission requirement after becoming a bonus.

Base points are equal for eligible validators. Base plus the maximum bonus is
1,000 points; criterion weights divide that bonus. Allocation uses each eligible
validator's share of earned points, then the voting-power cap. It does not split
money into independent base and bonus pots. Exact rational scores feed integer
micro-JUNO allocation and deterministic remainder handling.

Governance uses only the programme's own fully observed completed voting periods:
the previous 90 days, extended toward ten proposals within the available 180-day
history. A complete sample without applicable opportunities earns zero governance
bonus and retains its weight and eligible base points. Missing selected evidence
blocks a complete new calculation; it is not silently treated as a zero score.

Fixed allocations are reserved before the regular distribution and retain their
approved amount, task and inclusive UTC dates. They bypass regular eligibility
and voting-power caps. No automatic overlap matching or bonus deduction is added.
Technical chain constraints still apply to every actual movement.

## Review, approval and execution

The live impact preview and frozen proposal review use the same engine. Frozen
reviews retain all possible recipients, the exact criteria, evidence and targets.
Rule comparisons describe role, threshold, curve and weight changes; native
summaries remain bounded and state that approving rules moves no funds.

Schemas 2–10 keep their original normalization, calculation and hashes. Editing a
legacy rule makes an explicit new draft; it never rewrites an approved revision.
Historical relative caps need the actual validator count for conversion and are
not silently rounded. The existing direct percentage cap still supports 100%.

Rebalance uses the independently verified approved rule, fresh evidence and live
chain-state checks. Commission is a live admission limit only when its role is
Eligibility. Active-set membership is required only when that criterion is
selected. Validator identity and technical staking checks remain mandatory.
The approved-rule proposal and the subsequent movement proposal are separate.

## Publication boundary

This is a website change built on the pending proposal-size and code-review
changes. It requires no new contract deployment or collector installation of its
own. Existing workshop limits and the early size guards still apply. The optional
attachment contract remains undeployed and is not enabled by the composer.

## Validation and remaining limits

The complete local verification passes: 534 JavaScript tests and 250 Python tests
(14 environment-dependent skips), plus lint, formatting, typechecking and the
Pages/Worker build. This includes golden policy and allocation
hashes for schemas 2–10, schema-11 evidence/curve tests, frozen review transport,
approval discovery and exact execution messages. Independent review found and
fixed an invalid-input role selector mismatch and an unconditional upgrade-evidence
gate in Rebalance. Browser inspection confirms the real homepage entry, drag/drop,
keyboard moves, editable weights, live impact and saved draft reload. The full
automated browser matrix remains a CI gate; the local Chromium download was
unavailable.

The isolated Juno v31 lifecycle also passes with the original programme DAO:
native governance approves schema 11, the approved-rule reader verifies it, live
preflight accepts a permitted inactive recipient and the exact unbond movement
executes. Other holdings stay unchanged. The existing 45-movement schema-10 test,
authority denials, atomic rollback and corrected reward-claim tests still pass.
These tests use synthetic local accounts and funds, not mainnet transactions.

Using the published collector snapshot at block 43,412,375, the new default rule
at a 100% cap and a 21,938,700 JUNO comparison budget produces a 9,461-character
referenced body. A hypothetical schema-10 parent plus a 50/50 uptime/governance
bonus revision produces 9,801 characters. Both reproduce their complete targets.
These are measurements of test configurations, not submitted rule revisions.

The safe snapshot reduction keeps all possible recipients from either policy and
all rows needed for holdings and projected caps; an independent full calculation
rejects changed or omitted positive targets. Limits still apply: an all-unused
new rule compared with a parent requiring governance evidence measured 10,776
characters and was correctly blocked. Evidence growth and larger comparisons
still require the separately planned attachment activation, not discarded data
or automatic splitting of execution proposals.
