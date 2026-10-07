# Juno v31 upgrade observation

The owner requested a validator participation tracker during the 7 October 2026
upgrade, after receiving an approximately 55% consensus estimate from Dimi.
The standalone `juno-upgrade-status.html` page is read-only and does not require
a wallet, Render service, secret, new subscription or signing permission.

At approximately 07:32 UTC both PublicNode and STAVR reported consensus height
42,452,001, round 0, while the latest committed block remained 42,452,000 at
06:56:31 UTC. Their round-specific validator sets and votes agreed:

- Total voting power: 29,766,214, across 25 validators.
- Prevotes for block prefix `64AEF8D4020F`: 16,302,684, or 54.77%.
- Nil prevotes: 2,906,222, or 9.76%.
- No prevote observed: 10,557,308, or 35.47%.
- No precommits observed in that round.

This is a historical RPC observation, not a permanent readiness or software-version
claim. A nil vote counts as participation but does not support a block. Committing
requires more than two thirds of voting power in precommits for the same block and
round. Missing votes do not establish that a validator is offline. The interface
does not combine votes across observers, heights or rounds, and does not verify
the compact RPC vote strings' signatures independently.

The page refreshes every 30 seconds while visible, with a manual refresh and an
automatic-refresh checkbox. Unavailable observers lose their current metrics;
they do not silently become zero participation. Each source has its own results
and validator list. Names are fetched from the bonded validator metadata at STAVR
and matched using SHA-256 of the Ed25519 consensus public key, truncated to 20 bytes.
A dated 25-validator name snapshot is bundled as a fallback when metadata fails;
the UI labels its date and never uses that snapshot for voting power or votes.
Raw consensus addresses remain available when neither source has a name.

Sources:
- https://juno-rpc.publicnode.com/consensus_state
- https://juno.rpc.m.stavr.tech/consensus_state
- Each observer's `/dump_consensus_state` and `/status` endpoints.
- https://juno.api.m.stavr.tech/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=100
- https://github.com/cometbft/cometbft/blob/main/spec/consensus/consensus.md

Tests cover voting power rather than validator count, nil versus absent votes,
strictly more than two thirds, mismatched vote identities/heights/rounds, observer
disagreement, failed requests and 320–1440 px rendering. The live deployment helper
keeps its original transaction providers and freshness checks. This tracker never
authorizes a deployment or activates personal messaging; PR #195 remains draft.

## Publication checkpoint

Live page: https://dao.netareborn.com/juno-upgrade-status.html

PR #206 merged as `8a58a1b7813beef265f6627bdb31806b361e76a8`. Final-head
browser run `37589459187` and frontend run `37589459176` passed. Main frontend
run `37589754571` and Pages deployment `37589754547` passed after integration.
The preceding chat reported opening the live page; the handoff session rechecked
GitHub publication records without making a fresh consensus observation.

Continue from [the current handoff](HANDOFF_NEXT_CHAT_2026-10-07.md). The percentages
above remain historical; recheck live nodes before drawing a current conclusion.
