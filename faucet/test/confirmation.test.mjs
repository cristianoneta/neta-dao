import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createTransactionLookup,transactionTransport,CONFIRMATION_VERSION} from '../service/confirmation.mjs';
import {FaucetLedger,DAY} from '../service/ledger.mjs';

const rpc='https://juno.test.rpc.nodeshub.online';
const bytes=Buffer.from('synthetic signed transaction'),hash=createHash('sha256').update(bytes).digest('hex').toUpperCase();
const receipt=()=>({hash,height:'123',tx:bytes.toString('base64'),tx_result:{code:0}});
const json=data=>new Response(JSON.stringify(data));
function fixture({network='uni-7',result=receipt(),primaryError=false}={}){
  const calls=[];
  return {calls,fetcher:async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/status'))return json({result:{node_info:{network}}});
    assert.ok(url.endsWith('/tx?hash=0x'+hash));
    if(url.startsWith(rpc)||primaryError)return json({error:{message:'transaction indexing is disabled'}});
    return json({result});
  }};
}
test('indexed fallback validates fresh UNI-7 identity and exact signed bytes',async()=>{
  const f=fixture(),lookup=createTransactionLookup({rpc,fetcher:f.fetcher});
  assert.deepEqual(await lookup(hash),{hash,height:123,code:0});
  assert.equal(f.calls.length,4);assert.match(f.calls[0].url,/stavr/);
  assert.equal(f.calls[0].options.signal,f.calls[1].options.signal);
  assert.equal(f.calls[0].options.redirect,'error');
});
test('configured RPC can confirm when preferred index is unavailable',async()=>{
  const lookup=createTransactionLookup({rpc,fetcher:async(url)=>{
    if(url.includes('stavr'))throw Error('offline');
    if(url.endsWith('/status'))return json({result:{node_info:{network:'uni-7'}}});
    return json({result:receipt()});
  }});
  assert.equal((await lookup(hash)).code,0);
});
test('wrong chain and disabled indexes leave the outcome unknown',async()=>{
  for(const options of [{network:'juno-1'},{primaryError:true}]){
    const f=fixture(options);assert.equal(await createTransactionLookup({rpc,fetcher:f.fetcher})(hash),null);
  }
});
test('wrong hash, signed bytes, height, code and malformed receipts cannot unlock',async()=>{
  const base=receipt();
  for(const result of [null,{}, {...base,hash:'A'.repeat(64)}, {...base,tx:Buffer.from('altered').toString('base64')},
    {...base,tx:base.tx+'!'}, {...base,height:'0'}, {...base,height:'1.5'}, {...base,height:'9007199254740992'},
    {...base,tx_result:{}}, {...base,tx_result:{code:'0'}}, {...base,tx_result:{code:-1}}, {...base,tx_result:{code:2**32}}]){
    const f=fixture({result});assert.equal(await createTransactionLookup({rpc,fetcher:f.fetcher})(hash),null);
  }
});
test('transport failures, redirects, invalid JSON and oversized bodies remain unknown',async()=>{
  for(const fetcher of [async()=>{throw Error('timeout');},async()=>new Response('',{status:302}),async()=>new Response('{'),async()=>new Response('x'.repeat(512*1024+1))]){
    assert.equal(await createTransactionLookup({rpc,fetcher})(hash),null);
  }
});
test('invalid hashes and unsafe RPC configuration fail before any network access',async()=>{
  let calls=0;const lookup=createTransactionLookup({rpc,fetcher:async()=>{calls++;}});
  for(const h of ['',hash.toLowerCase(),hash+'?query=1',null])await assert.rejects(lookup(h),/Invalid transaction hash/);
  assert.equal(calls,0);
  for(const url of ['http://rpc.test','https://user:pass@rpc.test','https://rpc.test?key=1','https://rpc.test#fragment'])assert.throws(()=>createTransactionLookup({rpc:url}),/HTTPS/);
});
test('concurrent recovery shares one lookup but later refresh queries fresh state',async()=>{
  const f=fixture(),lookup=createTransactionLookup({rpc,fetcher:f.fetcher});
  const results=await Promise.all([lookup(hash),lookup(hash),lookup(hash)]);
  assert.ok(results.every(r=>r.hash===hash));assert.equal(f.calls.length,4);
  await lookup(hash);assert.equal(f.calls.length,8);
});
test('broadcast submits once without polling a disabled index; wrong chain never submits',async()=>{
  let submissions=0,network='uni-7';
  const client={getChainId:async()=>network,broadcastTxSync:async tx=>{assert.deepEqual(tx,bytes);submissions++;return hash;},broadcastTx:()=>assert.fail('must not use index polling'),getTx:()=>assert.fail('must not use configured getTx')};
  const transport=transactionTransport(client,{rpc});assert.equal(transport.confirmation,CONFIRMATION_VERSION);
  assert.equal(await transport.broadcast(bytes.toString('base64')),hash);assert.equal(submissions,1);
  network='juno-1';await assert.rejects(transport.broadcast(bytes.toString('base64')),/network mismatch/);assert.equal(submissions,1);
});
test('unknown payout survives restart, then verified receipt starts durable cooldown without rebroadcast',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'neta-confirmation-')),file=join(dir,'ledger.sqlite');
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  let proof=null,prepares=0,broadcasts=0,now=1800000000000;
  const adapter={prepare:async()=>{prepares++;return {hash,bytes:bytes.toString('base64')};},broadcast:async()=>{broadcasts++;throw Error('unknown network outcome');},lookup:createTransactionLookup({rpc,fetcher:async(url)=>{
    if(url.endsWith('/status'))return json({result:{node_info:{network:'uni-7'}}});
    return url.startsWith(rpc)?json({error:{message:'index disabled'}}):json({result:proof});
  }})};
  const options={verify:async()=>true,domain:'test',now:()=>now};
  let ledger=new FaucetLedger(file,adapter,options);
  const c=ledger.challenge('alice');assert.equal((await ledger.claim(c)).status,'pending');ledger.close();
  ledger=new FaucetLedger(file,adapter,options);
  try{
    await ledger.reconcile();assert.equal(ledger.blocked(),true);
    proof={...receipt(),tx:Buffer.from('tampered').toString('base64')};await ledger.reconcile();assert.equal(ledger.blocked(),true);
    proof=receipt();await ledger.reconcile();assert.equal(ledger.blocked(),false);
    assert.equal((await ledger.claim(c)).status,'confirmed');assert.equal(prepares,1);assert.equal(broadcasts,1);
  }finally{ledger.close();}
  ledger=new FaucetLedger(file,adapter,options);
  try{assert.throws(()=>ledger.challenge('alice'),/Only 25/);now+=DAY-1;assert.throws(()=>ledger.challenge('alice'),/Only 25/);now++;assert.ok(ledger.challenge('alice').id);}
  finally{ledger.close();}
});
test('verified included failure releases reservation without a successful-payout cooldown',async()=>{
  const f=fixture({result:{...receipt(),tx_result:{code:5}}});
  const adapter={prepare:async()=>({hash,bytes:bytes.toString('base64')}),broadcast:async()=>{},lookup:createTransactionLookup({rpc,fetcher:f.fetcher})};
  const ledger=new FaucetLedger(':memory:',adapter,{verify:async()=>true,domain:'test'});
  try{assert.equal((await ledger.claim(ledger.challenge('alice'))).status,'failed');assert.equal(ledger.blocked(),false);assert.equal(ledger.eligibility('alice').nextClaimAt,null);}
  finally{ledger.close();}
});

test('slow preferred index cannot delay confirmation and outstanding reads are cancelled',async()=>{
  const signals=[];
  const lookup=createTransactionLookup({rpc,fetcher:async(url,{signal})=>{
    if(url.includes('stavr')){
      signals.push(signal);
      return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
    }
    if(url.endsWith('/status'))return json({result:{node_info:{network:'uni-7'}}});
    return json({result:receipt()});
  }});
  assert.equal((await lookup(hash)).code,0);assert.equal(signals.length,2);
  assert.ok(signals.every(signal=>signal.aborted));
});
