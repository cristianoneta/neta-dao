import test from 'node:test';
import assert from 'node:assert/strict';
import {execute,fixedFee} from '../src/juno-governance-signing.mjs';
import {TxBody,AuthInfo} from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import {MsgSubmitProposal} from 'cosmjs-types/cosmos/gov/v1/tx';
import {claimProposal} from '../../planner-proposal-draft.mjs';
import {fixture as programmeFixture} from '../../tests/fixtures/delegation-planner.mjs';
const proposer='juno1'+'q'.repeat(38);
const draft=claimProposal(programmeFixture()).values;
import {sha256} from '@cosmjs/crypto';
import {toHex} from '@cosmjs/encoding';

const fee=fixedFee(150000,1.4,'0.075ujuno',500000);
function fixture(change=()=>{},chain='juno-1'){
  const rows=new Map();let signs=0,broadcasts=0,validations=0;
  globalThis.localStorage={getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,v),removeItem:k=>rows.delete(k)};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(k,o,fn)=>fn({})}}});
  const client={
    getChainId:async()=>chain,getTx:async()=>null,
    sign:async(sender,messages,explicit,memo)=>{
      signs++;
      const body=TxBody.fromPartial({messages:messages.map(m=>({typeUrl:m.typeUrl,value:MsgSubmitProposal.encode(m.value).finish()})),memo});
      const auth=AuthInfo.fromPartial({signerInfos:[{sequence:1n}],fee:{gasLimit:BigInt(explicit.gas),amount:explicit.amount}});
      change(body,auth);
      return {bodyBytes:TxBody.encode(body).finish(),authInfoBytes:AuthInfo.encode(auth).finish(),signatures:[new Uint8Array([2])]};
    },
    broadcastTx:async bytes=>{broadcasts++;return {transactionHash:toHex(sha256(bytes)).toUpperCase(),height:42,code:0};},
  };
  return {client,rows,counts:()=>({signs,broadcasts,validations}),send:(assertWallet=async()=>{validations++;})=>execute(client,proposer,'CLAIM_REWARDS',draft,[{denom:'ujuno',amount:'1000000000'}],fee,'cosmoot:gov:v1',{assertWallet})};
}
test('reviewed proposal and explicit fee are validated before one journaled broadcast',async()=>{
  assert.deepEqual(fee,{gas:'210000',amount:[{denom:'ujuno',amount:'15750'}]});
  const f=fixture();await f.send();assert.deepEqual(f.counts(),{signs:1,broadcasts:1,validations:2});assert.equal(f.rows.size,0);
});
test('modified message, memo, extension and fee never broadcast',async()=>{
  for(const change of [b=>b.messages[0].value=new Uint8Array([1]),b=>b.memo='other',b=>b.timeoutHeight=1n,b=>b.extensionOptions=[{typeUrl:'other',value:new Uint8Array()}],(b,a)=>a.fee.gasLimit=1n,(b,a)=>a.fee.amount=[{denom:'ujuno',amount:'1'}],(b,a)=>a.fee.payer='other']){
    const f=fixture(change);await assert.rejects(f.send(),/Wallet changed/);assert.equal(f.counts().broadcasts,0);assert.equal(f.rows.size,0);
  }
});
test('wrong network or changed wallet never broadcasts',async()=>{
  const wrong=fixture(()=>{},'uni-7');await assert.rejects(wrong.send(),/Wrong signing network/);assert.equal(wrong.counts().signs,0);
  const changed=fixture();let count=0;await assert.rejects(changed.send(async()=>{if(++count===2)throw Error('Account changed');}),/Account changed/);assert.equal(changed.counts().broadcasts,0);assert.equal(changed.rows.size,0);
});
test('lost response preserves signed bytes and forbids another signature',async()=>{
  const f=fixture();f.client.broadcastTx=async()=>{throw Error('lost response');};
  await assert.rejects(f.send(),/OUTCOME UNKNOWN/);await assert.rejects(f.send(),/RETRY LOCKED/);assert.equal(f.counts().signs,1);
  const pending=JSON.parse([...f.rows.values()][0]);assert.equal(pending.status,'pending');assert.match(pending.hash,/^[A-F0-9]{64}$/);assert.ok(pending.bytes);
});
test('unsafe gas or adjustment fails closed',()=>{
  for(const gas of [0,-1,1.2,NaN,Infinity,500001])assert.throws(()=>fixedFee(gas,1.4,'0.075ujuno',500000));
  for(const adjustment of [0,.9,3.1,NaN,Infinity])assert.throws(()=>fixedFee(100,adjustment,'0.075ujuno',500000));
});
