# Review architecture

Code-reviewed 2026-10-02. Current deployment inventory and limitations:
[docs/CURRENT_STATE.md](docs/CURRENT_STATE.md).

## Sources of truth

| Data | Source | Boundary |
| --- | --- | --- |
| Private per-DAO draft | Browser localStorage | Replaceable, not shared/on-chain |
| Operations public review | Legacy UNI-7 `neta-governance` contract | Other repository owns source; API differs from v0.3.0 |
| Juno public review | UNI-7 `neta-proposal-workshop` v0.3.0 | Immutable revisions, native threaded comments, contract hash on finalization |
| Operations DAO result/vote | Mainnet DAO proposal module | Existing Keplr vote execute; no automatic review submission |
| Native Juno governance | Mainnet `x/gov` | Read-only in frontend |
| Treasury | Generated current/history/event JSON | Read-only snapshots and limited native movement extraction |
| Delivery / Contributors / forecasting | UX concepts | No execution authority |
| RELAY main Inbox | Mainnet proposal reads and local comparison state | No UNI-7 review polling or private messages |
| RELAY encrypted lab | UNI-7 ciphertext and wallet-bound local crypto/archive | Separate test page; no recorded real two-wallet E2E |

## Distinct lifecycle implementations

### Operations legacy

`neta-governance.js` calls `publish_draft`, `publish_revision`, `add_comment`,
`finalize_and_submit` and owner `set_status`. The source is
<https://github.com/cristianoneta/neta-website/tree/main/contracts/neta-governance>.
Comments encode thread/reply metadata in body markers. Publishing/revising/
finalizing requires positive configured voting power; comments require strictly
more than the 10-NETA configured threshold. Failed access queries become zero
in the legacy source; it has no v0.3.0 cooldown/hash/JSON-array hardening.

Despite the button label, `finalize_and_submit` only sets the UNI-7 review to
`voting`. It emits no mainnet proposal message. The UI's withdrawal action is
restricted to a discussion author who is also the config owner and maps to
`set_status: declined`. Do not claim generic author withdrawal for this instance.

### Juno v0.3.0

`publish_proposal` → `add_revision` / `add_comment` → `finalize`.
All community review writes require at least 1 delegated JUNOX plus 1 staked
test NETA through the configured UNI-7 access mock. Finalization applies only
to the latest version, stores a contract-computed SHA-256 hash and closes
discussion. `MarkSubmitted` always rejects until a verifiable adapter exists.
The contract permits author withdrawal before submission; the UI exposes it
only during discussion. Attached funds are rejected, instances start paused,
owner transfer is two-step, queries are cursor-paginated, and moderation plus
30-second comment cooldown are contract behavior.

The crate also supports Operations mode (positive voting power to publish,
strictly greater than configured stake to comment). That supported mode does
not mean the legacy Operations instance has been replaced or migrated.

## Mainnet and deliverable boundary

Mainnet Operations proposal reads are separate from UNI-7 reviews. Open
non-native proposal records expose Keplr voting on `juno-1`; native Juno voting
buttons are hidden. Neither review flow creates mainnet proposals. Mainnet
native deposit/submission is absent; review status is not DAO approval.

`dao_deliverable_v1` objects in `actions_json` retain milestone title, deadline,
responsible wallet, confirmer and evidence. They are planning records. Future
submission adapters must validate executable messages separately. Delivery
acceptance and payment release do not exist.

## Change and verification rules

Preserve DAO/chain identity and governance request epochs. Re-query contract
access before relying on frontend controls. See CURRENT_STATE for history/
pagination limits and the separate unfixed Treasury async response race.
Use `node --test tests/*.test.mjs` for frontend checks, and the pinned Rust
workflow for contract changes. A new submission/voting adapter requires exact
message simulation, wallet/network binding and confirmed post-state evidence.
