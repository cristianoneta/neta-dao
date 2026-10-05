import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PRICE_SNAPSHOT_TTL,priceSnapshotPreimage,validatePriceSnapshot,validateQuote,paymentMessage,feeAmount} from '../../names-v2-core.mjs';
import {snapshotOffer,fetchSnapshotOffer,snapshotReview} from '../snapshot-client.mjs';
import {priceFromTreasury,signTreasuryPrice} from '../publish-snapshot.mjs';
import {CHAIN,NETA,DAO,POOL} from '../service/constants.mjs';
import {SNAPSHOT_ARTIFACTS} from '../mainnet-artifacts.mjs';
const fixture=JSON.parse(readFileSync(new URL('../../tests/fixtures/nns-v2-quote.json',import.meta.url)));
const key=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.alloc(32,7)]),format:'der',type:'pkcs8'});
const publicKey=createPublicKey(key).export({format:'der',type:'spki'}).subarray(-32).toString('base64');
const now=fixture.now, config=fixture.config, deployment={...fixture.deployment,pricing_protocol:'treasury-snapshot-v1'};
const expected=fixture.offer.quote;
function price(d=deployment,c=config,mutate=()=>{}) {
  const snapshot={signer_version:1,usd_per_neta_12:'2000000000000',observed_at:now-3600,expires_at:now-3600+PRICE_SNAPSHOT_TTL};mutate(snapshot);
  return {snapshot,signature:sign(null,Buffer.from(priceSnapshotPreimage(d,c,snapshot)),key).toString('base64')};
}
test('shared signed price matches the Rust fixture and is reusable across buyers and tariffs',async()=>{
  const shared=JSON.parse(readFileSync(new URL('../../tests/fixtures/nns-price-snapshot.json',import.meta.url)));
  assert.equal(priceSnapshotPreimage(deployment,config,shared.offer.snapshot),shared.text);
  await validatePriceSnapshot({deployment,config,...shared.offer,now});
  const signedPrice=price();
  for(const payer of ['alice','bob']) for(const [name,cents] of [['abc.neta',9900],['abcd.neta',1900],['alice.neta',500]]) {
    const c={...config,tariff:{three_cents:9900,four_cents:1900,standard_cents:500},tariff_version:2};
    const e={...expected,payer,owner:payer,name};
    const offer=await snapshotOffer({deployment,config:c,signedPrice,expected:e,now});
    assert.equal(offer.quote.amount,String(cents*5000));
    assert.equal(offer.signature,signedPrice.signature);
    const hook=JSON.parse(atob(paymentMessage(deployment,c,offer,fixture.salt).msg.send.msg));
    assert.deepEqual(hook.register_snapshot.offer,offer);
    assert.match(snapshotReview(offer),/Price observed:/);
  }
});
test('invalid signatures, wrong contexts, future/expired/overlong snapshots cannot create purchases',async()=>{
  const args={deployment,config,...price(),now};
  for(const field of ['registry','chain_id']) await assert.rejects(validatePriceSnapshot({...args,deployment:{...deployment,[field]:field==='chain_id'?'juno-1':'other-registry'}}));
  for(const field of ['token','treasury','quote_public_key','signer_version']) await assert.rejects(validatePriceSnapshot({...args,config:{...config,[field]:field==='signer_version'?2:'other-token'}}));
  for(const mutate of [p=>p.observed_at=now+1,p=>p.expires_at=now,p=>p.expires_at=p.observed_at+86401,p=>p.signer_version=2]) {
    await assert.rejects(validatePriceSnapshot({...args,...price(deployment,config,mutate)}));
  }
  const changed=price();changed.snapshot.usd_per_neta_12='9999999999999';
  await assert.rejects(validatePriceSnapshot({...args,...changed}),/signature/);
  await assert.rejects(snapshotOffer({deployment:fixture.deployment,config,signedPrice:price(),expected,now}),/snapshot-capable/);
});
test('snapshot age is independent from five-minute payment review; amount and reviewed identity remain enforced',async()=>{
  const offer=await snapshotOffer({deployment,config,signedPrice:price(),expected,now});
  const args={deployment,config,offer,expected,now};
  await assert.rejects(validateQuote({...args,now:now+300}),/expired/);
  for(const field of ['amount','usd_per_neta_12','owner','years','tariff_version']) {
    const changed=structuredClone(offer);changed.quote[field]=typeof changed.quote[field]==='number'?changed.quote[field]+1:'999';
    await assert.rejects(validateQuote({...args,offer:changed}));
  }
  const nearExpiry=price(deployment,config,p=>p.expires_at=now+30);
  const brief=await snapshotOffer({deployment,config,signedPrice:nearExpiry,expected,now});
  assert.equal(brief.quote.expires_at,now+30);
  await assert.rejects(validateQuote({...args,offer:brief,now:now+30}));
  const e={...expected,operation:'renew',payer:'sponsor',expected_expires_at:now+31536000};
  const renewal=await snapshotOffer({deployment,config,signedPrice:price(),expected:e,now});
  assert.ok(JSON.parse(atob(paymentMessage(deployment,config,renewal).msg.send.msg)).renew_snapshot);
});
const prod={...deployment,version:3,chain_id:CHAIN,registry:'juno186sudtyc6sfwfhs77uj6dnsmgf7sl9774slycavxmmfakhmhxans6f64x7',token:NETA,treasury:DAO,admin:DAO,testnet_only:false,signer_version:1,quote_public_key:publicKey};
prod.profile_contract='juno1rch3ut6r5ht3l94nw9yptdv3lg9fjhafnax5udz6dqzxe8lt6u8qhtmjvp';
prod.contracts=Object.fromEntries(['registry','profiles'].map((role,i)=>[role,{code_id:100+i,sha256:SNAPSHOT_ARTIFACTS[role].sha256,admin:null,creator:'juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt'}]));
function treasury(){return {chain_id:CHAIN,treasury_address:DAO,status:'PARTIAL',assets:[],nns_price:{token:NETA,pool:POOL,source:'treasury-wynd-juno-usd',observed_at:new Date((now-3600)*1000).toISOString(),usd_price:'1.039521280267436517629374242'}};}
test('publisher reuses treasury prices with exact decimal arithmetic and original expiry, even with zero holdings',async()=>{
  const t=treasury(), p=priceFromTreasury(t,now);
  assert.equal(p.usd_per_neta_12,'1039521280267');assert.equal(p.expires_at,now-3600+86400);
  const signed=signTreasuryPrice({treasury:t,deployment:prod,privateKeyPem:key.export({format:'pem',type:'pkcs8'}),now});
  assert.deepEqual(await validatePriceSnapshot({deployment:prod,config:prod,...signed,now}),signed.snapshot);
  const again=signTreasuryPrice({treasury:t,deployment:prod,privateKeyPem:key.export({format:'pem',type:'pkcs8'}),now:now+1800});assert.deepEqual(again,signed);
  assert.equal(Object.hasOwn(signed,'privateKeyPem'),false);
  const response=()=>new Response(JSON.stringify(signed));
  const c={...prod,tariff:config.tariff,tariff_version:1,purchases_paused:false};
  const offer=await fetchSnapshotOffer({deployment:prod,config:c,expected,now,fetcher:response});
  assert.equal(offer.quote.amount,feeAmount(expected.name,1,p.usd_per_neta_12,c.tariff));
  await assert.rejects(fetchSnapshotOffer({deployment:prod,config:c,expected,now,fetcher:()=>new Response(JSON.stringify({...signed,registry:'other-registry'}))}),/mismatch/);
});
test('publisher refuses missing, wrong, nonpositive, expired or future-dated prices and wrong signing key',()=>{
  for(const mutate of [t=>t.nns_price=null,t=>t.chain_id='uni-7',t=>t.nns_price.token='other',t=>t.nns_price.pool='other',t=>t.nns_price.usd_price='0',t=>t.nns_price.usd_price='-1',t=>t.nns_price.usd_price='NaN',t=>t.nns_price.observed_at=new Date((now+1)*1000).toISOString(),t=>t.nns_price.observed_at=new Date((now-86400)*1000).toISOString()]) {
    const t=treasury();mutate(t);assert.throws(()=>priceFromTreasury(t,now));
  }
  assert.throws(()=>signTreasuryPrice({treasury:treasury(),deployment:{...prod,quote_public_key:Buffer.alloc(32,8).toString('base64')},privateKeyPem:key.export({format:'pem',type:'pkcs8'}),now}),/key/);
});

