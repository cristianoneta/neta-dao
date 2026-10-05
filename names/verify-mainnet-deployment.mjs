// Read-only deployment attestation. No wallet, signing key or broadcast is used.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {validateSnapshotDeployment} from './snapshot-deployment.mjs';
import {MAINNET_PRICE_KEY,MAINNET_UPGRADE_ADMIN} from './mainnet-config.mjs';
import {SNAPSHOT_ARTIFACTS} from './mainnet-artifacts.mjs';
import {MainnetSetup} from './mainnet-deploy-core.mjs';
import {NamesV2Reader} from '../names-v2-reader.mjs';
import {lookupTransaction} from '../juno-faucet-transactions.mjs';
import {namesNetwork} from './networks.mjs';
import {TARIFF} from './service/constants.mjs';

function eventValue(events,type,key) {
  const values=[];
  for(const e of events||[])if(e.type===type)for(const a of e.attributes||[]){
    if(a.key===key)values.push(a.value);
    else if(Buffer.from(a.key,'base64').toString()===key)values.push(Buffer.from(a.value,'base64').toString());
  }
  assert.equal(new Set(values).size,1,`Unique ${type}/${key} event required`);
  return values[0];
}
function checkEvents(events,request,m) {
  const pin=m.contracts[request.role];
  if(request.kind==='store'){
    assert.equal(eventValue(events,'store_code','code_id'),String(pin.code_id));
    assert.equal(eventValue(events,'store_code','code_checksum').toLowerCase(),pin.sha256);
  }else{
    assert.equal(eventValue(events,'instantiate','code_id'),String(pin.code_id));
    assert.equal(eventValue(events,'instantiate','_contract_address'),request.role==='registry'?m.registry:m.profile_contract);
  }
}
export function validateDeploymentReceipts(bundle,manifest) {
  const m=validateSnapshotDeployment(manifest);
  assert.equal(bundle.kind,'nns-mainnet-deployment-receipts');
  assert.deepEqual(bundle.manifest,m);
  assert.equal(m.quote_public_key,MAINNET_PRICE_KEY);
  assert.equal(m.signer_version,1);
  for(const pin of Object.values(m.contracts))assert.equal(pin.creator,MAINNET_UPGRADE_ADMIN);
  assert.equal(bundle.history.length,4);
  assert.equal(new Set(bundle.history.map(x=>x.receipt.transactionHash)).size,4);
  const state={roles:{}};
  for(const [i,[kind,role]] of [['store','registry'],['instantiate','registry'],['store','profiles'],['instantiate','profiles']].entries()){
    const {request,receipt}=bundle.history[i];
    const expected=MainnetSetup.prototype.recipe.call({owner:MAINNET_UPGRADE_ADMIN,publicKey:MAINNET_PRICE_KEY},kind,role,state);
    const {intentId,...actual}=request;
    assert.match(intentId,/^[a-f0-9]{32}$/);assert.deepEqual(actual,expected);
    assert.match(receipt.transactionHash,/^[A-F0-9]{64}$/);
    assert.equal(receipt.chainId,'juno-1');assert.equal(receipt.code,0);assert.equal(receipt.intentMatched,true);
    assert.ok(Number.isSafeInteger(receipt.height)&&receipt.height>0);
    if(i)assert.ok(receipt.height>=bundle.history[i-1].receipt.height);
    checkEvents(receipt.events,request,m);
    state.roles[role]={codeId:m.contracts[role].code_id,...(kind==='instantiate'?{address:role==='registry'?m.registry:m.profile_contract,migrationAdmin:MAINNET_UPGRADE_ADMIN}:{})};
  }
  assert.deepEqual(bundle.observations.map(x=>x.provider).sort(),[...namesNetwork('juno-1').rests].sort());
  for(const o of bundle.observations){
    assert.ok(Number.isSafeInteger(o.block.height)&&o.block.height>=bundle.history.at(-1).receipt.height);
    assert.ok(Number.isFinite(o.block.time)&&o.block.time>0);
    assert.deepEqual(o.config,{chain_id:m.chain_id,token:m.token,treasury:m.treasury,admin:m.admin,quote_public_key:m.quote_public_key,signer_version:1,tariff:TARIFF,tariff_version:1,purchases_paused:true,testnet_only:false});
  }
  return m;
}
export async function verifyLiveDeployment(bundle,manifest,{fetcher=fetch}={}) {
  const m=validateDeploymentReceipts(bundle,manifest);
  // Reuse the wallet bridge's exact protobuf matcher; no new transaction decoder.
  const {matchTransaction}=await import('../faucet/src/names-signing.mjs');
  const transactions=[];
  for(const {request,receipt} of bundle.history){
    const found=await lookupTransaction(receipt.transactionHash,fetcher,'juno-1');
    assert.ok(found,'Exact transaction unavailable: '+receipt.transactionHash);
    assert.equal(found.height,receipt.height);assert.equal(found.code,0);
    const full={...request};
    if(request.kind==='store')full.wasm=readFileSync(new URL('../'+SNAPSHOT_ARTIFACTS[request.role].path,import.meta.url)).toString('base64');
    matchTransaction(found.tx,full);checkEvents(found.events,request,m);
    transactions.push({action:request.kind+' '+request.role,hash:found.hash,height:found.height,code:found.code,exact_payload_matched:true});
  }
  const observations=[];
  for(const provider of namesNetwork('juno-1').rests){
    const reader=new NamesV2Reader({deployment:m,fetcher});
    reader.network={...reader.network,rests:[provider]};
    const config=await reader.verify();
    assert.equal(config.purchases_paused,true,'Launch verification requires purchases paused');
    assert.deepEqual(config.tariff,TARIFF);assert.equal(config.tariff_version,1);
    observations.push({provider,block:reader.block,config});
  }
  assert.deepEqual(observations[0].config,observations[1].config);
  return {kind:'independent-nns-mainnet-verification',verified_at:new Date().toISOString(),manifest:m,transactions,observations,note:'Trusted provider observations and exact transaction bytes; not a Tendermint light-client proof. No writes performed.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [receiptPath,manifestPath,output]=process.argv.slice(2);
  const result=await verifyLiveDeployment(JSON.parse(readFileSync(receiptPath,'utf8')),JSON.parse(readFileSync(manifestPath,'utf8')));
  if(output)writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}
