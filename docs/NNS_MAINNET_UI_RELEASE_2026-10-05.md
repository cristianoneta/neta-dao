# Mainnet Names adapters and owner price-key setup

This follows Treasury-price PR #155. Mainnet reader, wallet, transaction bridge
and workspace now support the reviewed version-3 snapshot manifest. The network
selector preserves the existing UNI-7 lifecycle and journals. Mainnet is the
default selection, but missing deployment information blocks reads and writes;
no sample addresses, prices or active production state are substituted.

Mainnet reads verify chain freshness, registry/profile code IDs and pinned hashes,
creator/null migration admins, canonical NETA/DAO, public price key and registry
configuration. The signer uses allowlisted mainnet providers, JUNO gas and
chain-scoped journals. Confirmation uses exact transaction bytes and recovery
does not resubmit an uncertain transaction. Registration/renewal show the signed
price observation, expiry and exact NETA debit before the separate wallet action.

`names-mainnet-setup.html` lets the owner create/restore an Ed25519 price key,
download its private PEM backup, explicitly copy it for the Actions secret, and
download the public deployment plan. Only the public key enters localStorage.
No private key is rendered, logged or sent by the page (`connect-src 'none'`).
The page does not create a GitHub secret, deploy contracts or sign wallet messages.

Local checks: 118 root/Names Node tests and 50 faucet/signing tests passed.
Browser suites exercised both Names networks with synthetic chain/wallet data,
including actual Ed25519 price verification, shared-wallet handling, registration,
renewal, profile/transfer, stale reviews and uncertain outcomes across reloads.
The key-page suite checked backup compatibility, restoration, public-only storage,
absent-deployment gates and cross-tab preservation. Workspace security and profile
browser regressions were checked. Layouts were reviewed at desktop, tablet and
mobile widths; keyboard focus and reflow checks passed. Native browser zoom and
full assistive-technology testing remain open. See the release PR for remote CI
and publication evidence.

No production secret/key, new mainnet contract, production manifest, signed price
publication, wallet transaction or DAO execution was created. Next owner step:
create the key on the setup page, save the private backup, install Actions secret
`NNS_PRICE_SIGNING_KEY`, and share only the public key/plan. Then prepare and
owner-sign the deployment, verify receipts/manifest, configure the tariff while
paused, verify the real signed price, separately unpause through the DAO and
record an owner purchase. Validator live testing remains deferred.
