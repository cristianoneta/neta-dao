# Juno community review mainnet rollout

10 October 2026. Owner-selected access policy: **at least 1 delegated JUNO;
no NETA requirement**. This is preparation for a controlled two-wallet review
trial, not evidence that the complete governance lifecycle has passed.

## Verified deployment and activation candidate

`juno-review-mainnet-deploy.html` provides owner-reviewed code upload and
instantiation on `juno-1`. Each requires a separate Keplr transaction. The page
uses the existing exact-payload signing bridge, chain/wallet binding, persistent
transaction journal and read-only recovery. Disconnect and reload preserve an
unknown attempt; a new upload must not replace an unresolved one.

The owner and upgrade administrator are both
`juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`. The page displays this custody and
the one-JUNO requirement before either action. Instantiation attaches no funds;
network fees still apply. Use one browser on one production origin throughout
setup; deployment records do not synchronize between devices or origins.

The new workshop v0.3.1 starts **paused**. Setting `minimum_neta_stake` to `0`
skips every external NETA balance query, including instantiation and access
queries. A broken or absent CW20 staking contract cannot block the native-only
mode. The required legacy address fields remain in the schema but are unused
in this mode. Positive NETA thresholds and Operations membership behavior remain.
The separate v0.3.0 UNI-7 artifact and existing instances are unchanged.

The code hash is pinned in `juno-review-mainnet-config.mjs`. CI rebuilds and
compares `assets/review-mainnet/neta_proposal_workshop_v031.wasm` byte for byte.
Before and after signing, the setup checks fresh `juno-1` data. Before accepting
an instance it verifies code checksum, creator, owner, upgrade admin, label and
complete paused policy through Polkachu and Stavr. Exported receipts contain
public transaction and deployment data. The owner completed deployment and
shared the public receipts. Independent verification at 18:22 UTC on 10 October
confirmed exact upload and instantiate transaction bytes, code checksum,
creator/admin/owner, label and complete paused policy through both providers:

- Contract: `juno15wwr9dezyfp86p4px5p664gguargukml3wa9pctw9nutfn2rzk9qwf45gq`
- Code: `5171`; SHA-256: `2974c3de6c5cd2ad71de0ce2af45a50535fc55a79c5e85556923790c6274decf`
- Upload: `A7196F3EB326B368F59327B385016B78AC9553677E77979B6482528A11912F53`, height 42565130.
- Instantiate: `9E61CE32A83EF262188BDC8B114AFBFF50E05F309F1EAC2EAA5BDB84804B32E4`, height 42565156.
- [Public receipts](deployments/juno-review-mainnet-receipts-2026-10-10.json)
  and [independent verification](deployments/juno-review-mainnet-verification-2026-10-10.json).

`REVIEW_MAINNET_RELEASE` now pins this instance. No activation transaction has
been sent by this code change. The old deployment page disables further creation
and links to `juno-review-mainnet-activate.html`. The activation page verifies
both providers, requires the approved owner wallet and presents exactly
`{"set_paused":{"paused":false}}` for Keplr. Pending attempts survive reload and
wallet changes; recovery checks the original transaction without resending,
including after the chain is already unpaused.

New Juno reviews default to mainnet. URLs without a network but with a review ID
retain their historical UNI-7 meaning. New links include the chain and contract;
mainnet drafts, receipts and submission metadata are separate. The workspace
links to old UNI-7 reviews and drafts. Operations keeps its existing testnet path.
Every mainnet review write rechecks pinned code, authorities and policy. Paused
state blocks publication, revision and comments; withdrawal remains possible.

## Required order

1. Deployment and independent receipt verification are complete. Do not upload
   or instantiate another review contract.
2. Pass the activation candidate's CI checks and manually publish the exact
   merged main commit. The mainnet workspace will display the paused state.
3. Open `https://cosmoot.com/juno-review-mainnet-activate.html` in the owner browser.
   Connect Keplr, approve the displayed policy, choose **Review activation**, and
   inspect the pinned contract and `set_paused: false` message.
4. Choose **Confirm this transaction in Keplr** and sign personally. If the response
   is lost, use **Check pending transaction**, including after reload. Save the
   verified activation receipts. There is one transaction and a JUNO network fee.
5. Verify the published workspace on both production domains. Confirm mainnet
   labeling, the active contract and old UNI-7 links before the real-wallet trial.
6. Give the second tester a fresh mainnet review link. Test public reads, wallet
   eligibility, publication, revision, comment/reply, finalization, reload and
   author withdrawal. One delegated JUNO grants access; spendable JUNO pays fees.
   No native governance deposit is needed for these review tests.
7. Treat native governance submission as a separate real-money action. Review
   final content, execution messages, current deposit rules and fee before
   signing. Verify the native proposal, additional deposit, vote outcome and
   eventual execution separately. A successful review or simulation does not
   establish that lifecycle. Native voting UI and allocation execution are
   still separate unfinished features.

Manual release **38074225057** completed successfully for PR #280,
`c4c91fdac8883fec10edffe34d89fcf40b65ffe9`, publishing the deployment page.
The workspace activation candidate still needs its own manual release. Website
publication does not deploy, migrate or unpause a blockchain contract.

## Preparation evidence

Local validation: 10 workshop Rust tests, Clippy with warnings denied, 283 Node
tests, and the synthetic browser setup flow at 320/390/768/1440 pixels pass.
The browser covers explicit policy approval, two separate transaction reviews,
wallet changes, unknown-outcome recovery without resend, reload and export.
The native-only Rust lifecycle deliberately makes every external WASM query
panic: instantiate/access/publish/revise/comment/finalize/withdraw still pass,
while less than one delegated JUNO is rejected. These are local/synthetic checks;
full CI, wallet deployment and real mainnet acceptance are separate evidence.

Activation candidate: Node checks cover two-source pin/policy rejection,
chain/contract URL separation, finalized metadata, owner activation and recovery.
Synthetic browser checks cover mainnet publication, comments, finalization,
unknown-outcome recovery, sponsor submission, community deposits, author READY
withdrawal and preserved testnet drafts. Owner activation is checked at
320/390/768/1440 pixels with reload recovery and wallet invalidation. These checks
send no real transactions; the Dimi trial remains required after manual release
and owner activation.
