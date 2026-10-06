// UNI-7 protocol candidate. Only encrypted packets enter the transport.
// Caller MUST hold the device lock and persist send/receive recovery intents
// around CoreCrypto transactions, just as in the existing isolated RELAY lab.
const address = /^juno1[0-9a-z]{38,90}$/;
const hex = /^[0-9a-f]{64}$/;
const name = /^[a-z0-9]+(?:-[a-z0-9]+)*\.dao\.neta$/;
const enc = new TextEncoder(), dec = new TextDecoder('utf-8', {fatal:true});
const fields = ['chain','contract','name','revision','correspondent','reply','sender','senderGeneration','senderFingerprint','recipient','recipientGeneration','recipientFingerprint','messageId'];
const positive = n => Number.isSafeInteger(n) && n > 0;
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
function validate(meta) {
  if (meta?.chain !== 'uni-7' || !address.test(meta.contract) || !name.test(meta.name) || meta.name.length>57 ||
      !positive(meta.revision) || !positive(meta.senderGeneration) || !positive(meta.recipientGeneration) ||
      ![meta.sender,meta.recipient,meta.correspondent].every(a=>address.test(a)) ||
      ![meta.messageId,meta.senderFingerprint,meta.recipientFingerprint].every(h=>hex.test(h)) ||
      typeof meta.reply !== 'boolean' || (!meta.reply && meta.correspondent!==meta.sender)) throw Error('Invalid DAO message identity');
}
export function sessionId(meta, peer, generation) {
  if (meta?.chain!=='uni-7' || !address.test(meta.contract) || !name.test(meta.name) || !address.test(peer) || !positive(generation)) throw Error('Invalid DAO session');
  return ['dao-v1',meta.chain,meta.contract,meta.name,peer,generation].join(':');
}
export function sealDaoEnvelope(meta, text) {
  validate(meta);
  if (typeof text!=='string' || !text.trim() || enc.encode(text).length>1800) throw Error('Message must contain 1–1800 UTF-8 bytes');
  return enc.encode(JSON.stringify({version:1,...Object.fromEntries(fields.map(f=>[f,meta[f]])),text}));
}
export function openDaoEnvelope(raw, expected, remoteFingerprint) {
  validate(expected);
  if (!(raw instanceof Uint8Array) || raw.length>4096 || remoteFingerprint!==expected.senderFingerprint) throw Error('DAO sender identity mismatch');
  const message=JSON.parse(dec.decode(raw));
  if (!message || typeof message!=='object' || Array.isArray(message) || message.version!==1 ||
      Object.keys(message).length!==fields.length+2 || fields.some(f=>message[f]!==expected[f])) throw Error('Encrypted DAO routing mismatch');
  sealDaoEnvelope(expected,message.text);
  return message.text;
}
// Low-level primitive, to be called by prepareDaoPacket after its durable intent.
// CoreCrypto may persist session mutations even when the callback throws.
// A failed batch MUST stay locked behind that journal; never retry encryption.
export async function encryptDaoBatch(ctx, base, text, recipients) {
  if (!Array.isArray(recipients) || !recipients.length || recipients.length>33) throw Error('Invalid DAO roster');
  const seen=new Set(), result=[];
  for (const {address:recipient,device} of recipients) {
    if (seen.has(recipient) || recipient===base.sender || !device?.active) throw Error('Invalid DAO recipient');
    seen.add(recipient);
    const meta={...base,recipient,recipientGeneration:device.generation,recipientFingerprint:device.fingerprint};
    validate(meta);
    const session=sessionId(meta,recipient,device.generation);
    let prekeyId=null;
    if (!await ctx.proteusSessionExists(session)) {
      const prekey=device.prekeys?.[0];
      if (!prekey || !Number.isInteger(prekey.id) || prekey.id<0 || prekey.id>65535) throw Error('DAO reader needs a prekey');
      const bundle=bytes(prekey.bundle);
      if (bundle.length<32 || bundle.length>1024 || b64(bundle)!==prekey.bundle) throw Error('Invalid prekey');
      await ctx.proteusSessionFromPrekey(session,bundle);prekeyId=prekey.id;
    }
    if (await ctx.proteusFingerprintRemote(session)!==device.fingerprint) throw Error('DAO reader device changed');
    const ciphertext=await ctx.proteusEncrypt(session,sealDaoEnvelope(meta,text));
    if (ciphertext.length>4096 || ciphertext.length<16) throw Error('DAO ciphertext exceeds packet bounds');
    result.push({recipient,generation:device.generation,fingerprint:device.fingerprint,prekey_id:prekeyId,ciphertext:b64(ciphertext)});
  }
  return result;
}
export async function decryptDaoDelivery(ctx, meta, delivery) {
  validate(meta);
  if (delivery.recipient!==meta.recipient || delivery.generation!==meta.recipientGeneration || delivery.fingerprint!==meta.recipientFingerprint) throw Error('Not this recipient device');
  const session=sessionId(meta,meta.sender,meta.senderGeneration);
  const raw=await ctx.proteusDecryptSafe(session,bytes(delivery.ciphertext));
  return openDaoEnvelope(raw,meta,await ctx.proteusFingerprintRemote(session));
}

