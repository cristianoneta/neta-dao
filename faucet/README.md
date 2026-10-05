# Juno testnet faucet

A separate English one-pager at `/juno-faucet.html`, linked at the very bottom of
NETA DAO in a new tab. Uses the shared graphite/mint UI. UNI-7 only: never JUNO
mainnet. Keplr connects/suggests UNI-7; current validators are alphabetical and
include commission and this wallet's stake. Users can delegate, undelegate and
withdraw rewards (20 validators per transaction). Unbonding parameters are read
from the chain. Configured reward withdrawal addresses are shown explicitly.

## Activation status

The 2026-10-05 update raises the fixed payout to 25 JUNOX and readiness threshold
to 27 JUNOX. Manual Render deployment is required; verify `/status.amount` is
`25000000` before describing the new amount as live. Historical observations below
refer to the previous 10-JUNOX release.

**The funded Render service is connected for the first real payout test.**
On 2026-10-04 at approximately 13:58 Berlin, `/status` reported UNI-7,
address `juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt`, balance 15 JUNOX,
ready true and all three expected markers: usage-guards-v1,
uni7-exact-hash-v1, bank-send-gas-v1. POST CORS preflight was verified.
The page pins the exact Render origin and address and rejects old/mismatched
service status. Donate JUNOX remains an independent wallet-confirmed transfer;
a real 15-JUNOX donation succeeded. Payout receipt/replay/restart and fresh empty
wallet checks remain unverified until the owner completes them; do not claim E2E
completion from mocked tests. At that earlier 15-JUNOX balance, one payout plus fee would fall below the
then-current 12-JUNOX readiness reserve. The closing read on 2026-10-04 reported 1,039.974213
JUNOX and all three expected markers. Always recheck fresh `/status`; balance
and readiness alone are not payout/restart evidence. Current test steps and
receipts: [faucet handoff](../docs/HANDOFF_NEXT_CHAT_FAUCET_2026-10-04.md).

GitHub Pages cannot keep a signing key or execute this server. Required from the
operator: a persistent server/container host, HTTPS origin, and a **dedicated
UNI-7-only funded wallet**. Do not send a mnemonic in chat, put it in Git, host it
on Pages, or reuse a mainnet wallet. The operator provisions it as a secret file.

No self-managed server is required: the [Render deployment guide](RENDER.md)
and root `render.yaml` prepare a managed Node service with a persistent disk.
The operator must create the hosting account, review the paid service cost and
privately provision the dedicated wallet. This configuration does not activate
the public faucet by itself.

## Run the service

Node 24, persistent local disk, one service instance. Build from this directory:

```sh
npm ci --ignore-scripts
npm test
npm start
# alternatively: docker build -t neta-junox-faucet .
```

Configuration (no mnemonic value in environment variables):

| Variable | Meaning |
| --- | --- |
| `FAUCET_MNEMONIC_FILE` | Absolute path to a read-only mounted secret file |
| `FAUCET_ADDRESS` | Expected dedicated account; must match the signing key |
| `FAUCET_PUBLIC_ORIGIN` | HTTPS service origin, e.g. operator-owned faucet subdomain |
| `FAUCET_WEB_ORIGIN` | Allowed UI origin; default `https://dao.netareborn.com` |
| `FAUCET_DB` | Persistent SQLite path; default `/data/faucet.sqlite` |
| `FAUCET_RPC` | HTTPS UNI-7 signing/balance RPC; default NodesHub. Confirmation checks indexed STAVR and this RPC concurrently. |
| `HOST`, `PORT` | Default loopback `127.0.0.1:8787`; Docker listens on `0.0.0.0` |

Terminate TLS at a reverse proxy. Keep the service port private. Enforce request
size, timeouts and per-client rate limiting at that proxy. The service also caps
requests globally across all direct peers. This is an aggregate backstop, not an
end-user IP policy. It deliberately does not trust arbitrary forwarded headers.
Mount `/data` persistently, owned by UID 1000 for the container. Protect and back
up the SQLite database **with its WAL**, using SQLite's backup API or a clean
shutdown; do not restore an old ledger while payouts are running. There is no
admin withdrawal endpoint. Donations are ordinary wallet-signed bank transfers.

