import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {NamesV2Client} from '../names-v2-client.mjs';
import {priceSnapshotPreimage} from '../names-v2-core.mjs';

const key=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.alloc(32,7)]),format:'der',type:'pkcs8'});
const manifest=JSON.parse(readFileSync(new URL('../docs/deployments/nns-mainnet.json',import.meta.url)));
manifest.quote_public_key=createPublicKey(key).export({format:'der',type:'spki'}).subarray(-32).toString('base64');
const owner=manifest.admin;
function harness(){
  let clock=1791223000,wallet=owner,mode='',writes=[],fetches=0,hook=null;
  const config={...manifest,purchases_paused:true,tariff_version:1,tariff:{three_cents:9900,four_cents:1900,standard_cents:500}};
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const reader={verify:async()=>structuredClone(config),fetcher:async()=>{
    fetches++;if(mode==='missing')return new Response('',{status:404});
    const snapshot={signer_version:1,usd_per_neta_12:'1051527774123',observed_at:clock-60,expires_at:clock+86340};
    if(mode==='expired')snapshot.expires_at=clock;
    const p={schema_version:1,chain_id:manifest.chain_id,registry:manifest.registry,token:manifest.token,treasury:manifest.treasury,snapshot,signature:sign(null,Buffer.from(priceSnapshotPreimage(manifest,config,snapshot)),key).toString('base64')};
    if(mode==='signature')p.snapshot.usd_per_neta_12='1';if(mode==='envelope')p.registry='wrong';
    return new Response(JSON.stringify(p));
  }};
  const opts={deployment:manifest,reader,storage,now:()=>clock,walletAddress:async()=>wallet,withLock:async(_key,fn)=>fn(),execute:async(r,{beforeSign}={})=>{
    await beforeSign();await hook?.();await beforeSign();writes.push(r);config.purchases_paused=r.msg.set_purchases_paused.paused;
    if(mode==='lost')throw Error('Unknown broadcast outcome');return {chainId:'juno-1',transactionHash:'A'.repeat(64),height:100,code:0};
  }};
  return {config,storage,opts,client:()=>new NamesV2Client(opts),writes,fetches:()=>fetches,setMode:v=>mode=v,setWallet:v=>wallet=v,setClock:v=>clock=v,setHook:v=>hook=v};
}
test('opening purchases requires a signed public price and sends only the reviewed pause message',async()=>{
  const h=harness(),c=h.client(),r=await c.purchasePauseReview({owner,paused:false});
  assert.equal(h.writes.length,0);assert.equal(r.expires_at-r.issued_at,300);
  await c.setPurchasesPaused({owner,reviewed:r});
  assert.deepEqual(h.writes[0].msg,{set_purchases_paused:{paused:false}});assert.equal(h.writes[0].contract,manifest.registry);
  assert.equal(c.load(owner).phase,'complete');assert.equal(h.config.purchases_paused,false);
  h.setMode('missing');const fetches=h.fetches();const pause=await c.purchasePauseReview({owner,paused:true});
  await c.setPurchasesPaused({owner,reviewed:pause});assert.equal(h.fetches(),fetches);assert.equal(h.config.purchases_paused,true);
});
test('missing, forged, stale and wrong-deployment prices block opening before a write',async()=>{
  for(const mode of ['missing','signature','expired','envelope']){
    const h=harness();h.setMode(mode);await assert.rejects(h.client().purchasePauseReview({owner,paused:false}));assert.equal(h.writes.length,0);
  }
});
test('non-admin, switched wallet, stale review and changed config cannot change availability',async()=>{
  for(const mutate of [h=>h.setWallet('other'),h=>h.setClock(1791223300),h=>h.config.admin='other',h=>h.config.tariff_version++,h=>h.config.tariff.standard_cents++,h=>h.config.purchases_paused=false,h=>h.config.quote_public_key='wrong']){
    const h=harness(),c=h.client(),r=await c.purchasePauseReview({owner,paused:false});mutate(h);
    await assert.rejects(c.setPurchasesPaused({owner,reviewed:r}));assert.equal(h.writes.length,0);
  }
  const h=harness();h.setWallet('other');await assert.rejects(h.client().purchasePauseReview({owner:'other',paused:false}),/admin/);
  await assert.rejects(h.client().purchasePauseReview({owner,paused:'false'}),/mainnet/);
});
test('admin guard is rechecked after wallet interaction before broadcasting',async()=>{
  for(const mutate of [h=>h.setClock(1791223300),h=>h.config.tariff_version++,h=>h.setWallet('other')]){
    const h=harness(),c=h.client(),r=await c.purchasePauseReview({owner,paused:false});h.setHook(()=>mutate(h));
    await assert.rejects(c.setPurchasesPaused({owner,reviewed:r}));assert.equal(h.writes.length,0);assert.equal(c.load(owner).phase,'write_pending');
  }
});
test('unknown admin outcomes survive reload and recover exact receipts without repeating the action',async()=>{
  const h=harness(),c=h.client(),r=await c.purchasePauseReview({owner,paused:false});h.setMode('lost');
  await assert.rejects(c.setPurchasesPaused({owner,reviewed:r}),/Unknown/);assert.equal(c.load(owner).phase,'write_pending');
  const reloaded=h.client();await assert.rejects(reloaded.purchasePauseReview({owner,paused:true}),/pending/);
  await assert.rejects(reloaded.setPurchasesPaused({owner,reviewed:r}),/pending/);assert.equal(h.writes.length,1);
  await assert.rejects(reloaded.recoverPending(owner,async()=>({intentMatched:false})),/exact/);
  await reloaded.recoverPending(owner,async req=>{assert.deepEqual(req.msg,{set_purchases_paused:{paused:false}});return {intentMatched:true,chainId:'juno-1',transactionHash:'A'.repeat(64),height:100,code:0};});
  assert.equal(reloaded.load(owner).phase,'complete');assert.equal(h.writes.length,1);
});
test('unavailable persistence prevents any admin transaction',async()=>{
  const h=harness(),c=h.client(),r=await c.purchasePauseReview({owner,paused:false});h.storage.setItem=()=>{throw Error('storage unavailable');};
  await assert.rejects(c.setPurchasesPaused({owner,reviewed:r}),/storage/);assert.equal(h.writes.length,0);
});
test('an old cached signer is rejected without creating an unrecoverable pending intent',async()=>{
  const h=harness(),c=h.client(),r=await c.purchasePauseReview({owner,paused:false});h.opts.execute.adminReviewGuard=false;
  await assert.rejects(c.purchasePauseReview({owner,paused:false}),/Reload/);
  await assert.rejects(c.setPurchasesPaused({owner,reviewed:r}),/Reload/);
  assert.equal(c.load(owner),null);assert.equal(h.writes.length,0);
});
