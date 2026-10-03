// SPDX-License-Identifier: GPL-3.0-only
// Pinned CoreCrypto 10.5.3 IndexedDB layout. Call only with all handles closed
// and the wallet device lock held. Never restore a checkpoint after a send.
const req = r => new Promise((resolve,reject) => { r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
const done = tx => new Promise((resolve,reject) => { tx.oncomplete=resolve; tx.onabort=()=>reject(tx.error||Error('Checkpoint aborted')); tx.onerror=()=>reject(tx.error); });
function validate(path, blocks) {
  if (!/^relay-[0-9a-f]{24}\.db$/.test(path) || !Array.isArray(blocks) || !blocks.length || blocks.length>10000) throw Error('Invalid ratchet checkpoint');
  let size=0;
  for (const b of blocks) {
    if (b.path!==path || !Number.isSafeInteger(b.offset) || b.offset<0 || !Array.isArray(b.data) || !b.data.length || b.data.length>65536 || b.data.some(n=>!Number.isInteger(n)||n<0||n>255)) throw Error('Invalid checkpoint block');
    size+=b.data.length;
  }
  if(size>32*1024*1024 || new Set(blocks.map(b=>b.offset)).size!==blocks.length) throw Error('Invalid checkpoint size/offsets');
}
async function open() {
  const db=await req(indexedDB.open('core-crypto',1));
  if(db.objectStoreNames.length!==1 || !db.objectStoreNames.contains('blocks')) { db.close(); throw Error('Unsupported ratchet storage'); }
  return db;
}
export async function captureRatchet(path) {
  const db=await open();
  try {
    const tx=db.transaction('blocks','readonly'), completed=done(tx);
    const rows=await req(tx.objectStore('blocks').getAll()); await completed;
    const blocks=rows.filter(r=>r.path===path).map(r=>({path,offset:r.offset,data:Array.from(r.data)}));
    validate(path,blocks); return blocks;
  } finally { db.close(); }
}
export async function restoreRatchet(path,blocks) {
  validate(path,blocks);
  const db=await open();
  try {
    const tx=db.transaction('blocks','readwrite'), completed=done(tx), store=tx.objectStore('blocks');
    const rows=await req(store.getAll());
    for(const row of rows) if(row.path===path) store.delete([path,row.offset]);
    for(const row of blocks) store.add({...row,data:Uint8Array.from(row.data)});
    await completed;
  } finally { db.close(); }
}
