# Juno programme review and deposits

9 October 2026, implementation candidate. This change requires CI and a manual
website release. No real wallet signature, mainnet submission or deposit was
performed during development.

The planner prepares a private draft, then publishes it to the existing UNI-7
community review contract. Existing review eligibility remains: 1 JUNOX delegated
and 1 test NETA staked. Comments and revisions precede finalization. Review shows
no initial-deposit controls, pledges or escrow. Claim prose describes only claiming
the listed rewards into the programme treasury and leaving delegations unchanged.
Current rewards, indicative USD and timestamps remain in the planner.

A shareable `review` URL identifies the public review independently of local
storage. Finalized title, summary, body and actions are bound to the contract's
SHA-256 hash. Two independent UNI-7 sources must verify the finalized revision
before mainnet signing. Any direct-signing Keplr wallet can then submit, paying
its own initial deposit and fee; the original review author remains recorded.
Existing mainnet authority, delegation-list, destination and balance preflights
remain mandatory. The finalization does not authorize automatic execution.

The native proposal includes a review identifier and content hash in metadata.
Exact title, summary and executable messages must match when locating an existing
submission. A copied identifier with different contents is ignored. Two mainnet
sources are checked before signing and broadcasting. Browser locks and persistent
journals prevent local retries after unknown outcomes. These checks cannot provide
atomic exclusion between different users submitting simultaneously on different
devices; the native governance module has no unique-review constraint.

Once submitted, the UI links to `proposal=<id>`. A contributor can choose an
amount or the remaining deposit. `MsgDeposit` sends funds directly from their
wallet to native Juno governance. Target, minimum contribution, deadline and burn
rules are queried from the chain. Two-source identity, deposit and parameter
checks repeat before signing and broadcasting; a changed total requires another
review. The sender's balance must cover the contribution and simulated fee.
The UI closes contributions once the target is reached or the deposit phase ends.
If the chain minimum exceeds the small remainder, the excess is shown explicitly.
Concurrent contributions can still reach the chain together after the last read.

The review displays the exact wallet, proposal, amount and fee. Separate confirmation
is required. Unknown transaction outcomes expose only status lookup using the saved
hash, also after reload. Existing private drafts and old submission receipts are
preserved. Refunds, where applicable, return to each native depositor; chain burn
conditions and nonrefundable transaction fees are shown at the funding step.

Validation covers immutable hashes, matching executable content, pagination,
two-source disagreement, deadlines, minimum/remaining amounts and exact signing
bytes. The browser regression uses synthetic chain responses and separate author
and sponsor wallets for publish, finalize, share, submit and contribute, including
stale funding, account changes, unknown outcomes and four viewport sizes. No new
contract or backend custody is introduced. Mainnet voting remains read-only.
