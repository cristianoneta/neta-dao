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

Canonical release: [PR #169](https://github.com/cristianoneta/neta-dao/pull/169),
`feat/nns-flow-inbox-20261005`. Earlier PR #168's implementation was compared file
by file; its incident document and governance-specific error wording are retained.
The continuation adds the owner's specific transfer/renewal notices and polling
improvements. #168 is superseded and must not be merged independently.

The first remote commit is `3233326d2112d80841ffbc00d56fac0b27ec3fc9`; its tree
`340014b811cb9727b9eb82e90524f34c3ec20190` exactly matched the local tested tree.
A follow-up checkpoint consolidates both histories and records the next steps.
The initial PR checks were all queued: RELAY 37367523820, contract/frontend
37367523919, pricing 37367523764, faucet 37367523813. Check the current PR head
rather than assuming these run IDs cover later commits.

**Published and verified on 2026-10-06.** PR #169 merged at
`2e0ef62243513383362eb664bf9e56df2c559203`, preserving newer generated snapshots.
All four PR checks passed at `dce666dce47f866883ef08c150a880c65106bab9`:
pricing `37417458664`, faucet `37417458674`, contract/frontend `37417458680`,
RELAY browser `37417458715`. On main, pricing `37417655034`, faucet `37417655021`
and contract/frontend `37417655089` passed; RELAY's workflow is PR-triggered.
Pages `37417654224` succeeded. At 05:17:45 UTC all six changed public UI files
matched the merged source byte-for-byte; [hash evidence](deployments/nns-ui-release-2026-10-06.json).
The served NNS price passed Ed25519 validation (observed 04:48:22 UTC, valid for 24h).

On the first resumed attempt, browser-workspace-security still asserted the old
Read registry copy and removed nns-prepare control. Corrected it and the related
mainnet setup fixture to the combined availability/registration flow. The setup
fixture now exercises failed availability reads and confirms reserve/payment/sign
controls remain blocked. Both affected suites passed locally, followed by all
hosted suites. No mainnet payment, transfer or administration transaction was sent.

Scheduled Treasury/member/main-DAO updates recovered overnight; no old data job
was replayed. Main-DAO history remains unavailable and NNS revenue accounting is
still unconnected. The Treasury P&L artifact is a saved design, not live accounting.
