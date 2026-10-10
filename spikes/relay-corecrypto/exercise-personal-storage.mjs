import assert from 'node:assert/strict';

// Deliberately hold a real IndexedDB writer while the crypto realm is closed.
// A wrapper-only teardown removes the iframe early; the barrier must retain it
// until both this write and its promise-queued successor finish.
export async function exercisePersonalStorage(browser,origin){
  const context=await browser.newContext({ignoreHTTPSErrors:true});const page=await context.newPage();
  try{
    await page.addInitScript(()=>{
      const Native=FinalizationRegistry;window.nativeReferences=new Map();
      window.FinalizationRegistry=class extends Native{
        register(target,held,token){if(typeof target?.p==='bigint'&&typeof target?.markDestroyed==='function')nativeReferences.set(token,target);super.register(target,held,token);}
        unregister(token){nativeReferences.delete(token);return super.unregister(token);}
      };
    });
    await page.goto(origin+'/fixture');
    assert.equal(await page.evaluate(async()=>{
      const {PersonalCryptoRuntime}=await import('/relay-personal-runtime.mjs');
      const runtime=new PersonalCryptoRuntime(),wire=await runtime.reset();
      const key=new wire.DatabaseKey(crypto.getRandomValues(new Uint8Array(32)));
      const db=await wire.Database.open('relay-'+'c'.repeat(24)+'.db',key),cc=wire.CoreCrypto.new(db);
      await cc.transactionFfi({execute:async ctx=>{try{await ctx.proteusInit();}finally{ctx.uniffiDestroy();}}});
      cc.uniffiDestroy();db.uniffiDestroy();key.uniffiDestroy();await runtime.drain?.();
      const remaining=runtime.frame.contentWindow.nativeReferences.size;await runtime.close();return remaining;
    }),0,'native handles must close without waiting for garbage collection');
    await page.evaluate(async()=>{
      const {PersonalCryptoRuntime}=await import('/relay-personal-runtime.mjs');
      window.runtime=new PersonalCryptoRuntime();await runtime.reset();
      const frame=runtime.frame,realm=frame.contentWindow;
      const open=realm.indexedDB.open('core-crypto',1);
      open.onupgradeneeded=()=>open.result.createObjectStore('blocks',{keyPath:['path','offset']});
      const db=await new Promise((resolve,reject)=>{open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);});
      const tx=db.transaction('blocks','readwrite'),store=tx.objectStore('blocks');
      window.releaseWriter=false;window.runtimeClosed=false;window.writeFinished=false;
      function hold(){const r=store.get(['fixture',0]);r.onsuccess=()=>{if(!releaseWriter)hold();else store.put({path:'fixture',offset:0,data:new Uint8Array([1])});};}hold();
      tx.addEventListener('complete',()=>queueMicrotask(()=>{
        const next=db.transaction('blocks','readwrite');next.objectStore('blocks').put({path:'fixture',offset:1,data:new Uint8Array([2])});
        next.addEventListener('complete',()=>{writeFinished=true;db.close();});
      }));
      window.closing=Promise.resolve(runtime.close()).then(()=>{runtimeClosed=true;});window.frame=frame;
    });
    assert.deepEqual(await page.evaluate(()=>({closed:runtimeClosed,attached:frame.isConnected})),{closed:false,attached:true});
    await page.evaluate(async()=>{releaseWriter=true;await closing;});
    assert.deepEqual(await page.evaluate(()=>({closed:runtimeClosed,writeFinished,attached:frame.isConnected})),{closed:true,writeFinished:true,attached:false});
    // Failed writes must be surfaced, never accepted as a durable checkpoint.
    await page.evaluate(async()=>{
      await runtime.reset();const realm=runtime.frame.contentWindow,open=realm.indexedDB.open('core-crypto',1);
      const db=await new Promise((resolve,reject)=>{open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);});
      const tx=db.transaction('blocks','readwrite');tx.abort();db.close();
    });
    await assert.rejects(page.evaluate(()=>runtime.close()),/storage write failed/);
  }finally{await context.close();}
}
