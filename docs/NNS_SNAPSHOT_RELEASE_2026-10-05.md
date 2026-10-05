# Treasury price snapshot checkpoint — 2026-10-05

Owner accepted approximate periodic pricing and reuse of existing Treasury data.
This replaces the separate Render/WYND continuous-service deployment plan.
Current operation and setup are owned by [names/README](../names/README.md).

## Implemented

- Existing Treasury WYND/JUNO-USD reads now export explicit `nns_price`, including
  with zero NETA holdings. No extra price-provider requests are introduced.
- Existing main DAO workflow targets minutes 7/37 and signs an observation only
  when a reviewed mainnet manifest and private Actions price secret exist.
  Price expiry stays anchored to the collector observation for at most 24 hours.
- Registry v0.3.0 verifies shared Ed25519 price signatures and exact CW20 payments.
  Buyer authorization, commit/reveal, identity/revision, current tariff, replay,
  pause and key rotation remain enforced. Quotes still have a five-minute review.
- Browser/shared client prepares and validates snapshot payments and retains the
  existing durable-intent and exact-receipt recovery path. The normal UNI-7 page
  retains its individual test quotes; mainnet wallet/reader/page wiring is open.
- New mainnet registry WASM is separate from the unchanged historical UNI-7 WASM.
  Mainnet preparation validates new code pins and still produces unsigned data.
- Unused Render Blueprint and prior operational instructions are archived; the
  continuous-service source/tests are retained as a deferred alternative.

## Local evidence

- Registry: 21 Rust tests passed, including five new shared-price tests with
  Node/Rust signature fixture, actual CW20 fee forwarding, rollback, multiple
  buyers, renewal/replay, wrong authority/domain, expiry and altered amounts.
- Root + Names Node suites: 115 tests passed.
- Python Treasury/history, DAO onboarding, events and member suites: 31 passed.
- Rust format and Clippy with warnings denied passed. Release WASM built using
  pinned Rust 1.81.0 and the repository reproducible-build script. A transient
  empty host proc-macro build artifact was cleaned and rebuilt successfully.
  `cosmwasm-check` 1.5.11 accepted the new artifact.
- New shared-price tests cover exact decimal conversion, absent/invalid/old data,
  original expiry on rerun, no secret leakage on publisher errors, old artifact
  preservation, and client recovery without automatic transaction resubmission.

See the PR/current Actions for remote checks and publication status. Local tests
are synthetic and are not evidence of mainnet deployment, a live scheduled signed
price, a new wallet test or DAO execution.

## Remaining external/launch dependencies

No production private key was generated or installed. No new Render resource,
CoinGecko subscription, mainnet contract, production manifest or wallet transaction
was created. `docs/deployments/nns-mainnet.json` and `data/nns/price.json` are absent
by design until real deployment/configuration. The workflow skips NNS publication
while its production manifest is absent. Existing Treasury collection continues.

Next: owner-controlled Ed25519 key → Actions secret/public deployment key →
reviewed owner-signed registry/profile deployment → verified version-3 manifest →
DAO tariff while paused → public signed-price and mainnet adapter verification →
separate DAO unpause → owner-signed purchase evidence. Validator tests stay deferred.

Authentic older snapshots can still be used until expiry. No latest-price oracle
state or per-update on-chain gas is introduced. This is accepted approximate fee
pricing, not a price guaranteed to match a live trade or a manipulation-resistant
oracle. Source failures cannot renew an old observation's lifetime.
