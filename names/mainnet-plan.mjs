// Generates unsigned review material only. No RPC broadcast or wallet access.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {CHAIN, NETA, DAO, TARIFF} from './service/constants.mjs';
import {publicKey} from './service/chain.mjs';
import {validateSnapshotDeployment} from './snapshot-deployment.mjs';
import {SNAPSHOT_ARTIFACTS} from './mainnet-artifacts.mjs';

export function deploymentPlan(key) {
  publicKey(key);
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
      'Finish mainnet frontend/wallet integration and configure the Actions price secret plus verified manifest; verify the published signed snapshot.',
      'Only then prepare a separate DAO unpause proposal and owner-signed purchase check.'],
  };
}
export function tariffProposal(manifest, config) {
  validateSnapshotDeployment(manifest);
  for (const k of ['chain_id', 'token', 'treasury', 'admin', 'quote_public_key', 'signer_version', 'testnet_only']) if (config?.[k] !== manifest[k]) throw Error('Registry config does not match the reviewed mainnet manifest.');
  if (config.purchases_paused !== true || !Number.isSafeInteger(config.tariff_version) || config.tariff_version < 1) throw Error('Review current paused registry configuration first.');
  const execute = {set_tariff: {tariff: TARIFF, expected_version: config.tariff_version}};
  return {kind: 'unsigned-dao-message-review', chain_id: CHAIN, executing_dao: DAO,
    description: 'NNS annual registration and renewal: USD 99 / 19 / 5 in NETA. Purchases remain paused.',
    decoded_execute: execute,
    msgs: [{wasm: {execute: {contract_addr: manifest.registry, msg: Buffer.from(JSON.stringify(execute)).toString('base64'), funds: []}}}],
    note: 'This is a DAO execution message, not a submitted proposal. Choose the actual DAO proposal module in its governance UI.'};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [key, output] = process.argv.slice(2);
  if (!key || !output) throw Error('Usage: node names/mainnet-plan.mjs <public-price-key> <output.json>');
  const plan = deploymentPlan(key);
  for (const artifact of Object.values(plan.artifacts)) {
    const bytes = readFileSync(new URL('../' + artifact.path, import.meta.url));
    if (createHash('sha256').update(bytes).digest('hex') !== artifact.sha256) throw Error('Local artifact checksum mismatch.');
  }
  writeFileSync(output, JSON.stringify(plan, null, 2) + '\n', {flag: 'wx', mode: 0o600});
}
