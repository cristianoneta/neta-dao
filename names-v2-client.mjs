import {checkValidatorSnapshot,validateOperatorProof,samePair} from './names-v2-validator-proofs.mjs?v=1';
import {NAMES_V2_DEPLOYMENT,commitmentHash,validateQuote,paymentMessage,renewalExpiry} from './names-v2-core.mjs';
import {normalizeName,normalizeContacts} from './names-profile-core.mjs';
import {fetchSnapshotOffer} from './names/snapshot-client.mjs';

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
  save(intent) {
    const raw=JSON.stringify(intent);this.storage.setItem(this.key(intent.owner),raw);
    if(this.storage.getItem(this.key(intent.owner))!==raw)throw Error('Names intent storage could not be verified.');
  }
  stage(i,request,previousPhase) {
    i.previous_phase=previousPhase;
    const id=[...this.crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('');
    i.request={...request,intentId:id};this.save(i);return structuredClone(i.request);
  }
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
      i.phase='commit_pending';
      // Pending is kept on rejection, timeout or reload. No automatic retry.
      // The public memo must not reveal the name before the reveal transaction.
      const request=this.stage(i,{owner,contract:this.deployment.registry,msg:{commit:{hash:i.hash}},memo:'Commit NETA name'},'prepared');
      const receipt=await this.execute(request);
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
  async snapshotQuote({payer,name,years,operation,fetcher=globalThis.fetch}) {
    const config=await this.config(payer);
    let expected;
    if(operation==='register') {
      const i=await this.checkedIntent(payer,'committed');
      if(normalizeName(name)!==i.name || years!==i.years) throw Error('Registration intent changed.');
      expected=this.expectedRegistration(i);
    } else if(operation==='renew') {
      name=normalizeName(name);
      const r=await this.reader.identity(name);renewalExpiry(r,years,this.now());
      expected={operation,payer,owner:r.owner,name,generation:r.generation,ownership_revision:r.ownership_revision,expected_expires_at:r.expires_at,years};
    } else throw Error('Unknown purchase operation.');
    const offer=await fetchSnapshotOffer({deployment:this.deployment,config,expected,fetcher,now:this.now(),cryptoProvider:this.crypto});
    await this.owner(payer);
    return offer; // Host must show snapshotReview plus identity/network before register/renew.
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
      i.phase='payment_pending';i.offer=offer;
      const request=this.stage(i,{owner,...payment,memo:`Register ${i.name} · ${i.years} year(s)`},'committed');
      const receipt=await this.execute(request);
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
      const request=this.stage(i,{owner:payer,...payment,memo:`Renew ${name} · ${years} year(s)`},'complete');
      const receipt=await this.execute(request);this.receipt(receipt);
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
      const request=this.stage(i,{owner,...payment,memo:`${action} name transfer · ${name}`},'complete');
      const receipt=await this.execute(request);this.receipt(receipt);
      i.payment_hash=receipt.transactionHash;i.phase='complete';this.save(i);return receipt;
    });
  }

  async recoverPending(owner,recover,hash=null) {
    return this.withLock(this.key(owner),async()=>{
      await this.config(owner);const i=this.load(owner);
      if(!i?.request||!['commit_pending','payment_pending','write_pending'].includes(i.phase))throw Error('No recoverable Names attempt.');
      const result=await recover(structuredClone(i.request),hash);
      if(result?.intentMatched!==true)throw Error('Recovery did not prove this exact Names intent.');
      if(result.notBroadcast!==true){
        if(!Number.isInteger(result.code)||result.code<0)throw Error('Invalid recovery receipt.');
        this.receipt({...result,code:0});
      }
      const failed=result.notBroadcast===true||result.code!==0;
      if(failed){
        if(!['prepared','committed','complete'].includes(i.previous_phase))throw Error('Unknown prior intent phase.');
        i.phase=i.previous_phase;i.last_outcome=result.notBroadcast?'not_broadcast':'failed';
      }else if(i.phase==='commit_pending'){
        if((await this.reader.commitment(owner))?.hash!==i.hash)throw Error('Commit receipt is valid but commitment changed; preserve the intent.');
        i.phase='committed';i.commit_hash=result.transactionHash;
      }else{i.phase='complete';i.payment_hash=result.transactionHash;delete i.salt;delete i.offer;}
      i.history=[...(i.history||[]),{request:i.request,result}];delete i.request;
      this.save(i);return {intent:structuredClone(i),result};
    });
  }
  async cancelRegistration(owner) {
    return this.withLock(this.key(owner),async()=>{
      await this.config(owner);const i=this.load(owner);
      if(!i||!['prepared','committed'].includes(i.phase))throw Error('Reconcile the pending attempt before cancelling.');
      const commit=await this.reader.commitment(owner);
      if(i.phase==='prepared'&&commit?.hash!==i.hash){i.phase='complete';i.last_outcome='discarded';delete i.salt;this.save(i);return i;}
      if(commit?.hash!==i.hash)throw Error('Commitment changed. Preserve this intent for review.');
      const previous=i.phase;i.phase='write_pending';i.action='cancel-registration';
      const request=this.stage(i,{owner,contract:this.deployment.registry,msg:{cancel_commit:{hash:i.hash}},memo:'Cancel NETA name commitment'},previous);
      const receipt=await this.execute(request);this.receipt(receipt);
      i.phase='complete';i.payment_hash=receipt.transactionHash;delete i.salt;delete i.offer;this.save(i);return i;
    });
  }
  async setTariff({owner,tariff,expectedVersion}) {
    const reviewed=structuredClone(tariff);
    if(!reviewed||Object.keys(reviewed).sort().join(',')!=='four_cents,standard_cents,three_cents'||Object.values(reviewed).some(n=>!Number.isSafeInteger(n)||n<1)||!Number.isSafeInteger(expectedVersion)||expectedVersion<1)throw Error('Invalid reviewed tariff.');
    return this.withLock(this.key(owner),async()=>{
      const config=await this.config(owner),pending=this.load(owner);
      if(config.admin!==owner)throw Error('Only the registry admin can change the tariff.');
      if(config.tariff_version!==expectedVersion)throw Error('Tariff changed. Read and review it again.');
      if(pending&&pending.phase!=='complete')throw Error('Reconcile the pending Names transaction first.');
      if(Object.keys(reviewed).every(k=>reviewed[k]===config.tariff[k]))throw Error('This tariff is already active.');
      await this.owner(owner);
      const payment={contract:this.deployment.registry,msg:{set_tariff:{tariff:reviewed,expected_version:expectedVersion}}};
      const i={schema:1,chain_id:this.deployment.chain_id,registry:this.deployment.registry,owner,name:'Registry tariff',phase:'write_pending',action:'set-tariff',payment,created_at:this.now()};
      const request=this.stage(i,{owner,...payment,memo:'Update NNS annual tariff'},'complete');
      const receipt=await this.execute(request);this.receipt(receipt);
      i.phase='complete';i.payment_hash=receipt.transactionHash;this.save(i);return receipt;
    });
  }
  async validatorWrite({payer,prepared}) {
    return this.withLock(this.key(payer),async()=>{
      const {snapshot,proofs}=structuredClone(prepared);
      await this.config(payer);
      const pending=this.load(payer);
      if(pending&&pending.phase!=='complete')throw Error('Finish or reconcile the existing Names intent first.');
      const profile=await checkValidatorSnapshot(this.reader,snapshot,this.now());
      const name=profile.identity.name;let msg,action;
      if(snapshot.purpose==='link') {
        if(profile.identity.owner!==payer)throw Error('Reconnect the name owner before publishing the link.');
        msg={link_validators:{name,expected_revision:profile.revision,pair:snapshot.pair,expires_at:snapshot.expiresAt,
          mainnet_proof:validateOperatorProof(proofs.mainnet),testnet_proof:validateOperatorProof(proofs.testnet)}};
        action='link-validators';
      }else {
        if(!['mainnet','testnet'].includes(snapshot.role))throw Error('Choose the revoking operator.');
        msg={revoke_by_operator:{name,expected_revision:profile.revision,expires_at:snapshot.expiresAt,
          operator:snapshot.pair[snapshot.role],proof:validateOperatorProof(proofs[snapshot.role])}};
        action='revoke-validator-link';
      }
      await this.owner(payer);
      const payment={contract:this.deployment.profile_contract,msg};
      const i={schema:1,chain_id:this.deployment.chain_id,registry:this.deployment.registry,owner:payer,name,phase:'write_pending',action,payment,created_at:this.now()};
      const request=this.stage(i,{owner:payer,...payment,memo:`${action} · ${name}`},'complete');
      const receipt=await this.execute(request);this.receipt(receipt);
      i.phase='complete';i.payment_hash=receipt.transactionHash;this.save(i);return receipt;
    });
  }
  async unlinkValidators({owner,name,expectedRevision,expectedPair}) {
    return this.withLock(this.key(owner),async()=>{
      await this.config(owner);const pending=this.load(owner);
      if(pending&&pending.phase!=='complete')throw Error('Finish or reconcile the existing Names intent first.');
      name=normalizeName(name);const response=await this.reader.profile(name),profile=response?.profile;
      if(!response?.active||profile?.identity?.name!==name||profile.identity.owner!==owner||profile.identity.expires_at<=this.now()||profile.revision!==expectedRevision||!samePair(profile.validators,expectedPair))throw Error('Name owner or validator link changed. Review again.');
      await this.owner(owner);
      const payment={contract:this.deployment.profile_contract,msg:{unlink_validators:{name,expected_revision:expectedRevision}}};
      const i={schema:1,chain_id:this.deployment.chain_id,registry:this.deployment.registry,owner,name,phase:'write_pending',action:'unlink-validators',payment,created_at:this.now()};
      const request=this.stage(i,{owner,...payment,memo:`Unlink validators · ${name}`},'complete');
      const receipt=await this.execute(request);this.receipt(receipt);
      i.phase='complete';i.payment_hash=receipt.transactionHash;this.save(i);return receipt;
    });
  }
  async updateProfile({owner,name,contacts,expectedRevision}) {
    return this.withLock(this.key(owner),async()=>{
      await this.config(owner);const pending=this.load(owner);
      if(pending&&pending.phase!=='complete')throw Error('Finish or reconcile the existing Names intent first.');
      name=normalizeName(name);contacts=normalizeContacts(contacts);
      const read=await this.reader.profile(name),profile=read?.profile;
      if(!read?.active||profile?.identity?.owner!==owner||profile.identity.name!==name||profile.identity.expires_at<=this.now()||profile.revision!==expectedRevision)throw Error('Profile owner, expiry or revision changed. Review again.');
      const payment={contract:this.deployment.profile_contract,msg:{update_contacts:{name,expected_revision:expectedRevision,contacts}}};
      const i={schema:1,chain_id:this.deployment.chain_id,registry:this.deployment.registry,owner,name,phase:'write_pending',action:'update-profile',payment,created_at:this.now()};
      await this.owner(owner);
      const request=this.stage(i,{owner,...payment,memo:`Update public profile · ${name}`},'complete');
      const receipt=await this.execute(request);this.receipt(receipt);
      i.phase='complete';i.payment_hash=receipt.transactionHash;this.save(i);return receipt;
    });
  }
}
