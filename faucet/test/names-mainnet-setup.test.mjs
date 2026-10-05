import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {TxRaw,TxBody,AuthInfo} from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import {MsgExecuteContract,MsgStoreCode,MsgInstantiateContract} from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import {toBech32,toHex,toBase64} from '@cosmjs/encoding';import {sha256} from '@cosmjs/crypto';
import {MainnetSetup} from '../../names/mainnet-deploy-core.mjs';
import {MAINNET_PRICE_KEY,MAINNET_UPGRADE_ADMIN,MAINNET_REGISTRY_ADMIN} from '../../names/mainnet-config.mjs';
import {NETA,DAO} from '../../names/service/constants.mjs';import {createBridge,validAddress} from '../src/names-signing.mjs';
import {SNAPSHOT_ARTIFACTS} from '../../names/mainnet-artifacts.mjs';
const owner=toBech32('juno',new Uint8Array(20).fill(1)),publicKey=MAINNET_PRICE_KEY;
const codecs={'/cosmwasm.wasm.v1.MsgStoreCode':MsgStoreCode,'/cosmwasm.wasm.v1.MsgInstantiateContract':MsgInstantiateContract,'/cosmwasm.wasm.v1.MsgExecuteContract':MsgExecuteContract};
function harness(){
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},held=new Set();
 const locks={request:async(key,_,fn)=>{if(held.has(key))return fn(null);held.add(key);try{return await fn({});}finally{held.delete(key);}}};
 const codes=new Map(),contracts=new Map(),receipts=new Map();let signs=0,broadcasts=0,lost=false;
 const client={getChainId:async()=>'juno-1',simulate:async()=>200000,sign:async(_,messages,fee,memo)=>{
  signs++;return {bodyBytes:TxBody.encode(TxBody.fromPartial({messages:messages.map(m=>({typeUrl:m.typeUrl,value:codecs[m.typeUrl].encode(m.value).finish()})),memo})).finish(),authInfoBytes:AuthInfo.encode(AuthInfo.fromPartial({signerInfos:[{sequence:1n}],fee:{amount:fee.amount,gasLimit:BigInt(fee.gas)}})).finish(),signatures:[new Uint8Array([1])]};
 },broadcastTxSync:async bytes=>{
  broadcasts++;const raw=TxRaw.decode(bytes),any=TxBody.decode(raw.bodyBytes).messages[0],m=codecs[any.typeUrl].decode(any.value),events=[];
  if(any.typeUrl.endsWith('MsgStoreCode')){const id=codes.size+1;codes.set(id,{creator:owner,data_hash:toHex(sha256(m.wasmByteCode))});events.push({type:'store_code',attributes:[{key:'code_id',value:String(id)}]});}
  else if(any.typeUrl.endsWith('MsgInstantiateContract')){const address=toBech32('juno',new Uint8Array(32).fill(contracts.size+2)),msg=JSON.parse(new TextDecoder().decode(m.msg));contracts.set(address,{code_id:m.codeId.toString(),creator:owner,admin:m.admin,msg,paused:true});events.push({type:'instantiate',attributes:[{key:'_contract_address',value:address}]});}
  else{const msg=JSON.parse(new TextDecoder().decode(m.msg));contracts.get(m.contract).paused=msg.set_purchases_paused.paused;}
  const hash=toHex(sha256(bytes)).toUpperCase();receipts.set(hash,{hash,tx:toBase64(bytes),height:'100',index:0,tx_result:{code:0,events,gas_wanted:'100',gas_used:'90'}});
  if(lost)throw Error('lost response');return {transactionHash:hash,height:100,code:0};
 }};
 const fetcher=async input=>{
  if(input.startsWith('assets/')){const body=await readFile(new URL('../../'+input,import.meta.url));return {ok:true,arrayBuffer:async()=>body};}
  const url=new URL(input),p=url.pathname;let data;
  if(p==='/status')data={result:{node_info:{network:'juno-1'}}};
  else if(p==='/tx')data={result:lost?undefined:receipts.get(url.searchParams.get('hash').replace(/^0x/,''))};
  else if(p.endsWith('node_info'))data={default_node_info:{network:'juno-1'}};
  else if(p.endsWith('/blocks/latest'))data={block:{header:{chain_id:'juno-1',height:'100',time:new Date().toISOString()}}};
  else if(p.includes('/code/'))data={code_info:codes.get(Number(p.split('/code/')[1]))};
  else if(p.includes('/smart/')){const c=contracts.get(p.split('/contract/')[1].split('/')[0]),query=JSON.parse(Buffer.from(decodeURIComponent(p.split('/smart/')[1]),'base64').toString());
   if(query.token_info)data={data:{decimals:6}};
   else if(c?.msg.token)data={data:{...c.msg,chain_id:'juno-1',signer_version:1,tariff_version:1,tariff:{three_cents:9900,four_cents:1900,standard_cents:500},purchases_paused:c.paused}};
   else data={data:c.msg};
  }else data={contract_info:contracts.get(p.split('/contract/')[1])};
  return {ok:true,json:async()=>data};
 };
 const opts={owner,publicKey,client,bundle:{createBridge:opts=>createBridge({...opts,wait:async()=>{}}),validAddress},assertWallet:async address=>assert.equal(address,owner),storage,locks,fetcher};
 return {fetcher,opts,setup:()=>new MainnetSetup(opts),signs:()=>signs,broadcasts:()=>broadcasts,storage,setLost:x=>lost=x,codes,contracts};
}
test('mainnet uses four explicit transactions, real NETA, pinned price key and DAO authority; exports two-provider evidence',async()=>{
 const h=harness(),s=h.setup();
 for(const role of ['registry','profiles'])for(const kind of ['store','instantiate']){
  const reviewed=await s.prepare(kind,role),before=h.signs();assert.equal(s.state().pending,null);
  if(kind==='instantiate')assert.equal(reviewed.request.migrationAdmin,MAINNET_UPGRADE_ADMIN);
  if(kind==='instantiate'&&role==='registry')assert.deepEqual(reviewed.request.msg,{token:NETA,treasury:DAO,admin:MAINNET_REGISTRY_ADMIN,quote_public_key:MAINNET_PRICE_KEY,testnet_only:false});
  await s.execute(reviewed);assert.equal(h.signs(),before+1);assert.equal(s.state().pending,null);
 }
 const exported=await s.exportBundle(),m=exported.manifest;
 assert.equal(h.signs(),4);assert.equal(h.broadcasts(),4);assert.equal(m.version,3);assert.equal(m.testnet_only,false);
 assert.equal(m.contracts.registry.sha256,SNAPSHOT_ARTIFACTS.registry.sha256);assert.equal(m.admin,MAINNET_REGISTRY_ADMIN);assert.equal(m.treasury,DAO);
 assert.equal(exported.history.length,4);assert.equal(exported.observations.length,2);assert.notEqual(exported.observations[0].provider,exported.observations[1].provider);
 for(const o of exported.observations)assert.equal(o.config.purchases_paused,true);
 for(const c of h.contracts.values()){assert.equal(c.admin,MAINNET_UPGRADE_ADMIN);assert.equal(c.paused,true);}
 await assert.rejects(s.prepare('store','registry'),/already/);
 await assert.rejects(s.prepare('unpause','registry'),/Unknown/);
 await assert.rejects(s.prepare('store','token'),/Unknown/);
});
test('mainnet upload timeout is recovered after reload without a second signature or broadcast',async()=>{
 const h=harness(),s=h.setup(),review=await s.prepare('store','registry');h.setLost(true);await assert.rejects(s.execute(review),/UNKNOWN/);
 assert.ok(s.state().pending);assert.equal(h.codes.size,1);assert.equal(s.state().roles.registry,undefined);
 const reloaded=h.setup();await assert.rejects(reloaded.prepare('store','registry'),/Reconcile/);
 h.setLost(false);await reloaded.recover();assert.equal(reloaded.state().roles.registry.codeId,1);assert.equal(reloaded.state().pending,null);assert.equal(h.signs(),1);assert.equal(h.broadcasts(),1);
});
test('mainnet rejects edited instantiate parameters, another price key and wrong chain before signing',async()=>{
 const h=harness(),s=h.setup();await s.execute(await s.prepare('store','registry'));const review=await s.prepare('instantiate','registry');review.request.msg.admin=owner;
 await assert.rejects(s.execute(review),/changed/);assert.equal(h.signs(),1);assert.equal(s.state().pending,null);
 assert.throws(()=>new MainnetSetup({...h.opts,publicKey:Buffer.alloc(32,7).toString('base64')}),/key mismatch/);
 const bad=new MainnetSetup({...h.opts,fetcher:async()=>({ok:true,json:async()=>({default_node_info:{network:'uni-7'}})})});
 await assert.rejects(bad.network(),/MISMATCH/);assert.equal(h.signs(),1);
});
test('final manifest requires both providers and paused configuration, preserving deployment state on failure',async()=>{
 const h=harness(),s=h.setup();for(const role of ['registry','profiles'])for(const kind of ['store','instantiate'])await s.execute(await s.prepare(kind,role));
 const unavailable=new MainnetSetup({...h.opts,fetcher:async url=>url.startsWith('https://juno.api.m.stavr.tech')?{ok:false,status:503}:h.fetcher(url)});
 await assert.rejects(unavailable.exportBundle(),/503/);assert.equal(s.state().history.length,4);
 h.contracts.get(s.state().roles.registry.address).paused=false;
 await assert.rejects(s.exportBundle(),/remain paused/);assert.equal(h.signs(),4);
});

