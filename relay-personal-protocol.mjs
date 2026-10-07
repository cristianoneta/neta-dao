// SPDX-License-Identifier: GPL-3.0-only
// Generation-aware crypto primitives. Invoke inside a transaction after durable
// pre-operation checkpointing; CoreCrypto callbacks alone do not undo mutations.
import {personalSessionId} from './relay-personal-lifecycle.mjs';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const fields=['chain','contract','sender','senderGeneration','senderFingerprint','recipient','recipientGeneration','recipientFingerprint','messageId'];
function route(meta){
  if(!/^[a-f0-9]{64}$/.test(meta?.messageId))throw Error('Invalid message ID');
  return personalSessionId(meta,
    {address:meta.sender,generation:meta.senderGeneration,fingerprint:meta.senderFingerprint,device_id:'routing',protocol_version:1},
    {address:meta.recipient,generation:meta.recipientGeneration,fingerprint:meta.recipientFingerprint,device_id:'routing',protocol_version:1});
}
export async function personalArchiveId(meta){route(meta);return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(JSON.stringify(fields.map(k=>meta[k]))))),n=>n.toString(16).padStart(2,'0')).join('');}
export async function encryptPersonal(ctx,meta,text,recipient){
  const session=route(meta);
  if(typeof text!=='string'||!text||enc.encode(text).length>1800)throw Error('Invalid message text');
  if(!recipient?.active||recipient.generation!==meta.recipientGeneration||recipient.fingerprint!==meta.recipientFingerprint)throw Error('Recipient changed');
  let prekey=null;
  if(!await ctx.proteusSessionExists(session)){
    prekey=recipient.prekeys?.[0];
    if(!prekey||!Number.isInteger(prekey.id)||prekey.id<0||prekey.id>65535||typeof prekey.bundle!=='string'||prekey.bundle.length>1370)throw Error('Recipient needs a prekey');
    const bytes=Uint8Array.from(atob(prekey.bundle),c=>c.charCodeAt(0));
    if(bytes.length<32||bytes.length>1024)throw Error('Invalid prekey');
    await ctx.proteusSessionFromPrekey(session,bytes);
  }
  if(await ctx.proteusFingerprintRemote(session)!==meta.recipientFingerprint)throw Error('Recipient fingerprint mismatch');
  const plain=enc.encode(JSON.stringify({version:1,...Object.fromEntries(fields.map(k=>[k,meta[k]])),message:text}));
  return {ciphertext:await ctx.proteusEncrypt(session,plain),prekey};
}
export async function decryptPersonal(ctx,meta,ciphertext){
  const session=route(meta);
  if(!(ciphertext instanceof Uint8Array)||ciphertext.length<16||ciphertext.length>4096)throw Error('Invalid ciphertext');
  const plain=await ctx.proteusDecryptSafe(session,ciphertext);
  if(await ctx.proteusFingerprintRemote(session)!==meta.senderFingerprint||plain.length>3072)throw Error('Sender fingerprint mismatch');
  const data=JSON.parse(dec.decode(plain));
  if(!data||data.version!==1||Object.keys(data).length!==fields.length+2||fields.some(k=>data[k]!==meta[k])||typeof data.message!=='string'||!data.message||enc.encode(data.message).length>1800)throw Error('Encrypted routing mismatch');
  return data.message;
}
export async function resolvePersonalSender(adapter,row){
  if(row.recipient!==adapter.address||!Number.isSafeInteger(row.sender_generation)||row.sender_generation<1)throw Error('Wrong personal inbox');
  const historical=await adapter.historicalDevice(row.sender,row.sender_generation);
  if(!historical||historical.generation!==row.sender_generation||! /^[a-f0-9]{64}$/.test(historical.fingerprint)||historical.protocol_version!==1)throw Error('Historical sender identity unavailable');
  return historical; // Revocation/current generation does not erase old identity.
}
