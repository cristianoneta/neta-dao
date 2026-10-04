# Next chat — NNS UNI-7 owner test

## Profile review correction — 2026-10-04 continuation

The owner reached public-profile review, but all six fields appeared empty.
The lab called run(), which disabled the contact controls before FormData read
those controls; browsers omit disabled controls. Snapshot the name and form values
before entering the busy state. Normalization, owner/revision checks, explicit
Keplr confirmation and edit-to-invalidate behavior remain intact. Lab module URL
is v4. A real-browser regression fills all six fields, checks the reviewed values,
changes/reviews again and checks the arguments at the mocked publication boundary;
it also covers intentional blanks and invalid email. No real profile write is
claimed. Discard the old empty review; after publication reload without clearing
site data, verify the same manifest, reconnect, re-enter public fields and review.
PR #144 carries this correction with the earlier label-entry improvement. Check
its final CI and deployment before asking the owner to retry.

Checkpoint: 2026-10-04, 21:00 Europe/Berlin. Read AGENTS.md, HANDOFF.md and
CURRENT_STATE.md; read DESIGN_SYSTEM.md before UI changes. This file records
session evidence, not a fresh chain attestation at the time of a future read.

## Confirmed registration — 2026-10-04, 21:17 Europe/Berlin

Fresh read-only NodesHub queries returned `cristiano.neta` owned by the existing
owner wallet `juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt` in both `identity`
and `name_of`. Generation=1, ownership_revision=1, expires_at=1822677341.
The concurrently read UNI-7 latest block was 18540940 at
2026-10-04T19:17:07.391578106Z; smart queries were latest-state, not height-pinned.
This verifies current registered ownership through the configured provider, not
an exact payment receipt. The payment hash/inclusion remains to be recorded.
The owner previously pasted the confirmed reservation hash
`A1BBE04F166B3E443BD665A8A82367700950A7F6B3CD489701575C666F3FDC0C`
and a verified manifest/test-purchases-enabled lab status. The earlier setup
recovery blocker is superseded by this owner evidence and completed registration.
Next: optional public contact publication, then renewal and two-wallet transfer/
acceptance and old-profile invalidation. These later live tests remain unverified.
Do not repeat setup, reservation or registration. Keep signer and journals intact.

## Owner update — continuation at 21:06–21:11 Europe/Berlin

The owner reports saving the verified manifest, then believes both reservation
and payment for `cristiano.neta` were completed. Read-only NodesHub queries around UNI-7 height 18540830 subsequently returned:
`identity(cristiano.neta)` not found; `name_of(owner)` name=null; the owner has
a commitment at height 18540760, hash
`aeb505d87f846c786e56196ef5a0ae688865055c4f3597e3b3b6fb0e95346b33`,
expires_at=1791144568. A commitment does not disclose the reserved name.
Registration was not complete at this query. Inspect the lab transaction status
before asking for payment again; any pending payment must be recovered first.
The name-entry decision is now recorded in DESIGN_SYSTEM.md: label-only entry
with a fixed suffix; accept full-name paste without displaying a duplicate suffix.

## Immediate priority and unresolved owner state

All seven setup transactions succeeded. The test registry is already activated.
The corrected reader verified the full deployment at UNI-7 height 18539107.
However, the latest owner-pasted screen still says `Invalid code checksum` from
both NodesHub and STAVR, and `unpause · registry · confirmation pending`.
The owner asked whether to click Check pending transaction. We advised a hard
reload, Prepare test signer, Connect Keplr, then Check pending transaction.
No subsequent successful browser recovery or manifest export was reported.

Do not call this solved in the owner's browser, do not assume caching is proven,
and do not ask for another activation. Preserve all pending journals and site
data, including the non-exportable local quote key. Never clear locks by hand.

1. Resume https://dao.netareborn.com/names-v2-setup.html in the same browser.
2. Hard reload without clearing storage. Prepare the existing signer, reconnect
   the same wallet, then Check pending transaction. The exact activation hash is
   in the receipt table below if the optional recovery field is needed.
3. If checksum failure persists, inspect loaded `names-v2-reader.mjs` and dependent
   module version 3, actual response encoding and pinned manifest. Hex casing
   normalization must remain strict; never bypass checksum/identity verification.
4. Save verified manifest after successful recovery. Open
   https://dao.netareborn.com/names-v2-lab.html, import it, Verify deployment,
   then Connect Keplr. The public manifest in the repository is a reference, not
   a substitute for resolving the pending transaction journal.
5. Prepare a name (e.g. cristiano.neta if available), reserve it in Keplr, then
   create/review the local quote and explicitly confirm payment. Each action is
   separate. Record exact hashes, inclusion/code and resulting name ownership.
6. Test optional public contact persistence, renewal, a two-wallet transfer and
   acceptance, and invalidation of the previous owner's public profile.
7. Finish the operator-proof collection/submission UI and test with a consenting
   operator controlling both mainnet and UNI-7 validators. Cristiano does not run
   a validator; no volunteer has been recruited or contacted.

Steps 5–7 have no completed live-test evidence. Local/mocked tests are not proof
of those chain operations. Wallet signatures and transactions remain owner actions.

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
work through branches/PRs. Do not reset existing dirty worktrees: neta-dao,
neta-nns-confirm and neta-nns-checksum contain work already published via GitHub
Git Data APIs. This documentation was assembled separately in neta-handoff.
Local dirtiness does not imply missing remote changes. Never request seeds/private
keys, erase pending journals or enable mainnet messaging while fixing testnet UI.

Suggested next-chat prompt:

> Continue NETA DAO NNS UNI-7 testing. Read AGENTS.md, HANDOFF.md,
> docs/CURRENT_STATE.md and docs/HANDOFF_NEXT_CHAT_NNS_2026-10-04.md from current
> GitHub main. All seven setup transactions succeeded, but owner-browser recovery
> of the activation/checksum error is unconfirmed. Resolve that first without
> redeployment, duplicate activation or deleting browser data, then guide the
> first name registration and profile tests. Keep Smart Delegation research deferred.
