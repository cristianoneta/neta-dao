# Verified security continuation — 2026-10-03 UTC

This checkpoint supersedes the earlier pending-PR handoff snapshots. Recheck current
GitHub state before further integration; preserve subsequent data-bot commits.

## Integration evidence

| PR | Merge commit | Relevant final checks |
| --- | --- | --- |
| #100 | `c99ac99419d50ff35042fe71aec4c0ceed070572` | Contract/frontend 137; RELAY browser 32 |
| #101 | `bc7fb520cbb9626684ba04262b7a42835b497681` | RELAY browser 34 |
| #102 | `0bc53fb93fe95b07cb05e93563f6705624d9558d` | Contract/frontend 139; all four WASM build jobs in run 22 |
| #103 | `9ee6cdf362d99538ec19cd5c13249cc22c291610` | [Contract/frontend 147](https://github.com/cristianoneta/neta-dao/actions/runs/37110056510); [RELAY browser 41](https://github.com/cristianoneta/neta-dao/actions/runs/37110056522) |

All listed checks passed before merge. [Main push contract/frontend run 148](https://github.com/cristianoneta/neta-dao/actions/runs/37110369052) also passed after #103 was integrated. Website #137 and #138 also merged after
their relevant website and production-data checks passed. Website main push 312,
Pages 1122 and freshness 426 passed. Its bot commit `6faa4443a91227ac1705d385818772f20b902894`
was preserved. DAO Treasury run 933 and Pages 1028 passed before #103; bot commit
`aa412d3c75615f706d145e68f2369b06af884a0e` was preserved by the normal merge.

[DAO Pages 1029](https://github.com/cristianoneta/neta-dao/actions/runs/37110368736)
passed for #103's merge. Served governance controller, lab controller, archive,
checkpoint and shared signing bundle were compared byte-for-byte to checked output.
Index loads governance v27/shared v6; lab loads controller v3/shared v5.
Shared signing bundle SHA256:
`36142004f8f0d7be95cda49be573de2ef45acb3c5e6f7163757239af5f3ab917`.

## Implemented and tested

- Local transactional receive captures encrypted ratchet storage before receive,
  validates authenticated envelope inside the crypto transaction, and commits
  ratchet/archive coherently. Invalid ciphertext restores/quarantines and advances
  the cursor without a persistent whole-device lock. Interrupted archive writes
  recover on unlock. New archive IDs bind chain, contract, sender and generations.
- Adversarial isolated browser coverage exercises malformed ciphertext, colliding
  message IDs from different senders, subsequent valid receive, reload, interruption
  after ratchet commit and wallet change while archive completion is suspended.
  Device lock stays held until durable completion/recoverable interruption.
- Existing same-generation sessions do not demand an unused prekey for every follow-up.
  Contract v0.2 source requires recipient consent bound to both generations and
  allows only one initial per approved pair/generation. Tests include twenty rotating
  unapproved attackers, unauthorized consent, rotation and historical identity.
- Shared execute signing persists public signed bytes/hash/sequence before broadcast.
  Unknown outcomes survive reload and prevent repeated signing. Exact-hash inclusion
  reconciliation is tested using the actual generated bundle. The guarantee is
  browser/origin-local; there is no auto reset or rebroadcast.
- Moderation-hidden comments replace body/title and disable reply. Invalid/self/forward
  parents are normalized, descendant counting is iterative and rendering depth bounded.
  Native pagination remains bounded; legacy revision APIs have no cursor and explicitly
  warn when a one-shot result may truncate.
- Treasury events verify chain and block anchors, stop before the current tip, overlap
  incremental scans, reject reorg/stale/truncated required index data and retain
  previous records. Seven address searches use three workers. Height ranges are used
  only when the selected index supports them; Juno publicnode rejects ranges and
  therefore uses full replay. Unresolved optional Osmosis legacy index gaps remain
  explicit in source metadata; required Juno history loss fails publication.
  Sixteen collector/history unit tests passed.

## Live collector evidence and limitations

A read-only collection with the preceding implementation retained all 57 cached events
and verified anchors. Final-source repeat attempts timed out in external RPC
blockhash requests (including the final anchor check); they failed closed without
writing generated exports. This is not a successful final-source live collector run.
This historical failure is superseded by successful scheduled run 934 below;
it remains evidence that external RPC availability can vary. No generated JSON was
hand-edited and no cached history was deleted.

## Mainnet release gates remain closed

The pinned live mailbox is still v0.1. #102's new v0.2 source was built and audited,
but no contract was instantiated/migrated, no pin was changed and no chain write was made.

Remaining blockers:

1. Verify a new UNI-7 v0.2 deployment and integrate consent/refill UX with generation-aware
   historical session resolution; perform the rotation/exhaustion/adversarial matrix.
2. Define and implement automatic off-device encrypted backup, authenticated provider,
   versioning/synchronization and anti-rollback policy. Fresh-profile restore must
   coherently restore ratchet, archive, outbox and descriptor. Current recovery is
   local interruption recovery, not loss-of-browser/device recovery.
3. Resolve legacy pending archive intents without checkpoints and interrupted outbound
   states through verified reconciliation. Never discard pending state to enable signing.
4. Keep origin/device limitations of broadcast journals explicit. Manually cleared
   storage, another domain/device, interrupted signing and permanent CheckTx rejection
   require investigation; upload/instantiate paths are outside this execute adapter.

Mainnet messaging stays disabled. No real wallet key or live attack transaction was used.

## Resumed closure verification — 2026-10-03

The interrupted session had already merged documentation PRs DAO #104 (08:44 UTC)
and Website #139 (08:39 UTC). All final checks on DAO #100–#103 and Website
#137/#138 were re-read through GitHub: applicable test/build/collector jobs succeeded.
Website PR deploy jobs were intentionally skipped; post-merge Pages runs succeeded.
No remaining security PR was found open. Audit branches are historical integrated
work; do not merge/reapply them again or reset later bot snapshots.

Latest publication evidence at resumption: [DAO Pages 1031](https://github.com/cristianoneta/neta-dao/actions/runs/37110860079)
deployed bot commit `11fa3c1ff447ed1722e78ba8bb310f23d384019a`;
[Website Pages 1123](https://github.com/cristianoneta/neta-website/actions/runs/37110457625)
deployed `9eebb50a5c517e15b34a901b7b7e61c0d140a8bc`. Both passed.

[Treasury 934](https://github.com/cristianoneta/neta-dao/actions/runs/37110836725)
checked out `f76bbab87325b80ae55e61c73519cb6c8ed5fb9d` and completed both
collection steps and publication. It retained 57 events (28 cross-chain commands,
5 proposal executions, 10 inflows, 14 payments), with 47 indexed Juno transactions.
Juno anchor height: 42320096; Osmosis anchor height: 71815297. Both selected RPCs
reported no range support, so this proves successful full-replay fallback, not a
live incremental scan. Three previously cached Osmosis TXs were absent from its
current index; they remain retained with coverage warnings. Balance snapshots are
PARTIAL because some assets are unpriced; USD totals are not complete valuations.

Public HTTPS GETs returned HTTP 200 and byte-for-byte equality against checked
GitHub files for the following assets. No wallet transaction or contract deployment
was performed. This is publication evidence, not a fresh on-chain security audit.

| File | SHA-256 of served bytes |
| --- | --- |
| `index.html` | `c3bdafcde70d286a28e3241cb3f09be5faa38475beb489767f243bf400d5001b` |
| `relay-uni7-lab.html` | `ac78012873aea01dcdc009e81818ec22d955577ad703af81216c9711b171ac90` |
| `neta-governance.js` | `220280ab0eb4076767d8614fc8848b7c2483191f2b22ea20f20a554f4b989a19` |
| `treasury.js` | `76720475d9f855872226497b6e1f5779e120986dd3202f0a3c1a155bd36c7a25` |
| `names.js` | `d32df7b5a08224ea1c25fbbde70c2ff2fd4211d443d448eeb3696797fca115f8` |
| `relay.js` | `89c697f105e12260247393595c4a2bebe0a60bf4e58a74e16b6444a4e08e91da` |
| `relay-mailbox-status.js` | `02f3fe836bbddb61521cdf801aa4b7f8b301401ad2ade9160a0725426d7f00cd` |
| `relay-uni7-client.mjs` | `95d0e00dd59228dfb9eee90ff01d5e37bd6dee02c0fc0deef4ea1bac19166b5d` |
| `relay-uni7-lab.mjs` | `be8263f1ab1413f548a905263fd23736c55b2413ef495227d6ba21d4445169ac` |
| `relay-uni7-archive.mjs` | `6c3603e2cc27bf52ba006bd6f0bab907fe3084b6961ea14e3bb6b8c6c314fcc6` |
| `relay-uni7-checkpoint.mjs` | `4701993a50f51bd4a437f179069e6f5fe987f10882d6848c62fe2c721ec11294` |
| `assets/socials-testnet-client.js` | `36142004f8f0d7be95cda49be573de2ef45acb3c5e6f7163757239af5f3ab917` |
| `data/treasury/events.json` | `b86e21abebc2ff8b0ac6204da594b2428e7827bff855b51cd42d411562013a7e` |
