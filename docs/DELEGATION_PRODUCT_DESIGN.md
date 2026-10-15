# Delegation Programme: product design review

15 October 2026 · implementation candidate, not a production release.

Scope: the existing Juno programme overview and its rule → simulation → proposal
workflow. The owner requested a substantial UI/UX review with no additional product
features. This change reorganizes that core and preserves its calculation,
governance and transaction boundaries.

## Diagnosis

The previous page made users interpret the implementation before understanding
their task. Current holdings, draft rules, governance state and future scoring
models competed for attention. Active controls were collapsed while large disabled
V2/V3 groups occupied the working area. Important amounts were embedded in prose.
The final action said “Publish proposal” although it opened a prepared draft in
the existing proposal workspace.

This is a heuristic review of the live interface and code, not a usability study.
No conversion, comprehension or task-time improvement has been measured.

## Product hierarchy

| User's question | Default answer | Detail on demand |
| --- | --- | --- |
| What does the programme hold? | Delegated JUNO, spendable balance, position count and active-set share | Exact position amounts and coverage |
| What can I do next? | Plan an allocation; a separate rewards-claim action | The claim's source, timestamp and exact amount |
| What rules already apply? | Verified approval state and a short policy summary | Approved settings, exclusions and evidence |
| What am I proposing? | Open budget and eligibility controls with a draft summary | Formula, upgrade evidence and manual exclusions |
| Who would gain or lose allocation? | Current, target and change amounts in one comparison | Per-validator reasons, exact values and evidence |
| What does the next click do? | Open a proposal draft for community review | Rule/snapshot identifiers and later execution requirements |

Overview is an observation surface, outside the three numbered planning stages.
The stages remain freely navigable: Set rules → Review distribution → Review
proposal. They guide the work without turning the page into a gated wizard.
The existing proposal workspace then owns discussion, publication, funding,
on-chain submission and voting. A rule approval and allocation execution remain
separate decisions.

## Interface changes

- A compact product header retains the Cosmoot identity and Juno context. The
  programme title and navigation remain in view on entry through a stage deep link.
- The overview leads with two financial panels. Planning has the dominant action;
  rewards are a distinct secondary task. The active-set bar derives only from the
  existing observed positions; it is not a new score or performance claim.
- The five largest positions form a readable table beside the verified current
  policy and a short workflow explanation. All positions remain available.
- The editable rule criteria start open. A desktop summary stays beside the form,
  showing the budget, cap, commission and exclusions. On mobile it follows the
  controls in normal reading order. It always represents the local draft.
- Future scoring models and historical explanations are available in explicitly
  labelled disclosures. Existing disabled controls, weights and evidence remain.
- The simulation emphasizes proposed amounts and exceptions before the comparison.
  Search, filtering, sorting, pagination and row evidence keep their existing
  behavior. Six columns remain available in a labelled scroll region on mobile.
- Proposal review separates proposed policy from illustrative allocation amounts.
  “Open proposal draft” accurately describes the handoff. Signing and execution
  are not implied by planning buttons.
- Displayed financial amounts use two decimals for scanning; exact six-decimal
  values remain in details and exports. Missing prices stay unavailable. Missing
  approvals, source failures and stale snapshots retain distinct states.

The visual language reuses the graphite/mint foundations: neutral working surfaces,
tabular amounts, restrained borders, consistent 44px primary controls and visible
focus. No new framework, illustration system or global theme is introduced.

## Research and application

| Primary source | Applied principle |
| --- | --- |
| [Nielsen Norman Group: Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Keep primary work visible; defer secondary information. Active eligibility controls belong in the main form, future policy detail does not. |
| [Linear: Behind the latest design refresh](https://linear.app/now/behind-the-latest-design-refresh) | Give different elements different visual weight; let navigation recede and working content lead. |
| [Carbon: Data table guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) | Keep comparison tools together; use row expansion for supporting detail and retain pagination. |
| [Carbon: Progress indicator guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/progress-indicator/guidelines) | Use clear, actionable stages for the actual sequence; keep the overview separate from that sequence. |
| [W3C: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) and [Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Reflow the page to 320 CSS pixels, contain genuinely two-dimensional tables, and preserve keyboard/touch access. |

These are design references, not evidence that this implementation has achieved
usability or accessibility certification. Existing product behavior and the
repository's design system take precedence over copying a reference product.

## Verification and review frames

The planner browser regression covers all four stages at 1440, 768, 390 and 320px,
including expanded future models, loading/error/stale states, input validation,
draft persistence, table interactions and exact-value export. It also exercises
the unchanged downstream review, funding and voting journey with mocked services.
No real proposal or transaction is submitted by those tests.

The review frames below are browser captures of the implementation with explicitly
labelled example data. They are not live balances, actual validator assessments or
approved rules. The release remains manual; local validation is not release evidence.

| View | Desktop | Mobile |
| --- | --- | --- |
| Overview | [Preview](design/delegation-overview-desktop.webp) | [Preview](design/delegation-overview-mobile.webp) |
| Set rules | [Preview](design/delegation-rules-desktop.webp) | Covered by browser regression |
| Review distribution | [Preview](design/delegation-simulation-desktop.webp) | Covered by browser regression |
| Review proposal | [Preview](design/delegation-proposals-desktop.webp) | Covered by browser regression |

Before judging the redesign with real users, ask an observer to identify holdings
and spendable funds, ask a proposer to change a rule and explain its impact, and ask
a reviewer to distinguish rule approval from execution. These are proposed research
tasks, not completed testing or a request for additional product features.
