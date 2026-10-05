import {MAINNET_UPGRADE_ADMIN,MAINNET_REGISTRY_ADMIN} from '../names/mainnet-config.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {NamesV2Reader} from '../names-v2-reader.mjs';
import {NamesV2Client} from '../names-v2-client.mjs';
import {SNAPSHOT_ARTIFACTS} from '../names/mainnet-artifacts.mjs';
import {NETA,DAO} from '../names/service/constants.mjs';
import {createPriceKey,restorePriceKey} from '../names/price-key.mjs';
import {priceSnapshotPreimage} from '../names-v2-core.mjs';
const f=JSON.parse(readFileSync(new URL('./fixtures/nns-adr36.json',import.meta.url)));
const owner=f.profile.identity.owner;
const privateKey=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.alloc(32,7)]),type:'pkcs8',format:'der'});
export const mainnetManifest={version:3,pricing_protocol:'treasury-snapshot-v1',chain_id:'juno-1',testnet_only:false,registry:f.deployment.registry,profile_contract:f.deployment.contract,token:NETA,treasury:DAO,admin:MAINNET_REGISTRY_ADMIN,signer_version:1,quote_public_key:createPublicKey(privateKey).export({type:'spki',format:'der'}).subarray(-32).toString('base64'),contracts:Object.fromEntries(['registry','profiles'].map((role,i)=>[role,{code_id:i+100,sha256:SNAPSHOT_ARTIFACTS[role].sha256,creator:owner,admin:MAINNET_UPGRADE_ADMIN}]))};
const now=1791190800, config={...mainnetManifest,tariff_version:2,tariff:{three_cents:9900,four_cents:1900,standard_cents:500},purchases_paused:false};
test('mainnet reader verifies real NETA, both contract pins and owner-wallet upgrade administrators and chain; wrong identities fail closed',async()=>{
  for(const mode of ['ok','chain','key','checksum','decimals','admin','no-admin']){
    const fetcher=async url=>{const p=new URL(url).pathname;let data;
      if(p.endsWith('node_info'))data={default_node_info:{network:mode==='chain'?'uni-7':'juno-1'}};
      else if(p.endsWith('blocks/latest'))data={block:{header:{chain_id:'juno-1',height:'100',time:new Date(now*1000).toISOString()}}};
      else if(p.includes('/smart/')){const c=p.split('/contract/')[1].split('/')[0];data={data:c===NETA?{decimals:mode==='decimals'?8:6}:c===mainnetManifest.registry?{...config,quote_public_key:mode==='key'?'bad':config.quote_public_key}:{registry:mainnetManifest.registry}};}
      else if(p.includes('/code/'))data={code_info:{data_hash:mode==='checksum'?'00'.repeat(32):Object.values(mainnetManifest.contracts).find(c=>c.code_id===Number(p.split('/').pop())).sha256}};
      else {const c=p.split('/').pop(),pin=mainnetManifest.contracts[c===mainnetManifest.registry?'registry':'profiles'];data={contract_info:{code_id:pin.code_id,creator:owner,admin:mode==='admin'?DAO:mode==='no-admin'?'':MAINNET_UPGRADE_ADMIN}};}
      return {ok:true,json:async()=>data};
    };
    const reader=new NamesV2Reader({deployment:mainnetManifest,fetcher,now:()=>now});
    if(mode==='ok')assert.equal((await reader.verify()).chain_id,'juno-1');else await assert.rejects(reader.verify());
  }
});
test('mainnet purchase uses signed Treasury data, exact NETA amount and chain-scoped recovery',async()=>{
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};let commitment=null,record=null,writes=[],lost=false;
  const reader={verify:async()=>config,resolve:async name=>({name,available:true,next_generation:1}),nameOf:async address=>({address,name:null}),commitment:async()=>commitment,identity:async()=>record};
  const client=new NamesV2Client({deployment:mainnetManifest,reader,storage,walletAddress:async()=>owner,withLock:async(_k,fn)=>fn(),now:()=>now,execute:async r=>{writes.push(r);if(r.msg.commit)commitment=r.msg.commit;else if(r.msg.send){const hook=JSON.parse(atob(r.msg.send.msg));assert.ok(hook.register_snapshot);assert.equal(r.contract,NETA);assert.equal(r.msg.send.amount,'2500000');record={...hook.register_snapshot.offer.quote,expires_at:now+31536000};}if(lost)throw Error('unknown');return {chainId:'juno-1',transactionHash:'A'.repeat(64),height:100,code:0};}});
  await client.prepareRegistration({owner,name:'alice',years:1});await client.commit(owner);
  const snapshot={signer_version:1,usd_per_neta_12:'2000000000000',observed_at:now-60,expires_at:now+86340};
  const signed={schema_version:1,chain_id:'juno-1',registry:mainnetManifest.registry,token:NETA,treasury:DAO,snapshot,signature:sign(null,Buffer.from(priceSnapshotPreimage(mainnetManifest,config,snapshot)),privateKey).toString('base64')};
  const offer=await client.snapshotQuote({payer:owner,name:'alice.neta',years:1,operation:'register',fetcher:async()=>({ok:true,text:async()=>JSON.stringify(signed)})});
  lost=true;await assert.rejects(client.register(owner,offer),/unknown/);assert.equal(client.load(owner).phase,'payment_pending');
  assert.ok(client.key(owner).includes(':juno-1:'));assert.equal(writes.length,2);
  await assert.rejects(client.register(owner,offer));assert.equal(writes.length,2);
  assert.throws(()=>client.receipt({chainId:'uni-7',transactionHash:'A'.repeat(64),height:100,code:0}),/receipt/);
});
test('browser PEM backup matches Node publisher key format; restoring rejects wrong keys without exposing input',async()=>{
  const a=await createPriceKey(),b=await createPriceKey();
  assert.equal(createPublicKey(createPrivateKey(a.privatePem)).export({type:'spki',format:'der'}).subarray(-32).toString('base64'),a.publicKey);
  assert.deepEqual(await restorePriceKey(a.privatePem,a.publicKey),a);
  await assert.rejects(restorePriceKey(b.privatePem,a.publicKey),e=>!e.message.includes(b.privatePem)&&/matching/.test(e.message));
  await assert.rejects(restorePriceKey('secret-invalid-value'),e=>!e.message.includes('secret-invalid-value'));
});
