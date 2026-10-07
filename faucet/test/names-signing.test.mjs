import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TxRaw,TxBody,AuthInfo} from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import {MsgExecuteContract} from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import {sha256} from '@cosmjs/crypto';
import {toHex} from '@cosmjs/encoding';
import {createBridge,attemptKey,matchTransaction} from '../src/names-signing.mjs';
const f=JSON.parse(readFileSync(new URL('../../tests/fixtures/nns-adr36.json',import.meta.url)));
const owner=f.profile.identity.owner,contract=f.deployment.registry;
const request=()=>({owner,contract,msg:{commit:{hash:'ab'.repeat(32)}},memo:'Commit NETA name',intentId:'01'.repeat(16)});
const hash=bytes=>toHex(sha256(bytes)).toUpperCase();
function harness(){
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const held=new Set(),locks={request:async(key,_options,fn)=>{if(held.has(key))return fn(null);held.add(key);try{return await fn({name:key});}finally{held.delete(key);}}};
 let signs=0,broadcasts=0,found=null,mode='',wallet=owner,chain='uni-7';
 const client={getChainId:async()=>chain,simulate:async()=>100000,
  sign:async(sender,messages,fee,memo)=>{
    signs++;if(mode==='reject')throw Error('Keplr rejected');
    if(mode==='wallet-change')wallet='other';
    let msg=structuredClone(messages[0].value);
    if(mode==='payload')msg.contract=f.deployment.contract;
    const body=TxBody.fromPartial({messages:[{typeUrl:messages[0].typeUrl,value:MsgExecuteContract.encode(msg).finish()}],memo});
    const auth=AuthInfo.fromPartial({signerInfos:[{sequence:1n}],fee:{amount:fee.amount,gasLimit:BigInt(fee.gas)+(mode==='fee'?1n:0n)}});
    return {bodyBytes:TxBody.encode(body).finish(),authInfoBytes:AuthInfo.encode(auth).finish(),signatures:[new Uint8Array([1])]};
  },
  broadcastTxSync:async bytes=>{broadcasts++;found={hash:hash(bytes),tx:bytes,height:100,code:mode==='failed'?5:0};if(mode.startsWith('lost'))throw Error('response lost');return {transactionHash:found.hash,height:100,code:found.code};}
 };
 const opts={client,storage,locks,wait:async()=>{},lookup:async h=>mode!=='lost'&&found?.hash===h?found:null,assertWallet:async expected=>{if(wallet!==expected)throw Error('Wallet changed');},verifyDeployment:async()=>{if(mode==='deployment')throw Error('wrong deployment');}};
 return {map,storage,opts,bridge:()=>createBridge(opts),setMode:v=>mode=v,setChain:v=>chain=v,signs:()=>signs,broadcasts:()=>broadcasts,found:()=>found};
}
test('Names bridge persists exact bytes, confirms protobuf intent and shares the origin journal',async()=>{
 const h=harness(),r=request(),receipt=await h.bridge().execute(r);
 assert.equal(receipt.intentMatched,true);assert.equal(receipt.chainId,'uni-7');
 assert.equal(h.signs(),1);assert.equal(h.broadcasts(),1);assert.equal(h.map.has('neta-pending-tx-v1:uni-7:'+owner),false);
 const row=JSON.parse(h.storage.getItem(attemptKey(owner,r.intentId)));assert.equal(row.status,'included');assert.equal(row.hash,receipt.transactionHash);
 await assert.doesNotReject(()=>matchTransaction(h.found().tx,r));
 await assert.rejects(()=>matchTransaction(h.found().tx,{...r,msg:{cancel_commit:{hash:'ab'.repeat(32)}}}),/payload/);
 await assert.rejects(h.bridge().execute(r),/already exists/);assert.equal(h.signs(),1);
});
test('lost broadcast response stays locked across reload; exact inclusion alone releases it',async()=>{
 const h=harness(),r=request();h.setMode('lost');await assert.rejects(h.bridge().execute(r),/UNKNOWN/);
 const raw=h.storage.getItem('neta-pending-tx-v1:uni-7:'+owner);assert.ok(raw);
 const reloaded=h.bridge();await assert.rejects(reloaded.execute(r),/already exists/);assert.equal(h.broadcasts(),1);
 await assert.rejects(reloaded.recover(r,'A'.repeat(64)),/saved signed/);assert.equal(h.storage.getItem('neta-pending-tx-v1:uni-7:'+owner),raw);
 h.setMode('');const recovered=await reloaded.recover(r);assert.equal(recovered.code,0);assert.equal(h.map.has('neta-pending-tx-v1:uni-7:'+owner),false);assert.equal(h.broadcasts(),1);
});
test('wallet rejection, changed payload, fee and wallet never broadcast and have explicit recovery',async()=>{
 for(const mode of ['reject','payload','fee','wallet-change','deployment']){
  const h=harness(),r=request();h.setMode(mode);await assert.rejects(h.bridge().execute(r));assert.equal(h.broadcasts(),0);
  h.setMode('');if(mode==='wallet-change')h.opts.assertWallet=async()=>{};
  const result=await h.bridge().recover(r);assert.equal(result.notBroadcast,true);
 }
});
test('included failures are recoverable receipts, not repeat payments',async()=>{
 const h=harness(),r=request();h.setMode('failed');await assert.rejects(h.bridge().execute(r),/FAILED/);
 assert.equal((await h.bridge().recover(r)).code,5);assert.equal(h.broadcasts(),1);
});
test('admin review guard runs before signing and after wallet return; rejection never broadcasts',async()=>{
 for(const failAt of [1,2]){
  const h=harness(),r=request();let checks=0;
  await assert.rejects(h.bridge().execute(r,{beforeSign:async()=>{if(++checks===failAt)throw Error('Admin review expired');}}),/expired/);
  assert.equal(h.signs(),failAt-1);assert.equal(h.broadcasts(),0);
  assert.equal((await h.bridge().recover(r)).notBroadcast,true);
 }
});
test('malformed receipts and unrelated shared pending transactions are not cleared',async()=>{
 const h=harness(),r=request();h.setMode('lost');await assert.rejects(h.bridge().execute(r));
 const key='neta-pending-tx-v1:uni-7:'+owner,raw=h.storage.getItem(key);
 h.opts.lookup=async()=>({...h.found(),tx:new Uint8Array([1])});await assert.rejects(h.bridge().recover(r));assert.equal(h.storage.getItem(key),raw);
 h.opts.lookup=async()=>h.found();const other=JSON.stringify({...JSON.parse(raw),hash:'B'.repeat(64)});h.storage.setItem(key,other);
 assert.equal((await h.bridge().recover(r)).code,0);assert.equal(h.storage.getItem(key),other);
});
test('an interrupted signing record has no automatic reset and storage failure prevents signing',async()=>{
 const h=harness(),r=request();h.storage.setItem(attemptKey(owner,r.intentId),JSON.stringify({version:1,request:r,status:'signing'}));
 await assert.rejects(h.bridge().recover(r),/Interrupted signing/);assert.equal(h.signs(),0);
 const other=harness();other.opts.storage={...other.storage,setItem:()=>{throw Error('quota exceeded');}};
 await assert.rejects(other.bridge().execute(r),/quota/);assert.equal(other.signs(),0);
});

