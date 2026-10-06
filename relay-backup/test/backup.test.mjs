import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Secp256k1Wallet} from '@cosmjs/amino';
import {BackupStore} from '../store.mjs';
import {backupServer} from '../server.mjs';
import {verifyOwnership} from '../auth.mjs';
import {sealPersonalBackup,openPersonalBackup,personalBackupScope,backupDigest,PersonalBackupClient,wrapPersonalDatabaseKey,unwrapPersonalDatabaseKey} from '../../relay-personal-backup.mjs';
const signing=await Secp256k1Wallet.fromKey(new Uint8Array(32).fill(7),'juno'),wallet=(await signing.getAccounts())[0].address;
const scopeObject={chain:'juno-1',wallet,contract:'juno1'+'a'.repeat(58)},scope=personalBackupScope(scopeObject),code='c'.repeat(64);
const path='relay-'+'1'.repeat(24)+'.db';
function snapshot(){return {version:1,scope,corecryptoVersion:'10.5.3',descriptor:{fingerprint:'a'.repeat(64),generation:1},wrappedKey:'encrypted wrapped key',path,
 blocks:[{path,offset:0,data:[1,2,3]}],archiveRecords:[{text:'Already read secret'}],sendRecords:[{state:'pending',id:'1'.repeat(64)}],transactionIntents:[{status:'unknown'}],registrationIntent:null,cursor:8};}
