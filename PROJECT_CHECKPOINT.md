# NETA DAO Workspace checkpoint

Updated: **2026-10-02**. This file is a continuation index, not a second feature
specification. [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) owns the reviewed
state; [HANDOFF.md](HANDOFF.md) owns the reading order and working rules.
Historical snapshots remain in Git history.

## Last completed implementation

- PR #97: isolated GPL CoreCrypto UNI-7 lab, wallet-bound device registration,
  encrypted send/receive, local readable-history archive and restart unlock.
- Its integrated browser test uses two profiles with mocked Keplr/chain services.
  It is not a live UNI-7 exchange.
- PR #98: retries for Treasury event-index collection and GitHub snapshot pushes.
- RELAY's main navigation now contains Inbox, Following and Names & Contacts;
  Favorites are in Following, with no Inbox sidebar. Main SEND remains disabled.

## Next work, in order

1. Follow [docs/RELAY_UNI7_E2E_RUNBOOK.md](docs/RELAY_UNI7_E2E_RUNBOOK.md) with
   two real Keplr wallets; record public transaction/message and restart evidence.
   The test-only UI already exists. Investigate actual network/wallet failures
   before adding another client or redeploying the mailbox.
2. Address historical sender registration/rotation, depleted prekeys and safe
   reconciliation of uncertain registration/outbox/inbound state.
3. Specify provider/auth/sync/versioning and implement the agreed automatic
   encrypted backup of current state plus readable archive. Local unlock is not backup.
4. Test stale restore, wrong wallet/code, corruption, crash and concurrent device/tab
   behavior. Main composer activation requires its own integration/recovery review.
5. Continue Treasury accounting and proposal-linked delivery only after their data
   model is defined; keep concepts visibly separate from authoritative records.

## Gates still open

- Real two-wallet encrypted UNI-7 E2E and measured gas/storage.
- Automatic off-device backup and safe stale restore.
- Production client/distribution review and independent security audit.
- New mainnet mailbox implementation with at least 5 active NETA and reviewed policy.
- Native Juno mainnet deposit/submission/voting adapters.
- Names registry deployment and explicit UNI-7 Names test wiring.
- Treasury execution, milestone acceptance/payment and authoritative contributor records.

## Documentation correction checkpoint

The 2026-10-02 review reconciled README, Handoff, checkpoint and specialized docs
with source. It explicitly distinguishes Operations legacy finalization (UNI-7
status only) from mainnet voting, mainnet notifications from absent review feeds,
mocked lab from live E2E, local archive from remote recovery, and Treasury snapshot
attribution from complete accounting. No application code or contract was changed.
