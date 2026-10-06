# Treasury P&L — accepted design direction

Owner feedback, 2026-10-05 (Europe/Berlin): the draft looks good; correct black text
on very dark backgrounds and preserve the result in the handoff.

Status: **interactive design draft with fictional example data, not production
accounting and not deployed**. This design task was authorized while production
Treasury work remains behind the NNS release. Acceptance of the layout does not
verify financial data or authorize substituting examples for collector output.

## Saved reference

- [Standalone interactive preview](design/treasury-pnl-draft.html): download/open
  locally in a browser. No wallet, RPC or API requests; controls change sample data.
- [Editable inline source](design/treasury-pnl-draft.fragment.html): source of the
  preview shown in the conversation. Keep both files consistent when revising.

## Agreed composition and accounting behavior

- Place Income & expenses (cash-based P&L) between Assets and Treasury events.
- Default to the current month. Year and month selectors also support full-year
  views; current periods say month/year to date. Compare equal elapsed periods.
- Show income, paid expenses and operating surplus/deficit, followed by a category
  table, previous-period amounts and changes. Use signed values and labels.
- Separately show verified NETA Naming Service revenue with registration and
  renewal breakdowns, plus other operating income.
- Expenses: development/operations, marketing/community, grants, other expenses,
  and network fees. Avoid counting network fees twice.
- Category selection opens its detail; related Treasury events should link to
  actual transactions and relevant proposals when implemented.
- Freeze USD valuation at payment time; keep token amounts and pricing provenance
  available in actual event details. Do not revalue historical revenue at today's price.
- Missing history, prices or coverage are unavailable/partial, never fabricated zero.
  The draft includes explicit unavailable periods to illustrate this behavior.
- Keep funding/capital contributions and market/valuation movements separate from
  operating income. Explain the bridge from opening to closing Treasury value.
  Transfers between owned wallets and swaps are not revenue; reconcile transfers
  across chains without counting both legs as external income/expense.
- Upcoming payments/commitments stay outside paid expenses. Preserve token units,
  due dates, milestone/approval conditions and proposal links in production.
- No Reserve Policy. The sample shell/assets/events only supply visual context;
  reuse the actual shared navigation, DAO/network selection and Treasury features.

## Contrast correction and verification

The dark mockup now declares scoped foreground inheritance for all descendants,
with explicit option foreground/background colors. Semantic mint/red/amber colors
remain intact. This prevents generic host light-theme rules on headings, paragraphs,
labels, table cells and other text from overriding the dark surface's light text.
Production implementation must use the shared neta-ui.css tokens, not copy the
mockup's isolated theme as another product theme.

Local Chromium checks passed after the correction:
- Both light and dark host preferences, including injected black host text styles;
  visible text across October, September, YTD and unavailable states had a measured
  minimum contrast of 6.98:1 against its resolved opaque background.
- Year/period changes, category selection, related-event filtering, reconciliation
  and milestone expansion; no JavaScript errors.
- 1024, 768, 390 and 320 px viewports without page-level horizontal overflow.
  The dense mobile table scrolls horizontally within its own region.

These checks concern the mockup only. The actual ChatGPT host's stylesheet cannot
be fully reproduced by the standalone preview; owner can review the updated inline
render. Real data ingestion/classification, missing-price behavior, live transaction
links, proposal matching and deployment remain implementation tasks.

## Resume after the NNS release

1. Re-read HANDOFF, CURRENT_STATE and DESIGN_SYSTEM; preserve later bot commits.
2. Inspect actual Treasury collectors/history and receipt coverage. Establish the
   verified NNS fee path to the main DAO; do not infer fees from wallet balance changes.
3. Implement the above design with real source-backed totals and explicit coverage,
   reusing shared controls/tokens. Keep the mockup's example data out of production.
4. Check accounting identities, duplicate prevention, period boundaries and
   unavailable inputs; then review contrast/responsiveness and normal release gates.