const sign=async message=>{const doc={chain_id:'',account_number:'0',sequence:'0',fee:{gas:'0',amount:[]},msgs:[{type:'sign/MsgSignData',value:{signer:wallet,data:Buffer.from(message).toString('base64')}}],memo:''};return (await signing.signAmino(wallet,doc)).signature;};
test('complete snapshot is authenticated and all fresh restores are read-only',async()=>{
 const envelope=await sealPersonalBackup(scopeObject,3,snapshot(),code);assert.ok(!JSON.stringify(envelope).includes('Already read secret'));
 const restored=await openPersonalBackup(scopeObject,envelope,code,{minimumRevision:3,expectedDigest:await backupDigest(envelope)});
 assert.deepEqual(restored.snapshot,snapshot());assert.equal(restored.writesAllowed,false);
 await assert.rejects(openPersonalBackup(scopeObject,envelope,'d'.repeat(64)),/authentication/);
 await assert.rejects(openPersonalBackup(scopeObject,envelope,code,{minimumRevision:4}),/stale/);
 await assert.rejects(openPersonalBackup(scopeObject,{...envelope,revision:4},code),/authentication/);
 await assert.rejects(openPersonalBackup({...scopeObject,contract:'juno1'+'p'.repeat(58)},envelope,code),/identity/);
 const incomplete=snapshot();delete incomplete.transactionIntents;await assert.rejects(sealPersonalBackup(scopeObject,4,incomplete,code),/Incomplete/);
});
test('SQLite compare-and-swap preserves prior backup across conflict, lost response and restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'relay-backup-'));let db=new BackupStore(join(dir,'backup.sqlite'));
 try{
  const one=JSON.stringify(await sealPersonalBackup(scopeObject,1,snapshot(),code)),r=db.put(scope,0,one);
  assert.deepEqual(db.put(scope,0,one),r);
  assert.throws(()=>db.put(scope,0,JSON.stringify({...JSON.parse(one),iv:Buffer.alloc(12,1).toString('base64')})),/Revision conflict/);
  db.close();db=new BackupStore(join(dir,'backup.sqlite'));assert.equal(db.get(scope).blob,one);
  assert.throws(()=>db.put('wrong-wallet',0,one),/envelope/);assert.equal(db.get(scope).blob,one);
 }finally{db.close();await rm(dir,{recursive:true,force:true});}
});
test('quota failure never removes the previous encrypted object',async()=>{
 const db=new BackupStore(':memory:',{maxTotalBytes:2500});
 try{const one=JSON.stringify(await sealPersonalBackup(scopeObject,1,snapshot(),code));db.put(scope,0,one);
 const larger=snapshot();larger.archiveRecords.push({text:'x'.repeat(3000)});const two=JSON.stringify(await sealPersonalBackup(scopeObject,2,larger,code));
 assert.throws(()=>db.put(scope,1,two),/quota/);assert.equal(db.get(scope).revision,1);
 }finally{db.close();}
});
test('real ADR-36 signatures bind wallet and exact challenge',async()=>{
 const proof=await sign('test challenge');assert.equal(await verifyOwnership(wallet,'test challenge',proof),true);
 assert.equal(await verifyOwnership(wallet,'different challenge',proof),false);
 assert.equal(await verifyOwnership('juno1'+'q'.repeat(38),'test challenge',proof),false);
});
test('HTTP auth rejects replay/expiry/origin and client recovers a lost backup acknowledgement',async()=>{
 let now=100000,lost=false,active=wallet;
 const store=new BackupStore(':memory:');const webOrigin='https://dao.netareborn.com',domain='https://backup.example';
 const server=backupServer({store,origin:webOrigin,domain,chain:'juno-1',contract:scopeObject.contract,now:()=>now,allowedWallets:[wallet]});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const raw=(path,method,body,headers={})=>fetch(url+path,{method,headers:{origin:webOrigin,'content-type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 try{
  const challenge=await (await raw('/v1/challenge','POST',{wallet})).json(),signature=await sign(challenge.message);
  assert.equal((await raw('/v1/auth','POST',{nonce:challenge.nonce,signature})).status,200);
  assert.equal((await raw('/v1/auth','POST',{nonce:challenge.nonce,signature})).status,401);
  assert.equal((await raw('/v1/backup','GET',undefined,{origin:'https://evil.example'})).status,403);
  assert.equal((await raw('/v1/backup','GET')).status,401);
  const client=new PersonalBackupClient({url:domain,webOrigin,scope:scopeObject,now:()=>now,
   keplr:{getOfflineSigner:()=>({getAccounts:async()=>[{address:active}]}),signArbitrary:async(chain,address,message)=>{assert.equal(chain,'juno-1');assert.equal(address,wallet);return sign(message);}},
   fetcher:async(target,options)=>{const response=await fetch(target.replace(domain,url),{...options,headers:{...options.headers,origin:webOrigin}});if(lost&&options.method==='PUT'){lost=false;throw Error('lost response');}return response;}});
  await client.connect();assert.equal(await client.latest(),null);
  lost=true;const envelope=await sealPersonalBackup(scopeObject,1,snapshot(),code),receipt=await client.upload(envelope);
  assert.equal(receipt.revision,1);assert.equal((await client.latest({minimumRevision:1})).digest,receipt.digest);
  active='other';await assert.rejects(client.latest(),/wallet changed/);active=wallet;
  await client.connect();const expiredToken=client.token;now+=16*60000;await assert.rejects(client.latest(),/expired/);
  assert.equal((await raw('/v1/backup','GET',undefined,{authorization:'Bearer '+expiredToken})).status,401);
  assert.equal(store.get(scope).revision,1);
 }finally{await new Promise(r=>server.close(r));store.close();}
});
test('concurrent request cap bounds memory and releases capacity after completion',async()=>{
 const store=new BackupStore(':memory:');let release,entered=0;
 const hold=new Promise(r=>release=r),origin='https://dao.netareborn.com';
 const server=backupServer({store,origin,domain:'https://backup.example',chain:'juno-1',contract:scopeObject.contract,allowedWallets:[wallet],verify:async()=>{entered++;await hold;return true;}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const post=(path,body)=>fetch(url+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
 try{
  const challenges=[];for(let i=0;i<4;i++)challenges.push(await(await post('/v1/challenge',{wallet})).json());
  const pending=challenges.map(c=>post('/v1/auth',{nonce:c.nonce,signature:{}}));
  for(let i=0;i<100&&entered<4;i++)await new Promise(r=>setTimeout(r,5));assert.equal(entered,4);
  assert.equal((await post('/v1/challenge',{wallet})).status,429);
  release();assert.ok((await Promise.all(pending)).every(r=>r.status===200));
  assert.equal((await post('/v1/challenge',{wallet})).status,200);
 }finally{release();await new Promise(r=>server.close(r));store.close();}
});


test('database key wrapping is authenticated and domain/scope separated',async()=>{
 const secret=crypto.getRandomValues(new Uint8Array(32)),wrapped=await wrapPersonalDatabaseKey(scopeObject,secret,code);
 assert.deepEqual(await unwrapPersonalDatabaseKey(scopeObject,wrapped,code),secret);
 await assert.rejects(unwrapPersonalDatabaseKey(scopeObject,wrapped,'d'.repeat(64)));
 await assert.rejects(unwrapPersonalDatabaseKey({...scopeObject,wallet:'juno1'+'p'.repeat(38)},wrapped,code));
 const altered=JSON.parse(wrapped);altered.iv=Buffer.alloc(12).toString('base64');await assert.rejects(unwrapPersonalDatabaseKey(scopeObject,JSON.stringify(altered),code));
});
