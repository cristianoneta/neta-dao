import {MAINNET_REGISTRY_ADMIN} from './mainnet-config.mjs';
// Generates unsigned review material only. No RPC broadcast or wallet access.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {CHAIN, NETA, DAO, TARIFF} from './service/constants.mjs';
import {deploymentPlan} from './plan-core.mjs';
export {deploymentPlan} from './plan-core.mjs';
import {validateSnapshotDeployment} from './snapshot-deployment.mjs';
import {SNAPSHOT_ARTIFACTS} from './mainnet-artifacts.mjs';

export function tariffUpdate(manifest, config, tariff=TARIFF) {
  validateSnapshotDeployment(manifest);
  for (const k of ['chain_id', 'token', 'treasury', 'admin', 'quote_public_key', 'signer_version', 'testnet_only']) if (config?.[k] !== manifest[k]) throw Error('Registry config does not match the reviewed mainnet manifest.');
  if (typeof config.purchases_paused !== 'boolean' || !Number.isSafeInteger(config.tariff_version) || config.tariff_version < 1) throw Error('Review current registry configuration first.');
  for(const field of ['three_cents','four_cents','standard_cents'])if(!Number.isSafeInteger(tariff?.[field])||tariff[field]<1)throw Error('Tariffs must be positive integer USD cents.');
  const execute = {set_tariff: {tariff: {three_cents:tariff.three_cents,four_cents:tariff.four_cents,standard_cents:tariff.standard_cents}, expected_version: config.tariff_version}};
  return {kind: 'unsigned-owner-message-review', chain_id: CHAIN, signing_wallet: MAINNET_REGISTRY_ADMIN,
    description: `NNS annual registration and renewal: USD ${tariff.three_cents/100} / ${tariff.four_cents/100} / ${tariff.standard_cents/100} in NETA. Purchase pause is unchanged.`,
    decoded_execute: execute,
    msgs: [{wasm: {execute: {contract_addr: manifest.registry, msg: Buffer.from(JSON.stringify(execute)).toString('base64'), funds: []}}}],
    note: 'This is unsigned review material for the registry admin wallet, not a submitted transaction.'};
}

// Compatibility name for earlier unsigned review callers; this does not submit a DAO proposal.
export const tariffProposal=tariffUpdate;

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
