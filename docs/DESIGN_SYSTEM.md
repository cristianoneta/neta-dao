# NETA DAO design system

Version 1.0 · design direction selected by the owner on 2026-10-03.
Scope: every user-facing surface at `dao.netareborn.com`, including future pages.
Status: **shared theme and Home live; per-page refinement in progress**. PR #108
published the graphite/mint foundations and approved artwork. Home desktop and
320/768 px review frames have been inspected; #109 mobile corrections were verified
live. Proposals has an initial read/filter smoke check; full remaining module review
is pending. Follow the owner’s requested page-by-page publication cadence.
See CURRENT_STATE and HANDOFF for actual release evidence.
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
   Keep Home, Proposals, Delivery, Contributors, Treasury and RELAY. Inbox, Directory, Contacts, My profile
   and .neta name are peers within RELAY (owner update 2026-10-03). Maintain sticky header behavior.
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

Owner update 2026-10-08: Community Tools is grouped by project, initially Juno and
NETA, with room for future chains. Keep the existing Faucet and Validator Upgrade
Status under Juno. The NETA entry is **Buy NETA on WYND**, adapted from Rescue NETA
on the old site. Reuse the current graphite/mint foundations and Community Tools
header; do not import the old terminal/matrix styling. Use a readable amount and
transaction review form, explicit wallet confirmation and responsive project cards.

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
| Delivery | Shared hero with UX DRAFT / NOT LIVE DATA and a scoped no-live-data placeholder for every DAO; no fictional mandates, amounts, milestones, owners, evidence or action buttons (owner update 2026-10-06) |
| Contributors | Same cards/table styles and readable identities; distinguish illustrative contributions from authoritative records; no fictional live scores |
| Treasury | Clear totals, tabular figures, consistent asset/event tables, neutral chart grid, labeled series; distinguish committed snapshots and PARTIAL coverage from planning/forecast examples at the relevant section |
| RELAY | Same shell, list/reader/forms and unread treatment; Directory owns follow controls; zero unread badges stay hidden; unavailable private sending is not the dominant action |
| Names & Contacts | Reuse RELAY and shared forms/list patterns; preserve disabled registry activation and clear availability state |
| Lab/readiness/setup | Shared foundations where practical but unmistakable test/admin context; visual changes never remove security controls or enable writes |

Treasury charts may use mint, blue and amber with labels/line styles to distinguish
series. Red/green performance also needs signs and text.
Owner update 2026-10-05: place asset valuation/source warnings inside the default-closed
small/unpriced-assets details, alongside its asset rows and coverage explanation.
Apply this shared Treasury pattern to existing and future DAO entries. Keep the
PARTIAL status and priced-assets subtotal label visible; whole-snapshot failures
and transaction-history availability belong to their own sections. Do not recalculate values,
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


## RELAY navigation update — 2026-10-03

The owner requested one navigation level below RELAY. Do not recreate the separate
Following page or a Names tab containing another tab bar. DAO discovery and follow
preferences live together in Directory. Use a Followed filter, retaining existing
subscriptions. Profile detail stays a contextual view with a Back to directory
action. On narrow screens, section buttons wrap and remain directly discoverable.

RELAY shell correction (owner feedback, 2026-10-03): use the same persistent
masthead above the section navigation for every RELAY destination. The heading
is "Your conversations. Your connections."; it must not be hidden or replaced
when switching tabs. Inbox and Names surfaces share `relay-section-card`, padding,
background, border, title size and supporting text. Section titles are h2 inside
the card; the persistent masthead supplies the single h1. Keep the nav at the same
document position and reserve scrollbar space to avoid horizontal movement.


## Desktop section artwork — owner update 2026-10-03

Proposals, Delivery, Contributors and Treasury reuse the Home sprite in a shared
136 px decorative slot at the right of their introduction. RELAY reuses the
assembly plaza in the same slot, unchanged across all five sections. Keep action
buttons and status badges visible independently of artwork. At 960 px and below,
hide decoration and use a single text column. Use shared `page-hero` styles in
`neta-ui.css`; no additional raster files, animation or runtime rendering library.

## People navigation — owner decision 2026-10-03

Rename the main Contributors destination to **People**, with peer **Members**
and **Contributors** buttons using the existing RELAY subnav styling. Keep the
People heading, artwork and subnav stable for both panels and every DAO.
Members shows verified governance participation with DAO-specific units.
Contributors remains a planned state until the owner defines its real data and
workflow. Remove illustrative Operations people, mandates and pay from the live
UI. Preserve legacy `#contributors` links by routing to Members.

