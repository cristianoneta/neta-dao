import {MAINNET_UPGRADE_ADMIN,MAINNET_REGISTRY_ADMIN} from './mainnet-config.mjs';
import {CHAIN, NETA, DAO, TARIFF} from './service/constants.mjs';
import {SNAPSHOT_ARTIFACTS} from './mainnet-artifacts.mjs';
import {validatePricePublicKey} from './price-key.mjs';

export function deploymentPlan(key) {
  validatePricePublicKey(key);
  return {
    kind: 'unsigned-nns-mainnet-deployment-plan', chain_id: CHAIN,
    pricing_protocol: 'treasury-snapshot-v1',
    artifacts: SNAPSHOT_ARTIFACTS,
    registry_instantiate: {token: NETA, treasury: DAO, admin: MAINNET_REGISTRY_ADMIN, quote_public_key: key, testnet_only: false},
    wasm_migration_admin: MAINNET_UPGRADE_ADMIN,
    starts_paused: true, approved_tariff: TARIFF, price_policy: {source: 'existing Treasury WYND price', scheduled_minutes: 30, maximum_age_seconds: 86400},
    profiles_instantiate: 'Fill {registry: <verified new mainnet registry address>} after registry receipt.',
    next: ['Record upload and instantiate hashes, heights, code IDs and creator.',
      'Verify both contracts, pinned code hashes, owner-wallet upgrade administrators, treasury, quote key and paused config with two providers.',
      'Verify the initial USD 99/19/5 tariff and owner-wallet admin while purchases remain paused.',
      'Configure the Actions price secret and verified manifest; verify the published signed snapshot and mainnet UI.',
      'Only then prepare a separate owner-wallet activation and purchase check.'],
  };
}
