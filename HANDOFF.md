# NETA DAO handoff

Updated 7 October 2026. Read [CURRENT_STATE](docs/CURRENT_STATE.md) for the only
current feature/deployment/evidence matrix. [Release procedure](docs/RELEASES.md)
and [review remediation](docs/REPO_REMEDIATION_2026-10-07.md) own this cleanup's evidence.

## Next work

1. Finish review-remediation CI and publish the reviewed source/backend together.
   Keep the existing Render service, disk, Faucet identity and two admitted wallets.
   Public Inbox pins stay null. Record actual deployment SHAs; source is not deployment.
2. Hosted backup durability: use an isolated test identity and off-service export,
   restart and isolated restore. The local drill is not hosted evidence. Existing
   user backups and recovery codes must not be read or replaced.
3. Continue DAO multi-recipient recovery, authenticated history/cursors and prekey
   lifecycle, then the reviewed direct-mainnet DAO pilot. DAO receiving is opt-in,
   with one shared conversation and a compact Inbox selector. Code 5170 has DAO
   writes disabled; deployment/migration requires reviewed wallet/governance actions.
4. Payment requests, invoices, milestone evidence and Treasury/proposal linkage follow.
5. Automatic future Juno-upgrade tracking remains planned. Requirements are retained
   in [the dedicated specification](docs/JUNO_UPGRADE_AUTOMATION.md); v31 stays closed.

## Preserved decisions

- Both personal devices are registered; user-confirmed send/read/reload passed.
  Fresh-browser restore/rotation was explicitly deferred. Do not repeatedly request it.
- NNS: 3 characters $99/year, 4 $19, 5+ $5. Owner controls upgrades/tariffs/pause/key
  rotation; fees go to the main DAO. Keep the approved 24-hour signed snapshot policy.
- Never erase pending transaction/crypto journals, silently rotate keys, automatically
  resubmit uncertain transactions, change payout limits or enable public messaging.
- No new paid service or plan upgrade. Separate backup before expanding beyond ten
  pilot wallets, or earlier if contention requires it.
- Do not restart v31 collection or turn missing signatures into software-version claims.

Earlier chronology: [archived handoff](docs/archive/repo-review-2026-10-07/HANDOFF.md).
Update this file in place; put release evidence in its own dated record.
