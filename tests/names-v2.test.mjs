import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateKey,sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {feeAmount,renewalExpiry,quotePreimage,validateQuote,commitmentHash,YEAR,GRACE,NAMES_V2_DEPLOYMENT} from '../names-v2-core.mjs';
import {NamesV2Client} from '../names-v2-client.mjs';
import {marketPrice,issueQuote} from '../names/quote-policy.mjs';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/nns-v2-quote.json',import.meta.url)));
const now=fixture.now,config=fixture.config,deployment=fixture.deployment;
const privateKey=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.alloc(32,7)]),format:'der',type:'pkcs8'});
function signed(q,c=config){return {quote:q,signature:sign(null,Buffer.from(quotePreimage(deployment,c,q)),privateKey).toString('base64')};}
const fresh=()=>structuredClone(fixture.offer);
test('USD tariffs, micro-token rounding and lifetime boundaries are exact',()=>{
  assert.equal(feeAmount('abc',1,'2000000000000'),'49500000');
  assert.equal(feeAmount('abcd',1,'2000000000000'),'9500000');
  assert.equal(feeAmount('alice',1,'3000000000000'),'1666667');
  assert.equal(feeAmount('alice',5,'2000000000000'),'12500000');
  for(const years of [0,6,1.2])assert.throws(()=>feeAmount('alice',years,'2000000000000'));
  assert.throws(()=>feeAmount('alice',1,'0'));
  assert.equal(renewalExpiry({expires_at:now+YEAR},4,now),now+5*YEAR);
  assert.throws(()=>renewalExpiry({expires_at:now+YEAR},5,now));
  assert.equal(renewalExpiry({expires_at:now-1},1,now),now+YEAR);
  assert.throws(()=>renewalExpiry({expires_at:now-GRACE},1,now));
});
test('Node signature, browser verifier and Rust fixture share the exact protocol',async()=>{
  assert.equal(quotePreimage(deployment,config,fixture.offer.quote),fixture.text);
  assert.equal(await commitmentHash(deployment,'alice','alice.neta',fixture.salt),fixture.commitment);
  const verified=await validateQuote({deployment,config,offer:fresh(),expected:fixture.offer.quote,now});
  assert.equal(verified.amount,'2500000');
  for(const mutate of [q=>q.amount='2500001',q=>q.owner='bob',q=>q.years=2,q=>q.nonce='02'.repeat(32)]){
    const offer=fresh();mutate(offer.quote);await assert.rejects(validateQuote({deployment,config,offer,expected:offer.quote,now}));
  }
  await assert.rejects(validateQuote({deployment,config,offer:fresh(),expected:fixture.offer.quote,now:now+300}),/expired/);
  await assert.rejects(validateQuote({deployment,config:{...config,signer_version:2},offer:fresh(),expected:fixture.offer.quote,now}),/policy changed/);
  await assert.rejects(validateQuote({deployment:{...deployment,registry:'other-registry'},config,offer:fresh(),expected:fixture.offer.quote,now}),/signature/);
  assert.equal(NAMES_V2_DEPLOYMENT,null);
});
function market(){return {
  now,policy:{pool:'approved-pool',neta_token:'approved-token',usd_source:'approved-usd-feed',min_juno_reserve:'1000000',min_neta_reserve:'1000000',max_pool_age:60,max_usd_age:120,max_jump_bps:2000,max_baseline_age:600},
  pool:{chain_id:'juno-1',address:'approved-pool',token:'approved-token',native_denom:'ujuno',token_decimals:6,native_decimals:6,juno_reserve:'400000000',neta_reserve:'100000000',observed_at:now,height:1000},
  usd:{source:'approved-usd-feed',asset:'JUNO',usd_per_juno_12:'500000000000',observed_at:now},previous:{usd_per_neta_12:'2000000000000',observed_at:now-60},
};}
test('quote policy rejects stale/wrong/illiquid markets and excessive price changes',()=>{
  assert.equal(marketPrice(market()),'2000000000000');
  for(const mutate of [x=>x.pool.token='other',x=>x.pool.native_denom='uatom',x=>x.pool.observed_at=now-61,x=>x.usd.observed_at=now+1,
    x=>x.previous=null,x=>x.policy.max_jump_bps=0,x=>x.pool.juno_reserve='999999',x=>x.pool.juno_reserve='800000000',x=>x.usd.asset='ATOM',
    x=>{delete x.policy.pool;delete x.pool.address;},x=>{x.policy.usd_source='';x.usd.source='';}]){
    const x=market();mutate(x);assert.throws(()=>marketPrice(x));
  }
});
test('quote issuer derives its amount and lifecycle from verified inputs',async()=>{
  const m=market();let calls=0;
  const args={deployment,config,request:{operation:'register',payer:'alice',name:'Alice',years:1,amount:'1'},identity:{name:'alice.neta',available:true,next_generation:1},market:m,policy:m.policy,now,sign:async bytes=>{calls++;return sign(null,bytes,privateKey).toString('base64');}};
  const result=await issueQuote(args);assert.equal(result.quote.amount,'2500000');
  await validateQuote({deployment,config,offer:result,expected:fixture.offer.quote,now});
  assert.equal(calls,1);
  await assert.rejects(issueQuote({...args,identity:null}));assert.equal(calls,1);
});

