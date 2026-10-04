import {NAMES_V2_DEPLOYMENT,commitmentHash,validateQuote,paymentMessage,renewalExpiry} from './names-v2-core.mjs';
import {normalizeName} from './names-profile-core.mjs';

// Transaction coordination only. The host supplies a pinned, verified reader,
// the existing journaled exact-hash signer, and an origin-wide Web Lock.
// No production instance is created while NAMES_V2_DEPLOYMENT is null.
export class NamesV2Client {
  constructor({deployment=NAMES_V2_DEPLOYMENT, reader, storage, walletAddress, execute, withLock, now=()=>Math.floor(Date.now()/1000), cryptoProvider=globalThis.crypto}) {
    if(!deployment || deployment.chain_id!=='uni-7') throw Error('UNI-7 Names deployment has not been verified.');
    if(typeof reader?.verify!=='function'||typeof withLock!=='function'||typeof execute!=='function') throw Error('Verified reader, transaction journal and cross-tab lock are required.');
    this.deployment=structuredClone(deployment);this.reader=reader;this.storage=storage;this.walletAddress=walletAddress;
    this.execute=execute;this.withLock=withLock;this.now=now;this.crypto=cryptoProvider;
  }
  key(owner) { return `neta-nns-v2-intent:${this.deployment.chain_id}:${this.deployment.registry}:${owner}`; }
  load(owner) {
    const raw=this.storage.getItem(this.key(owner));if(raw===null)return null;
    let intent;try{intent=JSON.parse(raw);}catch{throw Error('Unreadable Names intent; preserve it for recovery.');}
    if(intent?.schema!==1||intent.owner!==owner||intent.chain_id!==this.deployment.chain_id||intent.registry!==this.deployment.registry
      ||!['prepared','commit_pending','committed','payment_pending','complete','write_pending'].includes(intent.phase)) throw Error('Unknown Names intent; preserve it for recovery.');
    return intent;
  }
  save(intent) { this.storage.setItem(this.key(intent.owner),JSON.stringify(intent)); }
  async owner(expected) {
    if(await this.walletAddress()!==expected) throw Error('Wallet changed. Reconnect the original name owner.');
  }
  async config(owner) {
    await this.owner(owner);
    const config=await this.reader.verify(this.deployment);
    if(config?.chain_id!==this.deployment.chain_id || config.token!==this.deployment.token || config.treasury!==this.deployment.treasury || config.testnet_only!==true) throw Error('Names deployment identity mismatch.');
    await this.owner(owner);return config;
  }
  async prepareRegistration({owner,name,years}) {
    return this.withLock(this.key(owner),async()=>{
      if((await this.config(owner)).purchases_paused!==false) throw Error('Name purchases are paused.');
      const existing=this.load(owner);
      if(existing && existing.phase!=='complete') throw Error('Finish or reconcile the existing Names intent first.');
      name=normalizeName(name);
      if(!Number.isInteger(years)||years<1||years>5) throw Error('Choose one to five years.');
      const resolved=await this.reader.resolve(name);
      if(resolved?.name!==name||resolved.available!==true||!Number.isSafeInteger(resolved.next_generation)||resolved.next_generation<1) throw Error('Name unavailable or lookup incomplete.');
      const owned=await this.reader.nameOf(owner);
      if(owned?.address!==owner||owned.name!==null) throw Error('Name ownership lookup failed or this wallet already has a name.');
      const salt=[...this.crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
      const hash=await commitmentHash(this.deployment,owner,name,salt,this.crypto);
      await this.owner(owner);
      const intent={schema:1,chain_id:this.deployment.chain_id,registry:this.deployment.registry,owner,name,years,generation:resolved.next_generation,
        salt,hash,phase:'prepared',created_at:this.now()};
      this.save(intent); // Must succeed before any wallet prompt.
      return structuredClone(intent);
    });
  }
  async checkedIntent(owner,phase) {
    const i=this.load(owner);
    if(!i||i.phase!==phase||normalizeName(i.name)!==i.name||await commitmentHash(this.deployment,owner,i.name,i.salt,this.crypto)!==i.hash) throw Error('Registration intent changed or requires reconciliation.');
    return i;
  }
  async commit(owner) {
    return this.withLock(this.key(owner),async()=>{
      if((await this.config(owner)).purchases_paused!==false) throw Error('Name purchases are paused.');
      const i=await this.checkedIntent(owner,'prepared');
      await this.owner(owner);
      i.phase='commit_pending';this.save(i);
      // Pending is kept on rejection, timeout or reload. No automatic retry.
      // The public memo must not reveal the name before the reveal transaction.
      const receipt=await this.execute({owner,contract:this.deployment.registry,msg:{commit:{hash:i.hash}},memo:'Commit NETA name'});
      this.receipt(receipt);
      i.commit_hash=receipt.transactionHash;this.save(i);
      const onchain=await this.reader.commitment(owner);
      if(onchain?.hash!==i.hash) throw Error('Commit receipt found but state is not yet confirmed. Reconcile.');
      i.phase='committed';this.save(i);return structuredClone(i);
    });
  }
  expectedRegistration(i) {
    return {operation:'register',payer:i.owner,owner:i.owner,name:i.name,generation:i.generation,ownership_revision:1,expected_expires_at:0,years:i.years};
  }
  async registrationQuote(owner,getQuote) {
    const config=await this.config(owner),i=await this.checkedIntent(owner,'committed');
    const expected=this.expectedRegistration(i);
    const offer=await getQuote(expected);
    await validateQuote({deployment:this.deployment,config,offer,expected,now:this.now(),cryptoProvider:this.crypto});
    await this.owner(owner);return structuredClone(offer);
  }
  async register(owner,reviewedOffer) {
    // Caller explicitly presents the exact debit and receives a separate click
    // for this method. An expired offer is never silently replaced here.
    return this.withLock(this.key(owner),async()=>{
      const offer=structuredClone(reviewedOffer);
      const config=await this.config(owner),i=await this.checkedIntent(owner,'committed');
      const resolved=await this.reader.resolve(i.name);
      if(resolved?.available!==true||resolved.next_generation!==i.generation||resolved.name!==i.name) throw Error('Name state changed. Review again.');
      await validateQuote({deployment:this.deployment,config,offer,expected:this.expectedRegistration(i),now:this.now(),cryptoProvider:this.crypto});
      await this.owner(owner);
      const payment=paymentMessage(this.deployment,config,offer,i.salt);
      i.phase='payment_pending';i.offer=offer;this.save(i);
      const receipt=await this.execute({owner,...payment,memo:`Register ${i.name} · ${i.years} year(s)`});
      this.receipt(receipt);i.payment_hash=receipt.transactionHash;this.save(i);
      const record=await this.reader.identity(i.name);
      if(record?.owner!==owner||record.name!==i.name||record.generation!==i.generation||record.ownership_revision!==1||record.expires_at<=this.now()) throw Error('Payment receipt found; reconcile the name state.');
      i.phase='complete';delete i.salt;delete i.offer;this.save(i);return record;
    });
  }
  receipt(r) {
    if(!r || !/^[A-F0-9]{64}$/.test(r.transactionHash)||r.code!==0||!Number.isSafeInteger(r.height)||r.height<=0||r.chainId!==this.deployment.chain_id) throw Error('Exact included transaction receipt is required. Keep the pending intent.');
  }
  async reconcile(owner,hash,lookupReceipt) {
    return this.withLock(this.key(owner),async()=>{
      await this.config(owner);const i=this.load(owner);
      if(!i || !['commit_pending','payment_pending','write_pending'].includes(i.phase)) throw Error('No pending Names transaction to reconcile.');
      if(!/^[A-F0-9]{64}$/.test(hash)) throw Error('Enter the exact transaction hash.');
      // Receipt adapter MUST verify signed bytes/message/sender against this
      // intent, not merely locate any successful transaction with this hash.
      const receipt=await lookupReceipt(hash,structuredClone(i));this.receipt(receipt);
      if(receipt.transactionHash!==hash||receipt.intentMatched!==true) throw Error('Receipt does not prove this exact Names intent.');
      if(i.phase==='commit_pending') {
        if((await this.reader.commitment(owner))?.hash!==i.hash) throw Error('Expected commitment not found.');
        i.commit_hash=hash;i.phase='committed';
      } else {
        // exact intent-matching receipt is authoritative even when a subsequent
        // valid transfer/update changed current state after this transaction.
        i.payment_hash=hash;i.phase='complete';delete i.salt;delete i.offer;
      }
      this.save(i);return structuredClone(i);
    });
  }
  async renew({payer,name,years,reviewedOffer}) {
    return this.withLock(this.key(payer),async()=>{
      const config=await this.config(payer),pending=this.load(payer);
      if(pending && pending.phase!=='complete') throw Error('Reconcile the pending Names transaction first.');
      name=normalizeName(name);const record=await this.reader.identity(name);
      renewalExpiry(record,years,this.now());
      const expected={operation:'renew',payer,owner:record.owner,name,generation:record.generation,ownership_revision:record.ownership_revision,expected_expires_at:record.expires_at,years};
      const offer=structuredClone(reviewedOffer);
      await validateQuote({deployment:this.deployment,config,offer,expected,now:this.now(),cryptoProvider:this.crypto});
      await this.owner(payer);
      const payment=paymentMessage(this.deployment,config,offer);
      const i={schema:1,chain_id:this.deployment.chain_id,registry:this.deployment.registry,owner:payer,name,phase:'write_pending',action:'renew',offer,payment,created_at:this.now()};
      this.save(i);
      const receipt=await this.execute({owner:payer,...payment,memo:`Renew ${name} · ${years} year(s)`});this.receipt(receipt);
      i.payment_hash=receipt.transactionHash;i.phase='complete';delete i.offer;this.save(i);return receipt;
    });
  }
  async transfer({owner,name,action,recipient,expiresAt,offerId}) {
    return this.withLock(this.key(owner),async()=>{
      await this.config(owner);
      const pending=this.load(owner);
      if(pending && pending.phase!=='complete') throw Error('Reconcile the pending Names transaction first.');
      name=normalizeName(name);
      const record=await this.reader.identity(name);
      if(record?.name!==name || record.expires_at<=this.now()) throw Error('An active name is required.');
      let msg;
      if(action==='offer') {
        if(record.owner!==owner || !recipient || recipient===owner || !Number.isSafeInteger(expiresAt) || expiresAt<=this.now() || expiresAt>record.expires_at || expiresAt>this.now()+7*86400) throw Error('Invalid transfer owner, recipient or expiry.');
        msg={offer_transfer:{name,recipient,expires_at:expiresAt,expected_generation:record.generation,expected_ownership_revision:record.ownership_revision}};
      } else if(action==='accept'||action==='cancel') {
        const offer=await this.reader.transferOffer(name);
        if(!offer || offer.id!==offerId || offer.expires_at<=this.now() || offer.generation!==record.generation || offer.ownership_revision!==record.ownership_revision || offer.owner!==record.owner) throw Error('Transfer offer changed or expired.');
        if(action==='accept') {
          if(offer.recipient!==owner) throw Error('Only the offered recipient can accept.');
          const owned=await this.reader.nameOf(owner);
          if(owned?.address!==owner||owned.name!==null) throw Error('Recipient already has a name or ownership is unknown.');
          msg={accept_transfer:{name,offer_id:offerId}};
        } else {
          if(record.owner!==owner) throw Error('Only the current owner can cancel.');
          msg={cancel_transfer:{name,offer_id:offerId}};
        }
      } else throw Error('Unknown transfer action.');
      await this.owner(owner);
      const payment={contract:this.deployment.registry,msg};
      const i={schema:1,chain_id:this.deployment.chain_id,registry:this.deployment.registry,owner,name,phase:'write_pending',action:`transfer-${action}`,payment,created_at:this.now()};
      this.save(i);
      const receipt=await this.execute({owner,...payment,memo:`${action} name transfer · ${name}`});this.receipt(receipt);
      i.payment_hash=receipt.transactionHash;i.phase='complete';this.save(i);return receipt;
    });
  }
}