test('missing or substituted upgrade authority cannot be newly signed on mainnet',async()=>{
 for(const admin of [undefined,owner]){
  const h=harness(),s=h.setup();await s.execute(await s.prepare('store','registry'));
  const review=await s.prepare('instantiate','registry');if(admin===undefined)delete review.request.migrationAdmin;else review.request.migrationAdmin=admin;
  await assert.rejects(s.execute(review),/changed/);assert.equal(h.signs(),1);
  const r={...review.request,intentId:'02'.repeat(16)};
  const b=createBridge({...h.opts,chainId:'juno-1',lookup:async()=>null,verifyDeployment:async()=>{}});
  await assert.rejects(b.execute(r),/administrator/);assert.equal(h.signs(),1);
 }
});
test('wallet cannot remove the reviewed owner-wallet migration administrator from signed protobuf',async()=>{
 const h=harness(),s=h.setup();await s.execute(await s.prepare('store','registry'));const sign=h.opts.client.sign;
 h.opts.client.sign=async(owner,messages,fee,memo)=>sign(owner,messages.map(m=>({...m,value:{...m.value,admin:''}})),fee,memo);
 await assert.rejects(s.execute(await s.prepare('instantiate','registry')),/payload/);assert.equal(h.broadcasts(),1);
 assert.equal((await s.recover()).notBroadcast,true);assert.equal(s.state().pending,null);
});
test('legacy no-admin pending creation is reconciled exactly but cannot continue or silently gain an upgrade administrator',async()=>{
 const {attemptKey}=await import('../src/names-signing.mjs');
 const h=harness(),s=h.setup();await s.execute(await s.prepare('store','registry'));
 const reviewed=await s.prepare('instantiate','registry'),request={...reviewed.request,intentId:'03'.repeat(16)};delete request.migrationAdmin;
 const value=MsgInstantiateContract.fromPartial({sender:owner,admin:'',codeId:BigInt(request.codeId),label:request.label,msg:new TextEncoder().encode(JSON.stringify(request.msg)),funds:[]});
 const raw=await h.opts.client.sign(owner,[{typeUrl:'/cosmwasm.wasm.v1.MsgInstantiateContract',value}],{amount:[{denom:'ujuno',amount:'1000'}],gas:'100000'},request.memo);
 const bytes=TxRaw.encode(raw).finish(),hash=toHex(sha256(bytes)).toUpperCase();await h.opts.client.broadcastTxSync(bytes);
 const state=s.state();state.pending={kind:'instantiate',role:'registry',request};s.save(state);
 h.storage.setItem(attemptKey(owner,request.intentId,'juno-1'),JSON.stringify({version:1,request,status:'pending',hash,bytes:toBase64(bytes)}));
 const before=h.signs();const receipt=await h.setup().recover();assert.equal(receipt.transactionHash,hash);assert.equal(h.signs(),before);assert.equal(h.broadcasts(),2);
 assert.equal(s.state().roles.registry.migrationAdmin,'');assert.equal(s.state().pending,null);assert.equal(s.state().history.length,2);
 await assert.rejects(s.prepare('store','profiles'),/upgrade administrator mismatch/);assert.equal(h.signs(),before);
});
