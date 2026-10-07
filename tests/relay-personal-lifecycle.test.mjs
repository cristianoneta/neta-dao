import test from 'node:test';
import assert from 'node:assert/strict';
import {PersonalMailboxLifecycle,personalSessionId} from '../relay-personal-lifecycle.mjs';
const a='juno1'+'q'.repeat(38),b='juno1'+'p'.repeat(38),contract='juno1'+'a'.repeat(58);
const bundle=btoa('x'.repeat(32));
function harness(){
  let ready=true,writes=0,evidence=null,lock=false;
  const own={generation:1,device_id:'alice',protocol_version:1,fingerprint:'a'.repeat(64),active:true,prekeys:[{id:1,bundle}],max_prekey_id:7};
  const remote={...own,device_id:'bob',fingerprint:'b'.repeat(64)};
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const adapter={profile:{chain:'juno-1',contract},address:a,assertWallet:async()=>{},verify:async()=>true,device:async addr=>addr===b?remote:own};
  const bridge={execute:async(_,opts)=>{await opts.beforeSign();writes++;throw Error('lost response');},recover:async()=>{if(!evidence)throw Error('unknown');return evidence;}};
  const lifecycle=new PersonalMailboxLifecycle({adapter,bridge,storage,locks:{request:async(_,opts,fn)=>{if(lock)return fn(null);lock=true;try{return await fn({});}finally{lock=false;}}},prepared:async()=>ready});
  return {lifecycle,own,remote,writes:()=>writes,unprepare:()=>ready=false,evidence:x=>evidence=x};
}
test('consent binds both generations and stale reviews cannot sign',async()=>{
  const h=harness(),r=await h.lifecycle.review('consent',{address:b,allowed:true});
  assert.deepEqual(r.request.msg,{allow_sender:{address:b,allowed:true,recipient_generation:1,sender_generation:1}});
  h.remote.generation++;await assert.rejects(h.lifecycle.submit(r),/changed/);assert.equal(h.writes(),0);
});
test('refill requires retained crypto keys, monotonic IDs and available capacity',async()=>{
  const h=harness();await assert.rejects(h.lifecycle.review('refill',{prekeys:[{id:7,bundle}]}),/stale/);
  const r=await h.lifecycle.review('refill',{prekeys:[{id:8,bundle}]});h.unprepare();await assert.rejects(h.lifecycle.submit(r),/durably/);assert.equal(h.writes(),0);
});
test('rotation requires separate new identity and preserves ambiguous intent',async()=>{
  const h=harness();await assert.rejects(h.lifecycle.review('rotate',h.own),/separately/);
  const r=await h.lifecycle.review('rotate',{device_id:'new-device',protocol_version:1,fingerprint:'c'.repeat(64),prekeys:[{id:1,bundle}]});
  await assert.rejects(h.lifecycle.submit(r),/lost response/);await assert.rejects(h.lifecycle.submit(r),/Unresolved/);
  await assert.rejects(h.lifecycle.recover(),/unknown/);assert.equal(h.writes(),1);assert.equal(h.lifecycle.load().status,'pending');
  h.evidence({intentMatched:true,chainId:'juno-1',transactionHash:'A'.repeat(64),height:9,code:0});
  assert.equal((await h.lifecycle.recover()).status,'confirmed');assert.equal(h.writes(),1);
});
test('not-broadcast action is retained and needs a new review',async()=>{
  const h=harness(),r=await h.lifecycle.review('block',{address:b,allowed:true});await assert.rejects(h.lifecycle.submit(r));
  h.evidence({notBroadcast:true,intentMatched:true});assert.equal((await h.lifecycle.recover()).status,'not_broadcast');
  const next=await h.lifecycle.review('block',{address:b,allowed:true});assert.notEqual(next.request.intentId,r.request.intentId);
});
test('both participants share a session ID; either generation or mailbox separates sessions',()=>{
  const h=harness(),own={address:a,...h.own},remote={address:b,...h.remote},scope={chain:'juno-1',contract};
  const first=personalSessionId(scope,own,remote);assert.equal(first,personalSessionId(scope,remote,own));
  assert.notEqual(first,personalSessionId(scope,own,{...remote,generation:2}));
  assert.notEqual(first,personalSessionId({...scope,contract:'juno1'+'c'.repeat(58)},own,remote));
});
