// SPDX-License-Identifier: GPL-3.0-only
// Caller holds the device Web Lock. Every record is authenticated and encrypted.
// A preparation checkpoint is never restored once ciphertext is durably ready.
const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true });
const hex = /^[0-9a-f]{64}$/;
const req = r => new Promise((ok, fail) => { r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
const done = tx => new Promise((ok, fail) => { tx.oncomplete = ok; tx.onabort = () => fail(tx.error || Error('Recovery storage aborted')); tx.onerror = () => fail(tx.error); });
export class PersonalSendJournal {
  static async open(scope, secret) {
    if (!['uni-7','juno-1'].includes(scope?.chain) || !/^juno1[0-9a-z]{38,90}$/.test(scope.wallet || '') ||
        !/^juno1[0-9a-z]{38,90}$/.test(scope.contract || '') || !(secret instanceof Uint8Array) || secret.length !== 32)
      throw Error('Invalid personal recovery scope');
    const identity = JSON.stringify([scope.chain, scope.contract, scope.wallet]);
    const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode(identity),
      info: enc.encode('neta-personal-send-journal-v1') }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']);
    const opening = indexedDB.open('relay-personal-send-journal-v1', 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore('records', { keyPath: 'key' });
    return new PersonalSendJournal(identity, scope, key, await req(opening));
  }
  constructor(identity, scope, key, db) { Object.assign(this, { identity, scope: { ...scope }, key, db }); }
  close() { this.db.close(); }
  async entries() {
    const tx = this.db.transaction('records', 'readonly'), complete = done(tx);
    const rows = await req(tx.objectStore('records').getAll()); await complete;
    return Promise.all(rows.filter(r => r.scope === this.identity).map(async row => {
      const data = JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Uint8Array.from(row.iv),
        additionalData: enc.encode(row.key) }, this.key, Uint8Array.from(row.ciphertext))));
      if (row.key !== this.identity + ':' + data.id || !hex.test(data.id) || data.version !== 1 ||
          !['preparing','ready','confirmed','rolled_back'].includes(data.state)) throw Error('Invalid recovery record');
      return data;
    }));
  }
  async save(data, add = false) {
    const key = this.identity + ':' + data.id, iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv,
      additionalData: enc.encode(key) }, this.key, enc.encode(JSON.stringify(data))));
    const tx = this.db.transaction('records','readwrite'), complete = done(tx);
    tx.objectStore('records')[add ? 'add' : 'put']({ key, scope: this.identity, iv: Array.from(iv), ciphertext: Array.from(ciphertext) });
    await complete;
  }
  async prepare({ meta, text, archiveId, blocks, send }) {
    if (!hex.test(meta?.messageId || '') || !hex.test(archiveId || '') || meta.chain !== this.scope.chain ||
        meta.contract !== this.scope.contract || meta.sender !== this.scope.wallet || !Array.isArray(blocks) || !blocks.length ||
        typeof text !== 'string' || !text || enc.encode(text).length > 1800 || send?.messageId !== meta.messageId ||
        send.recipient !== meta.recipient || send.generation !== meta.recipientGeneration || send.fingerprint !== meta.recipientFingerprint)
      throw Error('Invalid preparation checkpoint');
    if ((await this.entries()).some(r => !['confirmed','rolled_back'].includes(r.state))) throw Error('Unresolved personal send; recover first');
    await this.save({ version: 1, id: meta.messageId, recipient: meta.recipient, generation: meta.recipientGeneration,
      state: 'preparing', meta, text, archiveId, blocks, send }, true);
  }
  async ready(id, ciphertext) {
    const entry = (await this.entries()).find(r => r.id === id);
    if (entry?.state !== 'preparing' || !(ciphertext instanceof Uint8Array) || ciphertext.length < 16 || ciphertext.length > 4096)
      throw Error('Invalid ready ciphertext');
    // This atomic transition removes rollback authority and the now-unusable
    // full database snapshot; retain the intent and exact encrypted packet.
    await this.save({ ...entry, blocks: undefined, state: 'ready', ciphertext: Array.from(ciphertext) });
  }
  async reconcile(id, lookupSent) {
    const entry = (await this.entries()).find(r => r.id === id);
    if (!entry || !['ready','confirmed'].includes(entry.state)) throw Error('Ciphertext is not ready for transport');
    // Even a local confirmed marker is checked against the verified chain.
    const sequence = await lookupSent(id);
    if (sequence !== null) {
      if (!Number.isSafeInteger(sequence) || sequence < 1 || (entry.state === 'confirmed' && entry.sequence !== sequence))
        throw Error('Invalid or changed message receipt');
      if (entry.state !== 'confirmed') await this.save({ ...entry, state: 'confirmed', sequence });
      return { state: 'confirmed', sequence };
    }
    if (entry.state === 'confirmed') throw Error('Previously confirmed receipt unavailable');
    return { ...entry, ciphertext: Uint8Array.from(entry.ciphertext) };
  }
  async recover({ restore, abandon, confirm, lookupSent }) {
    const entries = await this.entries();
    if (entries.filter(r => !['confirmed','rolled_back'].includes(r.state)).length > 1)
      throw Error('Multiple unresolved personal sends; preserve journals');
    let pending = 0;
    for (const row of entries) {
      if (row.state === 'preparing') {
        // No transport accepts preparing. Restore only this provably pre-send state.
        await restore(row.blocks);
        await abandon(row.archiveId);
        await this.save({ ...row, blocks: undefined, state: 'rolled_back' });
      } else if (row.state === 'rolled_back') {
        await abandon(row.archiveId);
      } else if (row.state === 'ready') {
        const result = await this.reconcile(row.id, lookupSent);
        if (result.state === 'confirmed') await confirm(row.archiveId, result.sequence);
        else pending++;
      } else {
        // A crash between journal confirmation and archive completion is idempotent.
        await confirm(row.archiveId, row.sequence);
      }
    }
    return { pending };
  }
}
