import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {NamesV2Reader,validateManifest} from '../names-v2-reader.mjs';
import {NAMES_TEST_ARTIFACTS} from '../names-v2-artifacts.mjs';
const f=JSON.parse(readFileSync(new URL('./fixtures/nns-adr36.json',import.meta.url)));
const owner=f.profile.identity.owner;
export const manifest={version:1,chain_id:'uni-7',testnet_only:true,registry:f.deployment.registry,token:'juno168ctmpyppk90d34p3jjy658zf5a5l3w8wk35wht6ccqj4mr0yv8s4j5awr',profile_contract:f.deployment.contract,admin:owner,treasury:owner,quote_public_key:Buffer.alloc(32,7).toString('base64'),signer_version:1,
 contracts:Object.fromEntries(['registry','token','profiles'].map((role,i)=>[role,{code_id:i+1,sha256:NAMES_TEST_ARTIFACTS[role].sha256,creator:owner,admin:null}]))};
function harness(){let mode='',calls=0;const now=1700000000;
 const config={...manifest,purchases_paused:false,tariff_version:1,tariff:{three_cents:64000,four_cents:16000,standard_cents:500}};
 const fetcher=async(url)=>{calls++;let data;const p=new URL(url).pathname;
 if(p.endsWith('/node_info'))data={default_node_info:{network:mode==='chain'?'juno-1':'uni-7'}};
 else if(p.endsWith('/blocks/latest'))data={block:{header:{chain_id:'uni-7',height:'100',time:new Date((mode==='stale'?now-121:now)*1000).toISOString()}}};
 else if(p.includes('/smart/')){const contract=p.split('/contract/')[1].split('/')[0],q=JSON.parse(Buffer.from(decodeURIComponent(p.split('/smart/')[1]),'base64').toString());
   if(q.token_info)data={data:{decimals:mode==='decimals'?8:6}};
   else if(q.config)data={data:contract===manifest.registry?{...config,...(mode==='key'?{quote_public_key:'other'}:{})}:{registry:mode==='profile'?manifest.token:manifest.registry}};
   else if(mode==='missing')data={};else data={data:null};
 }else if(p.includes('/code/')){const id=Number(p.split('/code/')[1]);const pin=Object.values(manifest.contracts).find(c=>c.code_id===id).sha256;const hashes={checksum:'00'.repeat(32),uppercase:pin.toUpperCase(),base64:Buffer.from(pin,'hex').toString('base64'),mixed:pin.slice(0,32).toUpperCase()+pin.slice(32),malformed:pin.slice(1)};data={code_info:{data_hash:hashes[mode]??pin}};}
 else{const addr=p.split('/contract/')[1],role=addr===manifest.registry?'registry':addr===manifest.token?'token':'profiles';data={contract_info:{code_id:String(manifest.contracts[role].code_id),creator:owner,admin:mode==='admin'?owner:''}};}
 return {ok:true,json:async()=>data};};return {reader:new NamesV2Reader({deployment:manifest,fetcher,now:()=>now}),mode:v=>mode=v,calls:()=>calls};}
test('reader pins all contract roles and rejects wrong chain, code, admin, token and quote authority',async()=>{
 for(const mode of ['chain','checksum','admin','decimals','key','profile','stale']){const h=harness();h.mode(mode);await assert.rejects(h.reader.verify());}
 const h=harness();assert.equal((await h.reader.verify()).chain_id,'uni-7');assert.ok(h.calls()>8);
});
test('missing query data is never interpreted as availability or zero ownership',async()=>{
 const h=harness();await h.reader.verify();h.mode('missing');await assert.rejects(h.reader.resolve('alice'),/Missing/);
 assert.throws(()=>validateManifest(null));assert.throws(()=>validateManifest({...manifest,chain_id:'juno-1'}));
 assert.throws(()=>validateManifest({...manifest,registry:manifest.registry.slice(0,-1)+'q'}));
 assert.throws(()=>validateManifest({...manifest,contracts:{}}));
});

test('chain code hashes accept uppercase, mixed-case hex and canonical base64 but retain exact identity checks',async()=>{
 for(const mode of ['uppercase','mixed','base64']){const h=harness();h.mode(mode);assert.equal((await h.reader.verify()).chain_id,'uni-7');}
 for(const mode of ['checksum','malformed']){const h=harness();h.mode(mode);await assert.rejects(h.reader.verify());}
});
