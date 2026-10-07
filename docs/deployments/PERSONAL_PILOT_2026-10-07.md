# Restricted personal Inbox pilot — 7 October 2026

Pilot URL: https://dao.netareborn.com/relay-personal-pilot.html

This is the explicitly authorized private mainnet test for the owner and the
Faucet wallet. Both wallets are admitted to their own encrypted backup on the
existing Render service. Wallet signatures, exact origin/chain/contract binding,
per-wallet isolation and the existing storage/rate limits still apply. The public
Inbox deployment/release pins remain null and DAO writes remain disabled.
PR #195 remains draft; this publication does not merge the full candidate.

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

## User's first real test

1. Open the pilot page in a Keplr browser and select the Faucet wallet
   `juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt` on Juno mainnet.
   Connect, then **Continue with wallet**. The backup-access signature has no
   network fee; it grants this wallet access to its own encrypted backup.
2. Save the generated messaging recovery code privately. It is not a wallet seed.
   Do not share it in chat, logs or screenshots. Choose **Create inbox**, inspect
   the registration review, and confirm the transaction in Keplr if correct.
   Keplr displays the real JUNO network fee.
3. After confirmed registration, set the owner address as the contact and choose
   **Contact permissions → Allow messages**. Review and confirm in Keplr.
4. In the owner's wallet/browser, create or unlock its own inbox with its own
   recovery code. Send one short test message to the Faucet address, which must
   have allowed the owner first. Sending requires an active owned .neta name;
   the unnamed receiving wallet needs none.
5. On the recipient, check and read the message, reload/unlock, then retain the
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
Real backup authentication/write/read, restart persistence of stored encrypted
blobs, off-service snapshot/restore, hosted revision/quota behavior, and the real
send/read/reload/new-browser restore/device-rotation lifecycle remain unproven.
No real wallet signature or mainnet transaction was made by the assistant.
The temporary admission list is a private-pilot restriction; the intended public
registration model is wallet self-service with signatures and quotas.
