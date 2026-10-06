// Read/prepare adapter for a separately deployed UNI-7 mailbox v0.3 candidate.
// No mainnet address, deployment pin or signer is inferred automatically.
const ADDRESS=/^juno1[0-9a-z]{38,90}$/;
const HEX=/^[0-9a-f]{64}$/;
const RESTS=['https://juno.test.api.nodeshub.online','https://juno.api.t.stavr.tech'];
export class DaoInboxClient {
  constructor({deployment,account,execute,readable,fetch:fetcher=globalThis.fetch}) {
    if(deployment?.chain_id!=='uni-7'||!ADDRESS.test(deployment.contract)||!ADDRESS.test(deployment.registry)||!ADDRESS.test(deployment.creator)||!HEX.test(deployment.code_hash)||typeof account!=='function')throw Error('Verified UNI-7 DAO deployment required');
    Object.assign(this,{deployment:Object.freeze({...deployment}),account,execute,decode:readable,fetch:fetcher});
  }
  async get(base,path){const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);try{const response=await this.fetch(base+path,{signal:ctrl.signal,cache:'no-store'});if(!response.ok)throw Error('DAO source unavailable');return await response.json();}finally{clearTimeout(timer);}}
  async verify(){
    const d=this.deployment;this.base=null;
    for(const base of RESTS){try{
      const network=await this.get(base,'/cosmos/base/tendermint/v1beta1/node_info');
      if(network.default_node_info?.network!==d.chain_id)throw Error('DAO identity mismatch');
      const info=(await this.get(base,'/cosmwasm/wasm/v1/contract/'+d.contract)).contract_info;
      if(info?.creator!==d.creator||!/^\d+$/.test(String(info.code_id)))throw Error('DAO identity mismatch');
      const hash=(await this.get(base,'/cosmwasm/wasm/v1/code/'+info.code_id)).code_info?.data_hash;
      const hex=/^[a-f0-9]{64}$/i.test(hash||'')?hash.toLowerCase():Array.from(Uint8Array.from(atob(hash||''),c=>c.charCodeAt(0)),n=>n.toString(16).padStart(2,'0')).join('');
      if(hex!==d.code_hash)throw Error('DAO identity mismatch');
      this.base=base;
      if(await this.raw({dao:{registry:{}}})!==d.registry)throw Error('DAO registry mismatch');
      return true;
    }catch(error){this.base=null;if(/mismatch/.test(error.message))throw error;}}
    throw Error('DAO deployment verification unavailable');
  }
  async raw(query){if(!this.base)throw Error('DAO deployment unverified');const encoded=encodeURIComponent(btoa(JSON.stringify(query)));return(await this.get(this.base,'/cosmwasm/wasm/v1/contract/'+this.deployment.contract+'/smart/'+encoded)).data;}
  async query(query){await this.verify();return this.raw(query);}
  async list(wallet){
    if(!ADDRESS.test(wallet)||this.account()!==wallet)throw Error('Wallet changed');await this.verify();
    const result=[],seen=new Set();let after=null;
    for(let i=0;i<100;i++){
      const page=await this.raw({dao:{mailboxes:{address:wallet,after,limit:20}}});
      if(this.account()!==wallet)throw Error('Wallet changed');
      if(!Array.isArray(page?.items))throw Error('Invalid DAO mailbox list');
      for(const item of page.items){if(!item.enabled||!item.name?.endsWith('.dao.neta')||seen.has(item.name))throw Error('Invalid DAO mailbox identity');seen.add(item.name);result.push(item);}
      if(page.next===null)return result;
      if(typeof page.next!=='string'||(after!==null&&page.next<=after))throw Error('Invalid DAO pagination');after=page.next;
    }
    throw Error('DAO list too large; do not use an incomplete access list');
  }
  async access(name){const wallet=this.account();const box=(await this.list(wallet)).find(b=>b.name===name);if(!box)throw Error('DAO inbox access ended');return {wallet,box};}
  async page(name,after=null){
    const {wallet}=await this.access(name);const rows=await this.raw({dao:{inbox:{name,after,limit:50}}});
    if(this.account()!==wallet||!Array.isArray(rows))throw Error('DAO history unavailable');
    let previous=after||0;for(const row of rows){if(row.name!==name||!Number.isSafeInteger(row.sequence)||row.sequence<=previous)throw Error('Invalid DAO history');previous=row.sequence;}
    return {items:rows,next:rows.length===50?previous:null};
  }
  async thread(name,address){
    const {wallet,box}=await this.access(name);
    const state=await this.raw({dao:{thread:{name,correspondent:address}}});
    const blocked=await this.raw({dao:{blocked:{name,address}}});
    if(this.account()!==wallet||!state)throw Error('DAO conversation unavailable');
    return {...state,blocked,canBlock:box.authority===wallet||box.managers.includes(wallet)};
  }
  async readable(record,wallet){
    if(this.account()!==wallet)throw Error('Wallet changed');
    // Never show arbitrary chain fields as plaintext. Only an unlocked,
    // recovery-aware archive adapter may provide authenticated readable text.
    if(typeof this.decode!=='function')return null;
    const result=await this.decode(record,wallet);
    if(this.account()!==wallet)throw Error('Wallet changed');
    return typeof result==='string'?result:null;
  }
  async blockDraft(name,address,blocked){
    const {wallet,box}=await this.access(name);
    if(box.authority!==wallet&&!box.managers.includes(wallet))throw Error('DAO inbox manager required');
    return this.review(wallet,{dao:{set_block:{name,address,blocked,expected_revision:box.revision}}});
  }
  async assignDraft(name,correspondent,expected_revision,take){
    const {wallet}=await this.access(name);const state=await this.thread(name,correspondent);
    if(state.revision!==expected_revision)throw Error('Conversation changed');
    return this.review(wallet,{dao:{assign:{name,correspondent,expected_revision,take}}});
  }
  review(wallet,message){return Object.freeze({chain:'uni-7',contract:this.deployment.contract,wallet,message:JSON.parse(JSON.stringify(message))});}
  async submit(review){
    if(review.chain!=='uni-7'||review.contract!==this.deployment.contract||review.wallet!==this.account()||typeof this.execute!=='function')throw Error('Signing unavailable or wallet changed');
    const block=review.message?.dao?.set_block,assign=review.message?.dao?.assign;
    let fresh;
    if(block)fresh=await this.blockDraft(block.name,block.address,block.blocked);
    else if(assign)fresh=await this.assignDraft(assign.name,assign.correspondent,assign.expected_revision,assign.take);
    else throw Error('Unsupported reviewed DAO action');
    if(JSON.stringify(fresh)!==JSON.stringify(review))throw Error('DAO review changed');
    if(this.account()!==review.wallet)throw Error('Wallet changed');
    // Existing shared executor MUST preserve signed-byte journals and ambiguous
    // broadcast outcomes. A UI confirmation never bypasses Keplr signing.
    return this.execute(review.wallet,review.contract,review.message,'RELAY DAO inbox · UNI-7');
  }
}
