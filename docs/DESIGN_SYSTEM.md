# NETA DAO design system

Version 1.0 · design direction selected by the owner on 2026-10-03.
Scope: every user-facing surface at `dao.netareborn.com`, including future pages.
Status: **implementation in progress**. The first rollout adds shared graphite/mint
foundations and the approved Home artwork. Page-by-page live visual verification
is still pending; see CURRENT_STATE and HANDOFF for actual release evidence.
Actual capabilities remain defined in [CURRENT_STATE.md](CURRENT_STATE.md).

## Decision and visual references

The owner selected the original graphite/mint home concept, with small voxel
illustrations on the four module cards. Replace its upper-right wizard with
**option A, the assembly plaza (Versammlungsplatz)**. Keep the natural green moss,
warm stone, earth layers, cubic geometry and soft directional light of that concept.
Do not substitute the later abstract cube-stack or illustration-free hero variants.

- [Selected home composition](design/reference-home-composition.png): layout,
  typography, palette, card treatment and module illustration direction. The wizard
  is explicitly rejected and must never become a production asset.
- [Hero comparison sheet](design/reference-hero-options.png): **A only is selected**.
  B (linked islands) and C (shared building) are alternatives, not approved assets.

These generated images are visual references, not pixel specifications, executable
UI, final logos, or authoritative product copy. Preserve the reviewed live content
and its status distinctions when implementing. Do not copy generated wording,
sample values or omissions over the actual application. Production art is now prepared in `assets/design/assembly-plaza.webp` and
`assets/design/module-illustrations.webp`; do not ship the comparison sheet.

## Visual principles

1. Calm neutral graphite surfaces, readable off-white text and restrained mint.
2. Conventional, recognizable controls. Voxel art adds identity to content;
   it never defines the shape or meaning of a button, chart, input or navigation.
3. Shared shell and reusable components across all modules. Content and density
   may differ; typography, spacing, control states and color roles do not.
4. Existing information architecture and functionality are the starting point.
   Keep Home, Proposals, Delivery, Contributors, Treasury and RELAY. Following
   and Names & Contacts remain within RELAY. Maintain sticky header behavior.
5. Visual polish must preserve the distinction between real data, local drafts,
   testnet actions, incomplete coverage and planned features.

## Foundation tokens

The following tokens are implemented in `neta-ui.css`, loaded by the main workspace
and auxiliary RELAY pages. Do not duplicate
hex values or invent per-page theme systems. Semantic aliases should refer to
these foundations; module CSS should describe layout rather than a separate brand.

| Token | Value | Role |
| --- | --- | --- |
| `--neta-bg` | `#101216` | Page background |
| `--neta-surface` | `#191D24` | Cards and panels |
| `--neta-surface-raised` | `#222832` | Menus, dialogs, hovered neutral rows |
| `--neta-border` | `#303641` | Decorative dividers and panel boundaries |
| `--neta-control-border` | `#697586` | Boundaries needed to recognize controls |
| `--neta-text` | `#F2F4F7` | Primary text |
| `--neta-text-secondary` | `#A6ADBB` | Supporting text and labels |
| `--neta-accent` | `#6EE7B7` | Primary action and selected accent |
| `--neta-accent-hover` | `#93EFCB` | Primary hover |
| `--neta-on-accent` | `#101216` | Text/icons on mint buttons |
| `--neta-success` | `#6EE7B7` | Confirmed successful result, with label/icon |
| `--neta-warning` | `#F4C76B` | Caution, partial coverage, pending confirmation |
| `--neta-danger` | `#FF8FA3` | Error, destructive action, rejected result |
| `--neta-info` | `#9DBBFF` | Informational/in-progress state |
| `--neta-focus` | `#9DBBFF` | Visible keyboard focus ring |

Mint-filled controls use dark text, not white. Subtle decorative borders are not
sufficient for essential input boundaries or focus indicators. Verify rendered
contrast after blending, opacity, hover and overlays, not just isolated hex pairs.
Normal text must reach WCAG AA 4.5:1; qualifying large text 3:1; essential graphical
controls and states 3:1 against adjacent colors. Color never carries state alone.

