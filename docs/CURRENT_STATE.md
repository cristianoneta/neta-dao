# Current state — Cosmoot

Updated 24 October 2026. This is the authoritative current feature and release
inventory. Update rows in place; retain dated evidence separately. Public/private
boundaries are defined in [DOCUMENTATION_PRIVACY](DOCUMENTATION_PRIVACY.md).

## Source and publication

| Item | Confirmed state | Evidence / remaining boundary |
| --- | --- | --- |
| Last successful website release | Source `828059b4734530f237507700655f8b80e69f9986` (PR #304), including #301–#303 | [Manual release 40086798887](https://github.com/cristianoneta/neta-dao/actions/runs/40086798887) completed successfully on 24 October, including publication. |
| Maintenance release | [PR #304](https://github.com/cristianoneta/neta-dao/pull/304) integrated; website published and backend separately installed | [Changes and validation](MAINTENANCE_2026-10-24.md), [deployment acceptance and limits](DEPLOYMENT_ACCEPTANCE_2026-10-24.md). |
| Homepage / snapshot fallback follow-up | Source corrects obsolete voting/submission copy and adds the missing packaged delegation-planner snapshot | [Scope and evidence](HOME_FALLBACK_2026-10-24.md). Manual publication and controlled live fallback acceptance remain pending. |
| Backend / public data | OVH backend updated from the reviewed #304 source; Render is retired | Owner-confirmed healthy replacement, successful isolated host checks and independent public API/data probes. Private operational receipts remain outside Git. |
| Source and CI | GitHub primary; GitLab dormant reserve | One PR per related batch. Protected required aggregate check; security audits retained. Production data writers do not run on GitHub schedules. |

The failed pre-#303 release 40073942022 did not publish #302. The successful
release above supersedes that checkpoint. Workflow publication is separate from
live-wallet acceptance and current collector health. The backend installation has its
own dated acceptance record; no new wallet transaction or browser restore is claimed.

## Features

| Feature | Current implementation / publication | Limits and owning reference |
| --- | --- | --- |
| Delegation Programme | Overview → Set rules → Review distribution → Review proposal; actual holdings/rewards and approved-policy discovery | Frozen old/new rules and allocation impacts; rule approval does not authorize redistribution. [Programme](JUNO_DELEGATION_PROGRAMME.md), [review](DELEGATION_RULE_CHANGE_UX.md). |
| Validator history | Automatic use of the collected period until 90 days exist, then the rolling window; at least 97.5% observed commit signatures in schema 5 | Continuous observed membership, exact counts and original collection start; unavailable/gapped evidence blocks eligibility. Historical schemas retain their meaning. [History](VALIDATOR_HISTORY.md). |
| Programme reward claim | Correct DAO DAO Stargate withdrawals with the programme as delegator and destination | Required real local Juno test reproduces old/wrong-authority failures and verifies 37 withdrawals plus unchanged delegations. First replacement includes the #381 explanation; later omission uses agreed chain history. [Repair](PROGRAMME_CLAIM_REPAIR_2026-10-23.md). |
| Juno community review | Mainnet review v0.3.1, finalization, author withdrawal, native submission/deposits and voting | Fresh authority/content/balance checks; explicit wallet confirmation; pending outcomes remain locked. Operations legacy review is a separate UNI-7 flow. [Semantics](GOVERNANCE_EXECUTION_SEMANTICS.md), [funding](JUNO_COMMUNITY_FUNDING.md). |
| Native voting display | Four choices, live tally, direct voting, participation and validator/direct-address views | Incomplete detail is unavailable, not zero; no invented historical final participation. [Voting](JUNO_GOVERNANCE_VOTING.md). |
| One-off DAI proposal | Direct template link fills 460.9 axlDAI to the recipient of proposal #382; no permanent button | Exact native Community Pool spend is tested locally. Dimi's conversion to USDC and return are separate manual operations, not automated by the proposal. Opening the link does not sign. |
| Community Tools | Interchain → Juno → NETA; Delegation Programme chain picker and NNS entry | Juno currently offered; existing Faucet, v31 tracker and bounded Buy NETA on WYND retained. [Tools](COMMUNITY_TOOLS.md). |
| Treasury | Assets, DAO/SubDAO consolidation, P&L, Community Tax and staking accrual | Accounting begins 1 October 2026. Missing coverage/prices remain Partial or unavailable; claims do not double-count accrued rewards. Freshness is not established by a website release. [Accounting](TREASURY_ACCOUNTING_2026-10-06.md). |
| Names | Mainnet registry v0.3.1 / profiles v0.1.0; purchases active | Published code 5168/5169; recorded registration/fee evidence. Preserve renewal/transfer/validator acceptance limits. [Deployment](NNS_MAINNET_DEPLOYMENT_2026-10-05.md). |
| Personal messaging | Separate two-wallet mainnet pilot, code 5170 | Public release pin remains null. Send/read/reload evidence exists; fresh-profile restore/rotation was deferred. Sending requires an active owned name; receiving does not. [Pilot](deployments/PERSONAL_PILOT_2026-10-07.md). |
| Encrypted backup | Authenticated, scoped envelopes and separate database on the existing backend | Original allowlist retained; synthetic restore/restart evidence exists. Recurring independent retention remains an operational follow-up. [Recovery](BACKUP_RECOVERY.md). |
| Faucet | 25 JUNOX per wallet per 24 hours; ownership proof and durable payout journal | Visitor admission fix installed behind Caddy; original public identity and 25 JUNOX/24-hour limit confirmed. Per-visitor separation tested with isolated real Caddy; no production quota-exhaustion test. |
| DAO Inbox / payments | Gated protocol/UI groundwork; no activated DAO message writes or payment execution | Further recovery, permission and workflow work remains. |
| Notifications / People / Delivery | Browser-local notices and real membership reads | No push/email, cross-device notice sync or fictional live contributor/delivery data. |
| DEX | Unlisted browser simulation with orbital/list views, liquidity forms and unfunded incentive planning | No live swaps, token issuance, funded incentives or DCA; session/demo values. Contract/custody/audit work remains separate. |
| Juno upgrades | v31 archive closed; future-watcher lifecycle core tested | Future network collection, scheduling and automatic publication are not activated. Missing signatures are not proof of failed upgrades. [Tracker](JUNO_UPGRADE_AUTOMATION.md). |

## Security and maintenance boundaries

- `crypto-bigint 0.5.5` remains unpatched in the reviewed native test dependency
  graph. The guarded applicability exception expires **24 November 2026 00:00 UTC**;
  all seven WASM normal/build graphs must exclude that chain. Other advisories
  remain blocking. [Assessment](SECURITY_REVIEW_2026-10-24.md), [upgrade work](DEPENDENCIES.md).
- Review contracts, DAO authorization, native submission and later chain execution
  have separate semantics. [Required engineering reference](GOVERNANCE_EXECUTION_SEMANTICS.md).
- Initial upgrade/admin custody remains with the explicitly agreed owner wallet.
  Contract deployment, administration and fee destination are separate; maintenance
  does not transfer custody or make contracts immutable.
- Preserve original databases, crypto/transaction journals, source evidence, frozen
  reviews and generated Treasury/history data. Code rollback never restores an old
  database over newer production state.
- Source checks and synthetic tests are evidence for their fixtures, not a complete
  security audit or a promise of future mainnet execution.

The superseded combined chronology and earlier feature matrix are preserved in
[the 24 October archive](archive/CURRENT_STATE_2026-10-24_before-maintenance.md).
Use [HANDOFF](../HANDOFF.md) for the current development continuation.
