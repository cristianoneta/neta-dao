// SPDX-License-Identifier: GPL-3.0-only
// Recovery-aware personal browser controller. This module does not activate a
// deployment or mount production SEND. All chain writes require a reviewed
// request through the supplied exact-byte bridge and the owner's wallet UI.
import {PersonalBrowserStore} from './relay-personal-store.mjs';
import {PersonalSendJournal} from './relay-personal-recovery.mjs';
import {PersonalMessageTransport} from './relay-personal-transport.mjs';
import {PersonalMailboxLifecycle,personalSessionId} from './relay-personal-lifecycle.mjs';
import {encryptPersonal,decryptPersonal,personalArchiveId,resolvePersonalSender} from './relay-personal-protocol.mjs';
import {personalBackupScope,sealPersonalBackup,openPersonalBackup,backupDigest,wrapPersonalDatabaseKey,unwrapPersonalDatabaseKey} from './relay-personal-backup.mjs';
import {captureRatchet,restoreRatchet} from './relay-uni7-checkpoint.mjs';
import {acquireDeviceLock} from './spikes/relay-corecrypto/browser-device-lock.mjs';
const enc=new TextEncoder();
const random=(n=32)=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('');
const b64=b=>btoa(String.fromCharCode(...b));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const clone=structuredClone;
const address=s=>/^juno1[023456789acdefghjklmnpqrstuvwxyz]{38,90}$/.test(s||'');
const identity=d=>d&&({generation:d.generation,device_id:d.device_id,protocol_version:d.protocol_version,fingerprint:d.fingerprint});
const terminal=r=>['confirmed','rolled_back'].includes(r.state);
async function digest(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))),b=>b.toString(16).padStart(2,'0')).join('');}
class SnapshotJournal extends PersonalSendJournal{
  constructor(owner){super(owner.scope,owner.scopeObject,null,null);this.owner=owner;}
  async entries(){return clone(this.owner.snapshot.sendRecords);}
  async save(data,add=false){
    const rows=this.owner.snapshot.sendRecords,at=rows.findIndex(r=>r.id===data.id);
    if(add&&at>=0)throw Error('Personal send ID already exists');
    if(!add&&at<0)throw Error('Personal send journal missing');
    if(at<0)rows.push(clone(data));else rows[at]=clone(data);
    await this.owner.persist();
  }
  close(){}
}
export class PersonalBrowserController{
  constructor({runtime,adapter,backup,makeBridge,storage=globalThis.localStorage,onState=()=>{},fault=async()=>{}}){
    if(!runtime?.reset||!runtime?.close||adapter?.profile?.chain!=='juno-1'||!backup?.latest||!backup?.upload||typeof makeBridge!=='function'||!storage?.getItem)throw Error('Personal browser dependencies unavailable');
    Object.assign(this,{runtime,adapter,backup,makeBridge,storage,onState,fault});
    this.scopeObject={chain:adapter.profile.chain,contract:adapter.profile.contract,wallet:adapter.address};
    this.scope=personalBackupScope(this.scopeObject);this.busy=false;this.invalidated=false;this.failed=false;this.snapshot=null;this.record=null;this.lock=null;
    this.accountChanged=()=>this.invalidate();globalThis.addEventListener?.('keplr_keystorechange',this.accountChanged);
  }
  emit(){this.onState(this.status());}
  status(){
    if(this.invalidated||!this.snapshot)return {open:false,busy:this.busy,history:[],readOnly:true};
    return {open:true,busy:this.busy,readOnly:this.snapshot.controller.readOnly||!!this.snapshot.controller.rotationRecovery,needsRecovery:this.failed,
      generation:this.snapshot.descriptor.generation,registered:this.snapshot.controller.registered,
      backup:this.record?.remote||null,backupPending:!!this.record?.pendingUpload||this.record?.envelope.revision!==(this.record?.remote?.revision||0),
      history:clone(this.snapshot.archiveRecords.filter(r=>r.status==='confirmed')),
      pending:this.snapshot.sendRecords.filter(r=>!terminal(r)).map(r=>({id:r.id,state:r.state,outcome:r.attempt?.outcome||null})),
      operation:this.snapshot.registrationIntent?.status||null};
  }
  async guard(){if(this.invalidated)throw Error('Personal controller closed or wallet changed');try{await this.adapter.assertWallet();if(this.adapter.address!==this.scopeObject.wallet)throw Error('Personal wallet changed');}catch(error){this.invalidate();throw error;}}
  async run(fn,{recover=false}={}){
    if(this.busy)throw Error('Personal operation already running');
    if(this.failed&&!recover)throw Error('Personal recovery required before continuing');
    this.busy=true;this.emit();
    try{await this.guard();const result=await fn();await this.guard();return result;}
    catch(error){this.failed=!!this.snapshot;throw error;}
    finally{this.quiesce();this.busy=false;if(this.invalidated||!this.snapshot)await this.release();this.emit();}
  }
  invalidate(){this.invalidated=true;this.emit();if(!this.busy)void this.release();}
  async close(){this.invalidated=true;this.emit();if(!this.busy)await this.release();}
  async release(){this.quiesce();this.runtime.close();this.wire=null;this.repo?.close();this.repo=null;this.code=null;this.snapshot=null;this.record=null;await this.lock?.release();this.lock=null;globalThis.removeEventListener?.('keplr_keystorechange',this.accountChanged);}
  quiesce(){for(const name of ['cc','db','dbKey']){try{this[name]?.uniffiDestroy();}catch{}this[name]=null;}}
  async acquire(code){
    if(this.lock)throw Error('Personal device already open');
    if(!/^[a-f0-9]{64}$/.test(code||''))throw Error('Generated recovery code required');
    globalThis.addEventListener?.('keplr_keystorechange',this.accountChanged);
    await this.adapter.verify();const key=(await digest(this.scope)).slice(0,24);
    this.lock=await acquireDeviceLock({chain:'juno-1',wallet:this.scopeObject.wallet,path:'personal-scope-'+key});
    this.code=code;this.repo=await PersonalBrowserStore.open(this.scope);this.wire=await this.runtime.reset();
  }
  async path(descriptor){return 'relay-'+(await digest(this.scope+':'+descriptor.device_id)).slice(0,24)+'.db';}
  async transaction(callback){
    let result,originalError;
    try{await this.cc.transactionFfi({execute:async ctx=>{try{result=await callback(ctx);}catch(error){originalError=error;throw error;}finally{ctx.uniffiDestroy();}}});}
    catch(error){throw originalError||error;}return structuredClone(result);
  }
  async openCrypto(device=this.snapshot){
    this.quiesce();const secret=await unwrapPersonalDatabaseKey(this.scopeObject,device.wrappedKey,this.code);
    try{this.dbKey=new this.wire.DatabaseKey(secret);}finally{secret.fill(0);}
    this.db=await this.wire.Database.open(device.path,this.dbKey);this.cc=this.wire.CoreCrypto.new(this.db);await this.transaction(ctx=>ctx.proteusInit());
    if(await this.transaction(ctx=>ctx.proteusFingerprint())!==device.descriptor.fingerprint){this.quiesce();throw Error('Personal local fingerprint mismatch');}
  }
  async restoreWorking(device=this.snapshot){
    if(device.path!==await this.path(device.descriptor))throw Error('Backup database path mismatch');
    // Create only the pinned IndexedDB schema. Opening a new SQLite database
    // here would populate CoreCrypto's VFS cache before the import is installed.
    this.quiesce();this.wire=await this.runtime.reset();await new Promise((resolve,reject)=>{
      const r=indexedDB.open('core-crypto',1);
      r.onupgradeneeded=()=>r.result.createObjectStore('blocks',{keyPath:['path','offset']});
      r.onsuccess=()=>{r.result.close();resolve();};r.onerror=()=>reject(r.error);
    });
    await restoreRatchet(device.path,device.blocks);
  }
  async newDevice(generation){
    const descriptor={generation,device_id:'personal-'+random(12),protocol_version:1,fingerprint:null,prekeys:[],max_prekey_id:8};
    const path=await this.path(descriptor),secret=crypto.getRandomValues(new Uint8Array(32));
    let wrappedKey;try{wrappedKey=await wrapPersonalDatabaseKey(this.scopeObject,secret,this.code);this.dbKey=new this.wire.DatabaseKey(secret);}finally{secret.fill(0);}
    this.db=await this.wire.Database.open(path,this.dbKey);this.cc=this.wire.CoreCrypto.new(this.db);await this.transaction(ctx=>ctx.proteusInit());
    descriptor.fingerprint=await this.transaction(ctx=>ctx.proteusFingerprint());
    for(let id=1;id<=8;id++)descriptor.prekeys.push({id,bundle:b64(await this.transaction(ctx=>ctx.proteusNewPrekey(id)))});
    this.quiesce();return {path,wrappedKey,descriptor,blocks:await captureRatchet(path)};
  }
  validateSnapshot(s){
    if(s?.controller?.version!==1||typeof s.controller.readOnly!=='boolean'||typeof s.controller.registered!=='boolean'||!Array.isArray(s.controller.retired)||!Array.isArray(s.controller.quarantine))throw Error('Unsupported personal controller snapshot');
    if(s.archiveRecords.some(r=>r.meta?.chain!=='juno-1'||r.meta.contract!==this.scopeObject.contract||!['in','out'].includes(r.direction)||!['confirmed'].includes(r.status)||!Number.isSafeInteger(r.sequence)||r.sequence<1||typeof r.text!=='string'||(r.direction==='in'?r.meta.recipient:r.meta.sender)!==this.scopeObject.wallet))throw Error('Archive scope mismatch');
    if(s.sendRecords.some(r=>r.meta?.chain!=='juno-1'||r.meta.contract!==this.scopeObject.contract||r.meta.sender!==this.scopeObject.wallet||!['preparing','ready','confirmed','rolled_back'].includes(r.state)))throw Error('Send journal scope mismatch');
    if(s.transactionIntents.some(r=>typeof r.key!=='string'||typeof r.value!=='string'||!this.txKey(r.key)))throw Error('Transaction snapshot scope mismatch');
    if(s.controller.retired.some(d=>!d.descriptor||!Array.isArray(d.blocks)||typeof d.wrappedKey!=='string'))throw Error('Invalid retired device snapshot');
  }
  txKey(key){return key==='neta-pending-tx-v1:juno-1:'+this.scopeObject.wallet||key.startsWith('neta-nns-v2-attempt:juno-1:'+this.scopeObject.wallet+':')||key===['relay-personal-lifecycle-v1','juno-1',this.scopeObject.contract,this.scopeObject.wallet].join(':');}
  setupAdapters(){
    this.restoredStorage=new Map(this.snapshot.transactionIntents.map(r=>[r.key,r.value]));
    const storage={getItem:key=>this.snapshot.controller.readOnly?(this.restoredStorage.get(key)??null):(this.storage.getItem(key)??this.restoredStorage.get(key)??null),
      setItem:(key,value)=>{if(!this.txKey(key))throw Error('Foreign transaction key');if(this.snapshot.controller.readOnly)this.restoredStorage.set(key,value);else this.storage.setItem(key,value);},
      removeItem:key=>{if(!this.txKey(key))throw Error('Foreign transaction key');this.restoredStorage.delete(key);this.snapshot.transactionIntents=this.snapshot.transactionIntents.filter(r=>r.key!==key);if(!this.snapshot.controller.readOnly)this.storage.removeItem(key);}};
    this.bridgeStorage=storage;const raw=this.makeBridge(storage);
    if(raw.signedCheckpointGuard!==true)throw Error('Reload the recovery-aware signing bundle');
    this.bridge={execute:async(request,options={})=>{
      await this.assertWritable({rotation:this.rotating===true});
      return raw.execute(request,{...options,beforeSign:async()=>{await this.guard();await this.assertWritable({rotation:this.rotating===true});await options.beforeSign?.();},
        onSigned:async()=>{await this.fault('signed-before-backup');await this.persist();await this.fault('signed-after-backup');await this.guard();await this.assertOwn({rotation:this.rotating===true});}});
    },recover:(...args)=>raw.recover(...args)};
    this.journal=new SnapshotJournal(this);
    this.transport=new PersonalMessageTransport({adapter:this.adapter,journal:this.journal,bridge:this.bridge});
    this.lifecycle=new PersonalMailboxLifecycle({adapter:this.adapter,bridge:this.bridge,storage,prepared:async(kind,input,before)=>{
      const p=this.snapshot.controller.prepared;return !!p&&p.kind===kind&&same(p.input,input)&&same(p.before,before);
    }});
  }
  captureTransactions(){
    if(this.snapshot.controller.readOnly){this.snapshot.transactionIntents=[...this.restoredStorage].map(([key,value])=>({key,value}));return;}
    // Retain restored evidence even after adopting a new local signing journal.
    const rows=this.snapshot.transactionIntents.filter(r=>!r.key.startsWith('neta-pending'));const hashes=new Set();
    for(let i=0;i<this.storage.length;i++){
      const key=this.storage.key(i);if(!this.txKey(key)||key.startsWith('neta-pending'))continue;
      const value=this.storage.getItem(key);const parsed=JSON.parse(value);
      if(key.startsWith('neta-nns')&&parsed.request?.contract!==this.scopeObject.contract)continue;
      if(parsed.hash)hashes.add(parsed.hash);const at=rows.findIndex(r=>r.key===key);if(at<0)rows.push({key,value});else rows[at]={key,value};
    }
    const key='neta-pending-tx-v1:juno-1:'+this.scopeObject.wallet,value=this.storage.getItem(key);
    if(value){const row=JSON.parse(value);if(hashes.has(row.hash))rows.push({key,value});}
    this.snapshot.transactionIntents=rows;
  }
  async persist({upload=true}={}){
    this.quiesce();this.snapshot.blocks=await captureRatchet(this.snapshot.path);this.captureTransactions();
    if(this.record?.pendingUpload)await this.sync(); // Never overwrite an uncertain backup attempt.
    const revision=(this.record?.remote?.revision||0)+1;
    const envelope=await sealPersonalBackup(this.scopeObject,revision,this.snapshot,this.code);
    this.record=await this.repo.write({envelope,remote:this.record?.remote||null,pendingUpload:false},this.record?.localRevision||0);
    await this.fault('checkpoint-saved');
    if(upload&&!this.snapshot.controller.readOnly)await this.sync();
    this.emit();
  }
  async sync(){
    if(this.snapshot.controller.readOnly)throw Error('Restored profile cannot overwrite remote backup');
    const row=this.record,revision=row.envelope.revision,digestValue=await backupDigest(row.envelope),base=row.remote?.revision||0;
    const remote=await this.backup.latest({minimumRevision:base});
    if(remote?.revision===revision&&remote.digest===digestValue){
      this.record=await this.repo.write({...row,remote:{revision,digest:digestValue,updated:remote.updated},pendingUpload:false},row.localRevision);return;
    }
    if((remote?.revision||0)!==base||(base&&remote.digest!==row.remote.digest))throw Error('Remote backup changed in another profile; restore separately, no overwrite');
    if(revision===base){if(remote?.digest!==digestValue)throw Error('Backup watermark mismatch');return;}
    if(revision!==base+1)throw Error('Invalid backup revision');
    this.record=await this.repo.write({...row,pendingUpload:true},row.localRevision);
    const ack=await this.backup.upload(row.envelope);
    if(ack.revision!==revision||ack.digest!==digestValue)throw Error('Backup receipt mismatch');
    this.record=await this.repo.write({...this.record,remote:ack,pendingUpload:false},this.record.localRevision);
  }
  async create(code=random()){
    return this.run(async()=>{
      await this.acquire(code);
      if(await this.repo.read())throw Error('Local personal state already exists; unlock it');
      if(await this.backup.latest()||await this.adapter.device())throw Error('Existing remote backup/device requires recovery, not creation');
      const device=await this.newDevice(1);
      this.snapshot={version:1,scope:this.scope,corecryptoVersion:'10.5.3',...device,archiveRecords:[],sendRecords:[],transactionIntents:[],registrationIntent:null,cursor:0,
        controller:{version:1,readOnly:false,registered:false,retired:[],quarantine:[],inbound:null,prepared:null}};
      this.setupAdapters();await this.persist();return {recoveryCode:code,descriptor:clone(device.descriptor)};
    },{recover:true});
  }
  async unlock(code){return this.run(async()=>{
    await this.acquire(code);this.record=await this.repo.read();if(!this.record)throw Error('No local personal state; restore the backup');
    const {snapshot}=await openPersonalBackup(this.scopeObject,this.record.envelope,code);this.validateSnapshot(snapshot);this.snapshot=snapshot;this.setupAdapters();
    await this.restoreWorking();await this._recover();this.failed=false;return this.status();
  },{recover:true});}
  async restore(code){return this.run(async()=>{
    await this.acquire(code);if(await this.repo.read())throw Error('Refusing to replace existing personal state');
    const remote=await this.backup.latest();if(!remote)throw Error('No remote personal backup');
    const opened=await openPersonalBackup(this.scopeObject,remote.envelope,code,{minimumRevision:remote.revision,expectedDigest:remote.digest});
    this.validateSnapshot(opened.snapshot);this.snapshot=opened.snapshot;this.snapshot.controller.readOnly=true;
    this.setupAdapters();
    // Stage the entire authenticated snapshot atomically BEFORE touching any
    // working database. Interrupted import resumes via unlock, never key reset.
    const envelope=await sealPersonalBackup(this.scopeObject,remote.revision+1,this.snapshot,code);
    this.record=await this.repo.write({envelope,remote:{revision:remote.revision,digest:remote.digest,updated:remote.updated},pendingUpload:false},0);
    await this.fault('restore-staged');await this.restoreWorking();await this._recover();this.failed=false;return this.status();
  },{recover:true});}
  async assertOwn({rotation=false}={}){
    const own=await this.adapter.device();
    if(!this.snapshot.controller.registered){if(own)throw Error('A device was registered elsewhere');return;}
    if(!own?.active||!same(identity(own),identity(this.snapshot.descriptor)))throw Error('Active personal device changed; preserve local history');
    return own;
  }
  async assertWritable({rotation=false}={}){
    await this.guard();if((this.snapshot.controller.readOnly||this.snapshot.controller.rotationRecovery)&&!rotation)throw Error('Restored profile is read-only; review a new device generation');
    await this.assertOwn({rotation});
    if(this.record.pendingUpload)throw Error('Backup confirmation required before signing');
  }
  ensureIdle(){if(this.snapshot.sendRecords.some(r=>!terminal(r))||this.snapshot.controller.inbound||this.snapshot.registrationIntent?.status==='pending'||this.lifecycle.load()?.status==='pending')throw Error('Unresolved personal operation; recover it first');}
  async recover(){return this.run(async()=>{
    this.quiesce();this.record=await this.repo.read();const opened=await openPersonalBackup(this.scopeObject,this.record.envelope,this.code);
    this.validateSnapshot(opened.snapshot);this.snapshot=opened.snapshot;this.setupAdapters();await this.restoreWorking();await this._recover();this.failed=false;return this.status();
  },{recover:true});}
  async _recover(){
    if(!this.snapshot.controller.readOnly)await this.sync();
    const inbound=this.snapshot.controller.inbound;
    if(inbound){await restoreRatchet(inbound.path,inbound.blocks);if(inbound.path===this.snapshot.path)this.snapshot.blocks=clone(inbound.blocks);else this.snapshot.controller.retired.find(d=>d.path===inbound.path).blocks=clone(inbound.blocks);this.snapshot.controller.inbound=null;await this.persist();}
    await this.journal.recover({restore:async blocks=>{await restoreRatchet(this.snapshot.path,blocks);this.snapshot.blocks=clone(blocks);},abandon:async()=>{},
      confirm:async(id,sequence)=>{const row=this.snapshot.sendRecords.find(r=>r.archiveId===id);await this.confirmSent(row,sequence);},
      lookupSent:id=>this.adapter.smart({sent:{sender:this.scopeObject.wallet,message_id:id}})});
    for(const row of await this.journal.entries())if(['ready','confirmed'].includes(row.state)&&row.attempt){
      try{if(row.state==='confirmed')await this.bridge.recover(row.attempt.request);const result=await this.transport.recover(row.id);if(result.state==='confirmed')await this.confirmSent(row,result.sequence);}catch{/* Unknown remains visible and blocks new actions. */}
    }
    if(this.snapshot.registrationIntent?.status==='pending')await this.reconcileRegistration();
    if(this.lifecycle.load()?.status==='pending'){try{await this.lifecycle.recover();}catch{/* Preserve exact lifecycle evidence and remain blocked. */}}
    await this.activatePrepared();await this.persist();
  }
  async confirmSent(row,sequence){
    if(!row||!Number.isSafeInteger(sequence)||sequence<1)throw Error('Invalid sent message receipt');
    const old=this.snapshot.archiveRecords.find(r=>r.id===row.archiveId);
    if(old){if(old.sequence!==sequence||old.text!==row.text||!same(old.meta,row.meta))throw Error('Archived message receipt changed');return;}
    this.snapshot.archiveRecords.push({id:row.archiveId,direction:'out',status:'confirmed',sequence,meta:clone(row.meta),text:row.text});await this.persist();
  }
  async prepareMessage(recipient,text){return this.run(async()=>{
    this.ensureIdle();await this.assertWritable();if(!this.snapshot.controller.registered)throw Error('Register personal device first');await this.sync();
    if(!address(recipient)||recipient===this.scopeObject.wallet||typeof text!=='string'||!text||enc.encode(text).length>1800)throw Error('Invalid personal recipient or message');
    const remote=await this.adapter.device(recipient);if(!remote?.active)throw Error('Recipient has no active device');
    if(!same(await this.adapter.smart({consent:{recipient,sender:this.scopeObject.wallet}}),[remote.generation,this.snapshot.descriptor.generation]))throw Error('Recipient consent required');
    if(await this.adapter.smart({blocked:{recipient,sender:this.scopeObject.wallet}})!==false)throw Error('Recipient blocked sender');
    const d=this.snapshot.descriptor,meta={chain:'juno-1',contract:this.scopeObject.contract,sender:this.scopeObject.wallet,senderGeneration:d.generation,senderFingerprint:d.fingerprint,
      recipient,recipientGeneration:remote.generation,recipientFingerprint:remote.fingerprint,messageId:random()};
    await this.openCrypto();const session=personalSessionId(meta,{address:meta.sender,...d},{address:recipient,...remote});
    const exists=await this.transaction(ctx=>ctx.proteusSessionExists(session));const prekey=exists?null:remote.prekeys?.[0];if(!exists&&!prekey)throw Error('Recipient needs prekeys');
    this.quiesce();const blocks=await captureRatchet(this.snapshot.path),archiveId=await personalArchiveId(meta);
    const send={messageId:meta.messageId,recipient,generation:remote.generation,deviceId:remote.device_id,fingerprint:remote.fingerprint,
      ...(prekey?{initialPrekeyId:prekey.id,initialPrekeyBundle:Array.from(unb64(prekey.bundle))}:{})};
    await this.journal.prepare({meta,text,archiveId,blocks,send});await this.openCrypto();
    const encrypted=await this.transaction(ctx=>encryptPersonal(ctx,meta,text,remote));
    await this.fault('outbound-encrypted');await this.journal.ready(meta.messageId,encrypted.ciphertext);
    return this.transport.review(meta.messageId);
  });}
  async reviewPending(messageId){return this.run(async()=>{await this.assertWritable();await this.sync();return this.transport.review(messageId);});}
  async submitMessage(review){return this.run(async()=>{
    await this.assertWritable();await this.sync();
    try{const result=await this.transport.submit(review);await this.confirmSent(await this.transport.row(review.messageId),result.sequence);return result;}
    finally{await this.persist();}
  });}
  async receive(){return this.run(async()=>{
    if(!this.snapshot.controller.registered)throw Error('Personal device is not registered');this.ensureIdle();
    if(!this.snapshot.controller.readOnly)await this.sync();
    const rows=await this.adapter.inbox(this.snapshot.cursor||null);let previous=this.snapshot.cursor;
    for(const row of rows){
      if(!Number.isSafeInteger(row.sequence)||row.sequence<=previous||row.recipient!==this.scopeObject.wallet||! /^[a-f0-9]{64}$/.test(row.message_id)||!address(row.sender))throw Error('Invalid personal inbox sequence');previous=row.sequence;
      const device=[this.snapshot,...this.snapshot.controller.retired].find(d=>d.descriptor.generation===row.recipient_generation);
      if(!device)throw Error('Recipient generation unavailable; retain inbox cursor');
      const sender=await resolvePersonalSender(this.adapter,row),meta={chain:'juno-1',contract:this.scopeObject.contract,sender:row.sender,senderGeneration:row.sender_generation,senderFingerprint:sender.fingerprint,
        recipient:this.scopeObject.wallet,recipientGeneration:row.recipient_generation,recipientFingerprint:device.descriptor.fingerprint,messageId:row.message_id};
      const id=await personalArchiveId(meta);if(this.snapshot.archiveRecords.some(r=>r.id===id))throw Error('Inbox routing replay');
      await this.restoreWorking(device);this.snapshot.controller.inbound={path:device.path,blocks:clone(device.blocks),id,sequence:row.sequence};await this.persist();
      await this.openCrypto(device);let text;
      try{text=await this.transaction(ctx=>decryptPersonal(ctx,meta,unb64(row.ciphertext)));}
      catch{this.quiesce();await restoreRatchet(device.path,this.snapshot.controller.inbound.blocks);device.blocks=clone(this.snapshot.controller.inbound.blocks);
        this.snapshot.controller.quarantine.push({id,sequence:row.sequence});this.snapshot.cursor=row.sequence;this.snapshot.controller.inbound=null;await this.persist();continue;}
      await this.fault('inbound-decrypted');this.quiesce();device.blocks=await captureRatchet(device.path);
      this.snapshot.archiveRecords.push({id,direction:'in',status:'confirmed',sequence:row.sequence,meta,text});this.snapshot.cursor=row.sequence;this.snapshot.controller.inbound=null;
      await this.persist();
    }
    return this.status();
  });}
  registrationRequest(){const d=this.snapshot.descriptor;return {owner:this.scopeObject.wallet,contract:this.scopeObject.contract,intentId:random(16),kind:'execute',
    msg:{register:{expected_previous_generation:0,device_id:d.device_id,protocol_version:1,fingerprint:d.fingerprint,prekeys:d.prekeys}},memo:'RELAY register · juno-1'};}
  async reviewRegistration(){return this.run(async()=>{this.ensureIdle();await this.assertWritable();if(this.snapshot.controller.registered)throw Error('Already registered');await this.sync();return this.registrationRequest();});}
  async submitRegistration(request){return this.run(async()=>{
    this.ensureIdle();await this.assertWritable();if(this.snapshot.controller.registered)throw Error('Already registered');
    const expected=this.registrationRequest();expected.intentId=request.intentId;if(!same(expected,request))throw Error('Registration review changed');
    this.snapshot.registrationIntent={request:clone(request),status:'pending'};await this.persist();
    try{await this.bridge.execute(request);return await this.reconcileRegistration();}finally{await this.persist();}
  });}
  async reconcileRegistration(){
    const saved=this.snapshot.registrationIntent;if(!saved||saved.status!=='pending')return saved;
    const receipt=await this.bridge.recover(saved.request);
    if(receipt.intentMatched!==true)throw Error('Registration evidence unavailable');
    if(receipt.notBroadcast)saved.status='not_broadcast';
    else if(Number.isInteger(receipt.code)&&receipt.code>0&&receipt.chainId==='juno-1'&&/^[A-F0-9]{64}$/.test(receipt.transactionHash||'')&&Number.isSafeInteger(receipt.height)&&receipt.height>0)saved.status='failed';
    else if(receipt.code===0&&receipt.chainId==='juno-1'&&/^[A-F0-9]{64}$/.test(receipt.transactionHash||'')&&Number.isSafeInteger(receipt.height)&&receipt.height>0){
      const actual=await this.adapter.device();if(!actual?.active||!same(identity(actual),identity(this.snapshot.descriptor)))throw Error('Registered personal identity mismatch');
      this.snapshot.controller.registered=true;saved.status='confirmed';
    }else throw Error('Registration outcome remains unknown');
    saved.receipt=receipt;await this.persist();return clone(saved);
  }
  async reviewContact(kind,contact,allowed){return this.run(async()=>{this.ensureIdle();await this.assertWritable();await this.sync();return this.lifecycle.review(kind,{address:contact,allowed});});}
  async prepareRefill(){return this.run(async()=>{
    this.ensureIdle();await this.assertWritable();await this.sync();const own=await this.assertOwn();
    if(this.snapshot.controller.prepared)throw Error('Prepared lifecycle action already exists');
    const count=Math.min(8,16-own.prekeys.length);if(count<1)throw Error('Prekey pool is full');
    const start=Math.max(own.max_prekey_id,this.snapshot.descriptor.max_prekey_id)+1;if(start+count-1>65535)throw Error('Prekey IDs exhausted; rotate device');
    // A interrupted prekey generation is rolled back from the canonical snapshot.
    await this.openCrypto();const prekeys=[];for(let id=start;id<start+count;id++)prekeys.push({id,bundle:b64(await this.transaction(ctx=>ctx.proteusNewPrekey(id)))});
    this.snapshot.descriptor.max_prekey_id=start+count-1;
    const before={...identity(own),active:own.active},input={prekeys};this.snapshot.controller.prepared={kind:'refill',before,input};await this.persist();
    return this.lifecycle.review('refill',input);
  });}
  async prepareRotation(){return this.run(async()=>{
    this.ensureIdle();await this.assertWritable({rotation:true});if(this.snapshot.controller.prepared)throw Error('Prepared lifecycle action already exists');
    const own=await this.assertOwn();if(!own)throw Error('Register first');
    // A restored profile may only write after an explicit new device generation.
    // The chain registration is the cross-profile fence; existing journals must
    // be reconciled first and all old keys/history stay in the encrypted bundle.
    const current=clone(this.snapshot);const next=await this.newDevice(own.generation+1);
    const input={device_id:next.descriptor.device_id,protocol_version:1,fingerprint:next.descriptor.fingerprint,prekeys:next.descriptor.prekeys};
    this.snapshot=current;this.snapshot.controller.prepared={kind:'rotate',before:{...identity(own),active:own.active},input,next};
    await this.persist({upload:!this.snapshot.controller.readOnly});return this.lifecycle.review('rotate',input);
  });}
  async reviewPrepared(){return this.run(async()=>{this.ensureIdle();const p=this.snapshot.controller.prepared;if(!p)throw Error('No prepared lifecycle action');await this.assertWritable({rotation:p.kind==='rotate'});return this.lifecycle.review(p.kind,p.input);});}
  async submitLifecycle(review){return this.run(async()=>{
    this.ensureIdle();const rotating=review.kind==='rotate';await this.assertWritable({rotation:rotating});
    // A restored reader adopts remote write authority only for a new-key rotation.
    // Recheck the exact base revision first; a newer writer prevents takeover.
    if(rotating&&this.snapshot.controller.readOnly){
      const remote=await this.backup.latest({minimumRevision:this.record.remote.revision});if(remote?.revision!==this.record.remote.revision||remote.digest!==this.record.remote.digest)throw Error('Backup advanced; restore its latest state before rotation');
      this.snapshot.controller.readOnly=false;this.snapshot.controller.rotationRecovery=true;this.setupAdapters();
    }
    this.rotating=rotating;
    try{await this.persist();const result=await this.lifecycle.submit(review);await this.activatePrepared();return result;}
    finally{this.rotating=false;await this.persist();}
  });}
  async activatePrepared(){
    const prepared=this.snapshot.controller.prepared,row=this.lifecycle.load();
    if(!prepared||row?.status!=='confirmed'||row.review.kind!==prepared.kind||!same(row.review.input,prepared.input))return;
    if(prepared.kind==='rotate'){
      const actual=await this.adapter.device();if(!actual?.active||!same(identity(actual),identity(prepared.next.descriptor)))throw Error('Rotation not confirmed for prepared keys');
      const restoredReader=this.snapshot.controller.readOnly&&!this.snapshot.controller.rotationRecovery;
      const old={path:this.snapshot.path,blocks:clone(this.snapshot.blocks),wrappedKey:this.snapshot.wrappedKey,descriptor:clone(this.snapshot.descriptor)};
      this.snapshot.controller.retired.push(old);Object.assign(this.snapshot,clone(prepared.next));await this.restoreWorking();
      this.snapshot.controller.readOnly=restoredReader;this.snapshot.controller.rotationRecovery=false;
    }
    this.snapshot.controller.prepared=null;await this.persist();
  }
}
