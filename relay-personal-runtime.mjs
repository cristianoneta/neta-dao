// Pinned CoreCrypto keeps native handles/caches alive until GC. An IndexedDB
// rollback must never reopen into that old WASM realm. This disposable same-origin
// iframe gives every restore a fresh runtime; it is not a security boundary.
export class PersonalCryptoRuntime {
  constructor({document=globalThis.document,url=new URL('./relay-personal-runtime.html',import.meta.url)}={}){this.document=document;this.url=url;this.frame=null;}
  async drain(){
    if(!this.frame)return;const drain=this.frame.contentWindow?.NetaPersonalStorageDrained;
    if(typeof drain!=='function')throw Error('Personal storage barrier unavailable');
    await drain();
  }
  async close(){const frame=this.frame;try{await this.drain();}finally{frame?.remove();if(this.frame===frame)this.frame=null;}}
  async reset(){
    await this.close();const frame=this.document.createElement('iframe');this.frame=frame;
    frame.hidden=true;frame.title='Personal encryption runtime';frame.setAttribute('aria-hidden','true');
    const ready=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Personal crypto runtime timed out')),20000);
      frame.onload=async()=>{try{const wire=await frame.contentWindow?.NetaPersonalWireReady;if(!wire)throw Error('Personal crypto runtime unavailable');clearTimeout(timer);resolve(wire);}catch(error){clearTimeout(timer);reject(error);}};
      frame.onerror=()=>{clearTimeout(timer);reject(Error('Personal crypto runtime unavailable'));};
    });
    frame.src=String(this.url);this.document.body.append(frame);
    try{return await ready;}catch(error){await this.close();throw error;}
  }
}
