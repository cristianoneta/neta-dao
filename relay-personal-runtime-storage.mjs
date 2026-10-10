// SPDX-License-Identifier: GPL-3.0-only
// CoreCrypto 10.5.3 uses relaxed-idb: a finished crypto transaction can still
// have queued IndexedDB commits. Install in the disposable runtime before WASM
// starts. Never capture/replace blocks or remove that realm until they settle.
export function trackPersonalStorage(realm=globalThis){
  const prototype=realm.IDBDatabase.prototype,transaction=prototype.transaction;
  const pending=new Set();let failure=null;
  prototype.transaction=function(...args){
    let tx;
    try{tx=transaction.apply(this,args);}
    catch(error){if(this.name==='core-crypto'&&args[1]==='readwrite')failure=Error('Personal encryption storage write failed',{cause:error});throw error;}
    if(this.name!=='core-crypto')return tx;
    let complete;const settled=new Promise(resolve=>{complete=resolve;});pending.add(settled);
    const finish=()=>{pending.delete(settled);complete();};
    tx.addEventListener('complete',finish,{once:true});
    tx.addEventListener('abort',()=>{
      // The VFS aborts completed read-only preload transactions intentionally.
      if(tx.mode==='readwrite')failure=Error('Personal encryption storage write failed',{cause:tx.error});
      finish();
    },{once:true});
    return tx;
  };
  return async function drain(){
    do{
      await Promise.all([...pending]);
      // The VFS starts its next queued commit in a promise continuation.
      // An event-loop turn drains those continuations, without a timed sleep.
      await new Promise(resolve=>realm.setTimeout(resolve,0));
    }while(pending.size);
    if(failure)throw failure;
  };
}
// CoreCrypto.new() constructs an FFI instance and then a second wrapper. The
// original owns a native reference until GC. Release it explicitly so closing
// the returned controller handle really closes the database before a restore.
export function ownedPersonalCrypto(CoreCrypto){
  return class extends CoreCrypto{
    constructor(instance){try{super(instance);}finally{instance.uniffiDestroy();}}
  };
}
