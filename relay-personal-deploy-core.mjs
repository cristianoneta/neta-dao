// Owner-only preparation. This helper never changes production release pins.
import {PERSONAL_MAINNET_OWNER as OWNER,PERSONAL_MAINNET_WASM as HASH,PERSONAL_MAINNET_POLICY as POLICY,personalMainnetProfile} from './relay-personal-network.mjs';
import {namesNetwork} from './names/networks.mjs';
import {freshNamesBlock} from './names-v2-reader.mjs';
import {lookupTransaction} from './juno-faucet-transactions.mjs';
const NETWORK=namesNetwork('juno-1');
export const PERSONAL_DEPLOY_ARTIFACT='assets/relay-mainnet/neta_relay_mailbox_v04.wasm';
export const PERSONAL_DEPLOY_LABEL='NETA RELAY personal v0.4 · Juno mainnet';
const hex=b=>Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const codeHash=v=>/^[a-f0-9]{64}$/i.test(v||'')?v.toLowerCase():hex(Uint8Array.from(atob(v||''),c=>c.charCodeAt(0)));
const b64=b=>{let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s);};
function eventValue(receipt,type,key){
 const values=[];for(const e of receipt.events||[])if(e.type===type)for(const a of e.attributes||[]){if(a.key===key)values.push(a.value);else try{if(atob(a.key)===key)values.push(atob(a.value));}catch{}}
 const unique=[...new Set(values)];if(unique.length!==1)throw Error('Ambiguous deployment receipt; retain the pending transaction.');return unique[0];
}
export class PersonalMainnetSetup{
 constructor({owner,client,bundle,assertWallet,storage=globalThis.localStorage,locks=globalThis.navigator?.locks,fetcher=globalThis.fetch}){
  if(owner!==OWNER||!bundle?.createBridge||!locks?.request||!storage)throw Error('Approved owner wallet and durable setup dependencies required.');
  Object.assign(this,{owner,client,bundle,assertWallet,storage,locks,fetcher:(...args)=>fetcher(...args)});
  this.key='neta-relay-personal-mainnet-setup-v1:'+OWNER;
  this.bridge=bundle.createBridge({chainId:'juno-1',client,storage,locks,assertWallet,lookup:hash=>lookupTransaction(hash,fetcher,'juno-1'),verifyDeployment:()=>this.verifyPending()});
 }
 state(){
  const raw=this.storage.getItem(this.key);if(raw===null)return {version:1,owner:OWNER,hash:HASH,codeId:null,address:null,pending:null,history:[]};
  const s=JSON.parse(raw);if(s.version!==1||s.owner!==OWNER||s.hash!==HASH||!Array.isArray(s.history)||
   (s.codeId!==null&&(!Number.isSafeInteger(s.codeId)||s.codeId<1))||(s.address!==null&&(!s.codeId||!this.bundle.validAddress(s.address))))throw Error('Setup identity changed. Preserve the journal.');return s;
 }
 save(s){const raw=JSON.stringify(s);this.storage.setItem(this.key,raw);if(this.storage.getItem(this.key)!==raw)throw Error('Setup journal could not be verified.');}
 lock(fn){return this.locks.request(this.key,{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw Error('Another tab is using this setup.');return fn();});}
 async get(base,path){const r=await this.fetcher(base+path,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Mainnet query failed ('+r.status+').');return r.json();}
 async network(base){
  if((await this.get(base,'/cosmos/base/tendermint/v1beta1/node_info')).default_node_info?.network!=='juno-1')throw Error('NETWORK MISMATCH');
  const block=await this.get(base,'/cosmos/base/tendermint/v1beta1/blocks/latest');freshNamesBlock(block,'juno-1');return block.block.header;
 }
 async code(base,id){const info=(await this.get(base,'/cosmwasm/wasm/v1/code/'+id)).code_info;if(info?.creator!==OWNER||codeHash(info.data_hash)!==HASH)throw Error('Mailbox code identity mismatch.');}
 async verifyState(s=this.state()){
  const observations=[];
  for(const base of NETWORK.rests){
   const block=await this.network(base);if(s.codeId)await this.code(base,s.codeId);
   let policy=null;
   if(s.address){
    const c=(await this.get(base,'/cosmwasm/wasm/v1/contract/'+s.address)).contract_info;
    if(String(c?.code_id)!==String(s.codeId)||c.creator!==OWNER||c.admin!==OWNER||c.label!==PERSONAL_DEPLOY_LABEL)throw Error('Mailbox owner, admin or instance mismatch.');
    policy=(await this.get(base,'/cosmwasm/wasm/v1/contract/'+s.address+'/smart/'+btoa(JSON.stringify({config:{}})))).data;
    if(stable(policy)!==stable(POLICY))throw Error('Mailbox mainnet/NNS/DAO policy mismatch.');
   }
   observations.push({provider:base,height:block.height,time:block.time,policy});
  }
  return observations;
 }
 async artifact(){
  const r=await this.fetcher(PERSONAL_DEPLOY_ARTIFACT,{cache:'no-store'});if(!r.ok)throw Error('Reviewed mailbox WASM unavailable.');const bytes=new Uint8Array(await r.arrayBuffer());
  if(hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))!==HASH)throw Error('Mailbox WASM checksum mismatch.');return b64(bytes);
 }
 recipe(kind,s=this.state()){
  if(kind==='store'){if(s.codeId)throw Error('Mailbox code already uploaded.');return {owner:OWNER,kind,checksum:HASH,memo:'Upload NETA RELAY personal v0.4 on Juno mainnet'};}
  if(kind==='instantiate'){if(!s.codeId||s.address)throw Error('Upload once before creating one mailbox.');return {owner:OWNER,kind,codeId:s.codeId,migrationAdmin:OWNER,label:PERSONAL_DEPLOY_LABEL,msg:{mainnet:true},memo:'Instantiate NETA RELAY personal v0.4 on Juno mainnet'};}
  throw Error('Unknown mailbox deployment action.');
 }
 async prepare(kind){return this.lock(async()=>{await this.assertWallet(OWNER);const s=this.state();if(s.pending)throw Error('Reconcile the pending deployment first.');const request=this.recipe(kind,s);await this.artifact();await this.verifyState(s);await this.assertWallet(OWNER);return {kind,request};});}
 async verifyPending(){
  await this.assertWallet(OWNER);const s=this.state(),p=s.pending;if(!p)throw Error('No persisted deployment intent.');
  const request={...p.request};delete request.intentId;if(stable(request)!==stable(this.recipe(p.kind,s)))throw Error('Deployment request changed.');await this.verifyState(s);
 }
 async execute(review){return this.lock(async()=>{
  await this.assertWallet(OWNER);const s=this.state();if(s.pending)throw Error('Reconcile the pending deployment first.');
  const request=this.recipe(review.kind,s);if(stable(request)!==stable(review.request))throw Error('Deployment review changed.');
  const full={...request,intentId:hex(crypto.getRandomValues(new Uint8Array(16)))};
  if(full.kind==='store')full.wasm=await this.artifact();await this.verifyState(s);await this.assertWallet(OWNER);
  s.pending={kind:review.kind,request:{...full}};delete s.pending.request.wasm;this.save(s);
  return this.settle(await this.bridge.execute(full));
 });}
 async settle(receipt){
  const s=this.state(),p=s.pending;if(!p||receipt.intentMatched!==true)throw Error('Missing exact deployment receipt.');
  if(!receipt.notBroadcast&&(!/^[A-F0-9]{64}$/.test(receipt.transactionHash)||receipt.chainId!=='juno-1'||!Number.isInteger(receipt.code)||receipt.code<0))throw Error('Invalid deployment receipt.');
  if(!receipt.notBroadcast&&receipt.code===0){
   if(p.kind==='store'){const id=Number(eventValue(receipt,'store_code','code_id'));if(!Number.isSafeInteger(id)||id<1)throw Error('Invalid mailbox code ID.');s.codeId=id;}
   else {s.address=eventValue(receipt,'instantiate','_contract_address');if(!this.bundle.validAddress(s.address))throw Error('Invalid mailbox address.');}
   await this.verifyState(s);
  }
  s.history.push({request:p.request,receipt});s.pending=null;this.save(s);return receipt;
 }
 async recover(hash=null){return this.lock(async()=>{
  const p=this.state().pending;if(!p)throw Error('No pending deployment.');const full={...p.request};if(p.kind==='store')full.wasm=await this.artifact();
  return this.settle(await this.bridge.recover(full,hash));
 });}
 async exportBundle(){return this.lock(async()=>{
  const s=this.state();if(s.pending||!s.address)throw Error('Complete and reconcile the deployment first.');const observations=await this.verifyState(s);
  const deployment={chainId:'juno-1',contract:s.address,creator:OWNER,admin:OWNER,codeId:s.codeId,codeHash:HASH,label:PERSONAL_DEPLOY_LABEL};personalMainnetProfile(deployment);
  return {kind:'personal-mainnet-deployment-receipts',deployment,policy:POLICY,observations,history:s.history,activated:false};
 });}
}
export async function connectPersonalSetup({keplr=globalThis.keplr,bundle=globalThis.NetaNamesSigning,storage=globalThis.localStorage,locks=globalThis.navigator?.locks,fetcher=globalThis.fetch,assertCurrent=()=>{},onStatus=()=>{},connectionTimeoutMs=12000}={}){
 if(!keplr)throw Error('Keplr is not available in this browser. Open this page in a browser with Keplr enabled.');
 if(!bundle?.createBridge)throw Error('The signing tools have not loaded. Reload this page and try connecting again.');let active=true,client;
 const check=()=>{if(!active)throw Error('Deployment session disconnected.');assertCurrent();};
 const report=message=>{check();onStatus(message);};
 async function connectRpc(rpc,signer){
  let expired=false,timer;
  const pending=Promise.resolve().then(()=>bundle.connect(rpc,signer,'juno-1')).then(value=>{if(expired){value.disconnect();throw Error('Juno RPC connection timed out.');}return value;});
  try{return await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('Juno RPC connection timed out.'));},connectionTimeoutMs);})]);}
  finally{clearTimeout(timer);}
 }
 const assertWallet=async owner=>{check();const address=(await keplr.getOfflineSigner('juno-1').getAccounts())[0]?.address;check();if(address!==owner)throw Error('Use the approved owner wallet.');};
 try{
  report('Confirm the connection in Keplr. This does not request a transaction.');await keplr.enable('juno-1');await assertWallet(OWNER);
  const wrapped={getAccounts:async()=>{await assertWallet(OWNER);return keplr.getOfflineSigner('juno-1').getAccounts();},signDirect:async(address,doc)=>{await assertWallet(OWNER);const signed=await keplr.signDirect('juno-1',address,doc,{preferNoSetFee:true});await assertWallet(OWNER);return signed;}};
  for(const [index,rpc] of NETWORK.rpcs.entries()){
   report(`Owner wallet verified. Connecting to Juno (${index+1}/${NETWORK.rpcs.length})…`);
   try{client=await connectRpc(rpc,wrapped);break;}catch(error){check();}
  }
  if(!client)throw Error('Keplr connected, but the Juno network connection is unavailable. Retry later. No transaction was requested; keep your browser’s site data.');
  report('Owner wallet verified. Checking current Juno data with two independent providers…');
  const setup=new PersonalMainnetSetup({owner:OWNER,client,bundle,assertWallet,storage,locks,fetcher});setup.state();
  try{await setup.verifyState();}catch(error){check();throw Error('Keplr connected, but Juno verification failed: '+error.message+' No transaction was requested. Retry the connection later.');}check();
  return {owner:OWNER,setup,disconnect(){active=false;client.disconnect();}};
 }catch(error){active=false;client?.disconnect();throw error;}
}
