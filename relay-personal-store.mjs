// SPDX-License-Identifier: GPL-3.0-only
// One encrypted canonical checkpoint per mailbox/wallet. CoreCrypto's IndexedDB
// is a working copy and is restored from this checkpoint before opening handles.
const req=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});
const done=tx=>new Promise((ok,no)=>{tx.oncomplete=ok;tx.onabort=()=>no(tx.error||Error('Personal checkpoint aborted'));tx.onerror=()=>no(tx.error);});
export class PersonalBrowserStore{
  static async open(scope){
    const r=indexedDB.open('relay-personal-browser-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('devices',{keyPath:'scope'});
    return new PersonalBrowserStore(scope,await req(r));
  }
  constructor(scope,db){Object.assign(this,{scope,db});}
  close(){this.db.close();}
  async read(){const tx=this.db.transaction('devices','readonly'),end=done(tx),row=await req(tx.objectStore('devices').get(this.scope));await end;return row||null;}
  async write(value,expectedRevision){
    const tx=this.db.transaction('devices','readwrite'),end=done(tx),store=tx.objectStore('devices');
    const old=await req(store.get(this.scope));
    if((old?.localRevision||0)!==expectedRevision){tx.abort();await end.catch(()=>{});throw Error('Personal checkpoint changed in another controller');}
    if(!value?.envelope||value.envelope.scope!==this.scope||!Number.isSafeInteger(expectedRevision)||expectedRevision<0){tx.abort();await end.catch(()=>{});throw Error('Invalid personal checkpoint');}
    const row={...structuredClone(value),scope:this.scope,localRevision:expectedRevision+1};store.put(row);await end;return row;
  }
}
