# Next chat — NNS UNI-7 validator ownership

Checkpoint: 2026-10-04, continuation after the 21:40 Europe/Berlin owner tests.
Read AGENTS.md, HANDOFF.md and CURRENT_STATE.md; read DESIGN_SYSTEM.md before
UI edits. This records observed session state, not a future chain attestation.

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

Read current link queries the profile contract. A stored operator-key link does
not prove validator existence or active-set membership and does not award points.
No validator has been recruited or contacted. Real validator link/unlink/revoke
E2E remains outstanding. Tests use synthetic wallets/signatures/adapters; they
are not evidence of a consenting operator or live validator publication.

1. Verify this continuation's final PR checks and published lab v5 (reader/wallet
   v4, client v2) before proceeding in a future session.
2. Retain the same browser/site data and manifest. For name-owner link publication,
   use the second wallet that now owns cristiano.neta.
3. Test the new UI with an operator who controls both actual validators, signing
   in their own Keplr. Never request seeds, private keys or consensus/node keys.
4. Verify publication, both exclusive bindings, owner unlink and unilateral
   operator revocation with exact receipts and post-state.
5. Only then consume links alongside validated mainnet/testnet validator records
   and active UNI-7 consensus membership in the delegation snapshot.

Mainnet registry constants remain null. Production pricing, service custody and
mainnet launch are separate gates. Keep Smart Delegation research deferred.

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
work through branches/PRs. Do not reset existing dirty worktrees: neta-dao,
neta-nns-confirm and neta-nns-checksum contain work already published via GitHub
Git Data APIs. This documentation was assembled separately in neta-handoff.
Local dirtiness does not imply missing remote changes. Never request seeds/private
keys, erase pending journals or enable mainnet messaging while fixing testnet UI.

Suggested next-chat prompt:

> Continue NNS validator ownership testing from current GitHub main. Read AGENTS,
> HANDOFF, CURRENT_STATE and the NNS next-chat handoff. Registration, contacts,
> renewal and two-wallet transfer were checked on UNI-7. cristiano.neta now belongs
> to juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57 and has an empty current profile.
> Do not repeat those transactions. Verify the validator UI release and finish
> consenting-operator link/unlink/revocation E2E. Keep mainnet purchases disabled.