Activation checklist:

1. Deploy with the dedicated key and persistent volume; verify `/status` reports
   `chainId=uni-7`, `amount=25000000`, `intervalSeconds=86400`, expected address,
   `protection=usage-guards-v1` and `confirmation=uni7-exact-hash-v1`.
2. Fund that exact account with JUNOX using Donate JUNOX on the public page.
   Confirm the transfer in Keplr. A conservative 27-JUNOX reserve is required
   to report ready. The service pays transfer gas; an empty recipient can claim.
3. Pin the HTTPS API origin and funding address in `juno-faucet-config.mjs`, and
   add only that origin to the HTML CSP's `connect-src`.
4. From Keplr, exercise a real fresh-wallet payout and compare chain receipt with
   the fixed 25 JUNOX. Re-request must fail for the next 24h, including after
   service restart. Test a whole-number donation, staking, unstaking and rewards.
5. Record chain transaction hashes and exact deployment revision before claiming
   live end-to-end verification. Monitor funding and unresolved transactions.

## Usage guards and cost boundary

The operator accepted Render and requested conservative automatic pauses before
public activation. Defaults apply without new environment variables:

| Guard | Ceiling |
| --- | --- |
| Admitted HTTP requests, all paths/clients combined | 60 per UTC minute, 5,000 per UTC day, 50,000 per UTC month |
| Concurrent admitted HTTP handlers | 4 |
| New payout reservations, all wallets combined | 100 per UTC day, 1,000 per UTC month |
| Per-wallet payout | 25 JUNOX per rolling 24 hours |
| Status RPC refresh | One shared refresh per 30 seconds; failures also cached |
| POST body | 8 KiB |

Request counters persist in the **same SQLite file** as the payout journal.
Exhausted requests receive a small HTTP 429 with reset time, before body parsing,
wallet verification or RPC. Day/month windows reset at UTC boundaries, not the
Render billing date. Payout caps count every reservation, including failures and
old claims, and are enforced in the signing-reservation transaction. No refund on
failure, no resetting usage or deleting journals to restart. A completed/pending
claim can still return its existing result when the request budget permits it.
Maximum newly reserved transfers are 1,000 JUNOX/day and 10,000 JUNOX/month;
confirmed transfers can finish later than their reservation window.

`FAUCET_REQUESTS_PER_MINUTE`, `FAUCET_REQUESTS_PER_DAY`,
`FAUCET_REQUESTS_PER_MONTH`, `FAUCET_PAYOUTS_PER_DAY`, `FAUCET_PAYOUTS_PER_MONTH`
may **lower** these ceilings to positive integers. Zero/invalid/above-ceiling
values fail startup. `FAUCET_PAUSED=true` manually disables HTTP operations after
startup; use Render Suspend Service for host-level suspension. At a payout cap,
`/status` reports `ready:false` plus `pause`; `protection:usage-guards-v1` identifies
the deployed HTTP guard version. Balance readiness may be cached for 30 seconds.

**This is NOT a USD 10 spending cap, a bandwidth meter or a Render suspension.**
Render still bills the instance/disk; rejection responses, proxy traffic, builds
and other workspace services can still cost money. No provider API credential is
stored and no automatic host suspension is installed. Configure the Build
Pipeline additional-spend limit to USD 0 in Render and monitor workspace usage.
A guaranteed invoice ceiling requires a provider-enforced billing agreement.
The public frontend is connected to the deployed, funded service for controlled
testing. Signed payout/replay/restart checks remain evidence gates, not a claim
that the current UI is disabled.

## Transfer gas policy

Donations and payouts share `src/transfer-fee.mjs`: positive integer simulation
estimates up to 500000, then `max(250000, ceil(estimate * 1.8))` at 0.2 ujunox/gas.
The minimum fee is 0.05 JUNOX. A real donation exhausted the previous 1.4x limit
at height 18526822 (code 11); it transferred no donation tokens, but charged the
0.0274-JUNOX fee. The subsequent 15-JUNOX donation succeeded with gas limit
250000; its exact receipt is in the faucet handoff. No automatic retry or journal
reset. Staking/reward fees are unchanged. The deployed backend already reports
`gasPolicy:bank-send-gas-v1`; recheck it alongside the confirmation marker after
future backend deployments.

