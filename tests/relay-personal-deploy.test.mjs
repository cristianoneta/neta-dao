import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PersonalMainnetSetup,connectPersonalSetup,PERSONAL_DEPLOY_ARTIFACT,PERSONAL_DEPLOY_LABEL} from '../relay-personal-deploy-core.mjs';
import {PERSONAL_MAINNET_OWNER as owner,PERSONAL_MAINNET_WASM as hash,PERSONAL_MAINNET_POLICY as policy} from '../relay-personal-network.mjs';
import {PERSONAL_MAINNET_RELEASE} from '../relay-personal-release.mjs';
const wasm=await readFile(new URL('../'+PERSONAL_DEPLOY_ARTIFACT,import.meta.url));
const address='juno1'+'q'.repeat(58),locks={request:async(key,opts,fn)=>fn({})};
function fixture(){
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
 let writes=0,lost=false,bad=null,bridgeOptions;
 const receipt=r=>({chainId:'juno-1',transactionHash:(r.kind==='store'?'A':'B').repeat(64),height:123,code:0,intentMatched:true,
  events:[{type:r.kind==='store'?'store_code':'instantiate',attributes:[r.kind==='store'?{key:'code_id',value:'321'}:{key:'_contract_address',value:address}]}]});
 const bundle={validAddress:s=>s===address,createBridge:o=>{bridgeOptions=o;return {execute:async r=>{await o.verifyDeployment();writes++;if(lost)throw Error('UNKNOWN');return receipt(r);},recover:async r=>{await o.verifyDeployment();return receipt(r);}};}};
 const fetcher=async url=>{
  if(url===PERSONAL_DEPLOY_ARTIFACT)return {ok:true,arrayBuffer:async()=>bad==='wasm'?new Uint8Array(9):wasm};
  let data;if(url.endsWith('node_info'))data={default_node_info:{network:bad==='chain'?'uni-7':'juno-1'}};
  else if(url.endsWith('blocks/latest'))data={block:{header:{chain_id:'juno-1',height:'123',time:bad==='stale'?'2020-01-01T00:00:00Z':new Date().toISOString()}}};
  else if(url.includes('/code/'))data={code_info:{creator:bad==='creator'?'other':owner,data_hash:bad==='hash'?'0'.repeat(64):hash}};
  else if(url.includes('/smart/'))data={data:bad==='policy'?{...policy,dao_enabled:true}:policy};
  else data={contract_info:{code_id:'321',creator:owner,admin:bad==='admin'?'':owner,label:PERSONAL_DEPLOY_LABEL}};
  if(bad==='provider'&&url.includes('stavr'))return {ok:false,status:503};return {ok:true,json:async()=>data};
 };
 const setup=new PersonalMainnetSetup({owner,client:{},bundle,storage,locks,fetcher,assertWallet:async()=>{if(bad==='wallet')throw Error('wallet changed');}});
 return {setup,storage,map,receipt,bundle,fetcher,get writes(){return writes;},set lost(v){lost=v;},set bad(v){bad=v;},get bridgeOptions(){return bridgeOptions;}};
}
test('owner-reviewed upload/create exports verified policy and upgrade custody without activation',async()=>{
 const f=fixture();assert.equal(PERSONAL_MAINNET_RELEASE,null);
 await assert.rejects(f.setup.prepare('instantiate'),/Upload once/);
 const upload=await f.setup.prepare('store');assert.equal(f.writes,0);await f.setup.execute(upload);
 const create=await f.setup.prepare('instantiate');assert.equal(create.request.migrationAdmin,owner);assert.deepEqual(create.request.msg,{mainnet:true});await f.setup.execute(create);
 const exported=await f.setup.exportBundle();assert.equal(f.writes,2);assert.equal(exported.deployment.admin,owner);assert.equal(exported.deployment.codeHash,hash);assert.equal(exported.activated,false);assert.deepEqual(exported.policy,policy);assert.equal(exported.observations.length,2);
 await assert.rejects(f.setup.prepare('store'),/already/);await assert.rejects(f.setup.prepare('instantiate'),/Upload once/);
});
test('lost response retains intent and receipt recovery never signs again',async()=>{
 const f=fixture();f.lost=true;await assert.rejects(f.setup.execute(await f.setup.prepare('store')),/UNKNOWN/);
 const saved=f.storage.getItem(f.setup.key);await assert.rejects(f.setup.prepare('store'),/pending/);assert.equal(f.storage.getItem(f.setup.key),saved);
 await f.setup.recover();assert.equal(f.writes,1);assert.equal(f.setup.state().codeId,321);assert.equal(f.setup.state().pending,null);
});
test('changed review, artifact, owner, network and either provider block before signing',async()=>{
 for(const bad of ['wasm','wallet','chain','stale','provider']){const f=fixture();f.bad=bad;await assert.rejects(f.setup.prepare('store'));assert.equal(f.writes,0);}
 const f=fixture(),review=await f.setup.prepare('store');review.request.owner='other';await assert.rejects(f.setup.execute(review),/review changed/);assert.equal(f.writes,0);
 assert.throws(()=>new PersonalMainnetSetup({owner:'other',bundle:f.bundle,storage:f.storage,locks}),/owner/);
});
test('bad code or admin/policy receipt evidence preserves unresolved deployment',async()=>{
 for(const bad of ['hash','creator','admin','policy']){
  const f=fixture();if(['admin','policy'].includes(bad))await f.setup.execute(await f.setup.prepare('store'));
  const review=await f.setup.prepare(bad==='hash'||bad==='creator'?'store':'instantiate');f.lost=true;await assert.rejects(f.setup.execute(review),/UNKNOWN/);
  f.bad=bad;await assert.rejects(f.setup.recover());assert.ok(f.setup.state().pending);assert.equal(f.writes,bad==='hash'||bad==='creator'?1:2);
 }
});
test('ambiguous events cannot settle a pending upload',async()=>{
 const f=fixture();f.lost=true;await assert.rejects(f.setup.execute(await f.setup.prepare('store')),/UNKNOWN/);
 const r=f.receipt({kind:'store'});r.events[0].attributes.push({key:'code_id',value:'322'});await assert.rejects(f.setup.settle(r),/Ambiguous/);assert.ok(f.setup.state().pending);
});
test('late connection cancellation disposes RPC client and never returns owner session',async()=>{
 let current=true,disposed=0;const f=fixture();
 const keplr={enable:async()=>{},getOfflineSigner:()=>({getAccounts:async()=>[{address:owner}]})};
 await assert.rejects(connectPersonalSetup({keplr,bundle:{...f.bundle,connect:async()=>{current=false;return {disconnect(){disposed++;}};}},storage:f.storage,locks,fetcher:f.fetcher,assertCurrent:()=>{if(!current)throw Error('session changed');}}),/session changed/);
 assert.equal(disposed,1);assert.equal(f.writes,0);
});