## Community tools footer — owner update 2026-10-04

Use the Proposals footer on every workspace destination: one shared footer after
main, aligned with the content width, a subtle full-width divider and centered
underlined mint “Juno testnet faucet ↗” link. Keep the same 24/40 px vertical
padding and 44 px link target on Home, Proposals, Delivery, People, Treasury and
all RELAY panels. On short pages the footer rests at the viewport bottom; on long
pages it follows the content. Never overlay content with a fixed footer.
The independent faucet opens in a new tab with noopener/noreferrer.

## Shared wallet controls — owner update 2026-10-04

Every workspace route uses the shared header wallet controls. When connected,
show the shortened address and a separate Disconnect button; retain the full
address in the title and accessible label. Apply the same behavior on the
independent faucet. Controls wrap on narrow screens. Disconnect clears the
active connection, never stored drafts, keys or pending transaction journals.

## Faucet platform promotion — owner update 2026-10-04

The independent faucet header links back to the multi-DAO platform using
**dao.netareborn.com** and “Create · Discover · Govern DAOs”, never “Explore
NETA DAO”. Reuse the decorative assembly plaza, a neutral surface, subtle mint
border and external-link arrow. Keep wallet controls visually distinct and
available. Move the promotion to a separate row on narrow screens; the full
keyboard-accessible tile opens the platform in a new tab.


## Public profile preview — 2026-10-04

My profile remains inside the shared RELAY shell. Use labelled optional public
contact inputs, a collapsible validator-address section, and a neutral preview
card. At <=640 px the contact fields form one column. Render all self-entered
text via textContent; HTTPS links open with noopener/noreferrer. Distinguish
“Preview · not published”, self-declared contacts and actual operator ownership
proofs. Editing clears a stale preview. Never show verified identity or an active
programme award merely because a syntactically valid address was entered.

Owner update 2026-10-05: place a labelled **Network** select above the mainnet and
testnet validator addresses. Offer only supported networks (currently Juno), keep
both chain IDs visible in the address labels, and show the network in the preview.
Reuse the shared native select style. Changing networks invalidates the preview
and clears old operator addresses; it never requests signatures or switches the
global governance/wallet network.

## Names UNI-7 operator pages — 2026-10-04

Setup and lab reuse graphite/mint foundations and conventional labelled forms.
Keep UNI-7, mock-token and local-test-price labels explicit. Setup exposes one
review and one wallet confirmation per action, never an automatic transaction
queue. Lab reviews exact token debit/owner/recipient and clears stale reviews on
form edits or wallet changes. Disconnect preserves keys, setup and transaction
records. Render addresses/hashes with wrapping; all actions remain keyboard
reachable at 320px. These pages do not enable the production profile button.

## Name entry — owner decision 2026-10-04

Registration takes the label alone (e.g. `cristiano`) with a fixed `.neta` suffix
outside the editable field. Accept a pasted full name and display its label only;
never append a second suffix. Preserve validation of malformed/repeated suffixes.
The main fee calculator follows this pattern; the UNI-7 lab already accepts either
form through normalizeName but has not adopted the fixed-suffix presentation.

## Validator proof steps — 2026-10-04

The separate UNI-7 lab uses the same labelled fields, neutral sections and shared
review panel. Show exact operator chains/addresses, derived signing accounts,
name owner, profile revision, purpose and expiry before any signature. Use separate
mainnet and UNI-7 ownership buttons to allow deliberate account switching; a later
publication review is a separate UNI-7 transaction. Label collected signatures as
unpublished, and a stored link as operator ownership only, never active-validator
eligibility. Keep long addresses/challenges wrapped at 320px. Owner unlink and
operator withdrawal have explicit separate reviews. No new graphics or wizard.

## Integrated Names operations — 2026-10-05

Keep Names inside the existing RELAY shell and shared wallet header. Use a compact
network selector/session panel above the name/profile content and an inline, focusable review
panel with exact name, payer/owner, recipient, amount, expiry and network. Do not
embed the lab or show its setup/admin steps as the normal purchase flow. Use the
existing contact form; keep preview distinct from explicitly reviewed publication.
Show testnet/mock-token/local-price limits and preserve transaction recovery across
wallet changes. The mainnet adapter is gated by its verified deployment and DAO activation;
mainnet messaging remains unavailable.

## Mainnet Names preparation — 2026-10-05

