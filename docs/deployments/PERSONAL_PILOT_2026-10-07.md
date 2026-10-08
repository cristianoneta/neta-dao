# Restricted personal Inbox pilot — 7 October 2026

Pilot URL: https://dao.netareborn.com/relay-personal-pilot.html

This is the explicitly authorized private mainnet test for the owner and the
Faucet wallet. Both wallets are admitted to their own encrypted backup on the
existing Render service. Wallet signatures, exact origin/chain/contract binding,
per-wallet isolation and the existing storage/rate limits still apply. The public
Inbox deployment/release pins remain null and DAO writes remain disabled.
PR #195 is now integrated through remediation PR #224. Public activation is unchanged.

## Source and reproducible artifacts

The [artifact manifest](personal-pilot-artifacts-2026-10-07.json) identifies the
exact public source commit, candidate browser workflow and all seven published
artifact hashes. It also pins the two existing crypto assets reused by the page.
Full maintainable source is at that commit in the same public repository.
To reproduce, use a separate checkout of the manifest's `sourceCommit`:

```sh
npm ci --prefix faucet --ignore-scripts
node scripts/build-personal-pilot.mjs --check
node --test tests/relay-personal-pilot.test.mjs
```

The compiled runtime includes its candidate dependency closure. Its dedicated
signing bundle is a byte-identical copy of the source commit's reviewed bundle.
The shared public signing bundle, workspace entry point and public release flags
are not overwritten. The iframe reuses the existing corecrypto WASM assets. The
bundle retains the root runtime path. To change the pilot, update and verify the
source candidate, then publish new exact artifacts and their manifest together.

Candidate browser checks cover the actual compiled page loading without a wallet,
both admitted wallets, rejected third wallets, explicit backup authorization,
wallet-change/disconnect invalidation, stale connection cleanup, preserved local
journals and desktop/tablet/mobile layouts. Wallet/network actions in these checks
are simulated; they are not real mainnet pilot evidence.

## Real send/read/reload checkpoint — 7 October 2026, 14:17 Berlin

- At 12:05 UTC, STAVR returned active generation-1 devices for both pilot wallets.
- At 12:08 UTC, the Faucet recipient's consent for the owner returned [1,1].
- At 14:11 Berlin, the user supplied UI text showing a decrypted incoming message
  from the owner and an acknowledged encrypted backup. At 14:13 the user confirmed
  the message remained readable after reloading and reopening the recipient inbox.
- At 14:17, the user explicitly deferred further fresh-browser testing. The
  preceding attempted browser change was not established as a genuinely separate
  profile and did not establish read-only restore or rotation. Do not mark it passed
  or repeatedly ask the user to perform it now.

The basic mainnet send/receive/local-reopen test is successful based on the user's
visible result and confirmation. Public contract device/consent observations came
from one provider. Exact message transaction receipts and independent hosted
durability evidence were not collected. No private message body, recovery code,
wallet secret or authenticated backup bundle is included in this public record.
The deferred check does not change the two-wallet service admission or public
release flags. Proceed with DAO recovery implementation; retain these follow-ups.

## First real registration — 7 October 2026, 14:00 Berlin

The user's screenshot shows **Inbox ready · encrypted backup confirmed**.
A read-only STAVR contract query at 12:00 UTC returned the Faucet wallet's device
at generation 1; the owner wallet's device query returned null. This confirms
Faucet registration through one provider. The screenshot is client acknowledgement
of encrypted backup; it is not an independent durability/restart/restore test.
No secret recovery code was present in the screenshot.

Historical next step (completed by the later checkpoint above): register the owner's inbox, then let the Faucet recipient allow that
registered owner, then send the first owner-to-Faucet message. Do not ask the
Faucet wallet to register again. Existing encrypted state must be unlocked.

## User's first real test

1. Open the pilot page in a Keplr browser and select the Faucet wallet
   `juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt` on Juno mainnet.
   Connect, then **Continue with wallet**. The backup-access signature has no
   network fee; it grants this wallet access to its own encrypted backup.
2. Save the generated messaging recovery code privately. It is not a wallet seed.
   Do not share it in chat, logs or screenshots. Choose **Create inbox**, inspect
   the registration review, and confirm the transaction in Keplr if correct.
   Keplr displays the real JUNO network fee.
3. Switch to the owner's wallet and create/register its own inbox with its own
   separately saved recovery code. Both participants must have an active registered
   device before consent: permission is bound to both device generations.
4. Switch back to the Faucet wallet and unlock its existing inbox using its own
   recovery code. Set the owner address as the contact and choose
   **Contact permissions → Allow messages**. Review and confirm in Keplr.
5. Switch to the owner, unlock its existing inbox and send one short test message
   to the Faucet address. Sending requires an active owned .neta name;
   the unnamed receiving wallet needs none.
6. On the recipient, check and read the message, reload/unlock, then retain the
   same message after another read. Save only public transaction receipts and
   non-secret success/error observations.

Do not delete site data or repeat an uncertain broadcast. Use **Check pending
actions** to reconcile saved attempts. A fresh-browser restore and explicitly
reviewed device rotation are later pilot steps, after the first message works.
Never obtain the Faucet mnemonic through service environment variables. If its
wallet is not already in the user's own Keplr, the user must arrange wallet access.

## Remaining evidence

The two-wallet service admission and unauthenticated transport checks passed;
see [the hosted service record](RELAY_SHARED_RENDER_2026-10-07.md).
Both devices and recipient consent are observed on-chain. The user confirmed
successful send/read/reload and the client acknowledged encrypted backup.
Independent hosted authenticated write/read evidence, restart persistence of
stored encrypted blobs, off-service snapshot/restore and hosted revision/quota
behavior remain open. Fresh-browser read-only restore and device rotation are
explicitly deferred by the owner. A reply test is also outstanding; the receiving
Faucet wallet has no verified active sender name. Do not represent these remaining
items as completed or require another immediate browser test.
No real wallet signature or mainnet transaction was made by the assistant.
The temporary admission list is a private-pilot restriction; the intended public
registration model is wallet self-service with signatures and quotas.
