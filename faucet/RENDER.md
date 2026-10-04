# Deploy the UNI-7 faucet without managing a server

Status as of 2026-10-04: the owner created the Render service and provisioned
its private wallet. The public `/status` endpoint returned UNI-7 and balance 0:
`https://neta-junox-faucet.onrender.com`,
`juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt`.
The public faucet pins the dedicated donation address but keeps `api: null`.
Donate JUNOX works independently of Render; no live payout is verified.

Usage guards are already verified live. Deploy the backend confirmation update
manually and check both `protection: "usage-guards-v1"` and
`confirmation: "uni7-exact-hash-v1"` in `/status` before public activation.
It adds durable aggregate request/payout quotas and pauses API work automatically
when exhausted. It does not suspend the Render host or cap the invoice at USD 10.
See [the limits and cost boundary](README.md#usage-guards-and-cost-boundary).
Set the workspace Build Pipeline **additional-spend limit to USD 0** separately;
that setting covers build minutes only. Auto-deploy stays off.

The root `render.yaml` provisions one Node 24 web service in Frankfurt and a
1 GB persistent disk. Render handles HTTPS and process restarts. This uses a
**paid compute plan plus disk**; review the current price in Render before
creating the Blueprint. The free web-service plan cannot provide this disk.
There is no database migration; existing SQLite/WAL and pending claims must
remain in place. Confirmation lookup does not sign or repeat a payment.

## Existing service: deploy the confirmation correction

Open **neta-junox-faucet → Manual Deploy → Deploy latest commit** after the
confirmation PR is merged to `main`. Keep the service, disk, secret file and
environment group in place. No RPC environment edit is required: NodesHub remains
the signing/balance endpoint and the source adds indexed STAVR confirmation.
Verify the new `/status` confirmation marker above; a successful GitHub Pages
deployment does not update Render because auto-deploy is off.

Fund the existing dedicated address using the public page's Donate JUNOX control
and confirm the UNI-7 transfer in Keplr (100 JUNOX is a useful start). This funding
can happen before the Render deployment because donations are direct transfers. Do not recreate the wallet or database.
The sections below also document provisioning for a new installation.

## 1. Prepare the dedicated wallet and private settings

Create a separate wallet in Keplr solely for the UNI-7 faucet. Use its default
first account (Cosmos derivation path `m/44'/118'/0'/0/0`), not a Ledger-only
account or an additional account index. Copy its public `juno1...` address.
Fund it with JUNOX on UNI-7. At least 12 JUNOX are needed for the service to report
ready; 100 JUNOX is a practical initial test balance. These are testnet tokens.

Do not send the recovery phrase in chat or commit it to Git. The operator enters
it directly in Render's secret-file form:

1. Sign in to <https://dashboard.render.com/> and connect the GitHub account.
2. Open **Environment Groups → New Environment Group**.
3. Name it exactly `neta-junox-faucet-private`.
4. Add variable `FAUCET_ADDRESS` with the public dedicated `juno1...` address.
5. Add a **Secret File** named `faucet-mnemonic`, containing only that wallet's
   recovery words, separated by spaces. Do not put the mnemonic in an environment
   variable. Save the group. Link this group only to the single faucet instance.

## 2. Create the managed service

Open **New → Blueprint**, select `cristianoneta/neta-dao`, branch `main`, and use
the root `render.yaml`. Inspect the proposed service, compute price and disk
price, then create it. The private group must already exist in the same workspace.

The Blueprint sets the runtime, build/start commands, allowed UI origin, UNI-7
RPC and disk path. At startup the service uses Render's assigned HTTPS URL as
its ADR-36 challenge domain. No guessed service hostname needs to be entered.
An explicit `FAUCET_PUBLIC_ORIGIN` can override this later for a custom domain.

It deliberately provisions only one instance, no preview services, and no
automatic redeploys. A second process using the same payout key with a different
database can defeat the shared cooldown and signing lock. Keep the persistent
disk attached across all releases. Deploy reviewed updates manually.

Default TCP health checks verify that the initialized server is listening.
They do **not** prove sufficient balance or payout readiness. Do not use `/status`
as a high-frequency health check: it queries the RPC and reconciles the ledger.

## 3. Verify and activate the public page

Open the assigned `https://…onrender.com/status` URL. Verify:

| Field | Expected |
| --- | --- |
| `chainId` | `uni-7` |
| `protection` | `usage-guards-v1` |
| `confirmation` | `uni7-exact-hash-v1` |
| `gasPolicy` | `bank-send-gas-v1` |
| `address` | The exact dedicated wallet address |
| `amount` | `10000000` (10 JUNOX) |
| `intervalSeconds` | `86400` |
| `ready` | `true` after funding and with no unresolved payout |

Share **only the service URL and public wallet address** with the developer.
Those two public values are sufficient to pin `juno-faucet-config.mjs` and add
the exact API origin to the HTML CSP. Do not activate a placeholder URL.

Complete the [activation checklist](README.md#run-the-service): one real
fresh-wallet claim, on-chain receipt for exactly 10 JUNOX, a rejected repeated
claim, and the same cooldown after a service restart. Also verify donation,
staking, unstaking and reward flows with operator signatures. Record the deployed
commit and transaction hashes before calling the faucet live end to end.

## Operational notes

- A startup error about a missing file usually means the private environment
  group is not linked or the secret filename differs. Do not print file contents
  to diagnose it. An address mismatch requires checking the account selection.
- `ready: false` can mean insufficient funding or an unresolved transaction.
  Preserve the ledger and inspect the chain; do not delete the SQLite file.
- SQLite, WAL and payout history live under `/var/data`; only that directory is
  persistent. Follow the backup/recovery rules in the service README.
- The application's durable global request limiter is an aggregate backstop behind Render's
  proxy. It does not establish one-person-one-claim or per-client IP limits.
  The existing wallet cooldown remains the payout limit. Add an appropriate
  edge abuse policy before scaling public usage; do not trust arbitrary
  `X-Forwarded-For` headers.
- If no paid hosting is desired, adapting to Workers/Durable Objects is a
  separate runtime/storage implementation, not a switch for this Node service.

Primary hosting references: [Blueprint specification](https://render.com/docs/blueprint-spec),
[persistent disks](https://render.com/docs/disks),
[secret files](https://render.com/docs/configure-environment-variables#secret-files),
[default environment variables](https://render.com/docs/environment-variables),
[health checks](https://render.com/docs/health-checks).