Typography: locally hosted Inter (with its license) or a system sans-serif fallback.
Use `ui-monospace` only for addresses, hashes and code. Use tabular numerals for
financial values. Page headings 32–44 px desktop / 28–32 px mobile; section headings
20–24 px; card headings 16–20 px; body 15–16 px with 1.5–1.6 line height; secondary
labels 12–13 px. Avoid 9–10 px product copy. Uppercase with modest tracking is
reserved for short eyebrows/status labels, not full paragraphs or all navigation.

Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px. Default card padding 24 px desktop,
16–20 px mobile; gaps 16–24 px. Cards 12 px radius, inputs/buttons 8 px, compact
status pills fully rounded. Use restrained neutral shadows only for elevation.
No neon contours, terminal scanlines, green-washed panels or decorative background
animation. Keep the existing brand name; generated mockup marks are not a new logo.

## Shared shell and components

- Header: brand left, compact chain and searchable DAO selectors, explicit network
  state, wallet at right. Keep clear labels, sticky positioning and visible focus.
  Preserve RELAY's cross-DAO context and hidden DAO picker behavior.
- Navigation: separate row below header on desktop; readable labels, restrained
  active underline/surface, programmatic selected state. Do not compress everything
  into one crowded header. Preserve routes, deep links and DAO selection persistence.
- Buttons: one dominant primary action per local task area, mint fill/dark text.
  Secondary actions use neutral outlines; tertiary actions use text. Destructive
  actions have their own labeled danger treatment. Hover, active, focus, busy and
  disabled states must be explicit. Show a nearby reason for unavailable actions.
- Status badges: compact supporting labels, not button-like primary calls to action.
  Keep Planned, Testnet, Live data, Read-only, Partial and confirmed transaction
  states distinct. Brand mint does not by itself mean that something is confirmed.
- Forms: persistent labels, help where needed, clear validation and keyboard order.
  Errors reference the affected field; changing values must not silently submit.
- Lists/tables: neutral rows and dividers, visible selection, aligned numeric columns,
  consistent empty/loading/error states. Icons supplement text; icon-only actions
  need accessible names. Important data is never available exclusively on hover.
- Dialogs: coherent surfaces and typography, managed focus, keyboard dismissal where
  appropriate, focus restoration and scroll behavior. Keep transaction reviews readable.

## Voxel illustration rules

Home hero: one modest isometric assembly plaza, roughly the right third of the hero.
A moss-edged earth/stone island holds an open arrangement of equal stone seats around
a mint inset tile; short steps make the entrance visible. No central leader, wizard,
mascot, flag or unrelated character. Warm natural light, coherent camera angle,
light stone and green vegetation, no neon glow. Maintain breathing room around text.

Home module cards may retain the selected small voxel illustrations: document layers
for Proposals, steps/blocks for Delivery, grouped forms for Contributors and a small
vault for Treasury. They supplement conventional labels and icons. Use consistent
scale and lighting, approximately 48–80 px artwork containers rather than a second hero.

On task pages, use illustration only in a restrained introduction or empty state when
it helps orientation. No large hero above every working table, proposal or inbox.
No art inside dense data rows, charts, form fields or signing controls. Decorative
images have empty alt text and no tab stop; never encode essential status in an image.
No parallax or perpetual motion. Respect reduced-motion preferences for transitions.

Production art must be separate, optimized assets with explicit dimensions and
responsive sizes. Prefer AVIF/WebP with suitable fallback and transparency where
needed. Target <=200 KB for the hero and <=40 KB per small illustration, checking
actual quality rather than degrading legibility. Lazy-load below-fold decoration;
reserve dimensions to avoid layout shifts. No runtime 3D engine is needed.

## Application across pages

