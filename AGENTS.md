# Working on NETA DAO

Read `HANDOFF.md` and `docs/CURRENT_STATE.md` before changing the application.
For every UI change or new page, also read `docs/DESIGN_SYSTEM.md` and reuse its
shared foundations, component rules and page-specific requirements. The owner chose
the graphite/mint home concept with the voxel assembly plaza on 2026-10-03.
The wizard is rejected. Design approval is not evidence of completed implementation.

Keep documentation accurate about what is live, testnet-only, planned or disabled.
Preserve existing work and generated Treasury bot data; use branches and PRs.
GitHub is primary by owner decision on 8 October 2026; GitLab is a dormant reserve.
Batch related work into one branch/PR. Never create automatic version-update PR
waves or use GitHub schedules for production data. Keep security alerts/audits.
Production data belongs on OVH; code releases to Cloudflare are explicitly manual.
Before publishing PR/issue titles, descriptions or commit messages, review them
for accuracy and describe the concrete component, behavior and validation. Do not
post templated promotion, asset-return promises or requests for private wallet
material. For message-backup work, identify the encrypted message backup and the
actual restore operation explicitly; keep legitimate security terminology and
document limitations. Do not mass-edit historical records or rewrite Git history
to avoid classification. GitHub Support's 8 October account finding is recorded in
docs/GITHUB_REOPENING_2026-10-08.md; the specific flagged PR is still unidentified.
Follow docs/DOCUMENTATION_PRIVACY.md. Keep actual operator inventories, host access
commands, provider resource IDs, private backup locations/receipts and private file
references outside Git, PR descriptions, commit messages and CI output. Public
handoffs contain project status and generic procedures only. Consult the owner's
private operations handoff for host actions; never infer live access from a template.
Inspect applicable CI and verify deployments after integration. Never enable mainnet
messaging or discard pending crypto/transaction journals as part of UI work.

New production contracts must retain an explicitly agreed upgrade administrator
while the project is developing. Do not default to immutable deployment or choose
the DAO as upgrade admin without agreement. Owner decision 2026-10-05: NNS registry
and profiles initially use `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57`; a later
transfer to the main NETA DAO is a separate owner-confirmed action. Owner correction 12:53: the same wallet initially controls registry tariffs,
purchase pause and price-key rotation too. Fees always target the main NETA DAO
in the reviewed code. Keep upgrade custody, application administration and fee
destination explicit and separate; do not infer one from another.
For upgrades, verify source/target versions and code, test state preservation and
authority/transfer behavior, and preserve pending transaction journals.
