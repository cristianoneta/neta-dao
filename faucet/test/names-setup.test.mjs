import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {TxRaw,TxBody,AuthInfo} from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import {MsgExecuteContract,MsgStoreCode,MsgInstantiateContract} from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import {toBech32,toHex,toBase64} from '@cosmjs/encoding';import {sha256} from '@cosmjs/crypto';
import {NamesSetup} from '../../names-v2-setup-core.mjs';import {createBridge,validAddress} from '../src/names-signing.mjs';
import {NAMES_TEST_ARTIFACTS} from '../../names-v2-artifacts.mjs';
const owner=toBech32('juno',new Uint8Array(20).fill(1)),publicKey=Buffer.alloc(32,7).toString('base64');
const codecs={'/cosmwasm.wasm.v1.MsgStoreCode':MsgStoreCode,'/cosmwasm.wasm.v1.MsgInstantiateContract':MsgInstantiateContract,'/cosmwasm.wasm.v1.MsgExecuteContract':MsgExecuteContract};
function harness(){
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},held=new Set();
 const locks={request:async(key,_,fn)=>{if(held.has(key))return fn(null);held.add(key);try{return await fn({});}finally{held.delete(key);}}};
 const codes=new Map(),contracts=new Map(),receipts=new Map();let signs=0,broadcasts=0,lost=false;
 const client={getChainId:async()=>'uni-7',simulate:async()=>200000,sign:async(_,messages,fee,memo)=>{
  signs++;return {bodyBytes:TxBody.encode(TxBody.fromPartial({messages:messages.map(m=>({typeUrl:m.typeUrl,value:codecs[m.typeUrl].encode(m.value).finish()})),memo})).finish(),authInfoBytes:AuthInfo.encode(AuthInfo.fromPartial({signerInfos:[{sequence:1n}],fee:{amount:fee.amount,gasLimit:BigInt(fee.gas)}})).finish(),signatures:[new Uint8Array([1])]};
 },broadcastTx:async bytes=>{
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
  if(p==='/status')data={result:{node_info:{network:'uni-7'}}};
  else if(p==='/tx')data={result:receipts.get(url.searchParams.get('hash').replace(/^0x/,''))};
  else if(p.endsWith('node_info'))data={default_node_info:{network:'uni-7'}};
  else if(p.endsWith('/blocks/latest'))data={block:{header:{chain_id:'uni-7',height:'100',time:new Date().toISOString()}}};
  else if(p.includes('/code/'))data={code_info:codes.get(Number(p.split('/code/')[1]))};
  else if(p.includes('/smart/')){const c=contracts.get(p.split('/contract/')[1].split('/')[0]),query=JSON.parse(Buffer.from(decodeURIComponent(p.split('/smart/')[1]),'base64').toString());
   if(query.token_info)data={data:{decimals:6}};
   else if(c.msg.token)data={data:{...c.msg,chain_id:'uni-7',signer_version:1,tariff_version:1,tariff:{three_cents:64000,four_cents:16000,standard_cents:500},purchases_paused:c.paused}};
   else data={data:c.msg};
  }else data={contract_info:contracts.get(p.split('/contract/')[1])};
  return {ok:true,json:async()=>data};
 };
 const opts={owner,publicKey,client,bundle:{createBridge,validAddress},assertWallet:async address=>assert.equal(address,owner),storage,locks,fetcher};
 return {setup:()=>new NamesSetup(opts),signs:()=>signs,broadcasts:()=>broadcasts,storage,setLost:x=>lost=x,codes,contracts};
}
test('owner-driven setup verifies shipped WASM and completes exactly seven separate transactions',async()=>{
 const h=harness(),s=h.setup();
 await assert.rejects(s.prepare('instantiate','registry'),/Upload/);
 for(const role of ['token','registry','profiles'])for(const kind of ['store','instantiate']){
  const reviewed=await s.prepare(kind,role),before=h.signs();assert.equal(s.state().pending,null);
  await s.execute(reviewed);assert.equal(h.signs(),before+1);assert.equal(s.state().pending,null);
 }
 assert.equal(h.signs(),6);const manifest=await s.manifest();assert.equal(manifest.contracts.registry.sha256,NAMES_TEST_ARTIFACTS.registry.sha256);assert.equal(manifest.testnet_only,true);
 const last=await s.prepare('unpause','registry');await s.execute(last);assert.equal(h.signs(),7);assert.equal(s.state().enabled,true);assert.equal(h.broadcasts(),7);
 await assert.rejects(s.prepare('store','token'),/already/);
});
test('setup upload timeout is reconciled after reload without another upload or signature',async()=>{
 const h=harness(),s=h.setup(),review=await s.prepare('store','token');h.setLost(true);await assert.rejects(s.execute(review),/UNKNOWN/);
 assert.ok(s.state().pending);assert.equal(h.codes.size,1);assert.equal(s.state().roles.token,undefined);
 const reloaded=h.setup();await assert.rejects(reloaded.prepare('store','token'),/Reconcile/);
 await reloaded.recover();assert.equal(reloaded.state().roles.token.codeId,1);assert.equal(reloaded.state().pending,null);assert.equal(h.signs(),1);assert.equal(h.broadcasts(),1);
});
test('tampered deployment review cannot sign an arbitrary instantiate payload',async()=>{
 const h=harness(),s=h.setup();await s.execute(await s.prepare('store','token'));const review=await s.prepare('instantiate','token');review.request.msg={admin:'other'};
 await assert.rejects(s.execute(review),/changed/);assert.equal(h.signs(),1);assert.equal(s.state().pending,null);
});
