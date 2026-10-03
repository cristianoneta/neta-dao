// SPDX-License-Identifier: GPL-3.0-only
// Isolated UNI-7 E2E lab. No mainnet route or main RELAY send control uses this.
import * as wire from './assets/relay-crypto/corecrypto.js';
import { Uni7MailboxClient, RELAY_UNI7_MAILBOX } from './relay-uni7-client.mjs';
import { captureRatchet, restoreRatchet } from './relay-uni7-checkpoint.mjs';
import { Uni7Archive, archiveIdentity } from './relay-uni7-archive.mjs';
import { BrowserKeyVault } from './spikes/relay-corecrypto/browser-key-vault.mjs';
import { BrowserOutbox } from './spikes/relay-corecrypto/browser-outbox.mjs';
import { acquireDeviceLock } from './spikes/relay-corecrypto/browser-device-lock.mjs';
import { sealEnvelope, openEnvelope } from './spikes/relay-corecrypto/browser-envelope.mjs';
import { MailboxTransport } from './spikes/relay-corecrypto/mailbox-transport.mjs';

const $ = id => document.getElementById(id);
const address = value => /^juno1[023456789acdefghjklmnpqrstuvwxyz]{38,90}$/.test(value || '');
const state = { wallet: null, crypto: null, db: null, vault: null, archive: null, outbox: null,
  key: null, path: null, lock: null, descriptor: null, registration: null, busy: false, poisoned: false };
