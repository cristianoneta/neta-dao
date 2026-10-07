import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {TxRaw,TxBody,AuthInfo} from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import {MsgStoreCode} from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import {sha256} from '@cosmjs/crypto';
import {toHex,toBase64} from '@cosmjs/encoding';
import {createBridge,attemptKey,matchTransaction,validAddress} from '../src/names-signing.mjs';
import {PersonalMainnetSetup,PERSONAL_DEPLOY_ARTIFACT} from '../../relay-personal-deploy-core.mjs';
import {PERSONAL_MAINNET_OWNER as owner,PERSONAL_MAINNET_WASM as checksum} from '../../relay-personal-network.mjs';
const wasm=readFileSync(new URL('../../'+PERSONAL_DEPLOY_ARTIFACT,import.meta.url));
const request=()=>({owner,kind:'store',checksum,wasm:toBase64(wasm),intentId:'ca'.repeat(16),memo:'Upload NETA RELAY personal v0.4 on Juno mainnet'});
const txHash=b=>toHex(sha256(b)).toUpperCase();
function signed(r,code,fee={gas:'5000000',amount:[{denom:'ujuno',amount:'375000'}]},extra={}){
 const body=TxBody.fromPartial({messages:[{typeUrl:'/cosmwasm.wasm.v1.MsgStoreCode',value:MsgStoreCode.encode({sender:r.owner,wasmByteCode:code,...extra}).finish()}],memo:r.memo});
 const auth=AuthInfo.fromPartial({signerInfos:[{sequence:9n}],fee:{amount:fee.amount,gasLimit:BigInt(fee.gas)}});
 return TxRaw.fromPartial({bodyBytes:TxBody.encode(body).finish(),authInfoBytes:AuthInfo.encode(auth).finish(),signatures:[new Uint8Array([1])]});
}
function fixture(){
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const locks={request:async(k,o,fn)=>fn({})};let signs=0,broadcasts=0,found=null,simulated,fail=false;
 const client={getChainId:async()=>'juno-1',simulate:async(_,messages)=>{simulated=messages[0].value.wasmByteCode;if(fail)throw Error('Bad status on response: 400');return 2913204;},
  sign:async(_,messages,fee,memo)=>{signs++;assert.deepEqual(messages[0].value.wasmByteCode,simulated);return signed({...request(),memo},simulated,fee);},
  broadcastTxSync:async bytes=>{broadcasts++;found={hash:txHash(bytes),tx:bytes,height:123,code:0,events:[]};return found.hash;}};
 const opts={chainId:'juno-1',client,storage,locks,lookup:async()=>found,verifyDeployment:async()=>{},assertWallet:async()=>{},wait:async()=>{}};
 return {storage,map,opts,client,bridge:createBridge(opts),setFail:v=>fail=v,setFound:v=>found=v,counts:()=>({signs,broadcasts}),get simulated(){return simulated;}};
}
test('reviewed RELAY WASM compresses below RPC body limit and signs the simulated code',async()=>{
 const f=fixture(),r=request();assert.ok(wasm.length*2>1000000);await f.bridge.execute(r);
 assert.ok(f.simulated.length*2+1024<1000000);assert.deepEqual(gunzipSync(f.simulated),wasm);
 assert.deepEqual(f.counts(),{signs:1,broadcasts:1});assert.equal(JSON.parse(f.storage.getItem(attemptKey(owner,r.intentId,'juno-1'))).status,'included');
});
test('gzip receipts require the exact reviewed code and reject altered fields, corruption and expansion',async()=>{
 const r=request(),encode=(code,extra)=>TxRaw.encode(signed(r,code,undefined,extra)).finish();
 await matchTransaction(encode(wasm),r);await matchTransaction(encode(gzipSync(wasm)),r);
 const changed=Buffer.from(wasm);changed[100]^=1;
 for(const bytes of [encode(gzipSync(changed)),encode(gzipSync(wasm).subarray(0,-4)),encode(gzipSync(Buffer.alloc(wasm.length+100000))),
  encode(gzipSync(wasm),{sender:'other'}),encode(gzipSync(wasm),{instantiatePermission:{permission:1,addresses:[]}})])await assert.rejects(matchTransaction(bytes,r),/payload/);
});
test('legacy raw signed upload recovers after reload without simulation, signing or resubmission',async()=>{
 const f=fixture(),r=request(),bytes=TxRaw.encode(signed(r,wasm)).finish(),hash=txHash(bytes),record={...r};delete record.wasm;
 f.storage.setItem(attemptKey(owner,r.intentId,'juno-1'),JSON.stringify({version:1,request:record,status:'pending',hash,bytes:toBase64(bytes)}));
 f.storage.setItem('neta-pending-tx-v1:juno-1:'+owner,JSON.stringify({version:1,status:'pending',chain:'juno-1',sender:owner,hash,bytes:toBase64(bytes)}));
 f.setFound({hash,tx:bytes,height:123,code:0});f.setFail(true);
 const receipt=await createBridge(f.opts).recover(r);assert.equal(receipt.transactionHash,hash);assert.deepEqual(f.counts(),{signs:0,broadcasts:0});
 assert.equal(f.storage.getItem('neta-pending-tx-v1:juno-1:'+owner),null);
});
test('failed fee simulation leaves explicit not-broadcast evidence and owner setup recovers without retry',async()=>{
 const f=fixture();f.setFail(true);
 const fetcher=async url=>url===PERSONAL_DEPLOY_ARTIFACT?{ok:true,arrayBuffer:async()=>wasm}:{ok:true,json:async()=>url.endsWith('node_info')?
  {default_node_info:{network:'juno-1'}}:{block:{header:{chain_id:'juno-1',height:'123',time:new Date().toISOString()}}}};
 const setup=new PersonalMainnetSetup({owner,client:f.client,bundle:{createBridge,validAddress},storage:f.storage,locks:f.opts.locks,assertWallet:async()=>{},fetcher});
 await assert.rejects(setup.execute(await setup.prepare('store')),/Fee simulation failed before signing/);assert.ok(setup.state().pending);
 const receipt=await setup.recover();assert.equal(receipt.notBroadcast,true);assert.equal(setup.state().pending,null);assert.equal(setup.state().codeId,null);
 assert.deepEqual(f.counts(),{signs:0,broadcasts:0});assert.equal(setup.state().history.length,1);
});
