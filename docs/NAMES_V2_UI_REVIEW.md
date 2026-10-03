> Historical prototype review. The preview was superseded by main-page integration
> in #114, flat RELAY navigation in #115 and the shared shell in #116. Read
> [NAMES_MAIN_PAGE_INTEGRATION.md](NAMES_MAIN_PAGE_INTEGRATION.md) for current behavior.

# Names v2 UI review — 2026-10-03

The owner reported black headings/names in the embedded dark preview and requested
a complete layout review followed by publication on the existing website.

## Findings and changes

- The preview set the root foreground but not headings/strong text. Host element
  rules could override that inheritance. The revised page explicitly sets these
  foregrounds and uses `neta-ui.css` for all theme colors.
- The previous three-level navigation plus large marketing heading and unsolicited
  DAO detail competed with search. The new compact working header leads to search,
  then directory results. Profiles open only after selection, with an explicit
  return to the directory or contacts. Search terms survive profile navigation.
- Contacts start empty, with a useful next action; add/remove is available. Demo
  storage lasts only for the page session and is stated clearly.
- Profile ownership, receiving network and DAO provenance are distinct. DAO and
  individual profiles both expose a disabled-payment route preview. DAO changes
  create a local before/after proposal without changing the public profile.
- Normal text uses explicit light foregrounds, secondary text is at least 12 px,
  fields are 16 px or larger, main touch targets are at least 44 px, native focus
  remains visible, and forms associate errors with their inputs.
- A banner identifies the simulation, the quote says it is not a market price,
  and no fake wallet connection or membership verification is implied. Demo
  notifications are separate from the actual RELAY inbox.
- The production Names page links to the preview and replaces outdated initial
  5-NETA copy with the planned USD 5/160/640 tariff. Existing DOM hooks, v1 source
  and `REGISTRY=null` remain intact. Mainnet messaging remains disabled.

## References checked

- [ENS app](https://app.ens.domains/): prominent name search.
- [ENS ownership flow](https://support.ens.domains/en/articles/8626471-transfer-your-ens-name):
  ownership actions belong to the selected name, with review before transfer.
- [SPACE ID discovery](https://docs.space.id/domain-and-payment-id/domain-tutorials/discover):
  search and results as the entry point.
- [SPACE ID registration](https://docs.space.id/domain-and-payment-id/domain-tutorials/register):
  explicit duration, quote and request/registration steps.
- [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html):
  normal text at least 4.5:1, large text at least 3:1.

These are interaction references, not a claim of identical capabilities or a new
brand direction. The approved graphite/mint workspace design remains authoritative.

## Validation and publication

- JavaScript syntax and local DOM smoke checks passed: search/empty state, contact
  add/remove, invalid and demo-taken names, fee tiers, registration, renewal,
  notifications, transfer request, route preview and DAO draft isolation.
- Separate CSS and JS are same-origin assets; CSP disallows network connections.
  The preview never calls wallets, broadcasts, or writes browser persistence.
- `design/names-v2-review.html` provides 320/390/768/1440 px frames for visual QA.
- PR #112 final head `9bb5c10dbcc7694e80a5f1417c35d6680f56da3d` passed
  Contract/frontend run 158 (`37137001003`) and RELAY browser run 47
  (`37137000988`). The old text assertion was updated to the agreed planned
  tariff; all registry activation and payment-identity guards remain asserted.
- Merged as `5c9a7a85552710b1280a6be09cfa3a23082e0663`. Pages build/deploy
  `37137364945` succeeded. The public Names route visibly links to the preview.
- Public index.html, names.css and the three preview HTML/CSS/JS files matched
  the local published source byte-for-byte by SHA-256 on 2026-10-03.
- Supported cloud-browser inspection confirmed readable light headings and names.
  DAO heading computed foreground is rgb(242,244,247). Palette contrast: primary
  text on page 17.01:1; secondary text on raised surface 6.57:1; mint button text
  12.30:1; warning text 8.49:1. These are targeted checks, not a whole-page audit.
- Checked fixed 320/390/768/1440 px frames: document scrollWidth equaled clientWidth
  at 303/373/751/1438 px respectively (frame borders/scrollbars reduce CSS content
  width). Inspected directory, mobile DAO profile, tablet edit form and desktop
  proposal comparison. No document-level horizontal overflow in those views.
- Browser interactions: DAO profile selection/back navigation; invalid two-letter
  name blocked; demo quote, reservation, registration and RELAY confirmation;
  DAO profile change produces the before/after local draft. Keyboard Tab reached
  Save preview with the blue solid focus outline.
- Native 200% browser zoom could not be confirmed through the browser shortcuts;
  do not claim it passed. Complete assistive-technology/all-state accessibility
  review remains future work. No live wallet/contract flow was exercised.

Published preview: https://dao.netareborn.com/docs/design/names-v2-prototype.html

The preview is available from RELAY → Names & Contacts → Explore the preview.
It remains a simulation. Registration, quote service, profile contracts and system
notification delivery are not activated by this publication.

