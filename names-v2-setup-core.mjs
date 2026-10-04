import {NAMES_TEST_ARTIFACTS} from './names-v2-artifacts.mjs';
import {NamesV2Reader,UNI7_RESTS,UNI7_RPCS,freshUni7Block,uni7Failure} from './names-v2-reader.mjs?v=2';
import {CHAIN_CONFIG} from './juno-faucet-core.mjs?v=2';
import {lookupTransaction} from './juno-faucet-transactions.mjs';
import {getTestAuthority} from './names-v2-test-authority.mjs';
const bytes64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
const hex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
const codeHash=value=>/^[a-f0-9]{64}$/i.test(value||'')?value.toLowerCase():hex(Uint8Array.from(atob(value||''),c=>c.charCodeAt(0)));
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
function eventValue(receipt,type,key){
 const values=[];for(const event of receipt.events||[])if(event.type===type)for(const a of event.attributes||[]){
  if(a.key===key)values.push(a.value);else try{if(atob(a.key)===key)values.push(atob(a.value));}catch{}
 }
 const unique=[...new Set(values)];if(unique.length!==1)throw Error('Exact deployment event is unavailable. Keep the pending setup.');return unique[0];
}
export class NamesSetup {
 constructor({owner,publicKey,client,bundle,assertWallet,storage=localStorage,locks=navigator.locks,fetcher=fetch}){
  Object.assign(this,{owner,publicKey,client,bundle,assertWallet,storage,locks,fetcher});this.key='neta-nns-uni7-setup-v1:'+owner;
  this.bridge=bundle.createBridge({client,storage,locks,lookup:hash=>lookupTransaction(hash,fetcher),assertWallet,verifyDeployment:()=>this.verifyPending()});
 }
 state(){const raw=this.storage.getItem(this.key);if(raw===null)return {version:1,owner:this.owner,publicKey:this.publicKey,roles:{},pending:null,history:[]};const s=JSON.parse(raw);if(s.version!==1||s.owner!==this.owner||s.publicKey!==this.publicKey||!s.roles||!Array.isArray(s.history))throw Error('Setup identity or stored authority changed. Preserve the setup journal.');return s;}
 save(s){const raw=JSON.stringify(s);this.storage.setItem(this.key,raw);if(this.storage.getItem(this.key)!==raw)throw Error('Setup storage could not be verified.');}
 lock(fn){return this.locks.request(this.key,{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw Error('Another tab is using this setup.');return fn();});}
 async get(base,path){const r=await this.fetcher(base+path,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('UNI-7 query unavailable (HTTP '+r.status+').');return r.json();}
 async network(){
  this.base=null;const failures=[];
  for(const base of UNI7_RESTS){try{
   const n=await this.get(base,'/cosmos/base/tendermint/v1beta1/node_info');if(n.default_node_info?.network!=='uni-7')throw Error('NETWORK MISMATCH');
   const latest=await this.get(base,'/cosmos/base/tendermint/v1beta1/blocks/latest');freshUni7Block(latest);this.base=base;return;
  }catch(e){if(/MISMATCH/.test(e.message))throw e;failures.push(uni7Failure(base,e));}}
  throw Error('Fresh UNI-7 data unavailable. '+failures.join(' | '));
 }
 async code(role,id){
  const c=(await this.get(this.base,'/cosmwasm/wasm/v1/code/'+id)).code_info;
  if(c?.creator!==this.owner||codeHash(c.data_hash)!==NAMES_TEST_ARTIFACTS[role].sha256)throw Error('Uploaded code identity mismatch.');
 }
 async contract(role,address,codeId){
  if(!this.bundle.validAddress(address))throw Error('Invalid deployed contract address.');
  const c=(await this.get(this.base,'/cosmwasm/wasm/v1/contract/'+address)).contract_info;
  if(Number(c?.code_id)!==codeId||c.creator!==this.owner||c.admin)throw Error('Deployed contract identity mismatch.');
  await this.code(role,codeId);
 }
 async artifact(role){
  const spec=NAMES_TEST_ARTIFACTS[role];if(!spec)throw Error('Unknown setup role.');
  const r=await this.fetcher(spec.path,{cache:'no-store'});if(!r.ok)throw Error('Reviewed WASM artifact unavailable.');const bytes=new Uint8Array(await r.arrayBuffer());
  if(hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))!==spec.sha256)throw Error('WASM artifact checksum mismatch.');return bytes64(bytes);
 }
 recipe(kind,role,s=this.state()){
  const target=s.roles[role]||{},spec=NAMES_TEST_ARTIFACTS[role];if(!spec)throw Error('Unknown setup role.');
  if(kind==='store'){if(target.codeId)throw Error('This role already has an uploaded code.');return {owner:this.owner,kind,role,checksum:spec.sha256,memo:'Upload NNS '+role+' on UNI-7'};}
  if(kind==='instantiate'){
   if(!Number.isSafeInteger(target.codeId)||target.codeId<1||target.address)throw Error('Upload this role first or use its existing instance.');let msg;
   if(role==='token')msg={};
   if(role==='registry'){if(!s.roles.token?.address)throw Error('Instantiate the mock token first.');msg={token:s.roles.token.address,treasury:this.owner,admin:this.owner,quote_public_key:this.publicKey,testnet_only:true};}
   if(role==='profiles'){if(!s.roles.registry?.address)throw Error('Instantiate the registry first.');msg={registry:s.roles.registry.address};}
   return {owner:this.owner,kind,role,codeId:target.codeId,label:spec.label,msg,memo:'Instantiate NNS '+role+' on UNI-7'};
  }
  if(kind==='unpause'){
   if(role!=='registry'||!s.roles.token?.address||!s.roles.registry?.address||!s.roles.profiles?.address)throw Error('Finish all three contracts before enabling test purchases.');
   return {owner:this.owner,kind:'execute',role,contract:s.roles.registry.address,msg:{set_purchases_paused:{paused:false}},memo:'Enable NNS UNI-7 test purchases'};
  }
  throw Error('Unknown setup action.');
 }
 async prepare(kind,role){return this.lock(async()=>{await this.assertWallet(this.owner);const s=this.state();if(s.pending)throw Error('Reconcile the pending setup transaction first.');const request=this.recipe(kind,role,s);if(kind==='store')await this.artifact(role);await this.network();return {kind,role,request};});}
 async verifyPending(){
  await this.assertWallet(this.owner);await this.network();const s=this.state(),pending=s.pending;if(!pending)throw Error('No persisted setup intent.');
  const expected=this.recipe(pending.kind,pending.role,s);
  const request={...pending.request};delete request.intentId;
  if(stable(expected)!==stable(request))throw Error('Setup request changed.');
  for(const [role,r] of Object.entries(s.roles))if(r.address)await this.contract(role,r.address,r.codeId);else if(r.codeId)await this.code(role,r.codeId);
 }
 async execute(reviewed){return this.lock(async()=>{
  const s=this.state();if(s.pending)throw Error('Reconcile the pending setup first.');const request=this.recipe(reviewed.kind,reviewed.role,s);
  if(stable(request)!==stable(reviewed.request))throw Error('Setup state changed. Review again.');
  request.intentId=hex(crypto.getRandomValues(new Uint8Array(16)));
  const full={...request};if(reviewed.kind==='store')full.wasm=await this.artifact(reviewed.role);
  s.pending={kind:reviewed.kind,role:reviewed.role,request};this.save(s);
  const receipt=await this.bridge.execute(full);return this.settle(receipt);
 });}
 async settle(receipt){
  const s=this.state(),p=s.pending;if(!p||receipt.intentMatched!==true)throw Error('No matching setup receipt.');
  if(!receipt.notBroadcast&&(!/^[A-F0-9]{64}$/.test(receipt.transactionHash)||receipt.chainId!=='uni-7'||!Number.isInteger(receipt.code)))throw Error('Invalid setup receipt.');
  if(!receipt.notBroadcast&&receipt.code===0){
   await this.network();const role=p.role;
   if(p.kind==='store'){
    const id=Number(eventValue(receipt,'store_code','code_id'));if(!Number.isSafeInteger(id)||id<1)throw Error('Invalid stored code ID.');await this.code(role,id);s.roles[role]={codeId:id};
   }else if(p.kind==='instantiate'){
    const address=eventValue(receipt,'instantiate','_contract_address');await this.contract(role,address,p.request.codeId);s.roles[role]={codeId:p.request.codeId,address};
   }else{const manifest=await this.manifest();const config=await new NamesV2Reader({deployment:manifest,fetcher:this.fetcher}).verify();if(config.purchases_paused!==false)throw Error('Unpause receipt found but test purchases are still paused.');s.enabled=true;}
  }
  s.history.push({request:p.request,receipt});s.pending=null;this.save(s);return receipt;
 }
 async recover(hash=null){return this.lock(async()=>{const p=this.state().pending;if(!p)throw Error('No pending setup transaction.');const full={...p.request};if(p.kind==='store')full.wasm=await this.artifact(p.role);const receipt=await this.bridge.recover(full,hash||null);return this.settle(receipt);});}
 async manifest(){
  const s=this.state();for(const role of ['token','registry','profiles'])if(!s.roles[role]?.address)throw Error('Finish all contract instances first.');
  const m={version:1,chain_id:'uni-7',testnet_only:true,registry:s.roles.registry.address,token:s.roles.token.address,profile_contract:s.roles.profiles.address,admin:this.owner,treasury:this.owner,quote_public_key:this.publicKey,signer_version:1,
   contracts:Object.fromEntries(Object.entries(s.roles).map(([role,r])=>[role,{code_id:r.codeId,sha256:NAMES_TEST_ARTIFACTS[role].sha256,creator:this.owner,admin:null}]))};
  await new NamesV2Reader({deployment:m,fetcher:this.fetcher}).verify();return m;
 }
}
export async function connectNamesSetup({keplr=globalThis.keplr,bundle=globalThis.NetaNamesSigning,storage=localStorage,locks=navigator.locks,fetcher=fetch}={}){
 if(!keplr||!bundle?.createBridge||!locks?.request)throw Error('Keplr and secure browser storage/locks are required.');
 const authority=await getTestAuthority();await keplr.experimentalSuggestChain(CHAIN_CONFIG);await keplr.enable('uni-7');const signer=keplr.getOfflineSigner('uni-7');
 if(typeof signer.signDirect!=='function')throw Error('Use a Keplr Direct-signing test account.');
 const owner=(await signer.getAccounts())[0]?.address;if(!bundle.validAddress(owner,true))throw Error('Invalid UNI-7 wallet.');let active=true;
 const assertWallet=async address=>{if(!active||(await keplr.getOfflineSigner('uni-7').getAccounts())[0]?.address!==address)throw Error('Wallet changed. Reconnect.');};
 const wrapped={getAccounts:()=>signer.getAccounts(),signDirect:(address,doc)=>keplr.signDirect('uni-7',address,doc,{preferNoSetFee:true})};let client;
 for(const rpc of UNI7_RPCS)try{client=await bundle.connect(rpc,wrapped);break;}catch{}
 if(!client)throw Error('UNI-7 signing RPC unavailable.');
 const setup=new NamesSetup({owner,publicKey:authority.publicKey,client,bundle,assertWallet,storage,locks,fetcher});
 try{await setup.network();setup.state();}catch(error){active=false;client.disconnect();throw error;}
 return {owner,setup,disconnect(){active=false;client.disconnect();}};
}
