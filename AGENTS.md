# Working on NETA DAO

Read `HANDOFF.md` and `docs/CURRENT_STATE.md` before changing the application.
For every UI change or new page, also read `docs/DESIGN_SYSTEM.md` and reuse its
shared foundations, component rules and page-specific requirements. The owner chose
the graphite/mint home concept with the voxel assembly plaza on 2026-10-03.
The wizard is rejected. Design approval is not evidence of completed implementation.

Keep documentation accurate about what is live, testnet-only, planned or disabled.
Preserve existing work and generated Treasury bot data; use branches and PRs.
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