function harness(){
  let wallet='alice', clock=now, record=null, commitment=null, offer=null, fail=false, writes=0;
  const records=new Map();const storage={getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)};
  const reader={verify:async()=>structuredClone(config),resolve:async n=>({name:n,available:!record,next_generation:record?record.generation+1:1}),
    nameOf:async address=>({address,name:record?.owner===address?record.name:null}),commitment:async()=>commitment,identity:async()=>record,transferOffer:async()=>offer};
  const opts={deployment,reader,storage,walletAddress:async()=>wallet,now:()=>clock,withLock:async(_key,fn)=>fn(),execute:async request=>{
    writes++;if(fail)throw Error('Unknown broadcast outcome');
    if(request.msg.commit){
      assert.equal(request.memo,'Commit NETA name');
      assert.deepEqual(Object.keys(request.msg.commit),['hash']);
      commitment={hash:request.msg.commit.hash,height:100,expires_at:clock+3600};
    }
    if(request.msg.send){const hook=JSON.parse(Buffer.from(request.msg.send.msg,'base64').toString());
      const q=(hook.register||hook.renew||hook.register_snapshot||hook.renew_snapshot).offer.quote;record={name:q.name,owner:q.owner,generation:q.generation,ownership_revision:q.ownership_revision,expires_at:((hook.renew||hook.renew_snapshot)?Math.max(clock,q.expected_expires_at):clock)+q.years*YEAR};}
    return {transactionHash:'A'.repeat(64),chainId:'uni-7',code:0,height:101};
  }};
  return {opts,client:()=>new NamesV2Client(opts),storage,reader,writes:()=>writes,setWallet:w=>wallet=w,setClock:t=>clock=t,setFail:f=>fail=f,setRecord:r=>record=r,setOffer:o=>offer=o};
}
test('registration persists its secret before signing and resumes across reloads',async()=>{
  const h=harness(), c=h.client();
  const i=await c.prepareRegistration({owner:'alice',name:'Alice',years:1});
  assert.equal(c.load('alice').salt,i.salt);assert.equal(h.writes(),0);
  await c.commit('alice');assert.equal(c.load('alice').phase,'committed');
  const reloaded=h.client();const offer=await reloaded.registrationQuote('alice',async()=>fresh());
  const r=await reloaded.register('alice',offer);assert.equal(r.owner,'alice');assert.equal(h.writes(),2);
  assert.equal(reloaded.load('alice').phase,'complete');assert.equal(reloaded.load('alice').salt,undefined);
});
test('unknown broadcasts never automatically retry, including after reload',async()=>{
  const h=harness(), c=h.client();await c.prepareRegistration({owner:'alice',name:'alice',years:1});h.setFail(true);
  await assert.rejects(c.commit('alice'),/Unknown broadcast/);assert.equal(c.load('alice').phase,'commit_pending');
  await assert.rejects(h.client().commit('alice'),/reconciliation/);assert.equal(h.writes(),1);
  await assert.rejects(c.reconcile('alice','A'.repeat(64),async()=>({transactionHash:'A'.repeat(64),chainId:'uni-7',code:0,height:100,intentMatched:false})),/exact Names intent/);
  assert.equal(c.load('alice').phase,'commit_pending');
});
test('storage failure and wallet changes prevent any signing',async()=>{
  const h=harness();h.opts.storage={getItem:()=>null,setItem:()=>{throw Error('storage full');}};
  await assert.rejects(h.client().prepareRegistration({owner:'alice',name:'alice',years:1}),/storage full/);assert.equal(h.writes(),0);
  const a=harness(), c=a.client();await c.prepareRegistration({owner:'alice',name:'alice',years:1});a.setWallet('bob');
  await assert.rejects(c.commit('alice'),/Wallet changed/);assert.equal(a.writes(),0);
});
test('an expired reviewed quote is not silently replaced or submitted',async()=>{
  const h=harness(),c=h.client();await c.prepareRegistration({owner:'alice',name:'alice',years:1});await c.commit('alice');h.setClock(now+300);
  await assert.rejects(c.register('alice',fresh()),/expired/);assert.equal(h.writes(),1);assert.equal(c.load('alice').phase,'committed');
});
test('a third-party renewal binds the name owner while the sponsor pays',async()=>{
  const h=harness();h.setWallet('sponsor');h.setRecord({name:'alice.neta',owner:'alice',generation:1,ownership_revision:1,expires_at:now+YEAR});
  const q={...fixture.offer.quote,operation:'renew',payer:'sponsor',expected_expires_at:now+YEAR};
  await h.client().renew({payer:'sponsor',name:'alice',years:1,reviewedOffer:signed(q)});
  assert.equal((await h.reader.identity()).owner,'alice');assert.equal(h.writes(),1);
});
test('transfer acceptance checks recipient, current offer id and existing ownership',async()=>{
  const h=harness();h.setRecord({name:'alice.neta',owner:'alice',generation:1,ownership_revision:1,expires_at:now+YEAR});
  h.setOffer({id:2,owner:'alice',recipient:'bob',generation:1,ownership_revision:1,expires_at:now+100});
  h.setWallet('charlie');await assert.rejects(h.client().transfer({owner:'charlie',name:'alice',action:'accept',offerId:2}),/recipient/);
  h.setWallet('bob');await assert.rejects(h.client().transfer({owner:'bob',name:'alice',action:'accept',offerId:1}),/changed/);
  assert.equal(h.writes(),0);
  await h.client().transfer({owner:'bob',name:'alice',action:'accept',offerId:2});assert.equal(h.writes(),1);
});

