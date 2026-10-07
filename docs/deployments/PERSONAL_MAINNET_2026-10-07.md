# Personal mailbox v0.4 — verified Juno mainnet deployment

The owner completed both Keplr transactions on 7 October 2026 and supplied the
public receipt export. This is a real deployed contract, not public messaging
activation or evidence of a deployed backup service.

| Field | Verified value |
| --- | --- |
| Chain | `juno-1` |
| Code ID | `5170` |
| Contract | `juno1dvmms7su8zfqu4gxxmrkqhzpxr5v3sh8hzfxe8ypsgfegc22lggq5jfjx6` |
| Creator and upgrade administrator | `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57` |
| Label | `NETA RELAY personal v0.4 · Juno mainnet` |
| Uncompressed WASM SHA-256 | `835323a60b0d418d0ef88e1fe12c02f8d65cc5c84fcf593135fdb18977f86708` |
| Registry | `juno1pc8wrq89ljuhu2qt6rtk5lkkrptxajtf3un5llu8prg7r4z50vlszfhhza` |
| DAO writes | `false` |

| Action | Transaction | Height | UTC time | Fee |
| --- | --- | ---: | --- | ---: |
| Store code | `9282A17189A199D7EAC4F07F99D00B3654287D83F361A932E84842A6ABB59385` | 42,454,656 | 10:35:54 | 0.393283 JUNO |
| Instantiate | `198BFC83E6056EB285ECE3F9C5B19C3B54F68A91468592F1A32BBC65C488ECC9` | 42,454,685 | 10:37:23 | 0.026583 JUNO |

Both transactions returned code 0. Their total transaction fee was **0.419866
JUNO**. Instantiation used `{"mainnet":true}` and no attached contract funds.
The reviewed contract requires an active owned `.neta` name only for sending;
receiving/reading one's own messages does not require a name.

## Evidence and independent checks

- [Unmodified owner export](personal-mainnet-deployment-receipts-2026-10-07.json).
  File SHA-256: `7062e398fbd76022819db88053e6a55114389ea5c67e3fcf07cf13a6199b2a2f`.
- [Independent verification](personal-mainnet-verification-2026-10-07.json).
- Both configured REST providers, PolkaChu and STAVR, showed fresh `juno-1`
  height 42,454,775 at the initial verification observation around 10:42 UTC.
  Their downloaded code bytes hash to the reviewed artifact. Creator, code ID,
  label, administrator and smart-query policy match the exact intended values.
- Both providers supplied each successful receipt and the containing block.
  SHA-256 of the raw transaction bytes matched the supplied transaction hash.
  The existing `matchTransaction` validator checked both providers' raw bytes
  against the exported intent, including the exact decompressed WASM, message
  fields, memo, single-message structure, no hidden extension options and no
  instantiation funds. Both providers agree on the transaction data and fees.
- The initial `notBroadcast` history item remains client-exported recovery
  evidence. It is not independently established by a negative chain search.
  These checks are two-provider observations, not an independent light-client
  inclusion proof or an external security audit.

**Do not upload or instantiate again.** Keep the owner's original browser journals
and recovery state. The live setup helper can verify/export this existing contract.

## Render follow-up completed — 7 October, 11:15 UTC

The existing service now runs the reviewed candidate with backups enabled for
the owner only. See [the hosted record](RELAY_SHARED_RENDER_2026-10-07.md) for
verified settings and HTTP checks. The two-wallet/recovery gates remain open.
The following section records the earlier preparation state and is superseded
by that hosted record.

## Earlier preparation: existing Render service

Continue application work in draft PR #195 at
`052e736a87d44bbe3743524b1a547822bc6dbf81` (five passing hosted workflows).
The backup implementation remains on that candidate, not main. Before deployment,
inspect the actual existing service and deliberately select a reviewed candidate
commit through Render's supported deployment flow. A deployment of current main
alone does not install the candidate backup module.

The user installed the Render integration during this verification. Installation
was confirmed, but its service-management functions were not exposed to the
already-running turn. **Do not ask for another installation.** Discover and use
the now-connected integration on continuation. No dashboard configuration was read
or changed, and no Render deploy was started in this checkpoint.

Read-only baseline at 10:41 UTC: `https://neta-junox-faucet.onrender.com/status`
returned HTTP 200, `uni-7`, faucet address
`juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt`, amount `25000000`, interval
`86400`, ready `true`. `/health` returned 404. The hosted backup is not verified.

Prepare the existing service with RELAY **disabled** first. Preserve its actual
service ID, plan, disk/mount, mnemonic secret group/file, payout identity and
SQLite/WAL. Do not create another service or upgrade its plan.

| Setting | Reviewed candidate value |
| --- | --- |
| Root directory | Repository root (`.` in the Blueprint) |
| Build command | `npm ci --prefix faucet --omit=dev --ignore-scripts && npm ci --prefix relay-backup --omit=dev --ignore-scripts` |
| Start command | `FAUCET_PUBLIC_ORIGIN="${FAUCET_PUBLIC_ORIGIN:-$RENDER_EXTERNAL_URL}" node faucet/service/server.mjs` |
| Automatic deployment | Off |
| `NODE_VERSION` | `24.19.0` |
| `SKIP_INSTALL_DEPS` | `true` |
| `RELAY_BACKUP_ENABLED` | `false` until configuration and service checks are complete |
| `RELAY_BACKUP_DIRECTORY` | `/var/data/relay-backup` |
| `RELAY_WEB_ORIGIN` | `https://dao.netareborn.com` |
| `RELAY_MAILBOX_CONTRACT` | `juno1dvmms7su8zfqu4gxxmrkqhzpxr5v3sh8hzfxe8ypsgfegc22lggq5jfjx6` |
| `RELAY_BACKUP_WALLETS` | Start with the consenting owner for initial service checks; obtain the second consenting pilot wallet before the two-wallet test |
| Expected existing origin | `https://neta-junox-faucet.onrender.com`; verify against the actual service before pinning |

Retain the existing `FAUCET_DB=/var/data/faucet.sqlite` and mnemonic configuration.
No secret values belong in Git, output logs or this document. Validate the deployed
commit, health/origin/authentication/CORS/quotas and unchanged Faucet behavior,
then verify persistence across restart and protected off-service exports. Follow
[the shared pilot runbook](../RELAY_SHARED_PILOT_2026-10-07.md).

`PERSONAL_MAINNET_DEPLOYMENT` and `PERSONAL_MAINNET_RELEASE` are still null in
application code pending the reviewed service/release setup. The recorded contract
identity can now be used as verified input; do not fabricate another deployment.
The real two-wallet send/read/reply/reload/fresh-browser recovery test and remaining
release/security gates are still outstanding. DAO inboxes and payment requests
follow personal messaging.