## Limits and transaction integrity

- Exactly 25 JUNOX per connected wallet in a **rolling 24-hour window** after a
  confirmed payout. New addresses are separate wallets; this is not a per-human
  identity or anti-Sybil guarantee. Add operator abuse protection before scaling.
- ADR-36 proves wallet ownership with a random, single-use, 5-minute challenge,
  bound to service origin, chain, address and amount. An unexpired repeated request id
  returns its original result; it cannot create another payment.
- SQLite `BEGIN IMMEDIATE` plus a unique active signer slot serializes the payout
  wallet and reserves each claim before signing. Sign-before-broadcast state,
  signed bytes and exact hash persist with WAL + FULL synchronous durability.
- Broadcast uses `broadcastTxSync` once; mempool acceptance is not confirmation.
  The backend checks STAVR and the configured HTTPS RPC concurrently. Each lookup checks
  fresh `uni-7` identity, exact requested hash, SHA-256 of returned signed bytes,
  positive block height and a nonnegative integer execution code. Each endpoint
  has a shared 12-second status/receipt deadline, no redirects, and a 512-KiB
  response cap. Concurrent checks of the same hash share the in-flight lookup.
  These are trusted RPC receipts, not independently verified light-client proofs.
- Timeout, restart or missing transaction index never triggers a fresh signature
  or automatic rebroadcast. Inclusion is reconciled by exact hash and code.
  Until it is proven, further payouts pause. Failed included transactions release
  the slot; successful ones start the wallet's cooldown.
- An interrupted `signing` reservation has no automatic recovery. Stop payouts,
  inspect the account sequence, database and chain history. Do not delete the
  ledger or blindly clear pending entries. A known hash must be reconciled first;
  if inclusion cannot be proven, keep paused and investigate with the operator.
- Browser transactions use the same origin-wide `neta-pending-tx-v1:` journal and
  Web Lock as the DAO. They preserve ambiguous outcomes across tabs and reloads.
  `src/broadcast-journal.mjs` is synced from neta-website commit/blob provenance
  in its header. Do not change the shared semantics independently.
- All signing clients pin `uni-7`; fee/stake/send denom is `ujunox`. Donations
  accept positive whole JUNOX; stake/unstake accept up to six decimal places.

## Reproducibility and checks

```sh
npm ci --prefix faucet --ignore-scripts
npm run build --prefix faucet
npm test --prefix faucet
node --test tests/juno-faucet.test.mjs
node spikes/relay-corecrypto/browser-faucet.mjs
```

The new CI checks the rebuilt bundle against its committed bytes, audits pinned
packages, tests exact amounts, rolling-window limits, concurrent/replayed claims,
ADR-36 verification, wrong-chain rejection, durable unknown outcomes, pagination,
wallet switches and responsive browser flows. Browser chain and wallet actions
are mocked; these checks are not evidence of real signed chain transactions.

Read-only endpoint check on 2026-10-03: NodesHub and Stavr both returned `uni-7`,
22 validator records, `ujunox` staking denomination and `2419200s` (28 days)
unbonding. UI reads these dynamically and does not hardcode validator snapshots.

Primary references: [Keplr arbitrary signing](https://docs.keplr.app/api/guide/sign-arbitrary)
and [CosmJS](https://github.com/cosmos/cosmjs). Cosmos SDK rewards may contain
fractional micro-units; displayed rewards truncate after summation. Claiming
withdraws on-chain rewards, not a frontend-calculated transfer amount.

Dependency compatibility: `@cosmjs/encoding@0.38.1` calls Bech32 decode with an
Infinity limit. `@scure/base@2.4.0` rejects that; the encoding dependency is pinned
to 2.0.0, with valid/invalid address regression coverage. Re-evaluate this pin
when upgrading CosmJS and audit the resulting lockfile.
