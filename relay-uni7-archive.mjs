// SPDX-License-Identifier: GPL-3.0-only
// Testnet-only encrypted local archive. Public routing stays in the record key;
// message text and authenticated envelope are encrypted with a key distinct
// from the CoreCrypto database key, derived under a separate HKDF context.
const DB = 'relay-uni7-archive-v1';
const STORE = 'records';
const enc = new TextEncoder();
const dec = new TextDecoder();
// Hash the authenticated routing tuple, not attacker-selected messageId alone.
export async function archiveIdentity(meta) {
  if (!/^juno1[0-9a-z]{38,90}$/.test(meta?.sender || '') || !/^juno1[0-9a-z]{38,90}$/.test(meta?.recipient || '') ||
      !Number.isSafeInteger(meta.senderGeneration) || meta.senderGeneration<1 ||
      !Number.isSafeInteger(meta.recipientGeneration) || meta.recipientGeneration<1 ||
      !/^[0-9a-f]{64}$/.test(meta.messageId || '') || meta.chain!=='uni-7') throw Error('Invalid archive routing');
  const raw=enc.encode(JSON.stringify([meta.chain,meta.contract,meta.sender,meta.senderGeneration,meta.recipient,meta.recipientGeneration,meta.messageId]));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)), n=>n.toString(16).padStart(2,'0')).join('');
}
function request(req) { return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
function done(tx) { return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error || Error('Archive transaction aborted')); tx.onerror = () => reject(tx.error); }); }
export class Uni7Archive {
  static async open(wallet, secret) {
    if (!/^juno1[0-9a-z]{38,90}$/.test(wallet) || !(secret instanceof Uint8Array) || secret.length !== 32)
      throw Error('Invalid archive identity');
    const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('uni-7:' + wallet),
      info: enc.encode('neta-relay-readable-history-v1') }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const opening = indexedDB.open(DB, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(STORE, { keyPath: 'id' });
    return new Uni7Archive(wallet, key, await request(opening));
  }
  constructor(wallet, key, db) { Object.assign(this, { wallet, key, db }); }
  close() { this.db.close(); }
  async all() {
    const tx = this.db.transaction(STORE, 'readonly');
    const rows = await request(tx.objectStore(STORE).getAll());
    await done(tx);
    return rows.filter(row => row.wallet === this.wallet);
  }
  async record(id) {
    const tx = this.db.transaction(STORE, 'readonly');
    const row = await request(tx.objectStore(STORE).get(this.wallet + ':' + id));
    await done(tx); return row;
  }
  async begin(id, direction, meta, text) {
    if (!/^[0-9a-f]{64}$/.test(id) || !['in','out'].includes(direction) ||
        typeof text !== 'string' || !text || enc.encode(text).length > 1800)
      throw Error('Invalid archive intent');
    if (await this.record(id)) throw Error('Archive record already exists');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = enc.encode(this.wallet + ':' + id + ':' + direction);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad },
      this.key, enc.encode(JSON.stringify({ meta, text }))));
    const tx = this.db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({ id: this.wallet + ':' + id, wallet: this.wallet, messageId: id,
      direction, status: 'intent', sequence: null, iv: Array.from(iv), ciphertext: Array.from(ciphertext) });
    await done(tx);
  }
  async reserve(id, meta, sequence, blocks) {
    if (id!==await archiveIdentity(meta) || meta.recipient!==this.wallet ||
        !Number.isSafeInteger(sequence) || sequence<1 || await this.record(id)) throw Error('Invalid inbound checkpoint');
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const checkpoint=Array.from(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,
      additionalData:enc.encode(this.wallet+':'+id+':checkpoint')},this.key,enc.encode(JSON.stringify({meta,blocks})))));
    const tx=this.db.transaction(STORE,'readwrite'), completed=done(tx);
    tx.objectStore(STORE).add({id:this.wallet+':'+id,wallet:this.wallet,messageId:id,
      direction:'in',status:'pending',sequence,checkpointIv:Array.from(iv),checkpoint});
    await completed;
  }
  async rollback(id, restore, quarantine=false) {
    const row=await this.record(id);
    if(row?.status!=='pending' || !row.checkpoint) throw Error('No recoverable inbound checkpoint; remain locked');
    const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(row.checkpointIv),
      additionalData:enc.encode(this.wallet+':'+id+':checkpoint')},this.key,Uint8Array.from(row.checkpoint));
    const {meta,blocks}=JSON.parse(dec.decode(raw));
    if(id!==await archiveIdentity(meta) || meta.recipient!==this.wallet) throw Error('Checkpoint identity mismatch');
    await restore(blocks); // Keep journal until restore finishes, including across crashes.
    const tx=this.db.transaction(STORE,'readwrite'), completed=done(tx), store=tx.objectStore(STORE);
    if(quarantine) store.put({id:row.id,wallet:this.wallet,messageId:id,direction:'in',status:'quarantined',sequence:row.sequence});
    else store.delete(row.id); // Restart retries exact chain ciphertext from pre-receive state.
    await completed;
  }
  async recover(restore) {
    const pending=(await this.all()).filter(row=>row.status==='pending');
    if(pending.length>1) throw Error('Multiple receive journals; remain locked');
    for(const row of pending) await this.rollback(row.messageId,restore);
  }
  async cursor() {
    return Math.max(0,...(await this.all()).filter(r=>r.direction==='in' && ['confirmed','quarantined'].includes(r.status)).map(r=>r.sequence||0));
  }
  async complete(id, meta, text, sequence) {
    if (!Number.isSafeInteger(sequence) || sequence < 1 || typeof text !== 'string' ||
        !text || enc.encode(text).length > 1800) throw Error('Invalid received message');
    const row = await this.record(id);
    if (row?.status !== 'pending') throw Error('Inbound intent missing');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = enc.encode(this.wallet + ':' + id + ':in');
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad },
      this.key, enc.encode(JSON.stringify({ meta, text }))));
    const tx = this.db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ ...row, status: 'confirmed', sequence, checkpoint: undefined, checkpointIv: undefined, iv: Array.from(iv),
      ciphertext: Array.from(ciphertext) });
    await done(tx);
  }
  async commit(id, sequence) {
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw Error('Invalid chain sequence');
    const tx = this.db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const row = await request(store.get(this.wallet + ':' + id));
    if (!row || row.status !== 'intent') { tx.abort(); await done(tx).catch(() => {}); throw Error('Archive intent missing'); }
    store.put({ ...row, status: 'confirmed', sequence });
    await done(tx);
  }
  async readable() {
    const rows = await this.all();
    const result = [];
    for (const row of rows) {
      if (row.status === 'quarantined') continue;
      if (row.status !== 'confirmed') throw Error('Unresolved archive intent: device must remain locked');
      const aad = enc.encode(this.wallet + ':' + row.messageId + ':' + row.direction);
      const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Uint8Array.from(row.iv), additionalData: aad },
        this.key, Uint8Array.from(row.ciphertext));
      const content = JSON.parse(dec.decode(plaintext));
      result.push({ id: row.messageId, direction: row.direction, sequence: row.sequence, ...content });
    }
    return result.sort((a,b) => a.sequence - b.sequence);
  }
}
