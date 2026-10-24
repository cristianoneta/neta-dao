# Manual releases and rollback

GitHub is the primary source/CI system. Cloudflare publishes the static website;
OVH runs the backend and production data collection. Render is retired. Historical
migration instructions do not authorize starting another writer or restoring an
older database. The current source/publication receipt lives in [CURRENT_STATE](CURRENT_STATE.md).

## Review and website publication

1. Branch from current main, preserve generated data and use one PR for related
   changes. Inspect the complete diff, including generated and configuration files.
2. Run `npm run verify` and the applicable service checks. Every required CI job
   must pass for the final PR head: browser flows, Docker/Caddy, contract audit,
   reproducible artifacts and real Juno execution are separate mandatory gates.
3. Integrate through the protected required aggregate check with expected-head
   protection. No automatic merge or deployment is implied by an audit exception.
4. The owner opens [Deliberate Cloudflare release](https://github.com/cristianoneta/neta-dao/actions/workflows/cloudflare-release.yml),
   selects `main`, sets `deploy=true` and supplies the exact integrated SHA as
   `expected_commit`. A later main commit requires a new reviewed input.
5. Confirm Publish succeeded, inspect the served assets and affected desktop/mobile
   flow, and record the source/run/evidence in CURRENT_STATE in place. Do not claim
   a real wallet transaction or future governance execution from workflow success.

Keep public Inbox deployment/release pins null unless a separate release review
explicitly activates messaging. Preserve wallet bindings, pending signatures,
transaction receipts, original crypto state and frozen proposals.

## Backend changes

A website release does not update the API or collectors. Backend changes require
the reviewed image/configuration and the existing private operator procedure.
`bash scripts/backend-host-check.sh` runs isolated template, image, restore and
maintenance checks from a clean checkout. It does not activate production.

For the 24 October admission fix, update Caddy and backend together. The backend
trusts only the edge's configured API-network address; Caddy overwrites the client
address header. Keep the backend port unpublished, existing persistent budgets,
databases, identity and allowlist. Verify two visitors have independent short-term
limits and spoofed headers cannot bypass them. See [deployment guidance](../deploy/cosmoot/README.md).
Record website and backend deployment receipts separately. Never infer live host
configuration from the public Compose template.

## Rollback

Retain the previous frontend manifest and backend source/image identity. Roll code
back to the reviewed version while preserving current databases/WAL, environment,
allowlist and browser journals. Never overwrite newer production state with an old
backup to roll back an application change. Schema compatibility and contract
upgrades require their own state-preservation and authority review.

The admission change adds no database migration. Its application and proxy
configuration should be rolled back together. Existing unconfirmed transactions
remain locked; checking an exact hash must not re-sign or rebroadcast.

## Response headers

The Pages artifact includes the reviewed headers and compiled snapshot Worker.
User pages deny foreign framing; the same-origin personal crypto runtime iframe
retains its narrowly scoped embedding permission. Check actual response headers
and iframe operation after publication; HTML meta tags do not implement
`frame-ancestors` protection.
