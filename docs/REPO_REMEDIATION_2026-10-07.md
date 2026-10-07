# Repository review remediation — 7 October 2026

Implementation based on the owner's six-page review (15:08 Berlin).
Baseline main: `ad28b5e3`; personal candidate: `a17a2bf`; recorded hosted backend:
`052e736`. The cleanup integrates the reviewed candidate's maintained source while
retaining current main data and public messaging gates. Only status documents had
merge conflicts; the newer main evidence was preserved and archived.

| Finding | Implementation | Verification / limit |
| --- | --- | --- |
| E1 CI coverage | Every PR calls all module checks, plus syntax/manifest/build checks and one required summary | No PR path-filter gaps; branch rule activation requires GitHub administration |
| S1 Backup capacity | Separate anonymous/authenticated lanes, per-wallet active limit, explicit body deadline/size limit | Slow-body regression: four held anonymous requests cannot reject authenticated GET |
| S2 Faucet quotas | Cheap/malformed traffic uses bounded short-term throttle; persistent budget charged after valid fresh ownership proof | Invalid proof, status/404, replay, concurrent clients and restart covered; payout policy/journal retained |
| E2 Distributed source | Full maintainable pilot/client/backend/build sources together; shared Render blueprint, release procedure and manifest checks | Frontend builder byte-identical; actual backend deploy must be recorded separately |
| E3 Durability | Safe local export and isolated restore coverage; explicit recovery targets/retention and hosted drill runbook | Hosted off-service recovery remains open; no fabricated evidence or user recovery-code request |
| D1 Status contradictions | One current matrix, short README/handoff, pointers replacing duplicate checkpoints, one historical archive | Prior records retained; external issue/PR wording reconciled during release |
| M1 Maintainability | Readable source formatting, shared HTTP guards/signing build options, central contract inventory/source map | URL/storage/journal compatibility preserved; no framework or contract rewrite |
| M2 Maintenance | Weekly Dependabot npm/Cargo/Actions PRs and scheduled security audits | Rust pin/advisory exception preserved; no unreviewed major upgrades |
| Embedding headers | Deployable header policy with explicit crypto-iframe exception | GitHub Pages cannot apply repository header configuration; edge change still needed |

Local pre-format verification: 206 root Node, 84 Python, 67 Faucet, 22 Names and
11 Backup tests passed. Pilot generated files and all nine manifest hashes match.
Final CI, formatting, served bytes and deployment evidence are recorded below as
available. A successful test is not a hosted recovery or independent full audit.
