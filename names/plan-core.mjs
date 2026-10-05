import {CHAIN, NETA, DAO, TARIFF} from './service/constants.mjs';
import {SNAPSHOT_ARTIFACTS} from './mainnet-artifacts.mjs';
import {validatePricePublicKey} from './price-key.mjs';

export function deploymentPlan(key) {
  validatePricePublicKey(key);
  return {
    kind: 'unsigned-nns-mainnet-deployment-plan', chain_id: CHAIN,
    pricing_protocol: 'treasury-snapshot-v1',
    artifacts: SNAPSHOT_ARTIFACTS,
    registry_instantiate: {token: NETA, treasury: DAO, admin: DAO, quote_public_key: key, testnet_only: false},
    wasm_migration_admin: null,
    starts_paused: true, approved_tariff: TARIFF, price_policy: {source: 'existing Treasury WYND price', scheduled_minutes: 30, maximum_age_seconds: 86400},
    profiles_instantiate: 'Fill {registry: <verified new mainnet registry address>} after registry receipt.',
    next: ['Record upload and instantiate hashes, heights, code IDs and creator.',
      'Verify both contracts, immutable code hashes, treasury, quote key and paused config with two providers.',
      'Prepare the DAO tariff proposal; apply 99/19/5 while purchases remain paused.',
      'Configure the Actions price secret and verified manifest; verify the published signed snapshot and mainnet UI.',
      'Only then prepare a separate DAO unpause proposal and owner-signed purchase check.'],
  };
}
