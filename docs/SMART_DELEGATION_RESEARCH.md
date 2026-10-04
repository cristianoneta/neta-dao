# Smart Delegation App research — deferred, 2026-10-04

Owner decision: keep this research for later; finish the NNS UNI-7 tests first.
These are inspiration candidates, not approved changes to the delegation policy.

## Original material recovered

- [Archived policy guide, 2024-08-13](https://web.archive.org/web/20240813161133/https://smartdelegation.app/docs): Stake Agreements (fixed minima for services), Eligibility (all rules must pass), and weighted Scoring Parameters with thresholds. Policies progress from editable NotCommitted to immutable Committed versions; committed policies can generate transactions. Simulation exposes current, ideal and agreed stake and ineligible validators. Locked funds include unbonding/redelegation constraints. Public policies are optional.
- [Actual C4E public policy, archived 2024-07-14](https://web.archive.org/web/20240714072519/https://smartdelegation.app/public/44759337-3b2d-4bf8-89ec-f7f252a960da): account c4e1cqhjt97p9kwhef3ht9g3qn8u9tnfcv3y2kc669; policy updated 2023-04-14, marked Committed and superseded by a newer policy. Shows 39,796,825 C4E engaged funds in the simulation, not proof that all were delegated. Scoring weights: commission 5%, country concentration 30%, ISP concentration 30%, signed blocks 20%, voting 15%. Agreements shown expired 2023-07-14; do not treat this as current policy.
- [Archived terms, version 1.0 dated 2023-01-04](https://web.archive.org/web/20240305083506/https://smartdelegation.app/tos.pdf): Blockad s.r.o./RockawayX, approved wallet users, noncustodial service. Proprietary application and limited use license; no permission established to copy the whole app.
- [Archived landing page, 2024-05-06](https://web.archive.org/web/20240506112800/https://smartdelegation.app/): Smart Delegation App by RockawayX Labs. The live domain returned 502 during research; no official shutdown notice found.
- [Martin Vejmelka (RockawayX) — Architecting decentralization of L1s](https://www.youtube.com/watch?v=UJRsvMCFmyc): original 30:56 Gateway to Cosmos talk found. Metadata verified, video/transcript not reviewed. [Conference agenda](https://gateway.events/) also lists a separate Observatory, Stakebar & Smart Delegation Program workshop; its recording was not found.
- [Public Tendermint sensor branch](https://github.com/rockawayx-labs/tendermint/tree/v0.34.x-sensor): Apache-2.0. Three commits add peer latency/ping-pong timestamp/half-RTT measurement in p2p files. This is only a sensor component, not the complete vote-origin inference pipeline or delegation application. Compatibility with current CometBFT is unverified.
- [C4E official SRDP documentation](https://docs.c4e.io/validatorsGuide/strategReserveDelegationProgram/strategReserveDelegationProgram.html) explicitly names SDP for objective parameters.
- C4E governance [proposal 3](https://wallet.c4e.io/governance/3) passed 2023-02-24: 54m C4E, split 4m eligibility, 10m early validators, 34m objective, 6m subjective. [Proposal 4](https://wallet.c4e.io/governance/4) passed 2023-04-10: v1.2.0 upgrade to move 40m vesting funds to a separate SRDP account. [Proposal 6](https://wallet.c4e.io/governance/6) passed 2023-10-11: objective 34m to 30m, subjective 6m to 10m after two quarters. All 13 proposals were retrieved via the [chain v1 API](https://lcd.c4e.io/cosmos/gov/v1/proposals?pagination.limit=200); the legacy v1beta1 route failed.
- [Provider's own 2023 introduction](https://dydx.forum/t/validator-introduction-rockawayx-infra/504) links Observatory, Smart Delegation for foundations, and Stakebar for retail.
- [Observatory renewal](https://dydxgrants.com/grants/observatory-dashboard-renewal) and [September 2025 foundation update](https://www.dydx.foundation/blog/dydx-grants-program-community-update-september-2025) show related Observatory work continued. They do not establish that Smart Delegation remains operational.

## Context from Cristiano's April/May 2024 conversation

Martin described on-chain metrics plus modified CometBFT sensors observing P2P packet arrival times. A statistical pipeline infers nodes originating votes; it does not guarantee exact validator locations.

Delegation execution used a multisig UI: each signer reviews and signs in Keplr, then threshold permits broadcast. It was not Authz. DAO DAO integration did not exist at that time.

The commercial quote was roughly USD 5,000 per chain (more in tokens for volatility/liquidity). The supplied message does not explicitly specify the billing interval; do not describe it as a verified monthly quote.

## Useful later options

Versioned policies, eligibility separated from weighted scoring, public explanations and simulations, optional time-limited service agreements, redelegation constraints, and review/DAO approval before execution.

Reuse concepts independently. Only reuse source code with a verified applicable license. No open-source full SDP application was found among the provider's public repositories. Archived compiled JavaScript is not evidence of a reuse license.

## Existing NETA decisions remain authoritative

- A valid .neta name is required only for testnet bonus points, not the whole delegation programme.
- Active UNI-7 set membership at the snapshot earns full testnet points initially; no additional uptime requirement.
- Separate mainnet/testnet operator signatures verify the link; do not assume addresses share keys.
- Multiple linked testnet addresses never multiply points.
- Discord, Telegram, X/Twitter, email and homepage are optional public profile fields; contact information itself is not verified.
- Future name expiry affects future bonus eligibility, not automatic reversal of approved delegations.