test('index-disabled sending RPC and a lost response settle through independent exact inclusion',async()=>{
 for(const mode of ['', 'lost-indexed']){
  const h=harness(),r=request();h.setMode(mode);
  h.opts.client.broadcastTx=async()=>{throw Error('transaction indexing is disabled');};
  const receipt=await h.bridge().execute(r);
  assert.equal(receipt.code,0);assert.equal(receipt.intentMatched,true);
  assert.equal(h.signs(),1);assert.equal(h.broadcasts(),1);
  assert.equal(h.storage.getItem('neta-pending-tx-v1:uni-7:'+owner),null);
 }
});
test('confirmation can become visible after several reads without a second broadcast',async()=>{
 const h=harness(),r=request();let reads=0;
 h.opts.lookup=async()=>++reads<3?null:h.found();
 assert.equal((await h.bridge().execute(r)).code,0);
 assert.equal(reads,3);assert.equal(h.signs(),1);assert.equal(h.broadcasts(),1);
});

test('mainnet bridge isolates attempts and journals, checks chain on recovery and never clears UNI-7 data',async()=>{
 const h=harness(),r=request();h.opts.chainId='juno-1';h.setChain('juno-1');h.setMode('lost');
 const testnetKey='neta-pending-tx-v1:uni-7:'+owner;h.storage.setItem(testnetKey,'preserved-testnet-journal');
 await assert.rejects(h.bridge().execute(r),/UNKNOWN/);
 assert.equal(h.signs(),1);assert.equal(h.broadcasts(),1);
 assert.ok(h.storage.getItem(attemptKey(owner,r.intentId,'juno-1')));assert.equal(h.storage.getItem(attemptKey(owner,r.intentId)),null);
 const raw=TxRaw.decode(h.found().tx),auth=AuthInfo.decode(raw.authInfoBytes);assert.equal(auth.fee.amount[0].denom,'ujuno');
 h.setChain('uni-7');await assert.rejects(h.bridge().recover(r),/network mismatch/);
 h.setChain('juno-1');h.setMode('');const result=await h.bridge().recover(r);assert.equal(result.chainId,'juno-1');
 assert.equal(h.storage.getItem(testnetKey),'preserved-testnet-journal');assert.equal(h.storage.getItem('neta-pending-tx-v1:juno-1:'+owner),null);assert.equal(h.broadcasts(),1);
});

test('signed-byte checkpoint finishes before broadcast and failure is proven not broadcast',async()=>{
 for(const fail of [false,true]){
  const h=harness(),r=request();let backed=false;
  const original=h.opts.client.broadcastTxSync;
  h.opts.client.broadcastTxSync=bytes=>{assert.equal(backed,true);return original(bytes);};
  const pending=h.bridge().execute(r,{onSigned:async({transactionHash})=>{
   assert.equal(h.broadcasts(),0);
   const row=JSON.parse(h.storage.getItem(attemptKey(owner,r.intentId)));
   assert.equal(row.status,'signed');assert.equal(row.hash,transactionHash);assert.ok(row.bytes);
   if(fail)throw Error('Backup unavailable');backed=true;
  }});
  if(fail){await assert.rejects(pending,/Backup unavailable/);assert.equal(h.broadcasts(),0);assert.equal((await h.bridge().recover(r)).notBroadcast,true);}
  else{assert.equal((await pending).code,0);assert.equal(h.broadcasts(),1);}
 }
});