| Surface | Apply the shared style while preserving these requirements |
| --- | --- |
| Home | Assembly hero, Vision/Mission, four illustrated module cards, current status and updates; preserve all reviewed content sections |
| Proposals | Compact working header, clear draft/review/on-chain stages, selection and filters, readable proposal text; discussions stay visible below the proposal rather than hidden in details |
| Delivery | Same panels, milestone rows, owner/deadline/evidence treatment; clearly label concept data and unavailable acceptance/payment actions |
| Contributors | Same cards/table styles and readable identities; distinguish illustrative contributions from authoritative records; no fictional live scores |
| Treasury | Clear totals, tabular figures, consistent asset/event tables, neutral chart grid, labeled series; distinguish committed snapshots and PARTIAL coverage from planning/forecast examples at the relevant section |
| RELAY | Same shell, list/reader/forms and unread treatment; Following owns favorites; zero unread badges stay hidden; unavailable private sending is not the dominant action |
| Names & Contacts | Reuse RELAY and shared forms/list patterns; preserve disabled registry activation and clear availability state |
| Lab/readiness/setup | Shared foundations where practical but unmistakable test/admin context; visual changes never remove security controls or enable writes |

Treasury charts may use mint, blue and amber with labels/line styles to distinguish
series. Red/green performance also needs signs and text. Do not recalculate values,
change classification, replace bot snapshots or conceal source/date/coverage during
restyling. Do not use wallet connection as the primary action on read-only pages.

## Responsive and accessible behavior

Target a centered content area up to 1280 px with 24–48 px desktop margins and
16 px mobile margins. Use content-driven breakpoints near 1024 and 640 px:
four module columns become two then one. The hero becomes a single reading column;
decoration moves after copy or is hidden at narrow sizes. No text/art overlap.

Header controls wrap/reflow without shrinking labels. Keep all navigation destinations
discoverable; if tabs scroll, expose overflow and keep the active tab visible. Tables
may have a labeled horizontal scroll region; do not introduce page-wide overflow or
discard necessary columns. RELAY feed/detail and proposal panes become sequential
views with clear return navigation. Sticky bars must not cover focused controls.

Aim for >=44 px touch targets for primary controls. WCAG 2.2 AA target-size minimum
is 24 by 24 CSS px with defined exceptions/spacing; small icon buttons must not
be crowded. Support keyboard access, visible focus, 200% zoom and 320 CSS px reflow.
Use semantic elements and accessible names; preserve logical heading order.

## Implementation and future changes

Every UI task must read this guide and the actual feature inventory first. The shared design is owned by `neta-ui.css`. Existing module layout
styling is spread across `styles.css`, `neta-governance.css`,
`governance-overrides.css`, `relay.css`, `names.css` and lab-specific styles. During
rollout introduce shared foundations/components deliberately; migrate old rules
rather than accumulating competing overrides or scattered hardcoded colors.

Implementation order: shared tokens/font/shell; approved Home with assembly art;
Proposals/Treasury; Delivery/Contributors; RELAY/Names; auxiliary test/admin pages.
Each stage should preserve content, DOM hooks, route behavior and transaction guards.
Do not add a framework just for the theme. Refresh asset query versions when required.

For each new page or visual PR:

1. Reuse shared tokens, shell and components; document a genuinely new pattern here.
2. Check actual feature states against CURRENT_STATE; no activation through styling.
3. Review desktop (1440), tablet (768) and mobile (390/320) screenshots, keyboard
   navigation, zoom, visible focus, contrast and the relevant loading/error/empty states.
4. Exercise affected selection, filtering, dialog and responsive flows. Run relevant
   existing tests and inspect actual CI results. CSS and design-asset changes now match both frontend/contract and RELAY-browser
   CI filters; inspect actual results rather than assuming coverage.
5. Verify deployed assets and UI after integration and record what actually shipped.

These are acceptance criteria, not checks already completed for this design. Mainnet
messaging remains disabled; preserve all pending ratchet/archive/outbox and transaction
journals. Review unresolved safety gates in the security audit before functional work.

## Sources and decision precedence

Owner's selected concept and assembly-plaza choice establish the art direction.
This written guide defines implementation behavior; the generated pictures illustrate
appearance. Actual product state comes from CURRENT_STATE and verified code. If a
new explicit owner instruction changes the direction, record it here with its date.

- [Linear UI redesign](https://linear.app/now/how-we-redesigned-the-linear-ui): neutral surfaces, hierarchy and typographic clarity.
- [Mercury Treasury](https://mercury.com/treasury): readable financial UI reference, not a product or return claim.
- [Atlassian color foundations](https://atlassian.design/foundations/color): semantic color roles and reusable tokens.
- [WCAG contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- [WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
