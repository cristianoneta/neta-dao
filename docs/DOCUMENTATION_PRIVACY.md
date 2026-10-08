# Public and private documentation

Owner decision, 8 October 2026: application source and general documentation may
remain public. Operator records are maintained privately outside this repository.

| Public repository | Private operator record / protected secret storage |
| --- | --- |
| Source, tests and generic deployment templates | Actual host inventory, SSH usernames/commands and client key locations |
| Public application URLs and on-chain addresses | Provider account/resource IDs and account-specific access procedures |
| Public source/artifact checksums and release evidence | Backup paths, private export receipts, checksums and restore transcripts |
| Feature status, architecture and general migration gates | Exact operator continuation, purchase/account details and private file references |
| Environment variable names and sample values | Secret values, private keys, mnemonics, tokens and database archives |

Deployment defaults already defined by public source are not secrets. Do not copy
an installation's actual inventory into a runbook or treat a public template as
proof of the live configuration. Public blockchain identities and product endpoints
remain documented where required to inspect the application.

## Workflow

1. Record exact operational evidence in the owner's private handoff first.
2. Update public HANDOFF/CURRENT_STATE with a concise status and remaining gates.
   Refer generically to the private handoff; do not publish its storage identifiers,
   download links, local paths or commands containing real access details.
3. Review staged files, generated archives, PR descriptions and commit messages.
   Avoid repeating removed values in the explanation or in CI output.
4. Keep private material outside the checkout. Ignore rules reduce accidental
   additions; they do not protect tracked files or override a forced add.
5. Preserve unredacted originals privately before reducing historical operational
   documents. Retain useful public evidence and identify privacy redactions.

This separation changes current documentation only. Existing Git history, earlier
PR diffs and external copies can retain previously public content. Do not claim
that a deletion erased prior disclosure, and do not rewrite shared history or
change repository visibility without a separately reviewed decision. Any exposed
credential would require revocation/rotation; deleting text is insufficient.

Current public entry points: [HANDOFF](../HANDOFF.md),
[CURRENT_STATE](CURRENT_STATE.md), [host checkpoint](OVH_SETUP_2026-10-08.md).
The private operations handoff remains authoritative for actual host actions.
