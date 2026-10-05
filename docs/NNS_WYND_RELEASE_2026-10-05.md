# NNS WYND quote-service checkpoint — 5 October 2026

Owner requested completion and an updated handoff before moving to a new chat.
The next actionable dependency is Render hosting in observe mode, not another
UNI-7 deployment. Live validator testing remains deferred.

## Integrated source

- PR [#153](https://github.com/cristianoneta/neta-dao/pull/153).
- Reviewed head: `827707c0b3682aab72a94de9ca4cb6cc25fa3cc2`.
- Main merge: `837fa7942bec3e849a85fbb9863afbbbddb95395`.
- Separate service: `names/service/`; Blueprint: `names/render.yaml`.
- Unsigned mainnet/DAO material: `names/mainnet-plan.mjs`.
- Operational and launch sequence: [names/README](../names/README.md).

The service has no spending wallet. Its private Ed25519 quote authority lives in
the persistent private SQLite database. Two pinned public providers must agree
on a block/hash and state height. WYND supplies a 30-minute JUNO-per-NETA average;
CoinGecko supplies timestamped JUNO/USD. All fee calculations use integers.
The owner approved WYND and annual 99/19/5 USD; the concrete liquidity, averaging,
movement and usage limits are documented implementation proposals for live review.

## Verification

- 94 existing root Node tests and 12 new service tests passed locally.
- The new tests cover cumulative-price orientation and wraparound, warm-up and
  gaps, low reserves, spot manipulation, decimal precision, stale data, provider
  disagreement/height/code pins, key/quota persistence, 1,000/day cap, config and
  tariff/owner gates, browser-compatible signed registration/renewal quotes,
  paused issuance, restart, HTTP limits and paused DAO tariff preparation.
- PR quote-service CI `37284824631`: success.
- PR contract/frontend CI `37284824701`: success (Rust format/tests/Clippy/audit
  and existing frontend/invariant tests).
- Main quote-service CI `37284943550`: success.
- Main contract/frontend CI `37284943585`: success.
- Pages `37284943184`: success. This publishes repository static assets; it does
  not deploy the Node service to Render.
- Four served source files matched local bytes after Pages: `names/quote-policy.mjs`,
  `names/service/market.mjs`, `names/service/server.mjs` and `names/render.yaml`.

The actual Node `MainnetReader.pool()` succeeded against STAVR and Validatus at
height **42386655**, time **2026-10-05T08:30:17Z**, block hash
`/Q9Rb/AKgOo0F3wLsibgBLTBpkda9CXxEHqiG8MCVSo=`. Both agreed on the full pair,
accumulator and token responses at that height. Reserves: 103,019.433705 JUNO and
881.970017 NETA. Actual CoinGecko reader returned USD/JUNO scaled to 10^12:
`8920948915`, provider timestamp `1791188940`. This was a live source-reader check,
not a complete live 30-minute TWAP observation run. Approximate spot pool value:
USD 1,838. No comparison against all other pools was performed.

Pinned artifact SHA-256 values were checked against the actual existing files:

- Registry: `76a8ce6ce72d8ea73116bafad83a770438aa0e3e8f1f87957177d855ddee8b65`.
- Profiles: `9d47676d8dd0040b1cea4a39a3e8c95a75ea4841cd5b2eb5feb83c7f4516ceed`.

## Unfinished external/launch steps

No Render quote service has been created, so no production service URL or key is
recorded. No production key has been generated in this workspace or committed.
Synthetic test keys are generated transiently; private runtime state stays outside
the public repository. No mainnet uploads, instantiations, DAO proposal submission,
tariff execution, unpause or purchase took place in this task.

The existing website's transaction adapters remain UNI-7-only. Mainnet adapters,
reviewed production manifest/quote endpoint and transaction/recovery behavior
must be implemented before paid launch. Do not replace chain IDs/constants to
pretend that integration is complete. Preserve all existing browser journals.

Launch order: observe-mode hosting/key and restart verification → reviewed
owner-signed mainnet deployment → DAO tariff execution while paused → mainnet
website integration and live service readiness → separate DAO unpause → reviewed
owner-signed purchase with exact debit/treasury credit and identity verification.

The existing UNI-7 tariff update is independently still unverified. Its admin is
the original setup wallet; a future mainnet registry's admin/treasury is the main
NETA DAO. The chat's tariff approval is not either on-chain transaction.

## Side question preserved

The owner requested an English estimate of time spent across the projects. The
informal estimate and methodology are saved in
[WORK_TIME_ESTIMATE_2026-10-05](WORK_TIME_ESTIMATE_2026-10-05.md): about 90–95 hours,
plausible 80–105, faucet separated from DAO work. This is not tracked/billable time.
