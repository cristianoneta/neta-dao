# NNS purchase flow and lifecycle notifications

Continuation of the interrupted 2026-10-05 session. Existing uncommitted work
was copied into an isolated branch; the prior worktree and all generated data,
contracts, keys and transaction journals were preserved.

## Changes

- Check availability includes registry verification, without a wallet prompt.
- Start registration combines local secret preparation and the first review.
  Existing preparations resume without replacing secrets. The commitment lasts
  one hour and is not exclusive. The matching chain deadline is checked and shown.
- Buy name and Buy and confirm in Keplr explicitly identify payment. Renewal has
  corresponding labels. The two transaction confirmations remain separate.
- Inbox welcomes first-time name owners with capabilities, expiry, profile and
  management links. Renewal has its own confirmation with previous/new expiry.
  Transfers have distinct sent/received notices; an offer alone is not a transfer.
- Reminders: 6/3/1 calendar months, 14/7/1 days, expiry, and 30-day grace end.
  Latest-stage catch-up avoids flooding the inbox after an absence. All applicable
  notices link to the correct renewal menu, and profile links retain name/network.
- Notifications are scoped to wallet, registry and chain. Old ownership receives
  no further reminders. Re-registration is distinguished from transfer. Old terms
  are marked superseded after renewal. Expiry uses fresh verified block time.
- Governance polling stops in hidden tabs, respects the interval on focus and
  aborts timed-out requests. Name notice checks use a 15-minute visible interval
  plus wallet/action refreshes. No new scheduled collector is introduced.

## Limits

Notices are local system messages based on verified public chain observations.
They are not sent on-chain, by email or by push; private mainnet messaging stays
disabled. History/read state stay in this browser. First discovery of an existing
active name can generate the welcome/received notice. Exact transaction-time
delivery and cross-device message history are not claimed. Missed intermediate
renewals/transfers cannot be reconstructed from latest state alone. Fresh browsers
cannot discover expired names unless notification history or a completed journal
retains the name. No real mainnet payment or transfer was performed in this change.

## Verification

- Node frontend, lifecycle and pricing suites: 135 passed, zero failed.
- Mocked browser workflows: mainnet and UNI-7 purchase, renewal, public contacts,
  transfer, stale reviews, pending journal/reload/recovery and wallet isolation.
- Owner availability browser flow: missing price, stale config, opening/pausing,
  exact lost-response recovery, owner gating and responsive layout.
- Name tests cover calendar month ends, grace boundaries, renewal rescheduling,
  old-owner reminders, transfer-specific notices, re-registration, unavailable
  providers, unread state, action links and no implicit signing.
- Responsive checks at 1440/768/390/320 px; desktop and mobile purchase/inbox
  screenshots inspected. Mobile filters wrap and action links retain touch targets.

## Publication

Pending branch/PR integration and served-asset verification. GitHub runner
assignment was disrupted when this work began. Local test success is not evidence
of a completed hosted deployment.
