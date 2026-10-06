// SPDX-License-Identifier: GPL-3.0-only
// Encrypted backup codec and authenticated transport candidate. The caller must
// capture ALL stores while the device lock is held and CoreCrypto is quiescent.
// Fresh-profile restoration is always staged read-only; an old snapshot must
// never silently resume a ratchet that another browser may have advanced.
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const LIMIT=5*1024*1024;
const b64=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);};
const bytes=(s,n)=>{if(typeof s!=='string'||s.length>8*1024*1024)throw Error('Invalid backup bytes');let r;try{r=Uint8Array.from(atob(s),c=>c.charCodeAt(0));}catch{throw Error('Invalid backup bytes');}if(b64(r)!==s||(n&&r.length!==n))throw Error('Invalid backup bytes');return r;};
export function personalBackupScope({chain,contract,wallet}){
  if(chain!=='juno-1'||!/^juno1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(contract||'')||!/^juno1[023456789acdefghjklmnpqrstuvwxyz]{38}$/.test(wallet||''))throw Error('Invalid personal backup scope');
  return JSON.stringify([chain,contract,wallet]);
}
const header=(scope,revision)=>JSON.stringify({version:1,scope,revision});
async function key(code,salt,scope,purpose='neta-personal-backup-v1'){
  if(!/^[a-f0-9]{64}$/.test(code||''))throw Error('Generated 256-bit recovery code required');
  const secret=Uint8Array.from(code.match(/../g),s=>parseInt(s,16));
  try{const material=await crypto.subtle.importKey('raw',secret,'HKDF',false,['deriveKey']);return await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt,info:enc.encode(purpose+':'+scope)},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}finally{secret.fill(0);}
}
function validateSnapshot(s,scope){
  if(s?.version!==1||s.scope!==scope||s.corecryptoVersion!=='10.5.3'||!s.descriptor||! /^[a-f0-9]{64}$/.test(s.descriptor.fingerprint||'')||
    !Number.isSafeInteger(s.descriptor.generation)||s.descriptor.generation<1||typeof s.wrappedKey!=='string'||!s.wrappedKey||
    !Array.isArray(s.blocks)||!s.blocks.length||!Array.isArray(s.archiveRecords)||!Array.isArray(s.sendRecords)||!Array.isArray(s.transactionIntents)||
    !Object.hasOwn(s,'registrationIntent')||!Number.isSafeInteger(s.cursor)||s.cursor<0||!/^relay-[a-f0-9]{24}\.db$/.test(s.path||''))throw Error('Incomplete coherent backup snapshot');
  if(new Set(s.blocks.map(b=>b.offset)).size!==s.blocks.length||s.blocks.length>10000)throw Error('Invalid backup blocks');
  for(const b of s.blocks)if(b.path!==s.path||!Number.isSafeInteger(b.offset)||b.offset<0||!Array.isArray(b.data)||!b.data.length||b.data.length>65536||b.data.some(v=>!Number.isInteger(v)||v<0||v>255))throw Error('Invalid backup block');
}
export async function backupDigest(envelope){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(JSON.stringify(envelope)))),b=>b.toString(16).padStart(2,'0')).join('');}
export async function sealPersonalBackup(scopeObject,revision,snapshot,code){
  const scope=personalBackupScope(scopeObject);if(!Number.isSafeInteger(revision)||revision<1)throw Error('Invalid backup revision');validateSnapshot(snapshot,scope);
  const raw=enc.encode(JSON.stringify(snapshot));if(raw.length>LIMIT)throw Error('Backup snapshot quota exceeded');
  const salt=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(header(scope,revision))},await key(code,salt,scope),raw));
  return {version:1,scope,revision,salt:b64(salt),iv:b64(iv),ciphertext:b64(ciphertext)};
}
export async function openPersonalBackup(scopeObject,envelope,code,{minimumRevision=0,expectedDigest=null}={}){
  const scope=personalBackupScope(scopeObject);
  if(!Number.isSafeInteger(minimumRevision)||minimumRevision<0||envelope?.version!==1||envelope.scope!==scope||!Number.isSafeInteger(envelope.revision)||envelope.revision<1||envelope.revision<minimumRevision)throw Error('Wrong identity or stale backup');
  if(expectedDigest!==null&&await backupDigest(envelope)!==expectedDigest)throw Error('Backup digest mismatch');
  const ciphertext=bytes(envelope.ciphertext);if(ciphertext.length>LIMIT+16)throw Error('Backup quota exceeded');
  let raw;try{raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv,12),additionalData:enc.encode(header(scope,envelope.revision))},await key(code,bytes(envelope.salt,32),scope),ciphertext);}catch{throw Error('Recovery code, identity or backup authentication failed');}
  const snapshot=JSON.parse(dec.decode(raw));validateSnapshot(snapshot,scope);
  return {mode:'restore_read_only',writesAllowed:false,revision:envelope.revision,snapshot};
}
export class PersonalBackupClient{
  constructor({url,webOrigin,scope,keplr,fetcher=fetch,now=Date.now}){
    if(!/^https:\/\/[^/]+$/.test(url)||!/^https:\/\/[^/]+$/.test(webOrigin)||!keplr?.signArbitrary||!keplr?.getOfflineSigner)throw Error('Backup dependencies unavailable');
    Object.assign(this,{url,webOrigin,scope:personalBackupScope(scope),scopeObject:{...scope},keplr,fetcher,now,token:null,expires:0});
  }
  async wallet(){const active=(await this.keplr.getOfflineSigner(this.scopeObject.chain).getAccounts())[0]?.address;if(active!==this.scopeObject.wallet){this.token=null;throw Error('Backup wallet changed');}}
  async request(path,method,body,authorized=false){
    if(authorized){await this.wallet();if(!this.token||this.expires<=this.now())throw Error('Backup authentication expired');}
    const response=await this.fetcher(this.url+path,{method,cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json',...(authorized?{authorization:'Bearer '+this.token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!response.ok)throw Error('Backup service rejected request ('+response.status+')');return response.json();
  }
  async connect(){
    await this.wallet();const c=await this.request('/v1/challenge','POST',{wallet:this.scopeObject.wallet});
    let parsed;try{parsed=JSON.parse(c.message);}catch{throw Error('Invalid backup challenge');}
    if(parsed.purpose!=='NETA RELAY encrypted backup access v1'||parsed.domain!==this.url||parsed.origin!==this.webOrigin||parsed.scope!==this.scope||parsed.nonce!==c.nonce||! /^[a-f0-9]{64}$/.test(c.nonce)||parsed.expires!==c.expires||c.expires<=this.now()||c.expires>this.now()+125000)throw Error('Backup challenge identity mismatch');
    const signature=await this.keplr.signArbitrary(this.scopeObject.chain,this.scopeObject.wallet,c.message);await this.wallet();
    const auth=await this.request('/v1/auth','POST',{nonce:c.nonce,signature});
    if(auth.scope!==this.scope||! /^[a-f0-9]{64}$/.test(auth.accessToken)||!Number.isSafeInteger(auth.expires)||auth.expires<=this.now()||auth.expires>this.now()+905000)throw Error('Invalid backup session');
    await this.wallet();this.token=auth.accessToken;this.expires=auth.expires;
  }
  disconnect(){this.token=null;this.expires=0;}
  async latest({minimumRevision=0}={}){
    const result=await this.request('/v1/backup','GET',undefined,true);await this.wallet();
    if(result.backup===null){if(minimumRevision>0)throw Error('Previously confirmed backup missing');return null;}
    const b=result.backup;if(typeof b?.blob!=='string'||b.blob.length>8*1024*1024)throw Error('Invalid backup response');
    const envelope=JSON.parse(b.blob);
    if(envelope.scope!==this.scope||!Number.isSafeInteger(b.revision)||b.revision<1||b.revision<minimumRevision||b.revision!==envelope.revision||await backupDigest(envelope)!==b.digest)throw Error('Backup response changed or stale');
    return {...b,envelope};
  }
  async upload(envelope){
    if(envelope.scope!==this.scope||!Number.isSafeInteger(envelope.revision)||envelope.revision<1)throw Error('Wrong backup scope');
    const digest=await backupDigest(envelope);let receipt;
    try{receipt=await this.request('/v1/backup','PUT',{expectedRevision:envelope.revision-1,envelope},true);}catch(error){
      const found=await this.latest({minimumRevision:envelope.revision-1});
      if(found?.revision!==envelope.revision||found.digest!==digest)throw error;receipt=found;
    }
    await this.wallet();if(receipt.revision!==envelope.revision||receipt.digest!==digest||!Number.isSafeInteger(receipt.updated))throw Error('Backup acknowledgement mismatch');
    return {revision:receipt.revision,digest,updated:receipt.updated};
  }
}

// Separate key-wrapping domain; no unwrapped DB key is stored outside memory.
export async function wrapPersonalDatabaseKey(scopeObject,secret,code){
  const scope=personalBackupScope(scopeObject);
  if(!(secret instanceof Uint8Array)||secret.length!==32)throw Error('Invalid database key');
  const salt=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(scope)},await key(code,salt,scope,'neta-personal-db-key-v1'),secret));
  return JSON.stringify({version:1,salt:b64(salt),iv:b64(iv),ciphertext:b64(ciphertext)});
}
export async function unwrapPersonalDatabaseKey(scopeObject,wrapped,code){
  const scope=personalBackupScope(scopeObject);if(typeof wrapped!=='string'||wrapped.length>1024)throw Error('Invalid wrapped database key');
  const value=JSON.parse(wrapped);if(value.version!==1)throw Error('Invalid wrapped database key');
  return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(value.iv,12),additionalData:enc.encode(scope)},await key(code,bytes(value.salt,32),scope,'neta-personal-db-key-v1'),bytes(value.ciphertext,48)));
}