test('release artifacts preserve the existing UNI-7 registry and pin the new snapshot registry separately',async()=>{
  const {createHash}=await import('node:crypto');
  for(const a of Object.values(SNAPSHOT_ARTIFACTS)) assert.equal(createHash('sha256').update(readFileSync(new URL('../../'+a.path,import.meta.url))).digest('hex'),a.sha256);
  const old=readFileSync(new URL('../../assets/names-testnet/neta_names_v2.wasm',import.meta.url));
  assert.equal(createHash('sha256').update(old).digest('hex'),'76a8ce6ce72d8ea73116bafad83a770438aa0e3e8f1f87957177d855ddee8b65');
  assert.notEqual(SNAPSHOT_ARTIFACTS.registry.sha256,createHash('sha256').update(old).digest('hex'));
});

test('publisher CLI retains the exact last good file on collection/key errors and never re-dates a retained observation',async()=>{
  const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os'); const {join}=await import('node:path'); const {spawnSync}=await import('node:child_process');
  const dir=mkdtempSync(join(tmpdir(),'nns-snapshot-test-'));
  try {
    const t=treasury();t.nns_price.observed_at=new Date(Date.now()-3600000).toISOString();
    const input=join(dir,'treasury.json'), manifest=join(dir,'manifest.json'), output=join(dir,'price.json');
    writeFileSync(input,JSON.stringify(t));writeFileSync(manifest,JSON.stringify(prod));
    const run=secret=>spawnSync(process.execPath,[new URL('../publish-snapshot.mjs',import.meta.url).pathname,input,manifest,output],{encoding:'utf8',env:{...process.env,NNS_PRICE_SIGNING_KEY:secret}});
    const pem=key.export({format:'pem',type:'pkcs8'});
    assert.equal(run(pem).status,0);const before=readFileSync(output,'utf8');
    assert.equal(run(pem).status,0);assert.equal(readFileSync(output,'utf8'),before);
    const bad=run('SECRET_NOT_TO_LEAK');assert.equal(bad.status,1);assert.ok(!bad.stderr.includes('SECRET_NOT_TO_LEAK'));
    assert.equal(readFileSync(output,'utf8'),before);
    t.nns_price.observed_at=new Date(Date.now()-86401000).toISOString();writeFileSync(input,JSON.stringify(t));
    assert.equal(run(pem).status,1);assert.equal(readFileSync(output,'utf8'),before);
  } finally {rmSync(dir,{recursive:true,force:true});}
});


test('untrusted price envelope cannot replace the verified deployment or authority config',async()=>{
  const otherKey=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.alloc(32,8)]),format:'der',type:'pkcs8'});
  const signedPrice=price();
  signedPrice.config={...config,quote_public_key:createPublicKey(otherKey).export({format:'der',type:'spki'}).subarray(-32).toString('base64')};
  signedPrice.signature=sign(null,Buffer.from(priceSnapshotPreimage(deployment,signedPrice.config,signedPrice.snapshot)),otherKey).toString('base64');
  await assert.rejects(snapshotOffer({deployment,config,signedPrice,expected,now}),/signature/);
  const offer=await snapshotOffer({deployment,config,signedPrice:price(),expected,now});
  offer.config=signedPrice.config;offer.signature=signedPrice.signature;
  await assert.rejects(validateQuote({deployment,config,offer,expected,now}),/signature/);
});
