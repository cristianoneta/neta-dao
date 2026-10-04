import test from 'node:test';
import assert from 'node:assert/strict';
import {freshUni7Block,UNI7_RESTS} from '../names-v2-reader.mjs';
import {NamesSetup} from '../names-v2-setup-core.mjs';
const now=1791134107;
const header={chain_id:'uni-7',height:'18538092',time:'2026-10-04T17:15:03.154412200Z'};
test('UNI-7 headers accept live nanosecond timestamps and SDK fallback even with an empty block',()=>{
 for(const latest of [{block:{header}},{sdk_block:{header}},{block:{},sdk_block:{header}}])assert.deepEqual(freshUni7Block(latest,now),{height:18538092,time:Date.parse(header.time)/1000});
});
test('freshness reports node/browser times without accepting stale, future, wrong-chain or malformed data',()=>{
 for(const offset of [-31,121]){
  const block={block:{header:{...header,time:new Date((now-offset)*1000).toISOString()}}};
  assert.throws(()=>freshUni7Block(block,now),/Block time .*browser time .*automatic device date\/time/);
 }
 assert.throws(()=>freshUni7Block({block:{header:{...header,chain_id:'juno-1'}}},now),/MISMATCH/);
 for(const height of ['0','abc','9007199254740992'])assert.throws(()=>freshUni7Block({block:{header:{...header,height}}},now),/invalid/);
 assert.throws(()=>freshUni7Block({},now),/no header/);
});
function setup(fetcher){const s=Object.create(NamesSetup.prototype);s.fetcher=fetcher;return s;}
test('setup falls back on HTTP failure and clears an old selected node when all providers fail',async()=>{
 const s=setup(async url=>url.startsWith(UNI7_RESTS[0])?{ok:false,status:403}:{ok:true,json:async()=>url.endsWith('node_info')?{default_node_info:{network:'uni-7'}}:{block:{},sdk_block:{header:{...header,time:new Date().toISOString()}}}});
 await s.network();assert.equal(s.base,UNI7_RESTS[1]);
 s.fetcher=async()=>({ok:false,status:503});
 await assert.rejects(s.network(),e=>e.message.includes('nodeshub.online: UNI-7 query unavailable (HTTP 503)')&&e.message.includes('stavr.tech: UNI-7 query unavailable (HTTP 503)'));
 assert.equal(s.base,null);
});
test('network mismatch stops verification without falling through to a different provider',async()=>{
 let calls=0;const s=setup(async()=>{calls++;return {ok:true,json:async()=>({default_node_info:{network:'juno-1'}})};});
 await assert.rejects(s.network(),/MISMATCH/);assert.equal(calls,1);
});
