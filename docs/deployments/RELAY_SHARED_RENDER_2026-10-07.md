> Historical initial deployment record. The current backend is `f5b21a5` from PR #224,
> live 7 October at 14:01 UTC. See [current release receipt](repo-remediation-release-2026-10-07.json).
> Earlier missing-send/registration statements below are historical; the pilot evidence owns those results.

# Shared Render backup — hosted checkpoint, 7 October 2026

The existing Faucet service now runs the reviewed personal RELAY backup candidate.
The backend is enabled for the owner and the explicitly consenting Faucet-wallet pilot participant. Public Inbox release pins
remain null; no real messaging, authenticated backup upload or recovery pilot is
claimed. This record supersedes earlier statements that Render was not configured.

## Existing service and verified deployment

| Field | Observed value |
| --- | --- |
| Workspace | `netadao` / `tea-db101fc9v7es73d9srt0` (explicitly confirmed by owner) |
| Service | `neta-junox-faucet` / `srv-db10ddc9v7es73dbg45g` |
| Origin | `https://neta-junox-faucet.onrender.com` |
| Region / plan / instances | `frankfurt` / `0.5c-512mb` / `1` (unchanged) |
| Disk | `dsk-db10ddk9v7es73dbg4mg`, `faucet-ledger`, 1 GB, `/var/data` (unchanged) |
| Repository branch | `codex/personal-messaging-recovery-mainnet` |
| Deployed application commit | `052e736a87d44bbe3743524b1a547822bc6dbf81` |
| Root directory | Empty Dashboard field: repository root |
| Build command | `npm ci --prefix faucet --omit=dev --ignore-scripts && npm ci --prefix relay-backup --omit=dev --ignore-scripts` |
| Start command | `FAUCET_PUBLIC_ORIGIN="${FAUCET_PUBLIC_ORIGIN:-$RENDER_EXTERNAL_URL}" node faucet/service/server.mjs` |
| Automatic deployments | Off |
| Disabled-first deploy | `dep-db32hg2d0e5s73et6cag`, live 11:11:40 UTC |
| Owner-only enabled deploy | `dep-db32ib67bikc73bf5qkg`, live 11:13:32 UTC |
| Two-wallet enabled deploy | `dep-db32r1qd0e5s73eu9kcg`, live 11:31:56 UTC |

The owner changed branch/root/build/start in their existing Render browser, then
confirmed completion. MCP independently verified all four settings. Browser login
was abandoned at the owner's request; no further browser sign-in is needed for
supported deployment/environment/log operations.

**Connector behavior:** `update_environment_variables` merges by default when
`replace:false`, but also automatically triggers a deployment. Do not follow it
with a duplicate manual deploy. The initial disabled configuration update triggered
`dep-db32f67avr4c739ib5d0` from then-configured main commit
`b2138479c5059e28f748366e7eba2621227afe2b`, live 11:06:35 UTC. Faucet readiness
was rechecked before deliberately deploying the candidate branch.

Only the following non-secret variables were added/updated, using partial merges:

| Variable | Value |
| --- | --- |
| `NODE_VERSION` | `24.19.0` |
| `SKIP_INSTALL_DEPS` | `true` |
| `RELAY_BACKUP_ENABLED` | `true` after disabled-first checks |
| `RELAY_BACKUP_DIRECTORY` | `/var/data/relay-backup` |
| `RELAY_WEB_ORIGIN` | `https://dao.netareborn.com` |
| `RELAY_BACKUP_ORIGIN` | `https://neta-junox-faucet.onrender.com` |
| `RELAY_MAILBOX_CONTRACT` | `juno1dvmms7su8zfqu4gxxmrkqhzpxr5v3sh8hzfxe8ypsgfegc22lggq5jfjx6` |
| `RELAY_BACKUP_WALLETS` | `juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57,juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt` |

No new service, plan upgrade, disk replacement, secret change or database reset
was performed. No mnemonic/secret was read or exported. Existing payout rows were
not inspected; retained disk identity and healthy startup are not a row-level
ledger integrity audit.