The Names selector explicitly distinguishes Juno mainnet/NETA from UNI-7/mock NETA.
Reviews repeat network, debit, recipient and the snapshot observation/expiry.
The separate owner price-key page reuses graphite/mint tokens and labelled controls;
private PEM contents are never rendered. Show public key, backup/download and
GitHub-secret instructions separately from unsigned deployment-plan download.


## Names owner availability control — 2026-10-05

Keep administration inside the existing Names session panel, in an owner-only
collapsed details section after the status. Reuse the shared wallet and inline
review/confirmation panel. Show network, global effect, exact registry, admin,
fee recipient, tariff, signed price dates and network fee before confirmation.
Opening and pausing are separate explicit actions; ordinary users never see the
admin controls. Pending receipt recovery stays in the existing Saved transaction
section. No new wizard, separate wallet connection or deployment page is needed.

## Names purchase simplification — owner update 2026-10-05

Use three plain actions: Check availability, Start registration, Buy name. Registry
verification is part of availability checking; local secret preparation is part
of opening the first transaction review. Keep both explicit wallet confirmations
and the existing inline review panel. Label the payment confirmation Buy and
confirm in Keplr (Renew and confirm in Keplr for renewal). Explain the one-hour
non-exclusive commitment and show its actual deadline before payment. Never
present commitment as guaranteed name ownership. Refresh pricing is optional.

## Name lifecycle messages — owner update 2026-10-05

Reuse Inbox feed/reader, unread badges and a peer Names filter. Show separate
welcome, renewal-confirmed, name-transferred and name-received copy, plus expiry
reminders. Profile and renewal links must retain name/network context; expired
ownership must not advertise renewal after grace/transfer. Explain that these
are system notices checked while the page is open, with browser-local history.
Do not activate the private-message composer or imply email/push delivery.

## Compact Names account panel — owner update 2026-10-06

Show the connected name and expiry automatically, with Edit profile and Renew name
shortcuts to the existing forms. Label the compact selector **Name registration**
with explicit Juno mainnet / UNI-7 testnet options; this is the registry environment,
not a separate blockchain from the profile's Network field. Keep this selector visible;
collapse technical pricing/registry information and retain owner-only collapsed
administration. Use the shared foreground tokens, wrapping actions and a stacked
network selector on small screens. Loading, no active name and failed lookup are
distinct states; failed reads expose Retry name lookup. Automatic reads never
request wallet permission, submit transactions or overwrite unfinished forms.


## Names management and reviews — owner update 2026-10-06

Use the existing RELAY navigation. Show owners their name, expiry and contextual
Edit profile / Renew / Transfer actions; keep a new purchase form out of the normal
owner view. Availability is the first primary action; show registration/payment
only when relevant. Renewal skips availability and commitment. Expired names in
30-day grace expose renewal, not profile editing/transfer. Explain manual expired
name lookup when no local identity hint exists.

Pending transaction recovery is visible immediately after shared-wallet connection,
without a separate Names signing permission. Keep journals scoped and intact.
Load the owner's public profile on entering My profile. Late replies must not
replace edits; Review changes is primary and Preview is secondary. Make explicit
reload's overwrite behavior clear. Validator fields remain an optional disclosure.
Use readable definition rows for reviews, preserving debit, term, destination,
price dates and deadlines; collapse full technical details. Derive tariffs from
verified registry state. Retain shared semantic contrast tokens and stack/wrap
reviews and controls at 320 px; no extra Names navigation or wizard.

## Treasury income and expenses — owner revision 2026-10-06

Use one compact financial statement after Assets, before Treasury events. The
shared rows are Income, Expenses and Operating surplus / deficit, with account
children revealed by accessible disclosure buttons. Account mappings supply
DAO-specific sources; never impose NNS rows on every DAO. Other income is always
the last income row, including in consolidated views. Treasury token quantities
use two decimal places for display; retain USD values and full accounting precision. Right-align monetary
columns, use restrained neutral section surfaces and tabular figures. Keep a
compact partial-coverage label visible; place detailed methodology in a disclosure.
No repeated income tile, unavailable KPI strip or permanent receipt sidebar.

Years start at 2026 and include 2027/2028; future periods are explicitly empty.
NETA NNS rows and amounts link to a separate receipt register with year/month/type
filters, original transaction links and payment-time conversion details. Preserve
filter state on the return link. Match shared graphite/mint tokens and provide a
contained horizontal scroll region on mobile. No balance-derived income, assumed
zero, fabricated comparison or current-price revaluation.


## Accounting categories — owner update 2026-10-06

