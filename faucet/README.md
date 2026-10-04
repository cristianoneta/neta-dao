# Juno testnet faucet

A separate English one-pager at `/juno-faucet.html`, linked at the very bottom of
NETA DAO in a new tab. Uses the shared graphite/mint UI. UNI-7 only: never JUNO
mainnet. Keplr connects/suggests UNI-7; current validators are alphabetical and
include commission and this wallet's stake. Users can delegate, undelegate and
withdraw rewards (20 validators per transaction). Unbonding parameters are read
from the chain. Configured reward withdrawal addresses are shown explicitly.

## Activation status

**The payout service is implemented but NOT deployed or funded.**
`juno-faucet-config.mjs` intentionally has `api: null, address: null`. Get 10 JUNOX
and Donate remain disabled with a visible explanation until a reviewed deployment
has a dedicated funded UNI-7 address. Validator reads, wallet balances, staking,
unstaking and claiming existing staking rewards do not depend on this service.
No real wallet signature or payout was performed by the implementation tests.

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
| `FAUCET_RPC` | UNI-7 RPC; default NodesHub testnet endpoint |
| `HOST`, `PORT` | Default loopback `127.0.0.1:8787`; Docker listens on `0.0.0.0` |

Terminate TLS at a reverse proxy. Keep the service port private. Enforce request
size, timeouts and per-client rate limiting at that proxy. The service also caps
requests per direct peer; behind a proxy that is an aggregate backstop, not an
end-user IP policy. It deliberately does not trust arbitrary forwarded headers.
Mount `/data` persistently, owned by UID 1000 for the container. Protect and back
up the SQLite database **with its WAL**, using SQLite's backup API or a clean
shutdown; do not restore an old ledger while payouts are running. There is no
admin withdrawal endpoint. Donations are ordinary wallet-signed bank transfers.

Activation checklist:

1. Deploy with the dedicated key and persistent volume; verify `/status` reports
   `chainId=uni-7`, `amount=10000000`, `intervalSeconds=86400` and expected address.
2. Fund that exact account with JUNOX. A conservative 12-JUNOX reserve is required
   to report ready. The service pays transfer gas; an empty recipient can claim.
3. Pin the HTTPS API origin and funding address in `juno-faucet-config.mjs`, and
   add only that origin to the HTML CSP's `connect-src`.
4. From Keplr, exercise a real fresh-wallet payout and compare chain receipt with
   the fixed 10 JUNOX. Re-request must fail for the next 24h, including after
   service restart. Test a whole-number donation, staking, unstaking and rewards.
5. Record chain transaction hashes and exact deployment revision before claiming
   live end-to-end verification. Monitor funding and unresolved transactions.

## Limits and transaction integrity

- Exactly 10 JUNOX per connected wallet in a **rolling 24-hour window** after a
  confirmed payout. New addresses are separate wallets; this is not a per-human
  identity or anti-Sybil guarantee. Add operator abuse protection before scaling.
- ADR-36 proves wallet ownership with a random, single-use, 5-minute challenge,
  bound to service origin, chain, address and amount. An unexpired repeated request id
  returns its original result; it cannot create another payment.
- SQLite `BEGIN IMMEDIATE` plus a unique active signer slot serializes the payout
  wallet and reserves each claim before signing. Sign-before-broadcast state,
  signed bytes and exact hash persist with WAL + FULL synchronous durability.
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