## Live checks and their limits

[Recorded HTTP observations](shared-relay-render-verification-2026-10-07.json),
completed at **11:15:31 UTC**, establish ten checks:

- Faucet `/status`: HTTP 200, `uni-7`, ready true, same account
  `juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt`, 25 JUNOX per 86,400 seconds,
  balance `498156614` ujuno and unchanged protection/confirmation/gas policy.
- Disabled candidate `/health` returned 503 `RELAY backup is not enabled`;
  enabled deployment returned HTTP 200 `{"ok":true}` over verified HTTPS.
- Exact-origin CORS preflight allowed the intended methods/headers. Other origins
  and missing origins were refused; unauthenticated reads and invalid-token writes
  returned 401. A nonallowlisted wallet was refused with 429 (the combined error
  string includes `capacity`; the initial smoke assertion expecting 400 was
  corrected against source without changing the original observed response).
- The owner's challenge binds the exact backup origin, web origin, `juno-1`,
  verified mailbox and owner wallet. An invalid signature was refused with 401.
  Challenge nonces are omitted from the stored evidence; no access token was issued.
- No error/warning logs were returned for the inspected post-start interval.
  At 11:14:30 UTC, the new instance used 63,389,696 bytes of memory, with a
  536,870,900-byte limit. One instance was observed. This is an idle observation,
  not load/capacity assurance; the available CPU sample belonged to an older
  instance and is not used as an enabled-service measurement.

**Still outstanding:** valid wallet authentication, encrypted write/read, revision
conflicts and hosted quota enforcement, persistence of stored envelopes across
restart, protected off-service export/restore, and the consenting two-wallet
mainnet lifecycle. No chain transaction or Faucet claim was made by these probes.

## Exact continuation

1. Obtain the second consenting Juno wallet (the owner's second Keplr account is
   sufficient). Add it with a partial environment merge; expect the connector's
   automatic deploy. The recipient can receive/read without `.neta`; both sides
   need active owned names to test replies in both directions.
2. Prepare and review a wallet-restricted private pilot client with the real
   deployment and exact backup origin/CSP. The candidate's public release pins
   are still null; do not treat the hosted backend as public Inbox activation or
   blindly merge PR #195 just to open testing.
3. Use explicit real wallet confirmations to test authentication, coherent backup,
   registration/consent/send/read/reply/reload and fresh-browser read-only recovery
   followed by reviewed rotation. Preserve keys, recovery code and transaction
   journals; never auto-resend an unknown transaction.
4. Complete stored-envelope restart and protected off-service export/restore
   evidence before claiming durable production recovery. Follow the existing
   [shared pilot operating plan](../RELAY_SHARED_PILOT_2026-10-07.md).
5. After personal release, continue DAO inbox/recovery and then payment requests,
   invoices and Treasury integration. Keep DAO writes disabled until that work.

To disable only the shared backup, partially set `RELAY_BACKUP_ENABLED=false`
(the connector deploys automatically) and verify `/health` 503 plus Faucet
readiness. Retain all data, the current branch/build/start settings and disk.

## Consenting second wallet admitted — 13:34 Berlin

The owner explicitly approved backup access for the Faucet wallet after the automatic tool review requested separate consent. The partial environment update deployed the same reviewed application commit; no plan, disk, secret or payout configuration changed. [Four subsequent HTTP observations](shared-relay-faucet-admission-2026-10-07.json) confirm healthy backup/Faucet endpoints, a correctly scoped challenge for the second wallet, and rejection of unauthenticated reads. No valid wallet signature, stored backup, message or chain transaction was generated by these checks. The Faucet balance changed with chain activity; it is not claimed unchanged.

The address is an ordinary Juno mainnet account. The Faucet application's UNI-7 payout restriction does not make its address testnet-only. Receiving/reading and registration do not require a .neta name; sending does. The manual allowlist is temporary private-pilot admission, not the intended public self-service registration model.
