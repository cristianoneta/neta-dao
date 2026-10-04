import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {AuthInfo} from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import {bankSendFee} from '../src/transfer-fee.mjs';
import {broadcast} from '../src/signing.js';

const messages=[{typeUrl:'/cosmos.bank.v1beta1.MsgSend',value:{fromAddress:'sender',toAddress:'recipient',amount:[{denom:'ujunox',amount:'10000000'}]}}];
function setup(t,{estimate=97855,code=0,unknown=false,chain='uni-7'}={}){
  const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  const previousStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),previousLocks=Object.getOwnPropertyDescriptor(navigator,'locks');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
  Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(k,o,fn)=>fn({})}});
  t.after(()=>{if(previousStorage)Object.defineProperty(globalThis,'localStorage',previousStorage);else delete globalThis.localStorage;if(previousLocks)Object.defineProperty(navigator,'locks',previousLocks);else delete navigator.locks;});
  let simulations=0,signatures=0,sends=0,feeSeen;
  const client={getChainId:async()=>chain,getTx:async()=>null,simulate:async()=>{simulations++;return estimate;},sign:async(sender,actualMessages,fee)=>{
    signatures++;feeSeen=fee;assert.deepEqual(actualMessages,messages);
    return {bodyBytes:new Uint8Array([1]),authInfoBytes:AuthInfo.encode(AuthInfo.fromPartial({signerInfos:[{sequence:1n}],fee:{gasLimit:BigInt(fee.gas),amount:fee.amount}})).finish(),signatures:[new Uint8Array([2])]};
  },broadcastTx:async bytes=>{sends++;if(unknown)throw Error('timeout');return {transactionHash:createHash('sha256').update(bytes).digest('hex').toUpperCase(),height:42,code};}};
  return {client,map,get simulations(){return simulations;},get signatures(){return signatures;},get sends(){return sends;},get fee(){return feeSeen;}};
}
test('observed failed-donation estimate receives bank-send floor and explicit JUNOX fee',()=>{
  const fee=bankSendFee(97855);assert.equal(fee.gas,'250000');assert.deepEqual(fee.amount,[{denom:'ujunox',amount:'50000'}]);
  assert.ok(Number(fee.gas)>137382);assert.equal(bankSendFee(200000).gas,'360000');
});
test('non-integer, missing, negative and excessive estimates fail closed',()=>{
  for(const value of [undefined,NaN,Infinity,0,-1,1.1,'97855',500001])assert.throws(()=>bankSendFee(value),/Unsafe UNI-7 transfer gas/);
});
test('donation wrapper signs the buffered fee once and keeps exact amount/denom',async t=>{
  const s=setup(t);assert.equal((await broadcast(s.client,'sender',messages,'donate')).code,0);
  assert.equal(s.simulations,1);assert.equal(s.signatures,1);assert.equal(s.sends,1);assert.equal(s.fee.gas,'250000');assert.equal(s.map.size,0);
});
test('unknown transfer stays journal-locked and never signs or sends again',async t=>{
  const s=setup(t,{unknown:true});
  await assert.rejects(broadcast(s.client,'sender',messages,'donate'),/OUTCOME UNKNOWN/);
  await assert.rejects(broadcast(s.client,'sender',messages,'donate'),/RETRY LOCKED/);
  assert.equal(s.signatures,1);assert.equal(s.sends,1);assert.equal(s.map.size,1);
});
test('included out-of-gas failure is explained with hash; no automatic retry',async t=>{
  const s=setup(t,{code:11});
  await assert.rejects(broadcast(s.client,'sender',messages,'donate'),/ran out of gas.*No tokens were transferred.*TX [0-9A-F]{64}/);
  assert.equal(s.signatures,1);assert.equal(s.sends,1);assert.equal(s.map.size,0);
});
test('wrong chain cannot simulate, sign or broadcast',async t=>{
  const s=setup(t,{chain:'juno-1'});await assert.rejects(broadcast(s.client,'sender',messages,'donate'),/network mismatch/);
  assert.equal(s.simulations,0);assert.equal(s.signatures,0);assert.equal(s.sends,0);
});
