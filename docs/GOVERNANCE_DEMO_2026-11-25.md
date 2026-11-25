# Governance directory and proposal reader

Owner direction, 25 November 2026. The unlinked `/demo/` entry now opens a
grayscale directory for AtomOne, Gno.land and GnoSwap. All three are selectable:
GnoSwap has deployed protocol governance, distinct from Gno.land's GovDAO.
Existing `/demo/#/proposals`, `/demo/#/people` and `/demo/#/treasury` links retain
the earlier explicitly simulated concept and its browser-local drafts.

## Public sources and meaning

| Workspace | Mainnet source                                                                    | Decision model                                                            |
| --------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| AtomOne   | `atomone-1`, `/atomone/gov/v1/proposals` at All in Bits, with PublicNode fallback | Native chain governance, staked ATONE; preserve the source's vote options |
| Gno.land  | `gnoland-1`, `gno.land/r/gov/dao` through the official RPC                        | GovDAO member tiers; do not present it as GNOT token voting               |
| GnoSwap   | `gnoland-1`, `gno.land/r/gnoswap/gov/governance` through the official RPC         | Delegated xGNS, Yes/No; Passed and Executed remain separate               |

The reader checks the expected chain identity and a recent node tip before
accepting proposal data. AtomOne follows pagination cursors; GovDAO follows its
rendered page count and includes proposal zero; GnoSwap reads the deployed
proposal counter and fixed scalar fields. Pagination is bounded and a reached
limit is disclosed as partial coverage. Errors, unknown states and unavailable
tallies are not converted to empty history or zero votes. Integer vote weights
are retained without floating-point conversion.

Initial read-only observations on 25 November returned 21 retained AtomOne
proposals, 21 GovDAO proposals and two GnoSwap proposals. These are observations,
not fixed counts or claims that nodes retain every historical proposal. In
particular, AtomOne's highest observed ID was 22 despite 21 returned records.

Visible pages refresh every 60 seconds and on returning to the tab; a manual
Refresh action is also available. New proposals are discovered from the source
on each refresh. A failed refresh keeps the previous successful view with its
timestamp and an explicit error. This is a live reader, not a durable Cosmoot
archive or a background collector. Reads are not pinned to one common block;
the displayed node tip identifies source health, not the height of every value.

## Read-only boundary

The existing `/data/*` Pages Worker dispatches the exact
`/data/demo-governance` path to a bounded GET-only adapter. Its vocabulary fixes
the allowed public hosts, paths, realm names and Gno expressions. User parameters
cannot select a URL or expression; unexpected or duplicate parameters, redirects,
oversized responses and invalid JSON fail closed. The adapter forwards no user
authorization or cookies and does not propagate upstream cookies.

There is no wallet connection, voting, proposal submission, name registration or
social-provider confirmation in the real proposal reader. The separate People,
Treasury and discussion concept remains a labelled simulation. Its self-entered
social handles are not proof of account ownership. Untrusted proposal content is
escaped and rendered through a small Markdown subset without embedded HTML or
media. No production navigation link or sitemap entry is added; noindex does not
make a public URL private.

## Verification and release

Tests cover observed source formats, exact integer weights, native vote options,
cursor loops, pagination, wrong/stale chains, malformed data, fixed query limits,
response bounds and hostile proposal markup. The compiled Worker regression
checks this route and its credential boundary alongside the existing snapshot
routes. Desktop and narrow layouts were checked with real source responses.

The previous Gno concept was observed live at `/demo/#/proposals` on 25 November.
This directory and reader remain a release candidate until the deliberately
triggered Cloudflare workflow publishes the checked main commit. Source merge,
local preview and successful CI alone do not prove publication. No production
collector installation or host data change is required for this reader.

References: [GovDAO](https://gno.land/r/gov/dao),
[GnoSwap governance](https://docs.gnoswap.io/core-concepts/governance),
[deployed GnoSwap realm](https://gno.land/r/gnoswap/gov/governance/),
[AtomOne proposals](https://explorer.allinbits.com/atomone/gov).
