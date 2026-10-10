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
rules are queried from the chain. This view supports ordinary proposals only;
expedited proposals are rejected rather than applying ordinary deposit parameters. Two-source identity, deposit and parameter
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

## Review feedback and attribution — 10 October 2026 candidate

The review actions show preparation, wallet confirmation and chain confirmation
beside the relevant controls. Publication opens its public review directly; it does
not wait for unrelated mainnet history. Copy review link reports success or offers
an editable selection field when clipboard permission is unavailable.

Pending UNI-7 transactions are checked under the signing client's account lock.
Only the exact hash of the saved signed bytes plus a confirmed inclusion receipt
can release that journal. Uncertain signatures remain locked. A separate persistent
action/receipt binding keeps successful publication status-only if loading its view
fails. Checking an old action never signs the newly clicked comment or publication.
Wallet, DAO and selection changes invalidate in-flight view work. Public history
and pending journals are retained.

Draft author resolves the public mainnet NNS reverse name and verifies matching,
unexpired ownership, even for a visitor with no connected wallet. Lookup failures
retain the full address; stale responses cannot replace another selected author.

New planner proposals and new public drafts include “This proposal was created on
cosmoot.com.” before publication. Existing published/finalized content is unchanged.
For new planner reward reviews, two fresh mainnet sources must agree on the next
Roman suffix in the numbered claim series. Only claims with the programme's exact
reward execution messages and canonical title count; unnumbered historical claims
predate the series. The title ends with a single space and I, II, III, etc. Complete
paginated history is required; errors never silently reset the series. The number
is fixed before public review and is not changed at finalization/submission.
Independent parallel reviews may choose the same number: this is a descriptive
series, not an on-chain reservation or globally unique proposal identifier.

Withdraw review remains visible during discussion. Only its author, connected to
UNI-7, can confirm withdrawal. The terminal Withdrawn view retains text and comments;
withdrawal is distinct from a failed governance vote. No contract migration is needed.


## Finalized submission revision — candidate, 10 October 2026

Submission lives at the bottom of the review with two chain-derived choices:
minimum initial deposit and full voting deposit. After verification and fee
simulation, the selected action opens Keplr directly. Changed parameters require
a new choice; rejected signatures, account changes and unknown submissions retain
the existing transaction safeguards. A sponsor can submit another author's review.
Deposits after submission remain native MsgDeposit contributions by any wallet.

The review author can also withdraw from READY, switching to UNI-7 when needed.
Before withdrawal, the application checks the finalized review and native proposal
history, blocks saved submission attempts and takes the same per-review browser
lock as submission. Withdrawn content and comments stay readable. Already-native
proposals cannot be cancelled here. As before, separate devices/chains cannot
atomically exclude a simultaneous submission and review withdrawal; this UI does
not claim a cross-chain cancellation guarantee.

The public `/data/governance-read` route accepts only bounded GET requests to
fixed providers and the exact governance, treasury and review query allowlist.
It forwards the requested block height, strips credentials, rejects redirects
and large/non-JSON responses, uses no-store responses and never serves static
fallback data. It provides transport, not a new consensus source: checks still
compare distinct configured providers, exact contents, chain IDs and fresh heights.
The current Lavender.Five REST URL is used for native governance reads.

Local evidence: 268 Node tests; synthetic minimum-deposit submission, full-deposit
selection/signature rejection, account change, sponsor submission, later funding,
READY withdrawal and preserved transaction recovery; desktop/768/390/320 layouts;
compiled Pages and real workerd tests. Real end-to-end UNI-7 governance execution,
real sponsor wallet transactions and post-release live acceptance remain open.

## History pagination correction — 10 October 2026 candidate

PR #277 was published in successful manual release 38065296076. The subsequent
live check found that reverse cursor pagination over older native proposals can
return a node-side HTTP 500 nil-pointer error, surfaced as HTTP 502 by the read
route. The first page alone is not evidence of a complete duplicate check.

Duplicate detection and Roman claim numbering now traverse forward until the
terminal cursor. No history window, status filter or skipped failing page is
introduced. The numbering reader also preserves each provider's URL path prefix
while counting independent hosts only once. Page limits, repeated-cursor rejection,
source agreement and submission height checks remain unchanged.

Read-only live evidence: Polkachu and Stavr returned the same 147 proposal IDs at
height 42562163 through the published proxy with forward pagination. Regression
coverage includes a later-page match, later-page claim number and source disagreement;
the browser fixture rejects reverse reads and requires two history pages. This
candidate still requires complete CI and a separate manual release. No signing or
fund movement was part of diagnosis.
