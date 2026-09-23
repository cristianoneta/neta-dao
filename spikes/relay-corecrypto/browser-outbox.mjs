// Isolated browser test fixture. Stores only public routing metadata and already
// encrypted Proteus ciphertext; no drafts, plaintext or keys enter IndexedDB.
// A production outbox still needs a reviewed encrypted-at-rest storage design.
const STORE = 'messages';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error || Error('Outbox transaction aborted'));
    transaction.onerror = () => reject(transaction.error);
  });
}

export class BrowserOutbox {
  static async open(name) {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    return new BrowserOutbox(await requestResult(request));
  }

  constructor(database) { this.database = database; }
  close() { this.database.close(); }

  async entries() {
    const transaction = this.database.transaction(STORE, 'readonly');
    const entries = await requestResult(transaction.objectStore(STORE).getAll());
    await transactionDone(transaction);
    return entries;
  }

  async begin({ id, recipient, generation }) {
    if (!/^[0-9a-f]{64}$/.test(id) || !recipient || !Number.isSafeInteger(generation) || generation < 1) throw Error('Invalid outbox intent');
    const transaction = this.database.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const existing = await requestResult(store.getAll());
    if (existing.some(entry => entry.state !== 'confirmed') || existing.some(entry => entry.id === id)) {
      transaction.abort();
      await transactionDone(transaction).catch(() => {});
      throw Error('Unresolved send: sending is locked');
    }
    store.add({ id, recipient, generation, state: 'intent' });
    await transactionDone(transaction);
  }

  async ready(id, envelope) {
    if (!(envelope instanceof Uint8Array) || !envelope.length) throw Error('Missing ciphertext');
    const transaction = this.database.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const entry = await requestResult(store.get(id));
    if (!entry || entry.state !== 'intent') {
      transaction.abort();
      await transactionDone(transaction).catch(() => {});
      throw Error('Outbox intent missing');
    }
    store.put({ ...entry, state: 'ready', ciphertext: Array.from(envelope) });
    await transactionDone(transaction);
  }

  async reconcile(id, lookupSent) {
    const entry = (await this.entries()).find(value => value.id === id);
    if (!entry) throw Error('Outbox entry missing');
    if (entry.state === 'intent') throw Error('Unrecoverable send: rotate device before sending again');
    if (entry.state === 'confirmed') return { state: 'confirmed', sequence: entry.sequence };
    // Lookup errors must propagate; never infer "not sent" from an RPC timeout.
    const sequence = await lookupSent(id);
    if (sequence != null) {
      if (!Number.isSafeInteger(sequence) || sequence < 1) throw Error('Invalid chain sequence');
      const transaction = this.database.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put({ ...entry, state: 'confirmed', sequence });
      await transactionDone(transaction);
      return { state: 'confirmed', sequence };
    }
    return { state: 'ready', id, recipient: entry.recipient, generation: entry.generation, ciphertext: new Uint8Array(entry.ciphertext) };
  }
}
