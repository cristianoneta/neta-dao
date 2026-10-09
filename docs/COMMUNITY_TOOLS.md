# Community Tools project menu and WYND swap

9 October 2026 — reviewed implementation candidate; not yet published.

The owner requested Juno and NETA project sections, with future projects supported
by the same navigation. The existing Faucet and Validator Upgrade Status retain
their URLs and appear under Juno. `/community-tools/neta/buy/` adds **Buy NETA on
WYND** using the current shared header, theme, project breadcrumbs and a native
review dialog.

## Source and transaction behavior

The swap controller, REST query client, transaction fee helper and token icons are
adapted from `cristianoneta/neta-website` commit
`7ad0bbf7215e087e639965ae65ebecc0c77d2945`, specifically Rescue NETA. The old page
layout, animated background and site-wide wallet controller are not imported.

The existing WYND pair, pair code 2289, JUNO/NETA assets and 0.30% pool fee are
checked before quoting and again before signing. Both JUNO offers and CW20 NETA
offers are supported. The existing $25 estimated swap cap, adjustable slippage,
gas cap and shared persistent transaction journal are retained. No contract is
deployed. USD pricing reads the existing Juno delegation holdings snapshot; stale,
invalid or unavailable pricing prevents signing. This adds no scheduled collector.

The signing bridge uses the repository's pinned CosmJS dependencies and checks
the Juno chain, selected wallet, signed execute message, memo and explicit fee.
Wallet changes or a fresh quote below the reviewed minimum stop the action.
The belief price includes commission because WYND checks spread against the
pre-fee return; the review continues to display the net minimum. Unknown broadcast
results retain the journal and block another signature. A
successful receipt must include the expected receiving-asset event and amount.
Mainnet messaging gates are unchanged. No real purchase is part of automated QA.

## Validation and release boundary

- `node --test faucet/test/wynd-swap.test.mjs faucet/test/journal.test.mjs` passes:
  exact signing/fee, altered payload/fee, changed account/wrong chain, gas limits
  and persistent unknown-outcome handling.
- Build with `node scripts/build-signing.mjs swap`; CI verifies the checked-in
  bundle. No dependency or lockfile change is required.
- `node spikes/relay-corecrypto/browser-community-tools.mjs` supplies synthetic
  read-only network fixtures and synthetic wallet results. It covers project
  filtering/deep links, 1440/768/390/320 layouts, review/keyboard dismissal,
  native/CW20 payloads, quote movement, rejection and stale/invalid pool sources.
- CI browser execution and screenshot review cover the hub, purchase page and
  existing Juno pages at desktop and mobile sizes. The first run exposed an
  asynchronous navigation assertion and a genuine partial-verification race.
  Price and pool reads now publish success together; stale pricing cannot be
  overwritten by a later pool response. Final purchase/hub screenshots from run
  37885814168 were inspected, as were the unchanged Juno pages' regression
  screenshots. Local Chromium installation is unavailable in this environment.
- Browser and visual review are complete. Read-only checks verified current
  pair/code/fee/token identity and Juno RPC availability. Required CI remains the
  integration gate; use the deliberate Cloudflare release workflow and inspect
  both live domains afterward. A merged PR is not a production deployment.

WYND spread reference: `wynddao/wynddex`, `contracts/pair/src/contract.rs` and
`packages/wyndex/src/pair/utils.rs` (`assert_max_spread`). This source comparison does
not substitute for the configured on-chain pair/code/fee checks.

## Delegation Programme addition — 9 October 2026

The Juno project section now includes `/community-tools/juno/delegation/`, using
the same header, design tokens and card language. This is a planning build with
real snapshot inputs, current/target comparison and rule-proposal draft downloads.
Execution remains unavailable pending verified governance integration. See
[the implementation and rollout boundary](JUNO_DELEGATION_PROGRAMME.md).
