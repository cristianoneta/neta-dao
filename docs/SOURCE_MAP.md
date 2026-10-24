# Source map and responsibility boundaries

| Responsibility | Source | Boundary |
| --- | --- | --- |
| Governance composition and navigation | `neta-governance.js` | Wires views, selection and action handlers; still the largest controller and a target for further incremental extraction. |
| Review UI permissions / captured context | `src/governance/review-state.mjs`, `review-context.mjs` | Pure, typed decisions; account/chain/selection changes invalidate in-flight work. UI permission is not chain authorization. |
| Proposal data and editor | `src/governance/proposal-content.mjs`, `proposal-editor.mjs` | Parsing/validation separate from DOM and editable deliverable/accounting state. |
| Governance reads | `src/governance/queries.mjs` | Bounded reads, forward pagination and exact-hash receipt lookup; no signing. Existing independently verified native proof adapters remain separate. |
| Review receipts and recovery | `src/governance/review-session.mjs`, `review-publication.mjs` | Existing chain/wallet storage keys, fail-closed storage and status-only reconciliation. |
| Native submission / funding / voting | `planner-native-governance.mjs`, `juno-proposal-funding.mjs`, `native-voting-ui.mjs` | Frozen review/proof verification and exact transaction journals precede each action. |
| Signing bundle acquisition | `browser-signing.mjs`, existing Names/personal loaders | Lazy shared native/legacy load, bounded failure and explicit retry; loading never connects or signs. |
| Treasury | `treasury.js`, `treasury-*.mjs` | Published data, exact financial identities, coverage and receipt schemas. |
| Names | `names-workspace.js`, `names-profile*.mjs`, `names-v2*.mjs`, `names/` | Registry/profile identities and signed price snapshots. |
| RELAY | `relay.js`, `relay-personal-*.mjs`, `relay-dao-*.mjs` | Wallet/chain stores, consent, backup and recovery journals. |
| Community Tools | `community-tools/`, `community-*.mjs`, `juno-*.mjs` | Shared shell, frozen policy/review evidence and preserved entry URLs. |
| HTTP admission | `service/client-address.mjs`, `service/http-guards.mjs` | Direct peer by default; one valid client-IP header only from explicitly trusted proxy IPs; bounded bodies and counters. |
| Backend deployment | `deploy/cosmoot/` | Caddy overwrites the client header; backend trusts its fixed address on a dedicated API network. No public backend port. |
| Faucet / encrypted backup | `faucet/service/`, `relay-backup/` | Separate ledger/auth/databases; preserved persistent budgets and exact-hash payout recovery. |
| Contract checks | `scripts/contracts.json`, `scripts/check-contracts.mjs` | Seven independent lockfiles, bounded audit exception and byte-identical WASM gates. |

## Tooling and generated files

`npm run verify` is the common local/general-CI entry point. Formatting discovers
hand-written JS/MJS, including tests, instead of maintaining a small file allowlist.
Generated `dao-directory.js`, `relay-personal-pilot.js`, `assets/`, archived/design
references and manifest-pinned runtime files are excluded from formatting. Generated
and pinned bytes retain their independent integrity and reproduction checks.

ESLint applies correctness checks to executable source. Type checking currently
covers the explicitly annotated review permission/context modules. It does not
claim to type-check every legacy controller. `strict` type analysis is enabled;
`alwaysStrict` emission is explicitly disabled so a tooling configuration does not
add new directives to previously reviewed esbuild output.

The root workspace no longer eagerly includes the native and legacy signing
bundles. Dedicated legacy test/setup pages and the isolated pilot retain their
existing loading/build paths. Do not infer initial-page cost from the sum of all
tracked assets. Signing implementation, wallet confirmation and journal formats
remain unchanged; `scripts/build-signing.mjs` owns the shared build options.

The WASM checker is cached by exact tool version, runner and compiler pin. The
root JS/Python suite runs in the required general job; it is no longer duplicated
inside the Rust job. All Rust, real Juno execution, browser and artifact gates remain.

Legacy UNI-7 setup/lab pages, the original Names contract, quote-service source
and historical Render templates remain for compatibility/reference. Their presence
does not mean a service is active. Consult CURRENT_STATE before deletion or rollout.
