// Test-only key vault for the CoreCrypto database key. Uses browser Web Crypto;
// no wallet signature is treated as a password. Production integration needs
// an independent review, account-switch UX and a complete device backup.
const STORE = 'keys';
const ITERATIONS = 600000;
const encoder = new TextEncoder();

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error || Error('Vault transaction aborted'));
    transaction.onerror = () => reject(transaction.error);
  });
}
function identity(chain, address) {
  if (chain !== 'uni-7' || !/^juno1[0-9a-z]{30,100}$/.test(address)) throw Error('Invalid testnet identity');
  return `${chain}:${address}`;
}
function bytes(array, expected) {
  if (!Array.isArray(array) || array.length !== expected || array.some(value => !Number.isInteger(value) || value < 0 || value > 255)) throw Error('Invalid encrypted vault record');
  return Uint8Array.from(array);
}
async function wrappingKey(password, salt) {
  if (typeof password !== 'string' || password.length < 16) throw Error('Use a strong, separate vault password');
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
function validate(record, id) {
  if (record?.version !== 1 || record.identity !== id || record.iterations !== ITERATIONS) throw Error('Vault identity or format mismatch');
  return { salt: bytes(record.salt, 32), iv: bytes(record.iv, 12), ciphertext: bytes(record.ciphertext, 48) };
}

export class BrowserKeyVault {
  static async open(name) {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'identity' });
    return new BrowserKeyVault(await requestResult(request));
  }
  constructor(database) { this.database = database; }
  close() { this.database.close(); }

  async record(id) {
    const tx = this.database.transaction(STORE, 'readonly');
    const record = await requestResult(tx.objectStore(STORE).get(id));
    await transactionDone(tx);
    return record;
  }

  async create(chain, address, password) {
    const id = identity(chain, address);
    if (await this.record(id)) throw Error('Vault already exists; unlock or restore instead');
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = crypto.getRandomValues(new Uint8Array(32));
    const wrapping = await wrappingKey(password, salt);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(id) }, wrapping, key));
    const record = { version: 1, identity: id, iterations: ITERATIONS, salt: Array.from(salt), iv: Array.from(iv), ciphertext: Array.from(ciphertext) };
    const tx = this.database.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(record);
    try { await transactionDone(tx); } catch { key.fill(0); throw Error('Vault creation failed; key was not retained'); }
    return key;
  }

  async unlock(chain, address, password) {
    const id = identity(chain, address);
    const record = await this.record(id);
    if (!record) throw Error('No local vault for this wallet');
    const { salt, iv, ciphertext } = validate(record, id);
    const wrapping = await wrappingKey(password, salt);
    try {
      const result = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(id) }, wrapping, ciphertext));
      if (result.length !== 32) throw Error('Invalid database key');
      return result;
    } catch { throw Error('Unable to unlock vault; password or data is incorrect'); }
  }

  async exportEncrypted(chain, address) {
    const id = identity(chain, address);
    const record = await this.record(id);
    validate(record, id);
    return JSON.stringify(record);
  }

  async importEncrypted(chain, address, backup) {
    const id = identity(chain, address);
    if (await this.record(id)) throw Error('Vault already exists; refusing to replace local keys');
    if (typeof backup !== 'string' || backup.length > 4096) throw Error('Invalid backup');
    const record = JSON.parse(backup);
    validate(record, id);
    const tx = this.database.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(record);
    await transactionDone(tx);
  }
}
