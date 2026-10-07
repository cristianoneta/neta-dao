import test from 'node:test';
import assert from 'node:assert/strict';
import {PersonalMessageTransport} from '../relay-personal-transport.mjs';
import {PERSONAL_MAINNET_POLICY} from '../relay-personal-network.mjs';
const a='juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57',b='juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt',contract='juno1'+'a'.repeat(58),mid='1'.repeat(64);
function harness() {
  let row={version:1,id:mid,state:'ready',meta:{chain:'juno-1',contract,sender:a,senderGeneration:1,senderFingerprint:'a'.repeat(64),
    recipient:b,recipientGeneration:2,recipientFingerprint:'b'.repeat(64),messageId:mid},
    send:{messageId:mid,recipient:b,generation:2,deviceId:'bob',fingerprint:'b'.repeat(64)},ciphertext:Array(32).fill(7)};
  let sequence=null,evidence=null,writes=0,broken=false,account=a,locked=false;
  const own={generation:1,fingerprint:'a'.repeat(64),active:true},remote={generation:2,fingerprint:'b'.repeat(64),device_id:'bob',active:true};
  const adapter={profile:{chain:'juno-1',contract},address:a,assertWallet:async()=>{if(account!==a)throw Error('Wallet changed');},verify:async()=>true,
    device:async address=>address===b?remote:own,smart:async q=>{
      if(broken)throw Error('RPC offline');
      if(q.sent)return sequence;if(q.blocked)return false;if(q.consent)return [2,1];
    }};
  const journal={entries:async()=>[structuredClone(row)],save:async r=>{row=structuredClone(r);},
    reconcile:async(id,lookup)=>{const s=await lookup();if(s!==null){row={...row,state:'confirmed',sequence:s};return {state:'confirmed',sequence:s};}return {...row,ciphertext:Uint8Array.from(row.ciphertext)};}};
  const requests=[];
  const bridge={execute:async(req,{beforeSign})=>{await beforeSign();writes++;requests.push(structuredClone(req));throw Error('transport unavailable');},
    recover:async req=>{assert.deepEqual(req,requests.at(-1));if(!evidence)throw Error('unknown transaction');return evidence;}};
  const locks={request:async(_,opts,fn)=>{if(locked)return fn(null);locked=true;try{return await fn({});}finally{locked=false;}}};
  const transport=new PersonalMessageTransport({adapter,journal,bridge,locks});
  return {transport,adapter,remote,requests,row:()=>row,writes:()=>writes,receipt:n=>sequence=n,evidence:x=>evidence=x,
    offline:()=>broken=true,switch:()=>account=b};
}
test('unknown broadcast and RPC absence preserve packet and block a second signature',async()=>{
  const h=harness(); const review=await h.transport.review(mid);
  await assert.rejects(h.transport.submit(review),/transport unavailable/);
  await assert.rejects(h.transport.review(mid),/unresolved/);
  await assert.rejects(h.transport.recover(mid),/unknown/);
  h.offline();await assert.rejects(h.transport.recover(mid),/RPC/);
  assert.equal(h.writes(),1);assert.equal(h.row().attempt.outcome,'pending');
});
test('rejected signature and included failure permit only a new review of identical ciphertext',async()=>{
  for(const evidence of [{notBroadcast:true,intentMatched:true},{intentMatched:true,chainId:'juno-1',transactionHash:'A'.repeat(64),height:7,code:5}]){
    const h=harness();const first=await h.transport.review(mid);
    await assert.rejects(h.transport.submit(first));h.evidence(evidence);
    const recovered=await h.transport.recover(mid);assert.equal(recovered.reviewRequired,true);assert.equal(h.writes(),1);
    const second=await h.transport.review(mid);assert.notEqual(second.request.intentId,first.request.intentId);
    assert.deepEqual(second.request.msg,first.request.msg);
    await assert.rejects(h.transport.submit(second));assert.equal(h.writes(),2);assert.equal(h.row().attempts.length,1);
  }
});
test('confirmed message is recovered once without replaying the transaction',async()=>{
  const h=harness();await assert.rejects(h.transport.submit(await h.transport.review(mid)));h.receipt(9);
  assert.deepEqual(await h.transport.recover(mid),{state:'confirmed',sequence:9});
  await assert.rejects(h.transport.review(mid),/already confirmed/);assert.equal(h.writes(),1);
});
test('wrong-chain or unmatched success evidence cannot unlock an uncertain attempt',async()=>{
  for(const evidence of [{notBroadcast:true},{intentMatched:true,chainId:'uni-7',transactionHash:'A'.repeat(64),height:7,code:5},
    {intentMatched:true,chainId:'juno-1',transactionHash:'A'.repeat(64),height:7,code:0}]){
    const h=harness();await assert.rejects(h.transport.submit(await h.transport.review(mid)));h.evidence(evidence);
    await assert.rejects(h.transport.recover(mid));assert.equal(h.row().attempt.outcome,'pending');
  }
});
test('modified review, rotated receiver and switched wallet cannot sign',async()=>{
  const h=harness();const review=await h.transport.review(mid);review.request.msg.send.recipient=a;
  await assert.rejects(h.transport.submit(review),/Review changed/);assert.equal(h.writes(),0);
  const valid=await h.transport.review(mid);h.remote.generation++;
  await assert.rejects(h.transport.submit(valid),/generation changed/);assert.equal(h.writes(),0);
  h.switch();await assert.rejects(h.transport.review(mid),/Wallet changed/);
});
test('concurrent submissions share the origin lock and cannot create two attempts',async()=>{
  const h=harness(),review=await h.transport.review(mid);
  const results=await Promise.allSettled([h.transport.submit(review),h.transport.submit(review)]);
  assert.equal(h.writes(),1);assert.ok(results.some(r=>/Another tab/.test(r.reason?.message)));
});
test('a contact name transferred after review cannot sign or retarget the saved packet',async()=>{
  const h=harness();let owner=b;
  h.row().send.recipientName='bob.neta';h.adapter.profile.policy=PERSONAL_MAINNET_POLICY;
  h.adapter.get=async(base,path)=>path.endsWith('/latest')?
    {block:{header:{chain_id:'juno-1',height:'99',time:new Date().toISOString()}}}:
    {data:JSON.parse(atob(decodeURIComponent(path.split('/').at(-1)))).identity?
      {name:'bob.neta',owner,expires_at:Math.floor(Date.now()/1000)+3600}:{name:'bob.neta',address:owner}};
  const review=await h.transport.review(mid),ciphertext=structuredClone(h.row().ciphertext);owner=a;
  await assert.rejects(h.transport.submit(review),/Name owner changed/);
  assert.equal(h.writes(),0);assert.equal(h.row().meta.recipient,b);
  assert.deepEqual(h.row().ciphertext,ciphertext);assert.equal(h.row().attempt,undefined);
});
