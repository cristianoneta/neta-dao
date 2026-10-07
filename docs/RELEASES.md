# Releases and rollback

All executable PRs run `Repository checks` with an always-reported
**Required repository checks** result. Configure that exact check as required in
GitHub's branch rules. Current connected GitHub tools cannot administer rules;
the observed main branch was unprotected on 7 October. CI existing is not the same
as branch protection being enabled.

## Publish

1. Branch from current main; preserve generated bot data. Review the complete diff.
2. Keep public Inbox deployment/release pins null unless a separate release review
   explicitly activates them. Never infer activation from integrating source.
3. Verify source builds and manifest checks; all required jobs must pass for the
   exact head. Merge the PR with expected-head protection.
4. Record source commit, frontend manifest, backend deployed commit, mailbox code/
   checksum and backup schema in a release receipt. Check actual Pages bytes and
   Render health; do not substitute workflow success for served-file verification.
5. Publish an annotated release tag after verification. Backend should track main;
   a manual Render deploy uses the selected branch, so inspect it before deploying.
   No new service, disk or plan is needed.

## Roll back without losing user state

Retain the previous frontend manifest and deployed backend SHA. Select/redeploy
that exact known-good application version, preserving disk, environment, allowlist,
SQLite/WAL and client journals. Never copy an older database over the live store to
roll back code. No schema migration is introduced in this cleanup (backup envelope
v1 / SQLite backups table and Faucet quota tables stay compatible).

Run the backup tests against previous persisted revisions before promotion and
verify status/unauthenticated rejection after deployment. A rollback with new-schema
writes requires its own compatibility review. Contract rollback is not a static
site operation; it requires explicit upgrade administration and state preservation.

## Embedding protection

GitHub Pages does not accept a repository `_headers` file for custom HTTP headers.
Do not claim `frame-ancestors` in a meta element protects embedding. Configure the
edge/hosting HTTP response layer with CSP `frame-ancestors 'none'` and
`X-Frame-Options: DENY` on user pages; `relay-personal-runtime.html` specifically
needs `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN` for its crypto iframe.
`deploy/security-headers.conf` is a reviewable reverse-proxy configuration fragment,
not an applied GitHub Pages setting. Verify both responses and iframe operation
before marking this operational item done. No hosting migration is part of this fix.