export async function prepareDaoPacket({outbox,cryptoClient,base,text,recipients,threadRevision=null}) {
  // Validate the complete public context before recording or mutating crypto state.
  if(!Array.isArray(recipients)||!recipients.length||recipients.length>33||new Set(recipients.map(r=>r.address)).size!==recipients.length)throw Error('Invalid DAO roster');
  for(const r of recipients)sealDaoEnvelope({...base,recipient:r.address,recipientGeneration:r.device?.generation,recipientFingerprint:r.device?.fingerprint},text);
  if(base.reply&&!positive(threadRevision))throw Error('Reply needs current conversation revision');
  await outbox.begin({id:base.messageId,recipient:base.name,generation:base.revision});
  // No catch/reset here: partial crypto mutation, storage failure or interruption
  // preserves the intent and prevents a second prepare. Recovery is a release gate.
  const deliveries=await cryptoClient.transaction(ctx=>encryptDaoBatch(ctx,base,text,recipients));
  const packet={chain:base.chain,contract:base.contract,actor:base.sender,senderFingerprint:base.senderFingerprint,message:{dao:{send:{
    name:base.name,expected_revision:base.revision,sender_generation:base.senderGeneration,message_id:base.messageId,
    reply_to:base.reply?base.correspondent:null,expected_thread_revision:base.reply?threadRevision:null,deliveries,
  }}}};
  await outbox.ready(base.messageId,enc.encode(JSON.stringify(packet)));
  return {messageId:base.messageId,name:base.name,recipients:deliveries.map(d=>d.recipient)};
}

// Retry only exact, durable encrypted bytes. Unknown outcomes remain journaled.
export async function sendDaoReady({outbox,id,account,verify,query,execute,contract}) {
  if (!hex.test(id) || !address.test(contract)) throw Error('Invalid DAO transport');
  const actor=await account();
  if (!address.test(actor) || await verify()!==true) throw Error('Unverified UNI-7 mailbox');
  const lookup=()=>query({sent:{sender:actor,message_id:id}});
  const pending=await outbox.reconcile(id,lookup);
  if (pending.state==='confirmed') return pending;
  if (pending.state!=='ready' || !(pending.ciphertext instanceof Uint8Array)) throw Error('Unresolved DAO outbox');
  const packet=JSON.parse(dec.decode(pending.ciphertext)), send=packet.message?.dao?.send;
  if (packet.chain!=='uni-7' || packet.contract!==contract || packet.actor!==actor || !send || send.message_id!==id ||
      pending.recipient!==send.name || pending.generation!==send.expected_revision || !name.test(send.name)) throw Error('DAO outbox scope mismatch');
  const roster=await query({dao:{recipients:{name:send.name}}});
  if (roster.revision!==send.expected_revision || roster.name!==send.name) throw Error('DAO policy changed');
  const own=await query({device:{address:actor}});
  if (!own?.active || own.generation!==send.sender_generation || own.fingerprint!==packet.senderFingerprint) throw Error('Sender device changed');
  const expected=new Map(roster.recipients.filter(r=>r.address!==actor).map(r=>[r.address,r.device]));
  if (send.reply_to) {
    const thread=await query({dao:{thread:{name:send.name,correspondent:send.reply_to}}});
    if (!roster.recipients.some(r=>r.address===actor) || thread?.revision!==send.expected_thread_revision) throw Error('DAO conversation changed');
    if(send.reply_to!==actor)expected.set(send.reply_to,await query({device:{address:send.reply_to}}));
  }
  if (!Array.isArray(send.deliveries) || !expected.size || expected.size!==send.deliveries.length) throw Error('DAO recipient set changed');
  for(const item of send.deliveries) {
    const device=expected.get(item.recipient);
    if (!device?.active || device.generation!==item.generation || device.fingerprint!==item.fingerprint) throw Error('DAO reader device changed');
    const cipher=bytes(item.ciphertext);
    if(cipher.length<16||cipher.length>4096||b64(cipher)!==item.ciphertext)throw Error('Invalid DAO ciphertext');
    if(item.prekey_id!==null && !device.prekeys.some(p=>p.id===item.prekey_id))throw Error('DAO reader prekey consumed');
    expected.delete(item.recipient);
  }
  if(await account()!==actor || await verify()!==true)throw Error('Wallet or network changed');
  await execute(packet.message);
  if(await account()!==actor)throw Error('Wallet changed; preserve DAO outbox');
  const result=await outbox.reconcile(id,lookup);
  if(result.state!=='confirmed')throw Error('Broadcast uncertain; preserve DAO outbox');
  return result;
}
