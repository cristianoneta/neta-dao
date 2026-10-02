# RELAY UNI-7 two-wallet E2E runbook

Created 2026-10-02. **Status: live E2E not recorded.** Existing exchange/reply/
reload browser evidence mocks Keplr and UNI-7. This runbook uses the shipped
lab and does not enable the main composer or mainnet.

## Before the test

Read [CURRENT_STATE.md](CURRENT_STATE.md) and [RELAY_IMPLEMENTATION_PLAN.md](RELAY_IMPLEMENTATION_PLAN.md).
Use two independent browser profiles with two Keplr wallets, A and B, funded
with JUNOX for registration and send gas. Use non-sensitive test messages.
Open <https://dao.netareborn.com/relay-uni7-lab.html> in both profiles.
Use the readiness diagnostic to inspect public existing device state if needed.
Do not request seeds, copy private keys or clear extension storage.

The recorded mailbox address/hash are in CURRENT_STATE and
`relay-uni7-client.mjs`. The lab checks UNI-7 network, contract creator/label/code
hash and active wallet. If identity or availability checks fail, stop and
inspect the exact error. Suggest-chain endpoint caching may need Keplr cache
refresh as described in [../UNI7_DEPLOYMENT_RUNBOOK.md](../UNI7_DEPLOYMENT_RUNBOOK.md).

## Procedure

1. In A, connect Keplr on UNI-7. If local device already exists, unlock it with
   its saved local code. Otherwise create one and securely retain the displayed
   code before continuing. Repeat for B.
2. Register each prepared device with its explicit Keplr transaction. Query
   confirmation must match device/fingerprint/generation. The adapter supports
   first registration only; existing on-chain registration requires the matching
   local device or a separately reviewed rotation workflow. Do not blindly recreate it.
3. A sends a short test to B's Juno address using TEST ENCRYPTED SEND. Record
   confirmed message ID/sequence and public transaction evidence.
4. B selects CHECK & DECRYPT INBOX. Confirm A's message renders, then reply to A.
   A checks/decrypts and confirms the reply. Respect the 10-second sender cooldown.
5. Reload B, reconnect the same wallet and unlock the existing device with its
   local code. Confirm already-read history returns from the encrypted archive.
6. A sends another test after B's reload; B checks/decrypts it. Repeat reload/
   unlock for A and verify its history. This tests intact local storage only.

A CHECK reads at most 50 entries; another check can advance. No automatic backup,
new-device restore, rotation or main app inbox integration is covered here.

## Failure handling

Do not repeat a registration/send solely because broadcast or indexing timed
out. Inspect chain `device` / `sent` / `inbox` state and saved intent first.
Current lab blocks unresolved intents and has no full repair UI. Record the
failure and fix/review the recovery path; do not manually delete intent/ratchet/
archive state to make the test appear green. Do not regenerate ciphertext for
an existing message ID. A sender-generation change must fail closed.

## Evidence record to add after a real test

Record date/time, code commit and deployed asset version; public A/B addresses;
mailbox code/creator/label/hash verification; registration generations and TX
hashes or state-based confirmation; message IDs/sequences/heights and TX hashes
when available; send/receive/reply/reload results; actual gas/fees; any failures.
Never record message plaintext, local unlock/recovery codes, DB keys or backups.
If a hash is unavailable because indexing is disabled, say so and retain the
exact post-state proof. Keep simulated and live evidence in separate entries.

Passing this test supplies live UNI-7 evidence only. Automatic remote recovery,
production integration and mainnet release gates remain open.
