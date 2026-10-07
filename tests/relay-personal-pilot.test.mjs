import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PERSONAL_PILOT,assertPilotWallet} from '../relay-personal-pilot.mjs';
import {PERSONAL_MAINNET_DEPLOYMENT,personalMainnetProfile} from '../relay-personal-network.mjs';
import {PERSONAL_MAINNET_RELEASE} from '../relay-personal-release.mjs';

test('pilot binds real reviewed deployment and does not activate public messaging',async()=>{
  const receipts=JSON.parse(await readFile(new URL('../docs/deployments/personal-mainnet-deployment-receipts-2026-10-07.json',import.meta.url),'utf8'));
  const profile=personalMainnetProfile(PERSONAL_PILOT.deployment);
  assert.equal(profile.contract,receipts.deployment.contract);
  assert.equal(profile.codeId,String(receipts.deployment.codeId));
  assert.equal(profile.admin,receipts.deployment.admin);
  assert.equal(profile.codeHash,receipts.deployment.codeHash);
  assert.equal(PERSONAL_MAINNET_DEPLOYMENT,null);assert.equal(PERSONAL_MAINNET_RELEASE,null);
  assert.equal(PERSONAL_PILOT.backupUrl,'https://neta-junox-faucet.onrender.com');
  assert.equal(profile.policy.dao_enabled,false);
});
test('pilot accepts only both explicit participants, with immutable configuration',()=>{
  for(const wallet of PERSONAL_PILOT.wallets)assert.doesNotThrow(()=>assertPilotWallet(wallet));
  for(const wallet of [undefined,'',PERSONAL_PILOT.wallets[0].toUpperCase(),'juno1'+'q'.repeat(38)])
    assert.throws(()=>assertPilotWallet(wallet),/two participating wallets/);
  assert.throws(()=>PERSONAL_PILOT.wallets.push('other'),TypeError);
  assert.throws(()=>{PERSONAL_PILOT.deployment.contract='other';},TypeError);
});
test('pilot CSP pins backup/provider origins and uses separate signing artifact',async()=>{
  const html=await readFile(new URL('../relay-personal-pilot.html',import.meta.url),'utf8');
  const csp=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.ok(csp.includes(PERSONAL_PILOT.backupUrl));assert.ok(!csp.includes('*'));
  assert.ok(csp.includes("frame-src 'self'"));assert.ok(!csp.includes('unsafe-inline'));
  assert.ok(html.includes('assets/relay-personal-pilot-signing.js'));
  assert.ok(!html.includes('relay-personal-entry.mjs'));
});
