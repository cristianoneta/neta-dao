import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ValidatorStatusReader,validatorStatusText} from '../names-v2-validator-status.mjs';
const pair=JSON.parse(readFileSync(new URL('./fixtures/nns-adr36.json',import.meta.url))).pair;
const now=1800000000000,k=Buffer.alloc(32,8).toString('base64'),other=Buffer.alloc(32,9).toString('base64');
const pub=key=>({'@type':'/cosmos.crypto.ed25519.PubKey',key});
function fixture(change=()=>{}){
 const calls=[];
 const fetcher=async(url,options)=>{
  const u=new URL(url),chain=u.hostname.includes('polkachu')||u.hostname.includes('.m.')?'juno-1':'uni-7',role=chain==='uni-7'?'testnet':'mainnet';calls.push({url,options});
  let data,status=200;
  if(u.pathname.endsWith('/blocks/latest'))data={block:{header:{chain_id:chain,height:'100',time:new Date(now).toISOString()}}};
  else if(u.pathname.includes('/staking/'))data={validator:{operator_address:pair[role].address,description:{moniker:'Validator'},consensus_pubkey:pub(k),jailed:false,status:'BOND_STATUS_BONDED'}};
  else data={block_height:'100',validators:[{pub_key:pub(k),voting_power:'10'}],pagination:{total:'1'}};
  const altered=await change({u,chain,data,status,options});return new Response(JSON.stringify(altered?.data??data),{status:altered?.status??status});
 };
 return {calls,reader:new ValidatorStatusReader({fetcher,now:()=>now})};
}
test('validates both chains and checks actual consensus keys, not bonded status; GET only',async()=>{
 const s=fixture(),r=await s.reader.pair(pair);assert.equal(r.mainnet.exists,true);assert.equal(r.mainnet.consensus,null);assert.equal(r.testnet.consensus.active,true);assert.equal(r.testnet.consensus.height,100);
 assert.ok(s.calls.every(c=>c.options.method==='GET'&&c.options.credentials==='omit'&&c.options.redirect==='error'));
 assert.match(validatorStatusText(r),/IN ACTIVE CONSENSUS SET · block 100/);
 const absent=await fixture(({u,data})=>{if(u.pathname.includes('/validatorsets/'))data.validators[0].pub_key=pub(other);}).reader.pair(pair);
 assert.equal(absent.testnet.stakingStatus,'BOND_STATUS_BONDED');assert.equal(absent.testnet.consensus.active,false);
});
test('wrong-chain, stale and future headers cannot establish validator existence',async()=>{
 for(const alter of [h=>h.chain_id='wrong',h=>h.time=new Date(now-121000).toISOString(),h=>h.time=new Date(now+31000).toISOString()]){
  const s=fixture(({data})=>{if(data.block)alter(data.block.header);});const r=await s.reader.pair(pair);assert.equal(r.mainnet.exists,null);assert.equal(r.testnet.exists,null);assert.ok(s.calls.every(c=>c.url.includes('/blocks/latest')));
 }
});
test('explicit SDK NotFound is distinct from provider failure',async()=>{
 for(const [status,data,expected] of [[404,{code:5},false],[404,{message:'proxy missing'},null],[503,{error:'down'},null]]){
  const r=await fixture(({u})=>u.pathname.includes('/staking/')?{status,data}:null).reader.pair(pair);assert.equal(r.testnet.exists,expected);assert.equal(r.testnet.consensus,null);
 }
});
test('mismatched address, malformed key and missing jailed state stay unresolved',async()=>{
 for(const alter of [v=>v.operator_address=pair.mainnet.address,v=>v.consensus_pubkey=pub('bad'),v=>delete v.jailed]){
  const r=await fixture(({chain,data})=>{if(chain==='uni-7'&&data.validator)alter(data.validator);}).reader.pair(pair);assert.equal(r.testnet.exists,null);
 }
});
test('pagination uses fixed height and rejects truncated, repeated and wrong-height sets',async()=>{
 const rows=Array.from({length:101},(_,i)=>({pub_key:pub(Buffer.alloc(32,i+1).toString('base64')),voting_power:'1'}));rows[100].pub_key=pub(k);rows[7].pub_key=pub(Buffer.alloc(32,200).toString('base64'));
 for(const mode of ['good','truncated','duplicate','height','total']){
  const s=fixture(({u,data})=>{if(u.pathname.includes('/validatorsets/')){const offset=Number(u.searchParams.get('pagination.offset'));data.validators=structuredClone(rows.slice(offset,offset+100));data.pagination.total='101';if(offset&&mode==='truncated')data.validators=[];if(offset&&mode==='duplicate')data.validators[0]=rows[0];if(offset&&mode==='height')data.block_height='101';if(offset&&mode==='total')data.pagination.total='102';}});
  const r=await s.reader.pair(pair);assert.equal(r.testnet.exists,true);if(mode==='good')assert.deepEqual(r.testnet.consensus,{active:true,height:100,total:101});else {assert.equal(r.testnet.consensus,null);assert.match(validatorStatusText(r),/ACTIVE SET UNAVAILABLE/);}
 }
});
test('a failed primary can use a separately verified fallback',async()=>{
 const s=fixture(({u})=>u.hostname.includes('nodeshub')?{status:503,data:{}}:null);const r=await s.reader.pair(pair);assert.equal(r.testnet.exists,true);assert.equal(r.testnet.source,'https://juno.api.t.stavr.tech');
});
test('caller cancellation stops the observation without returning a negative result',async()=>{
 const c=new AbortController();c.abort();await assert.rejects(fixture().reader.pair(pair,{signal:c.signal}),/abort/i);
});
