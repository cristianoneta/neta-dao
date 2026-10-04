# UNI-7 faucet handoff — 2026-10-04

Updated at end of session. Overall continuation: [HANDOFF](../HANDOFF.md).
NNS is the current product priority; this file owns remaining faucet evidence.
The superseded step-by-step chronology is in the [archive](archive/FAUCET_CHRONOLOGY_2026-10-04.md).

## Current implementation and observed service state

- Live page: <https://dao.netareborn.com/juno-faucet.html>.
- Backend: <https://neta-junox-faucet.onrender.com>; read-only `/status` endpoint.
- Pinned address: `juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt`.
- `juno-faucet-config.mjs` and page CSP already pin this API. Donations and payout
  integration are enabled subject to wallet, validated status, cooldown and journal
  gates. Do not repeat the old API activation/setup steps.
- Read-only status during the closing review (2026-10-04, approximately 22:11 Berlin):
  `chainId:uni-7`, amount `10000000`, interval `86400`, balance `1039974213` ujunox
  (**1,039.974213 JUNOX**), `ready:true`, `pause:null`; all three expected markers
  `usage-guards-v1`, `uni7-exact-hash-v1`, `bank-send-gas-v1` were present.
  This supersedes the earlier 15-JUNOX funding snapshot. It does not establish the
  origin of additional funding or prove payout/restart E2E.

Keplr connect/disconnect and address display, live validators/commission, balances,
delegations/unbonding/rewards, reviewed stake/unstake/reward transactions and
whole-JUNOX donations are implemented. Reward confirmation uses independent indexed
UNI-7 lookup: NodesHub accepts broadcasts but disables transaction indexing.
The submitted bytes/hash and execution receipt are checked; unknown outcomes remain
pending. No automatic signing/rebroadcast occurs on Connect/Refresh recovery.

## Confirmed owner receipts

| Action | Evidence |
| --- | --- |
| Reward withdrawal | `72AA75539747AE522BBBEF06F6149F08252112CA15948E07F9BAE8F5FC2A8387`, height 18525930, code 0, rewards 173.075836 JUNOX, fee 0.037690 JUNOX |
| Failed 10-JUNOX donation before gas fix | `E4E0C8918FA87CDAFBF2ADDB7E010B9E5F39524CA92ABB3ED9628BE9260331D7`, height 18526822, code 11/out of gas, no donation transfer; fee 0.0274 JUNOX |
| Successful 15-JUNOX donation after gas fix | `9019CA5CE99FD3B9D31186083EB77856EA034B9A0BF5D7A4C0DAF5BC8658E2DF`, height 18530558, code 0, fee 0.05 JUNOX, gas limit 250000 / used 144384 |

Reward recipient and successful donation sender:
`juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`. Original checks verified receipt and
signed-byte hash through STAVR. These are recorded evidence, not new transactions
performed during this documentation review. No real payout/stake/unstake receipt
is archived here. Earlier PR/Pages evidence is retained in the chronology archive.

## Next live tests

1. Recheck fresh service status, current GitHub/frontend release and the browser's
   pending journal. Preserve all site data; reconcile known hashes before new writes.
2. Owner requests **10 JUNOX**, confirms the ADR-36 ownership message in Keplr,
   and supplies the resulting receipt. Verify exact amount, recipient and success.
3. Verify repeat-request rejection and the persisted 24-hour cooldown after an
   owner-triggered restart of the same Render service. Preserve SQLite/WAL.
4. Test a fresh empty recipient wallet; separately verify stake/unstake receipts.
   Do not describe mocked browser tests or `ready:true` as these live results.
5. Keep status/funding observations timestamped. Never infer current balance from
   this handoff or clear backend/browser journals to make a test pass.

## Hosting and spending boundaries

Render auto-deploy is **off**. Backend source changes require Manual Deploy to the
existing service, retaining its persistent disk, SQLite/WAL and private settings.
Static GitHub Pages changes alone do not require a Render deployment. The owner
already provisioned the private secret file; never request/read/print its contents.
See [Render guide](../faucet/RENDER.md) and [service README](../faucet/README.md).

Application guards: <=60 admitted requests/minute, 5,000/UTC day, 50,000/UTC month;
<=100 new payout reservations/day and 1,000/month (failed reservations count);
4 concurrent handlers; 30-second status cache; 8-KiB bodies; persistent counters;
fixed 10 JUNOX per wallet per rolling 24 hours. Environment overrides can lower
limits only. `FAUCET_PAUSED=true` provides a manual pause.

These limits are **not a hard dollar invoice cap**; rejected traffic, disk and
instance costs can remain billable. A Render build-spend limit of USD 0 was
recommended but not confirmed. Do not overstate platform billing protection.
Bank sends simulate, cap the estimate at 500000, and use
`max(250000, ceil(estimate * 1.8))` at 0.2 ujunox/gas; minimum fee is 0.05 JUNOX.
The service retains a 12-JUNOX readiness reserve. No automatic retry follows an
included failure or unknown broadcast.

## Deferred research

The Kintsugi faucet GitHub login returned 404 in the owner test; its exact app
configuration cause is unproven. Funding-precedent research and original sources
remain in the chronology archive. Do not reopen validator/whale research or send
outreach without instruction. The separate website nightly-ranking correction was
recorded as neta-website #142/#143; this DAO cleanup does not re-audit that repository.
