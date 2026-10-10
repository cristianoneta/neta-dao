import test from 'node:test';
import assert from 'node:assert/strict';
import {ownedPersonalCrypto,trackPersonalStorage} from '../relay-personal-runtime-storage.mjs';
import {PersonalBrowserController} from '../relay-personal-browser.mjs';

function storage(){
  class Database{
    name='core-crypto';
    transaction(_store,mode='readonly'){const tx=new EventTarget();tx.mode=mode;return tx;}
  }
  const realm={IDBDatabase:Database,setTimeout,clearTimeout};
  return {db:new Database(),drain:trackPersonalStorage(realm)};
}
test('checkpoint barrier waits for queued follow-up writes',async()=>{
  const {db,drain}=storage();const first=db.transaction('blocks','readwrite');let second,finished=false;
  first.addEventListener('complete',()=>queueMicrotask(()=>{second=db.transaction('blocks','readwrite');}));
  const waiting=drain().then(()=>{finished=true;});
  first.dispatchEvent(new Event('complete'));await new Promise(r=>setTimeout(r,5));
  assert.equal(finished,false);second.dispatchEvent(new Event('complete'));await waiting;
  assert.equal(finished,true);
});
test('write abort rejects the checkpoint; read-only preload abort is allowed',async()=>{
  const {db,drain}=storage();const read=db.transaction('blocks');read.dispatchEvent(new Event('abort'));await drain();
  const write=db.transaction('blocks','readwrite');write.error=Error('disk full');write.dispatchEvent(new Event('abort'));
  await assert.rejects(drain(),/storage write failed/);
  await assert.rejects(drain(),/storage write failed/);
});
test('CoreCrypto adapter releases the temporary constructor reference without GC',()=>{
  let refs=0;
  class Core{
    static new(){const original={uniffiDestroy(){refs--;}};refs++;return new this(original);}
    constructor(){refs++;}
    uniffiDestroy(){refs--;}
  }
  const instance=ownedPersonalCrypto(Core).new();assert.equal(refs,1);instance.uniffiDestroy();assert.equal(refs,0);
});
test('failed storage barrier blocks backup and keeps controller recoverable',async()=>{
  let writes=0;
  const c=new PersonalBrowserController({runtime:{reset:async()=>{},close:async()=>{},drain:async()=>{throw Error('storage write failed');}},
    adapter:{profile:{chain:'juno-1',contract:'juno1'+'q'.repeat(58)},address:'juno1'+'q'.repeat(38),assertWallet:async()=>{}},backup:{latest:async()=>{},upload:async()=>{writes++;}},makeBridge:()=>{},storage:{getItem:()=>null}});
  c.snapshot={controller:{readOnly:false},archiveRecords:[],sendRecords:[],descriptor:{generation:2}};
  c.repo={write:async()=>{writes++;}};
  await assert.rejects(c.run(()=>c.persist()),/storage write failed/);
  assert.equal(writes,0);assert.equal(c.busy,false);assert.equal(c.failed,true);assert.ok(c.snapshot);
});
