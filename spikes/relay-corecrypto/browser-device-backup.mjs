// Isolated CoreCrypto 10.5.3 browser fixture. Back up only after all CoreCrypto
// handles for this wallet are quiesced. The storage layout is version-specific.
import { BrowserKeyVault } from './browser-key-vault.mjs';

const encoder = new TextEncoder();
const ITERATIONS = 600000;
const MAX_BLOCKS = 10000;
const MAX_BYTES = 32 * 1024 * 1024;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error || Error('Database restore aborted'));
    tx.onerror = () => reject(tx.error);
  });
}
function binding(chain, wallet, path) {
  if (chain !== 'uni-7' || !/^juno1[0-9a-z]{30,100}$/.test(wallet) || !/^[a-z0-9-]{1,48}\.db$/.test(path)) throw Error('Invalid device backup identity');
  return `relay-device-backup-v1:${chain}:${wallet}:${path}`;
}
async function key(password, salt) {
  if (typeof password !== 'string' || password.length < 16) throw Error('Vault password required');
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function openBlocks() {
  const request = indexedDB.open('core-crypto', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('blocks', { keyPath: ['path', 'offset'] });
  const database = await requestResult(request);
  if (database.objectStoreNames.length !== 1 || !database.objectStoreNames.contains('blocks')) { database.close(); throw Error('Unsupported CoreCrypto storage layout'); }
  return database;
}
function validateBlock(block, path) {
  if (block?.path !== path || !Number.isSafeInteger(block.offset) || block.offset < 0 || !Array.isArray(block.data) || !block.data.length || block.data.length > 65536 || block.data.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) throw Error('Invalid database block');
}

export async function exportDevice({ chain, wallet, path, vaultName, password }) {
  const aad = binding(chain, wallet, path);
  const vault = await BrowserKeyVault.open(vaultName);
  const wrappedKey = await vault.exportEncrypted(chain, wallet);
  vault.close();
  const database = await openBlocks();
  const tx = database.transaction('blocks', 'readonly');
  const rows = await requestResult(tx.objectStore('blocks').getAll());
  await transactionDone(tx);
  database.close();
  const blocks = rows.filter(row => row.path === path).map(row => ({ path, offset: row.offset, data: Array.from(row.data) }));
  if (!blocks.length || blocks.length > MAX_BLOCKS) throw Error('Missing or excessive encrypted database blocks');
  blocks.forEach(row => validateBlock(row, path));
  const payload = encoder.encode(JSON.stringify({ version: 1, aad, wrappedKey, blocks }));
  if (payload.length > MAX_BYTES) throw Error('Encrypted database backup exceeds limit');
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(aad) }, await key(password, salt), payload));
  return JSON.stringify({ version: 1, salt: Array.from(salt), iv: Array.from(iv), ciphertext: Array.from(ciphertext) });
}

export async function importDevice({ chain, wallet, path, vaultName, password, backup }) {
  const aad = binding(chain, wallet, path);
  if (typeof backup !== 'string' || backup.length > MAX_BYTES * 4) throw Error('Invalid backup');
  const packageData = JSON.parse(backup);
  if (packageData?.version !== 1 || packageData.salt?.length !== 32 || packageData.iv?.length !== 12 || !Array.isArray(packageData.ciphertext)) throw Error('Invalid backup format');
  let raw;
  try {
    raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Uint8Array.from(packageData.iv), additionalData: encoder.encode(aad) }, await key(password, Uint8Array.from(packageData.salt)), Uint8Array.from(packageData.ciphertext));
  } catch { throw Error('Backup password, identity or data is incorrect'); }
  const payload = JSON.parse(new TextDecoder().decode(raw));
  if (payload.version !== 1 || payload.aad !== aad || typeof payload.wrappedKey !== 'string' || !Array.isArray(payload.blocks) || !payload.blocks.length || payload.blocks.length > MAX_BLOCKS) throw Error('Invalid device backup');
  payload.blocks.forEach(row => validateBlock(row, path));
  if (new Set(payload.blocks.map(row => row.offset)).size !== payload.blocks.length) throw Error('Duplicate database block');
  const vault = await BrowserKeyVault.open(vaultName);
  const database = await openBlocks();
  try {
    if (await vault.record(`${chain}:${wallet}`)) throw Error('Refusing to overwrite existing device keys');
    const tx = database.transaction('blocks', 'readonly');
    const existing = await requestResult(tx.objectStore('blocks').getAll());
    await transactionDone(tx);
    if (existing.some(row => row.path === path)) throw Error('Refusing to overwrite existing device database');
    // Importing to an empty device profile only. The vault and blocks live in
    // separate IDB databases, so a failure must keep the device locked.
    const write = database.transaction('blocks', 'readwrite');
    const store = write.objectStore('blocks');
    for (const row of payload.blocks) store.add({ path, offset: row.offset, data: Uint8Array.from(row.data) });
    await transactionDone(write);
    await vault.importEncrypted(chain, wallet, payload.wrappedKey);
  } finally { database.close(); vault.close(); }
}