test('explicit recovery restores only a proven unbroadcast or included-failure attempt',async()=>{
 const h=harness(),c=h.client();await c.prepareRegistration({owner:'alice',name:'alice',years:1});h.setFail(true);
 await assert.rejects(c.commit('alice'));const pending=c.load('alice');assert.match(pending.request.intentId,/^[a-f0-9]{32}$/);
 await assert.rejects(c.recoverPending('alice',async()=>({notBroadcast:true,intentMatched:false})),/prove/);
 assert.equal(c.load('alice').phase,'commit_pending');
 await c.recoverPending('alice',async request=>{assert.equal(request.intentId,pending.request.intentId);return {notBroadcast:true,intentMatched:true};});
 assert.equal(c.load('alice').phase,'prepared');assert.equal(c.load('alice').salt,pending.salt);
 h.setFail(false);await c.commit('alice');h.setFail(true);await assert.rejects(c.register('alice',fresh()));
 await c.recoverPending('alice',async()=>({transactionHash:'A'.repeat(64),chainId:'uni-7',height:100,code:5,intentMatched:true}));
 assert.equal(c.load('alice').phase,'committed');assert.equal(c.load('alice').last_outcome,'failed');assert.equal(h.writes(),3);
});
test('cancelling a prepared registration is local; pending outcomes cannot be discarded',async()=>{
 const h=harness(),c=h.client();await c.prepareRegistration({owner:'alice',name:'alice',years:1});await c.cancelRegistration('alice');
 assert.equal(h.writes(),0);assert.equal(c.load('alice').phase,'complete');
 await c.prepareRegistration({owner:'alice',name:'alice',years:1});h.setFail(true);await assert.rejects(c.commit('alice'));
 await assert.rejects(c.cancelRegistration('alice'),/Reconcile/);assert.equal(c.load('alice').phase,'commit_pending');
});
test('public profile writes bind current owner and reviewed profile revision',async()=>{
 const h=harness();h.opts.deployment={...deployment,profile_contract:'profile-contract'};
 h.reader.profile=async()=>({active:true,profile:{identity:{name:'alice.neta',owner:'alice',expires_at:now+YEAR},revision:2}});
 const c=h.client();await assert.rejects(c.updateProfile({owner:'alice',name:'alice',contacts:{},expectedRevision:1}),/revision/);assert.equal(h.writes(),0);
 await c.updateProfile({owner:'alice',name:'alice',contacts:{discord:'operator'},expectedRevision:2});assert.equal(h.writes(),1);
 assert.equal(c.load('alice').request.contract,'profile-contract');assert.equal(c.load('alice').phase,'complete');
});