let wasmReady = false;
const encoder = new TextEncoder();
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const randomId = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const fromBase64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const toBase64 = value => btoa(String.fromCharCode(...value));
const descriptorKey = wallet => 'relay-uni7-descriptor:' + wallet;
function notice(value) { $('status').textContent = value; }
function controls() {
  const connected = !!state.wallet, unlocked = !!state.crypto && !state.poisoned;
  $('wallet').textContent = state.wallet || 'NO WALLET CONNECTED';
  $('create').disabled = state.busy || !connected || !!state.crypto;
  $('unlock').disabled = state.busy || !connected || !!state.crypto;
  $('register').disabled = state.busy || !unlocked || !!state.registration;
  $('send').disabled = state.busy || !unlocked || !state.registration;
  $('receive').disabled = state.busy || !unlocked || !state.registration;
}
let adapter;
function makeAdapter() { return new Uni7MailboxClient({
  keplr: window.keplr,
  bundle: window.NetaSocialsTestnet,
  assertDevicePrepared: async (wallet, candidate) =>
    !!state.lock && !!state.crypto && wallet === state.wallet &&
    JSON.stringify(candidate) === JSON.stringify(state.descriptor) &&
    await state.crypto.transaction(ctx => ctx.proteusFingerprint()) === candidate.fingerprint
}); }
async function run(action) {
  if (state.busy) return;
  state.busy = true; controls();
  try { await action(); }
  catch (error) {
    try {
      if ((await state.outbox?.entries())?.some(row => row.state !== 'confirmed') ||
          (await state.archive?.all())?.some(row => row.status !== 'confirmed')) state.poisoned = true;
    } catch { state.poisoned = true; }
    notice('BLOCKED · ' + (error.message || String(error)));
  }
  finally { state.busy = false; controls(); }
}
async function closeLocal() {
  try { state.crypto?.uniffiDestroy(); } catch {}
  try { state.db?.uniffiDestroy(); state.key?.uniffiDestroy(); } catch {}
  try { state.vault?.close(); state.archive?.close(); state.outbox?.close(); } catch {}
  await state.lock?.release();
  Object.assign(state, { crypto: null, db: null, vault: null, archive: null, outbox: null,
    key: null, path: null, lock: null, descriptor: null, registration: null, poisoned: false });
  $('history').replaceChildren(); $('device').textContent = 'DEVICE LOCKED'; controls();
}
async function localPath(wallet) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode('uni-7:' + wallet));
  return 'relay-' + hex(new Uint8Array(digest)).slice(0, 24) + '.db';
}
async function openLocal(code, create) {
  if (!state.wallet) throw Error('Connect Keplr first');
  if (!wasmReady) { await wire.initWasmModule('./assets/relay-crypto/index_bg.wasm'); wasmReady = true; }
  const wallet = state.wallet, path = await localPath(wallet);
  const lock = await acquireDeviceLock({ chain: 'uni-7', wallet, path });
  let vault, db, client, archive, outbox, secret, key;
  try {
    vault = await BrowserKeyVault.open('relay-uni7-vault');
    secret = create ? await vault.create('uni-7', wallet, code) : await vault.unlock('uni-7', wallet, code);
    archive = await Uni7Archive.open(wallet, secret);
    key = new wire.DatabaseKey(secret);
    secret.fill(0); secret = null;
    await archive.recover(blocks => restoreRatchet(path, blocks));
    db = await wire.Database.open(path, key);
    client = wire.CoreCrypto.new(db);
    await client.transaction(ctx => ctx.proteusInit());
    outbox = await BrowserOutbox.open('relay-uni7-outbox-' + wallet);
    Object.assign(state, { lock, vault, db, crypto: client, archive, outbox, key, path });
    if (create) {
      const fingerprint = await client.transaction(ctx => ctx.proteusFingerprint());
      const prekeys = [];
      for (let id = 1; id <= 8; id++)
        prekeys.push({ id, bundle: toBase64(await client.transaction(ctx => ctx.proteusNewPrekey(id))) });
      state.descriptor = { device_id: 'relay-' + randomId().slice(0, 24), protocol_version: 1,
        fingerprint, prekeys };
      localStorage.setItem(descriptorKey(wallet), JSON.stringify(state.descriptor));
    } else {
      state.descriptor = JSON.parse(localStorage.getItem(descriptorKey(wallet)) || 'null');
      if (!state.descriptor || state.descriptor.fingerprint !== await client.transaction(ctx => ctx.proteusFingerprint()))
        throw Error('Local device identity is missing or changed');
    }
    const pending = (await outbox.entries()).some(row => row.state !== 'confirmed');
    const history = await archive.readable();
    if (pending) throw Error('Unresolved encrypted outbox; do not send or reset automatically');
    const registered = await adapter.device(wallet);
    if (registered) {
      if (!registered.active || registered.fingerprint !== state.descriptor.fingerprint ||
          registered.device_id !== state.descriptor.device_id)
        throw Error('On-chain device changed; this local device cannot continue');
      state.registration = registered;
    }
    $('device').textContent = 'LOCAL FINGERPRINT · ' + state.descriptor.fingerprint +
      (state.registration ? ' · REGISTERED GENERATION ' + state.registration.generation : ' · NOT REGISTERED');
    renderHistory(history);
    notice(create ? 'LOCAL DEVICE READY · SAVE THE CODE, THEN REGISTER WITH KEPLR.' :
      'DEVICE UNLOCKED · READABLE HISTORY RESTORED FROM THE ENCRYPTED LOCAL ARCHIVE.');
    controls();
  } catch (error) {
    secret?.fill(0);
    state.poisoned = true;
    try { client?.uniffiDestroy(); db?.uniffiDestroy(); key?.uniffiDestroy(); vault?.close(); archive?.close(); outbox?.close(); }
    finally { await lock.release(); Object.assign(state, { lock: null, crypto: null, db: null, vault: null,
      archive: null, outbox: null, key: null, path: null, registration: null }); }
    throw error;
  }
}
function renderHistory(rows) {
  $('history').replaceChildren();
  for (const row of rows) {
    const article = document.createElement('article'), label = document.createElement('small'), text = document.createElement('p');
    label.textContent = (row.direction === 'in' ? 'FROM ' + row.meta.sender : 'TO ' + row.meta.recipient) +
      ' · UNI-7 #' + row.sequence;
    text.textContent = row.text;
    article.append(label, text); $('history').append(article);
  }
}
async function assertLocal() {
  await adapter.assertWallet();
  if (!state.crypto || !state.archive || !state.registration || state.poisoned) throw Error('Registered local device required');
  const chainDevice = await adapter.device(state.wallet);
  if (!chainDevice?.active || chainDevice.generation !== state.registration.generation ||
      chainDevice.fingerprint !== state.descriptor.fingerprint) throw Error('Own device registration changed');
}
async function testSend() {
  await assertLocal();
  const recipient = $('recipient').value.trim(), text = $('message').value;
  if (!address(recipient) || recipient === state.wallet) throw Error('Enter another registered Juno wallet');
  if (!text || encoder.encode(text).length > 1800) throw Error('Enter at most 1800 UTF-8 bytes');
  const remote = await adapter.device(recipient);
  if (!remote?.active) throw Error('Recipient has no active device');
  const history = await state.archive.readable();
  const hasSession = history.some(row => (row.meta.sender === recipient && row.meta.senderGeneration===remote.generation) || (row.meta.recipient === recipient && row.meta.recipientGeneration===remote.generation));
  const prekey = hasSession ? null : remote.prekeys?.[0];
  if(!hasSession && !prekey) throw Error('Recipient needs an available prekey for a new session');
  const messageId = randomId();
  const meta = { chain: 'uni-7', contract: RELAY_UNI7_MAILBOX, sender: state.wallet,
    senderGeneration: state.registration.generation, senderFingerprint: state.descriptor.fingerprint,
    recipient, recipientGeneration: remote.generation, recipientFingerprint: remote.fingerprint, messageId };
  await state.outbox.begin({ id: messageId, recipient, generation: remote.generation });
  const archiveId=await archiveIdentity(meta);
  await state.archive.begin(archiveId, 'out', meta, text);
  const ciphertext = await state.crypto.transaction(async ctx => {
    if (prekey) await ctx.proteusSessionFromPrekey(recipient, fromBase64(prekey.bundle));
    if (await ctx.proteusFingerprintRemote(recipient) !== remote.fingerprint)
      throw Error('Recipient cryptographic identity changed');
    return ctx.proteusEncrypt(recipient, sealEnvelope(meta, text));
  });
  await state.outbox.ready(messageId, ciphertext);
  const transport = new MailboxTransport({
    sender: state.wallet, network: async () => { await adapter.verify(); return 'uni-7'; },
    account: async () => { await adapter.assertWallet(); return state.wallet; },
    verifyMailbox: async () => { await adapter.verify(); return true; },
    query: (_, query) => adapter.smart(query),
    execute: async (_, message, memo) => window.NetaSocialsTestnet.execute(await adapter.signer(),
      state.wallet, RELAY_UNI7_MAILBOX, message, memo),
    outbox: state.outbox
  });
  const sent = await transport.sendReady({ messageId, recipient, generation: remote.generation,
    deviceId: remote.device_id, fingerprint: remote.fingerprint,
    ...(prekey ? { initialPrekeyId: prekey.id, initialPrekeyBundle: fromBase64(prekey.bundle) } : {}) });
  await state.archive.commit(archiveId, sent.sequence);
  $('message').value = '';
  renderHistory(await state.archive.readable());
  notice('ENCRYPTED UNI-7 MESSAGE CONFIRMED · #' + sent.sequence);
}
function quiesceRatchet() {
  state.crypto?.uniffiDestroy(); state.db?.uniffiDestroy();
  state.crypto=null; state.db=null;
}
async function reopenRatchet() {
  state.db=await wire.Database.open(state.path,state.key);
  state.crypto=wire.CoreCrypto.new(state.db);
  await state.crypto.transaction(ctx=>ctx.proteusInit());
}
async function receive() {
  await assertLocal();
  const after=await state.archive.cursor();
  const rows=await adapter.inbox(after || null);
  let count=0, quarantined=0, previous=after;
  for(const row of rows) {
    if(!Number.isSafeInteger(row.sequence) || row.sequence<=previous || !/^[0-9a-f]{64}$/.test(row.message_id) || row.recipient!==state.wallet ||
       row.recipient_generation!==state.registration.generation || !address(row.sender)) throw Error('Invalid public message envelope');
    previous=row.sequence;
    const sender=await adapter.device(row.sender);
    // Historical identity resolution is still a gate: never guess a fingerprint.
    if(!sender?.active || sender.generation!==row.sender_generation) throw Error('Historical sender identity unavailable; refusing decryption');
    const meta={chain:'uni-7',contract:RELAY_UNI7_MAILBOX,sender:row.sender,
      senderGeneration:row.sender_generation,senderFingerprint:sender.fingerprint,
      recipient:state.wallet,recipientGeneration:state.registration.generation,
      recipientFingerprint:state.descriptor.fingerprint,messageId:row.message_id};
    const id=await archiveIdentity(meta);
    quiesceRatchet();
    const blocks=await captureRatchet(state.path);
    await state.archive.reserve(id,meta,row.sequence,blocks);
    await reopenRatchet();
    let text;
    try {
      text=await state.crypto.transaction(async ctx=>{
        const plain=await ctx.proteusDecryptSafe(row.sender,fromBase64(row.ciphertext));
        const fingerprint=await ctx.proteusFingerprintRemote(row.sender);
        return openEnvelope(plain,meta,fingerprint); // Authenticate inside crypto transaction.
      });
    } catch {
      quiesceRatchet();
      await state.archive.rollback(id,blocks=>restoreRatchet(state.path,blocks),true);
      await reopenRatchet();
      quarantined++; continue;
    }
    // Storage failures keep the checkpoint pending and fail closed. Unlock
    // restores pre-receive state and retries, never silently advances ratchet.
    await state.archive.complete(id,meta,text,row.sequence);
    count++;
  }
  renderHistory(await state.archive.readable());
  notice((count ? count+' ENCRYPTED MESSAGE(S) DECRYPTED & ARCHIVED.' : 'NO NEW MESSAGES.')+
    (quarantined ? ' '+quarantined+' INVALID MESSAGE(S) QUARANTINED.' : ''));
}
$('connect').onclick = () => run(async () => {
  await closeLocal();
  adapter = makeAdapter();
  state.wallet = await adapter.connect();
  $('recovery').value = ''; $('new-code').hidden = true;
  notice('UNI-7 WALLET CONNECTED · CREATE OR UNLOCK A LOCAL DEVICE.');
});
$('create').onclick = () => run(async () => {
  const code = randomId();
  await openLocal(code, true);
  $('new-code').textContent = 'SAVE THIS LOCAL UNLOCK CODE NOW · ' + code;
  $('new-code').hidden = false;
  $('recovery').value = '';
});
$('unlock').onclick = () => run(async () => {
  const code = $('recovery').value.trim();
  $('recovery').value = '';
  await openLocal(code, false);
  $('new-code').hidden = true;
});
$('register').onclick = () => run(async () => {
  const result = await adapter.registerPreparedDevice(state.descriptor);
  state.registration = result.device;
  $('device').textContent += ' · REGISTERED GENERATION ' + result.device.generation;
  notice('DEVICE REGISTERED ON UNI-7 · ' + (result.transactionHash || 'CONFIRMED BY QUERY'));
});
$('send').onclick = () => run(testSend);
$('receive').onclick = () => run(receive);
window.addEventListener('keplr_keystorechange', () => { state.wallet = null; closeLocal().then(() => notice('KEPLR ACCOUNT CHANGED · CONNECT AGAIN.')); });
window.addEventListener('pagehide', () => { state.crypto?.uniffiDestroy(); state.db?.uniffiDestroy(); state.key?.uniffiDestroy(); state.vault?.close(); state.archive?.close(); state.outbox?.close(); });
controls();
