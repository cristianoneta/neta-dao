# Documentation map

Updated 2026-10-06. Use current documents for decisions and dated evidence for
provenance. Do not read every historical handoff as an independent to-do list.

| Purpose | Owning document |
| --- | --- |
| Next chat, current priority, preservation rules | [Root HANDOFF](../HANDOFF.md), [2026-10-06 checkpoint](HANDOFF_NEXT_CHAT_2026-10-06.md) |
| Connected features, deployment boundaries and source map | [CURRENT_STATE](CURRENT_STATE.md) |
| Open work across modules | [PROJECT_CHECKPOINT](../PROJECT_CHECKPOINT.md) |
| Verification commands and repository overview | [Root README](../README.md) |
| Latest maintenance scope and findings | [2026-10-04 review](MAINTENANCE_CHECKPOINT_2026-10-04.md) |
| NNS mainnet continuation and preserved UNI-7 evidence | [NNS handoff](HANDOFF_NEXT_CHAT_NNS_2026-10-04.md) |
| Existing/fresh UNI-7 test procedure | [Owner runbook](NNS_UNI7_OWNER_TEST_2026-10-04.md) |
| Shared Treasury price snapshots and mainnet preparation | [NNS pricing runbook](../names/README.md) |
| NNS internal security review and latest release verification | [2026-10-05 review](NNS_SECURITY_REVIEW_2026-10-05.md) |
| Historical snapshot protocol/source verification | [Snapshot checkpoint](NNS_SNAPSHOT_RELEASE_2026-10-05.md) |
| Historical continuous quote-service release evidence | [WYND release](NNS_WYND_RELEASE_2026-10-05.md) |
| Accepted Names product rules | [v2 plan](NETA_NAMES_V2_PLAN.md) |
| Registry/quote and profile/operator protocols | [Registry](NNS_V2_REGISTRY_2026-10-04.md), [Profiles/programme decisions](NNS_VALIDATOR_PROFILES_2026-10-04.md) |
| Faucet live evidence and remaining tests | [Faucet handoff](HANDOFF_NEXT_CHAT_FAUCET_2026-10-04.md), [service operation](../faucet/README.md) |
| Treasury cash-based P&L and NNS receipt coverage | [Accounting continuation](TREASURY_ACCOUNTING_2026-10-06.md) |
| Shared Treasury schema and filtered NNS register | [Statement revision](TREASURY_STATEMENT_2026-10-06.md) |
| UI/new pages | [Design system](DESIGN_SYSTEM.md) |
| DAO addition and membership | [Onboarding checklist](DAO_ONBOARDING_CHECKLIST.md), [People evidence](PEOPLE_MEMBERS_CONTRIBUTORS_2026-10-03.md) |
| Governance APIs and permissions | [Review architecture](../REVIEW_ARCHITECTURE.md) |
| Encrypted messaging and recovery | [Implementation plan](RELAY_IMPLEMENTATION_PLAN.md), [recovery decision](RELAY_RECOVERY_DECISION.md), [security architecture](RELAY_SECURITY_ARCHITECTURE.md) |
| Deferred delegation research | [Smart Delegation](SMART_DELEGATION_RESEARCH.md) |

## Evidence and archives

Dated security, valuation, onboarding, UI-review and maintenance files record what
was checked at that time. Later deployments do not retroactively change their
original test counts or receipt evidence. Their old “next steps” are superseded
by the current handoff. Historical files stay at existing URLs to preserve links.

The consolidated append-only histories are preserved under [archive](archive/).
No transaction receipts, public manifests, security findings, generated Treasury
exports or contract artifacts were deleted during the cleanup.

## Maintenance rule

Update current statements in place. Keep one owning runbook per feature. Put exact
release checks in its evidence section or PR description; link rather than copying
whole chronologies into README, HANDOFF and CURRENT_STATE. Mark a historical
checkpoint as historical before leaving instructions that have already been done.
Separate source-tested, published, observed live state and wallet-E2E evidence.