test('admin tariff update preserves version, wallet and pending-intent guards',async()=>{
 const tariff={three_cents:9900,four_cents:1900,standard_cents:500};
 const h=harness(),c=h.client();
 await assert.rejects(c.setTariff({owner:'alice',tariff,expectedVersion:1}),/registry admin/);assert.equal(h.writes(),0);
 h.setWallet('admin');
 await assert.rejects(c.setTariff({owner:'admin',tariff,expectedVersion:2}),/Tariff changed/);
 await assert.rejects(c.setTariff({owner:'admin',tariff:{...tariff,extra:1},expectedVersion:1}),/Invalid reviewed/);
 await c.setTariff({owner:'admin',tariff,expectedVersion:1});
 const done=c.load('admin');assert.equal(h.writes(),1);assert.equal(done.phase,'complete');assert.deepEqual(done.request.msg,{set_tariff:{tariff,expected_version:1}});assert.equal(done.request.contract,deployment.registry);
 h.reader.verify=async()=>({...config,tariff,tariff_version:2});
 await assert.rejects(c.setTariff({owner:'admin',tariff,expectedVersion:2}),/already active/);assert.equal(h.writes(),1);
});
test('unknown tariff update survives reload and reconciles without repeating the write',async()=>{
 const h=harness(),tariff={three_cents:9900,four_cents:1900,standard_cents:500};h.setWallet('admin');h.setFail(true);
 await assert.rejects(h.client().setTariff({owner:'admin',tariff,expectedVersion:1}),/Unknown broadcast/);
 const c=h.client();assert.equal(c.load('admin').phase,'write_pending');
 await assert.rejects(c.setTariff({owner:'admin',tariff,expectedVersion:1}),/pending Names/);assert.equal(h.writes(),1);
 await c.recoverPending('admin',async request=>{assert.deepEqual(request.msg.set_tariff.tariff,tariff);return {transactionHash:'A'.repeat(64),chainId:'uni-7',height:100,code:0,intentMatched:true};});
 assert.equal(c.load('admin').phase,'complete');assert.equal(h.writes(),1);
});
test('approved tariff prices registration and renewal quotes and invalidates prior versions',async()=>{
 const updated={...config,tariff:{three_cents:9900,four_cents:1900,standard_cents:500},tariff_version:2};
 for(const [name,amount] of [['abc.neta','49500000'],['abcd.neta','9500000'],['alice.neta','2500000']])for(const operation of ['register','renew']){
  const q={...fixture.offer.quote,name,operation,tariff_version:2,amount,expected_expires_at:operation==='renew'?now+YEAR:0};
  const offer=signed(q,updated);assert.equal((await validateQuote({deployment,config:updated,offer,expected:q,now})).amount,amount);
 }
 await assert.rejects(validateQuote({deployment,config:updated,offer:fresh(),expected:fixture.offer.quote,now}),/policy changed/);
});


test('shared snapshot purchase uses the existing durable commit/payment/recovery coordinator',async()=>{
  const shared=JSON.parse(readFileSync(new URL('./fixtures/nns-price-snapshot.json',import.meta.url)));
  const h=harness();h.opts.deployment={...deployment,pricing_protocol:'treasury-snapshot-v1'};
  const c=h.client();await c.prepareRegistration({owner:'alice',name:'alice',years:1});await c.commit('alice');
  const published={schema_version:1,chain_id:deployment.chain_id,registry:deployment.registry,token:config.token,treasury:config.treasury,snapshot:shared.offer.snapshot,signature:shared.offer.signature};
  const reviewed=await c.snapshotQuote({payer:'alice',name:'alice',years:1,operation:'register',fetcher:async()=>new Response(JSON.stringify(published))});
  assert.equal(h.writes(),1);
  h.setFail(true);await assert.rejects(c.register('alice',reviewed),/Unknown broadcast/);
  const reloaded=h.client();assert.equal(reloaded.load('alice').phase,'payment_pending');
  assert.ok(JSON.parse(atob(reloaded.load('alice').request.msg.send.msg)).register_snapshot);
  await assert.rejects(reloaded.register('alice',reviewed),/reconciliation/);
  await reloaded.recoverPending('alice',async()=>({notBroadcast:true,intentMatched:true}));
  h.setFail(false);await reloaded.register('alice',reviewed);
  assert.equal(reloaded.load('alice').phase,'complete');assert.equal((await h.reader.identity()).owner,'alice');
});
