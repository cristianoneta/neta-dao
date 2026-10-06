// SPDX-License-Identifier: GPL-3.0-only
// Reviewed consent/block/prekey/rotation actions. Uses the existing exact-byte
// signing bridge; crypto preparation stays durable until its receipt is proven.
const address = v => /^juno1[023456789acdefghjklmnpqrstuvwxyz]{38,90}$/.test(v || '');
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
function identity(d) {
  if (!d || !Number.isSafeInteger(d.generation) || d.generation < 1 || !/^[a-f0-9]{64}$/.test(d.fingerprint) ||
      !/^[A-Za-z0-9-]{1,64}$/.test(d.device_id) || d.protocol_version !== 1) throw Error('Invalid device identity');
  return {generation:d.generation,fingerprint:d.fingerprint,device_id:d.device_id,protocol_version:d.protocol_version,active:d.active};
}
function keys(prekeys) {
  if (!Array.isArray(prekeys) || !prekeys.length || prekeys.length>16) throw Error('Invalid prekey batch');
  const seen=new Set();
  for(const p of prekeys){
    if(!Number.isInteger(p.id)||p.id<0||p.id>65535||seen.has(p.id)||typeof p.bundle!=='string'||p.bundle.length>1370)throw Error('Invalid prekey');
    let bytes;try{bytes=atob(p.bundle);}catch{throw Error('Invalid prekey');}
    if(bytes.length<32||bytes.length>1024||btoa(bytes)!==p.bundle)throw Error('Invalid prekey');seen.add(p.id);
  }
}
export class PersonalMailboxLifecycle {
  constructor({adapter, bridge, storage=globalThis.localStorage, locks=globalThis.navigator?.locks, prepared}) {
    if(!adapter?.profile||!bridge?.execute||!bridge?.recover||!storage?.getItem||!locks?.request||typeof prepared!=='function')throw Error('Lifecycle dependencies required');
    Object.assign(this,{adapter,bridge,storage,locks,prepared});
  }
  key(){const p=this.adapter.profile;return ['relay-personal-lifecycle-v1',p.chain,p.contract,this.adapter.address].join(':');}
  load(){const raw=this.storage.getItem(this.key());if(raw===null)return null;const row=JSON.parse(raw);
    if(row.version!==1||!['pending','confirmed','not_broadcast','failed'].includes(row.status)||row.review?.request?.owner!==this.adapter.address||row.review.request.contract!==this.adapter.profile.contract||row.review.chain!==this.adapter.profile.chain)throw Error('Invalid lifecycle journal');return row;}
  save(row){const raw=JSON.stringify(row);this.storage.setItem(this.key(),raw);if(this.storage.getItem(this.key())!==raw)throw Error('Lifecycle journal not durable');}
  exclusive(fn){return this.locks.request(this.key(),{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw Error('Lifecycle action in another tab');return fn();});}
  async review(kind,input={}) {
    await this.adapter.assertWallet();await this.adapter.verify();
    if(this.load()?.status==='pending')throw Error('Unresolved lifecycle action; reconcile first');
    const own=await this.adapter.device(),before=identity(own);
    if(!own.active)throw Error('Device inactive');
    let msg,remote=null;
    if(kind==='consent'||kind==='block'){
      if(!address(input.address)||input.address===this.adapter.address||typeof input.allowed!=='boolean')throw Error('Invalid contact action');
      if(kind==='consent'){
        remote=identity(await this.adapter.device(input.address));if(!remote.active)throw Error('Contact inactive');
        msg={allow_sender:{address:input.address,recipient_generation:own.generation,sender_generation:remote.generation,allowed:input.allowed}};
      }else msg={set_block:{address:input.address,blocked:input.allowed}};
    }else if(kind==='refill'){
      keys(input.prekeys);
      if(!Number.isInteger(own.max_prekey_id)||input.prekeys.some(p=>p.id<=own.max_prekey_id)||own.prekeys.length+input.prekeys.length>16)throw Error('Prekey batch is stale or exceeds capacity');
      msg={add_prekeys:{generation:own.generation,prekeys:input.prekeys}};
    }else if(kind==='rotate'){
      keys(input.prekeys);
      identity({...input,generation:own.generation+1,active:true});
      if(input.fingerprint===own.fingerprint||input.device_id===own.device_id)throw Error('Rotation requires a separately prepared new device');
      msg={register:{device_id:input.device_id,protocol_version:input.protocol_version,fingerprint:input.fingerprint,prekeys:input.prekeys}};
    }else throw Error('Unsupported lifecycle action');
    if(['refill','rotate'].includes(kind)&&await this.prepared(kind,input,before)!==true)throw Error('Crypto preparation is not durably saved');
    await this.adapter.assertWallet();
    return structuredClone({kind,input,before,remote,chain:this.adapter.profile.chain,request:{owner:this.adapter.address,
      contract:this.adapter.profile.contract,intentId:random(),kind:'execute',msg,memo:'RELAY '+kind+' · '+this.adapter.profile.chain}});
  }
  submit(review){return this.exclusive(async()=>{
    const fresh=await this.review(review.kind,review.input);fresh.request.intentId=review.request.intentId;
    if(!same(fresh,review))throw Error('Device or reviewed action changed');
    const previous=this.load();
    this.save({version:1,status:'pending',review,history:[...(previous?.history||[]),...(previous?[{status:previous.status,review:previous.review,receipt:previous.receipt}]:[])]});
    await this.bridge.execute(review.request,{beforeSign:async()=>{
      await this.adapter.assertWallet();await this.adapter.verify();
      if(!same(identity(await this.adapter.device()),review.before))throw Error('Own device changed');
      if(review.remote&&!same(identity(await this.adapter.device(review.input.address)),review.remote))throw Error('Contact changed');
      if(['rotate','refill'].includes(review.kind)&&await this.prepared(review.kind,review.input,review.before)!==true)throw Error('Prepared crypto changed');
    }});
    return this._recover();
  });}
  recover(){return this.exclusive(()=>this._recover());}
  async _recover(){
    await this.adapter.assertWallet();await this.adapter.verify();
    const row=this.load();if(!row)throw Error('No lifecycle intent');if(row.status!=='pending')return row;
    const receipt=await this.bridge.recover(row.review.request);
    if(receipt?.intentMatched!==true)throw Error('Unverified lifecycle receipt');
    let status;
    if(receipt.notBroadcast===true)status='not_broadcast';
    else{
      if(receipt.chainId!==this.adapter.profile.chain||!/^[A-F0-9]{64}$/.test(receipt.transactionHash||'')||!Number.isSafeInteger(receipt.height)||receipt.height<1||!Number.isInteger(receipt.code)||receipt.code<0)throw Error('Unknown lifecycle transaction');
      status=receipt.code===0?'confirmed':'failed';
    }
    const result={...row,status,receipt};this.save(result);return result;
  }
}
// Both participants derive the same session namespace for a generation pair.
// Old generations remain readable without replacing the new generation's ratchet.
export function personalSessionId(scope,own,remote){
  if(!['juno-1','uni-7'].includes(scope?.chain)||!address(scope.contract)||!address(own?.address)||!address(remote?.address)||own.address===remote.address)throw Error('Invalid session scope');
  const participants=[own,remote].map(p=>{identity(p);return [p.address,p.generation,p.fingerprint];}).sort((a,b)=>a[0].localeCompare(b[0]));
  return JSON.stringify(['neta-personal-v1',scope.chain,scope.contract,participants]);
}