Treasury event account tags use compact neutral pills with explicit Income/Expense
labels and an Unclassified fallback. Proposal action details use a labelled native
select for each action's planned spending category, with shared expense labels and
an explicit non-expense transfer choice. Read-only proposals disable the selects.
Provisional statement amounts use a text label; zero is shown only for a reviewed
snapshot and must not imply full public-index coverage.


## Compact Treasury header — owner update 2026-10-06

Remove the USD/NETA currency buttons and the hero's “Live assets / Partial
accounting” badge for every DAO. USD remains the accounting unit, labelled in
the statement. Keep snapshot time/source as compact text beneath the hero
description; omit the separate controls row. Preserve the modest Treasury voxel
art on desktop without an empty aside row on mobile. Keep source/coverage states
at the balances and P&L they describe.


## Organizational DAO selector — owner decision 2026-10-06

Use Chain → DAO organization → SubDAO. Default to Consolidated overview; visually
separate it from the native select's DAO units group, with Main first and remaining
units alphabetically. Operations belongs formally to NETA; no on-chain hierarchy
is asserted. Chain denotes the governance home; cross-chain custody stays included.
Use the existing searchable organization picker and a labelled native unit select.
At mobile widths let SubDAO use a full row and let the header scroll with content
to leave usable screen space. Treasury omits the network badge entirely.

Consolidated Treasury shows included unit values/dates and links, custody-preserving
asset positions and expandable P&L unit totals. Missing coverage is explicit at the
value it affects; do not invent zeros. Other sections remain unit-specific, with
Main clearly identified for organization scope. Retain existing DAO contract and
permission identities. No new wallet or transaction flow is introduced.

## Juno reporting units — owner update 2026-10-06

The main unit may have an explicit name: Juno uses **Community Pool** first,
followed by **Delegation Programme**. Keep ordering based on the main unit's ID,
not the literal label Main. Use the shared Treasury assets/P&L layout; label native
positions Available, Delegated, Unbonding and Claimable rewards without merging
availability states. Community Pool income expands into Community Tax and Other
income. Keep historical accrual coverage separate from the observed current rate.

## DAO structure — owner approval 2026-10-06

People opens with DAO structure before Members and Contributors. Use a framed
organizational diagram, node buttons and a consolidated overview button tied to
the shared header selection. Mint plus a Selected label marks the active unit;
when consolidated, mark the frame and no individual node. Reuse the colorful
assembly plaza for Main and the green/orange/stone contributor art for SubDAOs.
Keep branch connectors neutral and allow nested levels and mobile reflow. Show
only configured units and explicit organizational relationships, with a concise
authority note. Existing direct Members/Contributors links remain functional.

## Inbox filters — owner update 2026-10-06

Use All, Messages, Governance and Unread. NNS lifecycle notices belong under
Messages while retaining their system-source label and contextual actions.
Do not add a separate Names filter. Planned shared-mailbox design is documented
in DAO_MAILBOX_DESIGN_2026-10-06.md; it is not an enabled UI capability.

## DAO mailbox component — gated candidate, 2026-10-06

The tested, unmounted DAO inbox component places a native select beside the Inbox
heading, using existing graphite controls and mint states. Omit it unless enabled
mailboxes are authorized for the connected wallet. Keep the DAO browsing selector
independent of mailbox access. On small screens the heading/select may wrap.
Conversations group by account, with chronological entries in the reader and
assignment/blocking in contextual controls. Do not publish fixture inboxes. See
DAO_MAILBOX_IMPLEMENTATION_2026-10-06.md for remaining activation requirements.

## Personal recovery Inbox — gated candidate, 2026-10-06

The unmounted personal component reuses graphite/mint tokens, labelled recovery,
contact and message fields, literal-text history and a focusable inline review.
Keep device/backup and contact-permission controls in native disclosures; retain
visible pending recovery and read-only/backup-pending/error states. Generate and
acknowledge a separately saved recovery code before creating a profile. Never
render the code after successful unlock/create/restore or on wallet invalidation.
Reviews summarize action, network, wallet and recipient; full transaction details
are collapsed. Every chain action needs a distinct review and Keplr confirmation.
Restoring does not enable sending. This component is tested separately and does
not mount itself in production or activate mainnet SEND.


## Personal Inbox workspace host — gated source, 2026-10-06

Use the existing Inbox card and shared wallet header. A reviewed release supplies
an explicit Open personal inbox action; Compose focuses/opens that same section.
Keep backup authorization visible before setup/unlock/restore; device tools stay
in a disclosure. Disconnect or leaving Inbox clears the plaintext section and
requires deliberate reopening. The connected wallet chain must be Juno mainnet.
The private history is currently a separate section, above the DAO/name updates;
their filters and counts do not index it yet. Do not imply unified private unread
counts. The default source pin is null and keeps the disabled preview intact.


