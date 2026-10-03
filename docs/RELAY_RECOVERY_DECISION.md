# RELAY recovery decision · 2026-09-27

Status: agreed product direction, **not implemented**. The user requested a simple UX with automatic encrypted backups instead of recurring manual file exports. The main Inbox UX annotations were implemented by 27 September; current code-backed state is in `CURRENT_STATE.md`.

## User flow

1. At first device setup, connect Keplr, register a separate messaging device on UNI-7 through an explicit wallet transaction, and save a generated high-entropy recovery code.
2. The browser keeps the current ratchet/device state and a separately encrypted local archive of already-readable sent and received messages. It automatically uploads only a client-side-encrypted, wallet-bound backup bundle to an off-chain store. The UI shows the last confirmed successful backup. Storage provider, authentication, retention and synchronization protocol are **undecided**.
3. On a new browser/device, connect the same wallet and enter the code. Restore readable history; reconcile chain inbox, outbox and device generations. A stale or uncertain restore is read/receive-only until safe reconciliation or a new wallet-authorized device registration and session. Never promise recovery of messages after the last confirmed backup.

Keplr proves address ownership. Its private key does not reconstruct the distinct messaging keys or already-read text. Used ratchet message keys remain discarded; do not preserve them for history replay. Chain ciphertext by itself cannot restore a read conversation. A wallet signature alone must not silently unlock every old message.

## Security and implementation gates

- Never upload plaintext, recovery code or unwrapped keys; never put them on-chain. Backup + code in an attacker's possession exposes the included old readable history even though used ratchet keys were deleted. Explain this tradeoff plainly.
- Specify authenticated backup versioning, anti-rollback, atomic/quiescent snapshots of ratchet state + archive + outbox + cursors, failed-backup visibility, wallet binding, lost-code behavior, concurrent tabs/devices and crash recovery. A stale backup cannot safely resume sending by default.
- The existing isolated CoreCrypto backup test restored a still-unread prekey message only. It is not proof of already-read history recovery or a production backup. Test already-read history, newer inbound messages, wrong wallet/code, corruption, stale backup, registration rotation and tab conflicts.
- The read-only `relay-uni7-readiness.html` page is deployed and verified the UNI-7 mailbox identity and public device/inbox query. PR #89 merged with green CI and Pages. It did not register, decrypt or send. Two real Keplr wallets have not completed encrypted send, receive and restart on UNI-7.
- Keep the main RELAY `SEND MESSAGE` action and all mainnet DMs disabled until testnet E2E and recovery gates pass. Mainnet needs a separate policy and audit.

The later PR #97 lab includes an encrypted local readable-history archive and a mocked two-profile exchange/reply/reload test. It does not provide automatic off-device backup. Its code is a local unlock code, not recovery after browser-data loss.

Current continuation (2026-10-03): local interrupted-receive recovery is implemented, but automatic off-device backup is not. Follow `PROJECT_CHECKPOINT.md` and `HANDOFF.md`: finish isolated consent/generation and coherent restore testing first. No real wallet keys or live attack transactions are permitted in the current task. The live two-wallet runbook is a later, separately authorized evidence gate.
