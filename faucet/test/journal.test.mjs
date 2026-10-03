import test from 'node:test';import assert from 'node:assert/strict';
import {journalBroadcast} from '../src/broadcast-journal.mjs';
import {AuthInfo} from 'cosmjs-types/cosmos/tx/v1beta1/tx';
test('wallet broadcast timeout shares the persistent origin journal and forbids another signature',async()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},locks={request:async(k,o,fn)=>fn({})};let signs=0,broadcasts=0;
 const client={getChainId:async()=>'uni-7',getTx:async()=>null,sign:async()=>{signs++;return {bodyBytes:new Uint8Array([1]),authInfoBytes:AuthInfo.encode(AuthInfo.fromPartial({signerInfos:[{sequence:1n}]})).finish(),signatures:[new Uint8Array([2])]};},broadcastTx:async()=>{broadcasts++;throw Error('reply lost');}};
 const send=()=>journalBroadcast(client,'wallet',[],{gas:'1',amount:[]},'test',{storage,locks});
 await assert.rejects(send(),/OUTCOME UNKNOWN/);await assert.rejects(send(),/RETRY LOCKED/);assert.equal(signs,1);assert.equal(broadcasts,1);
 const pending=JSON.parse(map.get('neta-pending-tx-v1:uni-7:wallet'));assert.match(pending.hash,/^[A-F0-9]{64}$/);assert.ok(pending.bytes);
 client.getTx=async()=>({hash:pending.hash,height:8,code:0});await assert.rejects(send(),/PREVIOUS TRANSACTION INCLUDED/);assert.equal(signs,1);
});
