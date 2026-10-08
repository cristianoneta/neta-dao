# Dependency maintenance backlog

The owner requested an end to automatic version-update PR waves. The 32 open
Dependabot PRs below were inventoried on 8 October before consolidation. Their
proposed package upgrades are not part of the infrastructure migration.
Closing an unmerged version PR does not fix a vulnerability or dismiss an alert.

Keep security alerts and the weekly audit. Review potentially applicable advisories
first (including the CosmJS and GitHub Actions release notes in this inventory),
then prepare one reviewed maintenance batch. Do not combine unreviewed major
CosmWasm/storage/schema upgrades with a hosting migration. Version PR limits are
zero; security updates have separate behavior and are not subject to that limit.

| Original PR | Proposed update |
| --- | --- |
| [#256](https://github.com/cristianoneta/neta-dao/pull/256) | Bump sha2 from 0.10.9 to 0.11.0 in /contracts/neta-names |
| [#255](https://github.com/cristianoneta/neta-dao/pull/255) | Bump thiserror from 1.0.69 to 2.0.21 in /contracts/neta-names |
| [#254](https://github.com/cristianoneta/neta-dao/pull/254) | Bump cosmwasm-std from 1.5.11 to 3.0.10 in /contracts/neta-names |
| [#253](https://github.com/cristianoneta/neta-dao/pull/253) | Bump actions/cache from 4.2.3 to 6.1.0 |
| [#252](https://github.com/cristianoneta/neta-dao/pull/252) | Bump actions/checkout from 4.2.2 to 7.0.1 |
| [#251](https://github.com/cristianoneta/neta-dao/pull/251) | Bump actions/setup-node from 4.4.0 to 7.0.0 |
| [#250](https://github.com/cristianoneta/neta-dao/pull/250) | Bump bech32 from 0.9.1 to 0.12.0 in /contracts/neta-validator-profiles |
| [#249](https://github.com/cristianoneta/neta-dao/pull/249) | Bump schemars from 0.8.22 to 1.2.2 in /contracts/neta-validator-profiles |
| [#248](https://github.com/cristianoneta/neta-dao/pull/248) | Bump cosmwasm-std from 1.5.11 to 3.0.10 in /contracts/neta-validator-profiles |
| [#247](https://github.com/cristianoneta/neta-dao/pull/247) | Bump @ubjs/node from 0.31.0-5 to 0.31.0-6 in /spikes/relay-corecrypto |
| [#246](https://github.com/cristianoneta/neta-dao/pull/246) | Bump @ubjs/core from 0.31.0-5 to 0.31.0-6 in /spikes/relay-corecrypto |
| [#245](https://github.com/cristianoneta/neta-dao/pull/245) | Bump @cosmjs/encoding from 0.38.1 to 0.39.0 in /faucet |
| [#243](https://github.com/cristianoneta/neta-dao/pull/243) | Bump prettier from 3.6.2 to 3.9.9 in /faucet |
| [#244](https://github.com/cristianoneta/neta-dao/pull/244) | Bump @cosmjs/crypto from 0.38.1 to 0.39.0 in /relay-backup |
| [#242](https://github.com/cristianoneta/neta-dao/pull/242) | Bump cosmwasm-std from 1.5.11 to 3.0.10 in /contracts/neta-names-test-token |
| [#241](https://github.com/cristianoneta/neta-dao/pull/241) | Bump cw20 from 1.1.2 to 2.0.0 in /contracts/neta-names-v2 |
| [#240](https://github.com/cristianoneta/neta-dao/pull/240) | Bump @cosmjs/proto-signing from 0.38.1 to 0.39.0 in /faucet |
| [#239](https://github.com/cristianoneta/neta-dao/pull/239) | Bump @cosmjs/amino from 0.38.1 to 0.39.0 in /relay-backup |
| [#238](https://github.com/cristianoneta/neta-dao/pull/238) | Bump cosmwasm-std from 1.5.11 to 3.0.10 in /contracts/workshop-access-mock |
| [#237](https://github.com/cristianoneta/neta-dao/pull/237) | Bump @cosmjs/encoding from 0.38.1 to 0.39.0 in /relay-backup |
| [#236](https://github.com/cristianoneta/neta-dao/pull/236) | Bump schemars from 0.8.22 to 1.2.2 in /contracts/neta-names-v2 |
| [#235](https://github.com/cristianoneta/neta-dao/pull/235) | Bump cw2 from 1.1.2 to 3.0.0 in /contracts/workshop-access-mock |
| [#234](https://github.com/cristianoneta/neta-dao/pull/234) | Bump cosmwasm-schema from 1.5.11 to 3.0.10 in /contracts/workshop-access-mock |
| [#233](https://github.com/cristianoneta/neta-dao/pull/233) | Bump cw20-base from 1.1.2 to 2.0.0 in /contracts/neta-names-test-token |
| [#232](https://github.com/cristianoneta/neta-dao/pull/232) | Bump ed25519-zebra from 3.1.0 to 5.0.0 in /contracts/neta-names-v2 |
| [#231](https://github.com/cristianoneta/neta-dao/pull/231) | Bump cw-storage-plus from 1.2.0 to 3.0.1 in /contracts/neta-proposal-workshop |
| [#230](https://github.com/cristianoneta/neta-dao/pull/230) | Bump cw20 from 1.1.2 to 2.0.0 in /contracts/neta-names-test-token |
| [#229](https://github.com/cristianoneta/neta-dao/pull/229) | Bump schemars from 0.8.22 to 1.2.2 in /contracts/neta-relay-mailbox |
| [#228](https://github.com/cristianoneta/neta-dao/pull/228) | Bump cw2 from 1.1.2 to 3.0.0 in /contracts/neta-relay-mailbox |
| [#227](https://github.com/cristianoneta/neta-dao/pull/227) | Bump thiserror from 1.0.69 to 2.0.21 in /contracts/neta-proposal-workshop |
| [#226](https://github.com/cristianoneta/neta-dao/pull/226) | Bump schemars from 0.8.22 to 1.2.2 in /contracts/neta-proposal-workshop |
| [#225](https://github.com/cristianoneta/neta-dao/pull/225) | Bump thiserror from 1.0.69 to 2.0.21 in /contracts/neta-relay-mailbox |
