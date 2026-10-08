# Future Juno upgrade tracking

Status: proposal/lifecycle core implemented and tested; network runner,
early-vote capture and automatic page publication remain pending. Not scheduled.
v31 remains closed.

## Owner requirement: automatic future upgrade tracking — 7 October 2026, 14:51 Berlin

The owner wants the completed v31 workflow reused for every future Juno software
upgrade, and explicitly requested this requirement in the handoff. **Prepared core, not a running watcher.** v31 remains closed. Do not claim
that future proposals are already being watched. `scripts/juno_upgrade_lifecycle.py`
recognizes modern/legacy upgrade messages, requires two configured same-height
governance sources, reconciles approved plans and revisions, separates execution
height H from the committed halt anchor H-1, and freezes closure. Its synthetic
tests cover duplicate reads, unsupported messages, cancellations, source disagreement,
baseline changes, early completion, deadline boundaries and late records.

`scripts/juno_upgrade_state.py` supplies a private, atomic, locked event store:
concurrent updates re-read under the lock, crash-before-replace retains the prior
checkpoint, and stale workers cannot replace closed events or change anchors.

Next, connect bounded/paginated chain transport,
pre-restart consensus capture and the existing Community Tools publication path.
The lifecycle/store modules do not fetch, schedule or publish by themselves. Its `complete` input
must be set only after complete bounded pagination; truncated or failed reads are
not cancellation evidence. Do not add a timer until the full acceptance below passes.

Required behavior:

1. A lightweight recurring Juno-mainnet proposal watcher detects actual software-
   upgrade proposal messages, including their proposal ID, status, plan name and
   scheduled block height. Use chain-provided upgrade identity/version, not guessed
   sequential version numbers or proposal-title keyword matching. Deduplicate
   repeated reads and revisions so each upgrade gets one permanent page and one
   Community Tools index entry. Create the upcoming/proposed entry automatically
   when discovered, clearly labelled with its current governance state.
2. Confirm proposal passage and the active on-chain upgrade plan before calling
   the upgrade scheduled. Reconcile changed heights/plans, rejected or failed
   proposals and cancellations; an unapproved or cancelled proposal must not start
   active upgrade monitoring. Keep its status explicit without replacing an older
   upgrade's archive.
3. Prepare collection before the scheduled height so pre-restart consensus votes
   are captured rather than recovered afterwards. Anchor the observation window
   to the confirmed timestamp of the actual upgrade-halt block, as for v31; an ETA
   or proposal submission time is not the start. Preserve first-vote and first-
   included-block-signature evidence separately, with source/capture timestamps.
4. Observe for **at most five hours after the halt**. **Stop early once all
   validators in the upgrade validator set are confirmed participating and the
   chain has resumed.** For a robust automatic completion criterion, require a
   canonical post-upgrade block signature for every baseline validator, cross-
   checked by the independent providers. Never infer all-ready from voting-power
   quorum alone, an empty live round, a changing validator denominator, missing
   data or one provider. Early votes may establish earlier participation times,
   but do not replace the all-validator completion check. Installed software
   versions and exact readiness times remain outside the tracker's evidence.
5. At closure, freeze that event's result, stop its collector and browser polling,
   and publish the archived page automatically. Show whether it ended because all
   validators were evidenced or because five hours elapsed. At the deadline,
   validators without saved participation in the window receive the v31-style
   **“No upgrade evidenced within 5h”** note. Do not label early-completed events
   as a five-hour timeout. If coverage is incomplete, state it instead of making
   an unsupported five-hour absence claim. Retain raw evidence and exclude later
   records from the closed result, as demonstrated by v31's late 0base.vc record.
6. Persist event identity, halt anchor, deadline, scan watermark and closure reason
   across collector restarts/deploys; keep runs bounded, idempotent and isolated
   per upgrade. A collector must not restart a closed event, extend its deadline
   or overwrite previous archives. A late in-flight writer must respect closure.
   The lightweight proposal watcher continues looking for future upgrades after
   an individual event closes; only that event's active monitoring stops.
7. Acceptance coverage must include repeated proposal reads, governance status
   changes/cancellation, actual halt timing, capture before restart, all-validator
   early completion, the five-hour boundary, partial/disagreeing RPC data, restart
   recovery, and proof that closed pages/collectors make no live requests. Reuse
   the v31 layout and its inspected responsive behavior; publish real data only.

This requirement is an authorization/design direction for the next tracker
implementation, not evidence of an installed recurring watcher. The previously
agreed DAO messaging work and deferred personal recovery checks remain in their
own checkpoints below; no wallet signing or new messaging activation is implied.

