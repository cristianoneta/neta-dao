# UNI-7 Names test token

Small `cw20-base` 1.1.2 wrapper for isolated NNS tests. Instantiation and execution
reject other chains and native funds. Instantiate `{}` to issue 1,000,000 six-decimal
TNETA to the sender. There is no minter or migration entrypoint. These are test
units, not real NETA. The owner-driven setup deploys a fresh instance.

Build with `scripts/build-wasm.sh neta-names-test-token`; CI checks the shipped
artifact under `assets/names-testnet` byte-for-byte. See the owner test runbook in
`docs/NNS_UNI7_OWNER_TEST_2026-10-04.md` for deployment/recovery details.
