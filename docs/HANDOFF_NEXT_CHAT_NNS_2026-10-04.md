# Next chat — NNS Treasury prices and mainnet preparation

Checkpoint updated: **2026-10-05 after PR #158 publication and the internal
security review**. The date in this filename preserves existing links. The owner
requested a new-chat handoff before any deployment transaction.
Read [AGENTS](../AGENTS.md), [root HANDOFF](../HANDOFF.md) and
[CURRENT_STATE](CURRENT_STATE.md); read DESIGN_SYSTEM.md before UI edits.

## Resume here: mainnet deployment, still unsigned

- PR [#158](https://github.com/cristianoneta/neta-dao/pull/158) is merged as
  `62f12f1a0c672a776a5f3500ab4e8e8a09b93e42` and live. All 11 final PR checks,
  three main checks and Pages `37302003843` passed; 15 served files matched.
  [Review evidence](NNS_SECURITY_REVIEW_2026-10-05.md) records 210 passing
  Rust/Node tests and browser flows. This is a targeted internal review, not an
  independent audit. Do not repeat this work just to reconstruct chat context.
- At 12:54 Berlin the owner confirmed **nothing had been uploaded or signed**;
  only the old registry-upload review was displayed. No recovery/redeployment is
  needed. No production contract/code IDs or wallet receipts have been recorded.
- Selected wallet: `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`.
  It initially holds **both Wasm upgrade rights and registry administration**
  (tariffs, pause, price-key rotation). The main NETA DAO only receives name fees.
  Later transfers require separate `MsgUpdateAdmin` actions for each contract
  and registry `set_admin` for application authority, plus updated verified pins.
  No transfer or removal of upgrade authority is authorized now.
- Force-reload (Ctrl+F5) [the deployment page](https://dao.netareborn.com/names-mainnet-deploy.html),
  discard the old unsent review, connect wallet …57, then individually review and
  confirm registry upload → registry creation → profile upload → profile creation.
  Each action uses real JUNO gas shown in Keplr; deployment sends no NETA.
  Use **Verify and download public receipts** and provide the public
  `nns-mainnet-deployment-receipts.json`. Preserve site data and journals.
- Registry **v0.3.1**: `assets/names-mainnet/neta_names_v2_v031.wasm`, SHA-256
  `f25c982db217363c395a1c09c3028988cff390323b0aa852249016bbebe974fc`.
  The old review hash `821f85a345adf68e3323315a0220286046c88d30c92c4e296afcfe7414bdea71`
  belongs to preserved v0.3.0, not the new deployment target. Profiles stay at
  `assets/names-testnet/neta_validator_profiles.wasm`, SHA-256
  `9d47676d8dd0040b1cea4a39a3e8c95a75ea4841cd5b2eb5feb83c7f4516ceed`.
- Registry starts **paused**, initially USD **99 / 19 / 5** annually for
  3 / 4 / 5–32 characters. Mainnet purchases follow the verified current tariff,
  so the owner can adjust prices later. Historical UNI-7 code stays unchanged.
- Public price key is already pinned:
  `XfqS2XMXgZKJ5fiU721D3XsuhPas+4U1idUujcintdU=`. Do not regenerate it.
  Private backup custody and owner installation of `NNS_PRICE_SIGNING_KEY` in
  GitHub Actions remain **unconfirmed**. Never request the private key in chat.
- Reuse existing Treasury WYND prices: the existing job targets minutes 7/37;
  signed observations expire within 24 hours of the original observation.
  Ordinary deviations and authentic older prices until expiry are accepted.
  **No new Render NNS service**, price polling or on-chain price-update job.
- After receiving receipts, independently verify chain/code/config/admins and
  publish `docs/deployments/nns-mainnet.json` (version 3). It does not yet exist;
  the dated unsigned plan is not a deployment receipt or production manifest.
  Confirm secret installation, verify the public signed price and mainnet UI
  while paused, then prepare a separate owner-reviewed unpause and real purchase.
  There is **no dedicated mainnet owner tariff/unpause panel yet**: contract
  authority and unsigned helpers exist. Do not claim the deployment page activates
  purchases or that a DAO proposal is needed for current owner administration.

The owning procedure is [names/README](../names/README.md). Missing production
manifest or failed verification keeps mainnet operations unavailable. Real mainnet
purchase and consenting-validator E2E remain open; validator testing is deferred.
The existing UNI-7 deployment, completed lifecycle and original local authority
must be preserved. The sections below are dated UNI-7 evidence, not another
mainnet setup sequence; its original admin wallet differs from mainnet wallet …57.

## UNI-7 owner update — 2026-10-05

Live validator testing is paused until later at the owner's request.
Approved annual registration AND renewal tariffs are now **USD 99 / 19 / 5** for
3 / 4 / 5–32 characters, paid in NETA. The lab's Annual pricing section reads the
actual config and provides an admin-only reviewed `set_tariff` action with the
current expected version, durable intent journal and exact-receipt recovery.
Use the existing manifest and setup admin `juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt`,
not the second wallet that owns cristiano.neta. One explicit UNI-7 Keplr transaction
is needed; the public source/UI change alone does not change the deployed tariff.
No receipt for that update has been recorded yet. Verify config before continuing.

The existing source/WASM bootstrap tariff and signed historical fixtures retain
640/160/5 for reproducibility. Do not replace deployed code, artifact hashes or
old receipts. New UNI-7 installations using the historical artifact must apply the approved
tariff via the same admin action before testing purchases. Mainnet v0.3.1 already
starts with 99/19/5 while paused. Test quotes always use the **on-chain** tariff
and version, never a UI override. A tariff version change invalidates old quotes;
existing name ownership/expiry and standard-name pricing remain unchanged.

PR #149 read-only validator diagnostic is live: all three PR checks and both main
checks passed; Pages 37277629958 succeeded, and all four public HTML/module files
matched. Screenshots at 320/390/768/1440 px were inspected. Real operator E2E remains
open, and direct live REST calls from the execution environment returned 403.

## Main-page continuation — 2026-10-05

The normal RELAY name/profile pages reuse the existing UNI-7 deployment, shared
header wallet, reader/client and persistent journals. Registration, renewal,
transfer and public contacts have main-page controls and explicit reviews. Start
with UNI-7 selected and Read registry and Load my name; do not repeat setup or the completed
purchases/transfer. Test quotes still use the original browser's saved authority.
The integration tests simulate chain/wallet adapters; an owner check of this new
UI is pending. Real validator testing remains deferred. The owner subsequently
selected WYND for NETA pricing, reconfirmed the tariff and requested moving to
mainnet. The current browser key and deployment runbook is [names/README](../names/README.md).
The later owner decision replaces that service with shared signed Treasury prices;
see the root handoff for the current key/deployment sequence. No mainnet contract
address or activation is recorded.

## Current owner state and completed tests

The setup recovery is resolved: the owner exported and used the verified manifest.
Do not repeat deployment, activation, registration or payment. The name has been
transferred to the second wallet; reconnect that wallet for name-owner actions.

Current name owner: `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`.
Former name owner and unchanged setup admin/treasury:
`juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt`.

The owner signed these flows. Read-only NodesHub queries checked resulting state;
latest block reads were concurrent, not height-pinning each smart query.

| Test | Observed state | Latest UNI-7 block read |
| --- | --- | --- |
| Registration | `cristiano.neta`, former owner, generation 1 / ownership revision 1, expires_at=1822677341 | 18540940 at 19:17:07 UTC |
| Public contacts | Profile revision 1, description and website populated; remaining fields empty | 18541230 at 19:29:29 UTC |
| One-year renewal | expires_at=1854213341, exactly 31,536,000 seconds added | 18541305 at 19:32:41 UTC |
| Transfer offer | Offer ID 1 to second wallet, former owner still held name | 18541406 at 19:36:57 UTC |
| Accepted transfer | New owner, ownership revision 2, old name_of=null, new name_of=cristiano.neta, offer=null | 18541478 at 19:39:59 UTC |
| Profile invalidation | New owner identity, profile revision 2, all visible contacts empty, updated_at=0 | 18541478 at 19:39:59 UTC |

Expiry is 2028-10-03T19:15:41Z: contract years are 365 days, not calendar years.
Historical profile data remain on-chain; invalidation is not historical deletion.
Contact values are intentionally omitted from this handoff. Confirmed reservation
hash pasted by owner: `A1BBE04F166B3E443BD665A8A82367700950A7F6B3CD489701575C666F3FDC0C`.
Exact registration/profile/renewal/offer/accept receipts still need archival; the
table is post-state evidence, not a claim that their exact bytes were reverified here.

## Independent chain observations — 2026-10-05

The lab now has **Check entered validators**, usable without a manifest or wallet.
**Read current link** also checks the stored pair after reading its profile. The
new reader verifies fresh chain headers and exact operator records, then compares
the UNI-7 consensus public key with every page of the set at the displayed height.
Mainnet existence does not require active-mainnet membership. Bonded staking status
is never substituted for actual consensus membership. Failed, stale, malformed or
incomplete data remain explicitly unavailable; these observations award no points.

Sources are pinned public REST providers (Polkachu/STAVR for mainnet, NodesHub/STAVR
for UNI-7). Records use latest staking state, while consensus pages share a fixed
height. This is not a coherent historical programme snapshot or light-client proof.
Each provider attempt is bounded to 15 seconds and 2 MB per response; no background
polling or wallet writes are added. Input/manifest changes cancel pending reads.
Protocol source: Cosmos SDK `proto/cosmos/base/tendermint/v1beta1/query.proto`.
Local tests: 91 root Node tests passed, including wrong-chain/stale/not-found,
malformed records, complete consensus pagination, fallback and cancellation.
Browser CI additionally exercises wallet-free checks, inactive/unavailable states,
existing ownership writes and responsive layouts. Real operator E2E stays open.
Live chain requests from the execution environment were blocked with HTTP 403;
no successful live validator observation is claimed from those attempts.

## Current implementation and next action

The validator continuation adds a separate section in names-v2-lab.html:
prepare a contract-matched challenge, explicitly sign mainnet and UNI-7 ownership
one at a time, reconnect the name owner, review and publish through the existing
journaled UNI-7 transaction bridge. The name owner may be a third account.
Unpublished consent proofs remain in tab memory across deliberate wallet switches;
reload discards them, not pending transaction records. Proofs expire within nine
minutes. Wallet changes during signing, changed ownership/revision/deployment,
wrong challenges and duplicate active bindings fail closed.

Owner unlink and unilateral operator revocation have separate reviews. Either
operator can withdraw consent; any connected UNI-7 wallet can pay that revocation's
gas. The name owner cannot veto a valid operator revocation. Public-contact data
and registry ownership are not changed by unlink/revoke.

Read current link queries the profile contract. A stored operator-key link alone does
not prove validator existence or active-set membership and does not award points.
The separate read-only observation above reports available public-chain evidence.
No validator has been recruited or contacted. Real validator link/unlink/revoke
E2E remains outstanding. Tests use synthetic wallets/signatures/adapters; they
are not evidence of a consenting operator or live validator publication.

1. Fetch fresh main and check current deployment health. PR #145 release checks
   already passed; published lab v5 uses reader/wallet v4 and client v2.
2. Retain the same browser/site data and manifest. For name-owner link publication,
   use the second wallet that now owns cristiano.neta.
3. Test with a consenting operator who controls both actual validators and an
   active test name in their own browser/Keplr. Proofs stay in one tab; this UI
   does not exchange signatures between remote people. Do not share wallets or
   keys to link the current owner's name. No seeds/private/consensus keys are needed.
4. Verify publication, both exclusive bindings, owner unlink and unilateral
   operator revocation with exact receipts and post-state.
5. Only then consume links alongside validated mainnet/testnet validator records
   and active UNI-7 consensus membership in the delegation snapshot.

Mainnet registry constants remain null. Production pricing, service custody and
mainnet launch are separate gates. Keep Smart Delegation research deferred.

## Validator UI release — PR #145

Merged as `50c5814e048230507a1d03c3e7c8c03f97b537ee`; final PR head
`65abd6514bd3bac94cb4238d4fcde0c15458c969`. PR browser run 37230272454,
contract/frontend 37230272470 and faucet 37230272450 succeeded. Main runs
37230567986 and 37230567917, plus Pages 37230567543, succeeded.
All eight changed public assets matched after publication. 84 root Node tests
passed; browser integration covers explicit signatures/publication/unlink/revoke,
wallet switching and late-connect rejection. Screenshots at 320/390/768/1440 px
were inspected. Tests use synthetic chain/wallet adapters, not operator consent.
A read-only deployed-contract challenge matched client text and derived signers;
this was not a live validator write. Full evidence: [PR #145](https://github.com/cristianoneta/neta-dao/pull/145).

## Profile review release — PR #144

Fixed the owner-reported empty profile preview by reading FormData before busy
render disabled inputs. PR/main tests and browser regression passed. Merge
c50ec80e20364069d3efd50c8c531499c411ff2f; Pages run 37228164284 succeeded;
all four changed public UI files matched after publication. Profile publication
was then confirmed by the owner test above. The main fee field accepts a bare
label and strips a valid pasted suffix; DESIGN_SYSTEM records this convention.

## Existing deployment and exact receipts

Network: `uni-7`. Owner/admin/test treasury:
`juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt`.
Canonical public manifest: [nns-uni7-owner-2026-10-04.json](deployments/nns-uni7-owner-2026-10-04.json).

| Role | Code | Contract |
| --- | --- | --- |
| Mock token | 122 | `juno1gcpuzmtetez6mf9tnuk3ua7pwe933pzeqr7ac5jl235au8ls38jsuuf2js` |
| Registry | 123 | `juno186sudtyc6sfwfhs77uj6dnsmgf7sl9774slycavxmmfakhmhxans6f64x7` |
| Profiles | 124 | `juno1rch3ut6r5ht3l94nw9yptdv3lg9fjhafnax5udz6dqzxe8lt6u8qhtmjvp` |

All seven receipts were confirmed with success code 0 in this session:

| Action | UNI-7 height | Transaction |
| --- | --- | --- |
| Upload token | 18538759 | `ABE19AD1FD53CDF4EB95F79E81ADB93E6454507634D0400CF56C5130E12C1E5B` |
| Instantiate token | 18538887 | `D01F03275DA527BB5752B4B7519CEBCFDB5FEC4A4BA0A2A924BD854077756BD7` |
| Upload registry | 18538946 | `79A7FEC83E5678CBC0DD406C2044876C852C588C433341B04044463456C5C43E` |
| Instantiate registry | 18538982 | `BA6DE6E887AB312CD9D4B48F0AD81CC323D5D3DA1CA96DB8B38A3649F41B8D15` |
| Upload profiles | 18538991 | `07F30BBAD8459190499FB37B61CEAC544118B79AC050CC856AF6FABF24865519` |
| Instantiate profiles | 18539030 | `95B19217AF74C573292493F4C89855C56D75F49A9D18A92C94DFB5BDAA3C54E5` |
| Activate purchases | 18539039 | `3A33D74BE3F1F1C059D22FF19D0E3D131F1100EC3CC6A1BEB84D904E03BB9853` |

Verified post-state: purchases_paused=false, testnet_only=true, correct token,
treasury/admin and quote key, six-decimal mock token, correct profiles registry,
expected code hashes/creators, and no contract migration admins. Quote public key:
`ykjbKyZDRBtP+xPszShTLhN3LA2wehDyRE7mEgjnyjw=`. Signer/tariff versions: 1.
The private quote key remains in this browser's IndexedDB, separate from Keplr.
Mock supply is 1,000,000 TNETA, fixed, no minter; quote rate is fictional USD 2.
Mainnet deployment constants remain null; no production price service is ready.

## Released corrections and validation evidence

- PR #139 shipped registry/profiles contracts, Keplr setup/lab, durable recovery,
  browser-local quotes and three WASMs checked against all seven contract builds.
- PR #140 fixed illegal native-fetch receiver binding and added network diagnostics.
  Merge: a27179925533760bd1fe5e8421112fe9509f9d96. Published assets verified.
- PR #141 submits once, then checks indexed providers independently by exact signed
  hash/bytes/protobuf intent. NodesHub accepts broadcast but disables tx indexing.
  Unknown receipts remain locked; there is no automatic resign/resend. Merge:
  8ab94ce86219b1dd88e3d0e0457be068a814d212. 47 local signing/faucet tests passed;
  PR/main checks and Pages succeeded, and deployed signing bundle/pages matched.
- PR #142 accepts valid upper/mixed/lowercase 64-character hex code digests and
  canonical base64, normalizes hex for pinned comparison, and still rejects wrong
  or malformed digests. Real WASM hashes replace all-digit test fixtures. Twenty
  targeted tests passed; the old error was reproduced before the fix and the live
  full deployment verification passed afterward. Merge:
  8b4f450cc6e333341deeb5c3f5a22185bcbb6f8f. PR runs 37222634755, 37222634790,
  37222634759 succeeded; main runs 37222760872, 37222760885 and Pages 37222760258
  succeeded. All seven changed public assets matched the reviewed files after
  publication. This is release evidence, not proof of owner-browser recovery.

## Decisions and deferred work

- A valid .neta name is required only for testnet bonus points. Other delegation
  criteria do not require buying a name.
- Active UNI-7 set at the snapshot earns full testnet points initially, without
  another uptime requirement. Multiple linked validators do not multiply points.
- Mainnet and testnet operator addresses/chain IDs require separate ownership
  signatures; never infer a shared key from an address or allow duplicate claims.
- Discord, Telegram, X/Twitter, email and homepage are optional public contacts.
  Verified validator linkage does not verify those contact details.
- Expiry affects future bonus eligibility, not automatic reversal of approved
  delegations. Mainnet launch and production pricing remain future work.
- [Smart Delegation research](SMART_DELEGATION_RESEARCH.md) retains original C4E
  proposals, archived app documentation/public policy/terms, talk and sensor code.
  User explicitly deferred this until NNS tests progress. Concepts may inspire
  future work; full-app source/license is not established. No research suggestion
  overrides existing policy decisions.
- The requested two-monster Halloween GIF was delivered separately as
  `pepe-frankenstein-delegation-programme.gif`; it is not a deployed website asset.
- Earlier faucet payout/restart/cooldown, fresh-wallet and unstake evidence gates
  remain in HANDOFF_NEXT_CHAT_FAUCET_2026-10-04.md; this session did not complete them.

## Workspace continuity

Use fresh GitHub main and current CI, preserve bot Treasury/member snapshots, and
work through branches/PRs. Inspect existing worktrees before touching them;
previous changes may already be published through GitHub Git Data APIs. Local
workspace paths are temporary and are not the source of truth for continuation.
Local dirtiness does not imply missing remote changes. Never request seeds/private
keys, erase pending journals or enable mainnet messaging while fixing testnet UI.

Suggested next-chat prompt:

> Continue NNS from current main. Read AGENTS, HANDOFF, CURRENT_STATE and
> names/README.md. The owner approved Treasury-based shared signed price snapshots
> with 24-hour validity, no separate Render service. Preserve the existing UNI-7
> contracts and completed lifecycle tests. Check current PR/CI and the snapshot
> checkpoint, then continue key setup and reviewed mainnet preparation. Validator
> tests remain deferred; no purchase activation without the wallet/DAO receipts.