## Personal mailbox owner deployment — 2026-10-06

The separate operator page reuses the Names deployment page foundations and
graphite/mint tokens. Keep upload/create reviews distinct; show mainnet, real JUNO
fees, owner upgrade authority and reviewed artifact identity. Retain a visible
pending-transaction recovery section and public receipt export. Disconnect/account
changes clear reviews while preserving journals. This page does not activate
public messaging or create a backup service; no new main navigation item.

## Personal mainnet owner deployment — 2026-10-07

The standalone owner setup page reuses the existing Names deployment foundations
and styles. Keep Juno mainnet, owner upgrade authority, separate upload/create
reviews, real network fees and recovery/export visible. Connecting and reviewing
never sign. Preserve exact-intent journals across account changes and reloads.
Publishing this helper does not activate private Inbox sending or DAO writes.

## Personal Inbox simplification — candidate, 2026-10-07

Use one compact entry card inside the existing Inbox. Detect local/remote state;
show only create, unlock or restore as appropriate. Code-saving confirmation and
wallet reviews remain explicit. Keep maintenance under Device and backup, bound
history height and offer renewal/recovery only when needed. Names resolve to an
address shown in the review; contact invitations never grant permission. Automatic
receive/reconciliation must stop when locked, busy, hidden, disposed or in error.
No passkey unlock or unattended signing is implied by this UI.

## Restricted personal pilot page — 2026-10-07

Use a separate operator URL while the public Inbox release remains null. Reuse the
Community Tools/Faucet header, one wallet connection and the existing personal
Inbox component, with graphite/mint foundations. Show private pilot, Juno mainnet,
explicit fees and sender-only name eligibility. Keep recovery guidance collapsed;
do not add a second wallet selector or an automatic registration flow. Client-side
participant filtering complements the independently enforced server allowlist and
wallet signatures; it is not a substitute for backend authorization. Disconnect,
wallet change and leaving the page clear plaintext while retaining saved journals.

## Compact Juno participation tracker — owner correction, 2026-10-07

Use one compact participation summary and one validator list; keep per-observer
technical details in a closed disclosure. Prioritize validators without an observed
block signature and provide All / Signed / No block signature filters. On narrow
screens, rows reflow into validator/power and status/block-count pairs. Do not repeat
consensus addresses beneath every known name. Show stale/unavailable/disagreeing data
at the summary. Empty live consensus rounds are not validator upgrade-readiness data.

## Community Tools hub — owner decision, 2026-10-07

The shared workspace footer now says **Community Tools ↗** and opens
`/community-tools/`. Use two concise tool cards for Juno Faucet and Validator Upgrade
Status, then an upgrade index and a separate permanent page for each upgrade.
Use the existing graphite/mint foundations and breadcrumbs. Existing faucet and
tracker URLs redirect to their corresponding tools on the same origin; keep all
wallet and transaction storage keys unchanged. The validator table includes first
signature delay after the halt and block offset after restart; avoid treating this
as actual software readiness or using insulting/performance rankings.

## Community Tools header and responsiveness — owner correction, 2026-10-07

All Community Tools pages reuse the Faucet header, assembly-plaza promotion and
responsive grid via `community-tools-header.css`. Wallet controls remain on the
Faucet; read-only upgrade pages show Juno mainnet, and the hub shows Juno Community.
Use First consensus vote as the default delay measure, not the first commit.
Keep partial historical coverage explicit, unknown values unranked, nil votes
separate from block agreement, and current signing distinct from responsiveness.
The chronological power buildup belongs in a compact closed disclosure; measure
and sort controls stay conventional native selects. Preserve the optional first
block-signature view as separate evidence, never a readiness substitute.

## Restricted personal pilot page — 2026-10-07

Use a separate operator URL while the public Inbox release remains null. Reuse the
Community Tools/Faucet header, one wallet connection and the existing personal
Inbox component, with graphite/mint foundations. Show private pilot, Juno mainnet,
explicit fees and sender-only name eligibility. Keep recovery guidance collapsed;
do not add a second wallet selector or an automatic registration flow. Client-side
participant filtering complements the independently enforced server allowlist and
wallet signatures; it is not a substitute for backend authorization. Disconnect,
wallet change and leaving the page clear plaintext while retaining saved journals.
