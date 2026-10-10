# Juno community review mainnet rollout

10 October 2026. Owner-selected access policy: **at least 1 delegated JUNO;
no NETA requirement**. This is preparation for a controlled two-wallet review
trial, not evidence that the complete governance lifecycle has passed.

## Prepared deployment

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
public transaction and deployment data. `REVIEW_MAINNET_RELEASE` stays null;
this change has no public workspace switch or automatic unpause action.

## Required order

1. Pass the PR checks and manually publish the exact reviewed main commit.
2. On `https://cosmoot.com/juno-review-mainnet-deploy.html`, connect the owner
   wallet, review custody and access policy, then confirm upload and instance
   creation separately in Keplr. Recover a pending transaction before continuing.
3. Download and inspect the public deployment receipts. Independently match the
   real transaction bytes, code hash, new address, owner/admin and paused config.
4. Pin those verified values and finish the public workspace activation change:
   review reads/writes, staking feedback, fees, wallet chain selection, author
   text, finalized metadata, read-proxy allowlist, withdrawal checks and receipt
   namespaces must all use the selected review network. Preserve old UNI-7 URLs
   and pending journals with their original chain/contract identity. Never
   relabel a testnet review as a mainnet review or move its finalized content.
5. Pass synthetic two-network/browser checks, explicitly unpause the verified
   mainnet instance with the owner wallet, manually release the workspace
   switch, and accept both production domains with actual wallets.
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

The prior manual release **38071673542** completed successfully for
`6f33689ba76cc8f81e2a7e5163bec6dea62dff61` (PR #279). It still uses UNI-7 review
and Juno-mainnet native submission. Website publication does not deploy or
migrate a blockchain contract.

## Preparation evidence

Local validation: 10 workshop Rust tests, Clippy with warnings denied, 283 Node
tests, and the synthetic browser setup flow at 320/390/768/1440 pixels pass.
The browser covers explicit policy approval, two separate transaction reviews,
wallet changes, unknown-outcome recovery without resend, reload and export.
The native-only Rust lifecycle deliberately makes every external WASM query
panic: instantiate/access/publish/revise/comment/finalize/withdraw still pass,
while less than one delegated JUNO is rejected. These are local/synthetic checks;
full CI, wallet deployment and real mainnet acceptance are separate evidence.
