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

## Compact participation correction — 7 October 2026

The owner observed advancing block heights with 0% live-round votes everywhere.
The old display sampled the next unfinished round, which resets after each block;
it therefore gave a misleading picture of ongoing validator participation.

The replacement shows one summary and one filtered validator list. After restart,
it reads the last five canonical commits, ending one block behind the observed tip,
plus the validator set pinned to that height. Both observers are asked for the same
window where possible. Every block must match chain/height, canonical status,
validator identity/order and signature shape; committed power must exceed two thirds.
The window stops at the upgrade boundary or an advertised validator-set transition.
Malformed/incomplete history is unavailable, never fabricated zero participation.

“Signed” means at least one included block signature in this window. Its union of
voting power is explicitly distinct from signing power in the latest individual
block; it is not used to claim quorum across blocks. Each row shows signed blocks /
observed blocks. Nil votes are not block signatures. Missing signatures do not prove
that a validator has not upgraded. Signatures remain RPC observations, not locally
verified cryptographic evidence. The two sources are never merged. Disagreement,
single-source coverage and stale blocks remain visible above the table; source
selection, observer details, names provenance and methodology are collapsed.

The current-round parser remains only for the initial wait before canonical
post-upgrade history exists, with explicit round-specific labels. Once a source
observes resumed blocks, unavailable commit history cannot fall back to a reassuring
or alarming live-round zero. Reads remain bounded to 10 seconds, one refresh at a
time, at most 14 node requests per visible 30-second refresh, plus infrequent names
metadata. No wallet, server, journal or messaging behavior changes.

Local verification: nine core tests and the focused browser regression pass, covering
empty live rounds after restart, canonical history, exact validator sets, incomplete
and malformed evidence, nil votes, set changes, source disagreement/fallback, stale
and missing data, filters and responsive layout at 1440/768/390/320 px. Screenshots
were inspected; narrow rows reflow without page overflow. Browser RPC data is mocked;
publication and live-network observations must be recorded separately.

## Community Tools and first-signature history

Owner publication instruction, 7 October: publish the reviewed tracker as part of
Community Tools. The shared workspace footer links to `/community-tools/`, with
children `/community-tools/juno-faucet/` and `/community-tools/validator-upgrades/`.
The v31 detail page is `/community-tools/validator-upgrades/juno-v31/`.
The old root faucet/tracker URLs are same-origin redirects; query/hash and all
origin-scoped faucet storage survive. Faucet imports/assets remain at their existing
root locations. Names' JUNOX links go directly to the new faucet; the owner deployment
page links directly to v31. No wallet/deployment/backup activation is included.

The new column is **First signature after upgrade halt**. It records the first
included canonical block precommit and uses that validator's signature timestamp,
not the block header's timestamp. This matters for v31: the first post-upgrade
header has time `2026-10-07T06:56:33.885375947Z`, while its signatures were around
`2026-10-07T07:53:30Z`. Both PublicNode and STAVR returned the same canonical first
commit during this work. The halt reference is the header of height 42,452,000:
`2026-10-07T06:56:31.235578431Z`. The elapsed time includes the common chain halt;
block offset 0 means inclusion in the first resumed block. It cannot reconstruct
which validator had its binary ready earliest, earlier prevotes, or exact installation
time. Commit inclusion and validator clocks also affect the observation.

`scripts/update_validator_upgrades.py` walks every height from the halt with two
independent matching canonical commits, bounded ten-height batches, exact validator
identity/signature shape, a strict per-block quorum and a linked block chain. It
retains a contiguous checkpoint and never skips an unavailable height, replaces
an existing first observation, interprets nil as a block signature, or overwrites
corrupt saved evidence. Each actual JSON record includes its transaction-independent
commit hash, signature and timestamp. This is RPC-checked evidence, not local
Ed25519 signature verification. The half-hour workflow continues partial scans,
publishing only `data/validator-upgrades/*.json`; completed histories require no
further node requests. Source disagreement stops at the last accepted prefix.
The browser reads this separate dated history at most every five minutes and never
turns an unavailable archive into zero delay. Current participation remains the
independent five-block live view.

Future upgrades: add an explicitly reviewed ID/height/date/path to
`data/community-upgrades.json`, create a matching detail page with `data-upgrade`
and `data-upgrade-height`, and retain the old JSON and URL. The upgrade index renders
the registry. Stop the previous collector with `collect:false` (or set its inclusive
`endHeight` while completing backfill); do not let a later upgrade be labelled as
readiness for an earlier one. The live panel of an old detail page must be frozen
or relabelled deliberately when publishing that next upgrade.

Verification includes the real first canonical v31 commit's schema, six collector
unit tests, three browser-history parser tests, the existing core/frontend/faucet
checks, the expanded tracker browser regression, legacy redirects and the faucet
browser regression under its new path. Desktop, tablet and narrow layouts were
reviewed. Browser transaction tests remain simulated; publication evidence follows
only after CI and deployment are verified.
