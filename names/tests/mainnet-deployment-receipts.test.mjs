import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateDeploymentReceipts} from '../verify-mainnet-deployment.mjs';
const bundle=JSON.parse(readFileSync(new URL('../../docs/deployments/nns-mainnet-receipts-2026-10-05.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../docs/deployments/nns-mainnet.json',import.meta.url)));
test('owner mainnet receipts match all four reviewed deployment intents and both paused observations',()=>{
  assert.deepEqual(validateDeploymentReceipts(bundle,manifest),manifest);
});
test('receipt verification rejects mixed receipts, wrong authorities, payloads and provider disagreement',()=>{
  for(const mutate of [
    b=>b.history[0].receipt.code=1,
    b=>b.history[1].request.migrationAdmin=b.manifest.treasury,
    b=>b.history[1].request.msg.admin=b.manifest.treasury,
    b=>b.history[3].request.msg.registry=b.manifest.profile_contract,
    b=>b.history[2].receipt.transactionHash=b.history[0].receipt.transactionHash,
    b=>b.history[0].receipt.events.find(e=>e.type==='store_code').attributes.find(a=>a.key==='code_id').value='1',
    b=>b.observations[1].provider=b.observations[0].provider,
    b=>b.observations[1].config.purchases_paused=false,
    b=>b.observations[0].config.tariff.standard_cents=1,
  ]){const changed=structuredClone(bundle);mutate(changed);assert.throws(()=>validateDeploymentReceipts(changed,manifest));}
});
