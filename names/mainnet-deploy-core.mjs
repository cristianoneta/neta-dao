import {SNAPSHOT_ARTIFACTS as ARTIFACTS} from './mainnet-artifacts.mjs';
import {MAINNET_PRICE_KEY,MAINNET_UPGRADE_ADMIN,MAINNET_REGISTRY_ADMIN} from './mainnet-config.mjs';
import {DAO,NETA} from './service/constants.mjs';
import {namesNetwork} from './networks.mjs';
const NETWORK=namesNetwork('juno-1');
import {NamesV2Reader,freshNamesBlock,uni7Failure} from '../names-v2-reader.mjs?v=3';
import {lookupTransaction} from '../juno-faucet-transactions.mjs';
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
export class MainnetSetup {
 constructor({owner,publicKey,client,bundle,assertWallet,storage=localStorage,locks=navigator.locks,fetcher=fetch}){
  if(publicKey!==MAINNET_PRICE_KEY)throw Error('Mainnet price key mismatch.');
  Object.assign(this,{owner,publicKey,client,bundle,assertWallet,storage,locks,fetcher:fetcher.bind(globalThis)});this.key='neta-nns-mainnet-setup-v1:'+owner;
  this.bridge=bundle.createBridge({chainId:'juno-1',client,storage,locks,lookup:hash=>lookupTransaction(hash,fetcher,'juno-1'),assertWallet,verifyDeployment:()=>this.verifyPending()});
 }
 state(){const raw=this.storage.getItem(this.key);if(raw===null)return {version:1,owner:this.owner,publicKey:this.publicKey,roles:{},pending:null,history:[]};const s=JSON.parse(raw);if(s.version!==1||s.owner!==this.owner||s.publicKey!==this.publicKey||!s.roles||!Array.isArray(s.history))throw Error('Setup identity or stored authority changed. Preserve the setup journal.');return s;}
 save(s){const raw=JSON.stringify(s);this.storage.setItem(this.key,raw);if(this.storage.getItem(this.key)!==raw)throw Error('Setup storage could not be verified.');}
 lock(fn){return this.locks.request(this.key,{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw Error('Another tab is using this setup.');return fn();});}
 async get(base,path){const r=await this.fetcher(base+path,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Juno mainnet query unavailable (HTTP '+r.status+').');return r.json();}
 async network(){
  this.base=null;const failures=[];
  for(const base of NETWORK.rests){try{
   const n=await this.get(base,'/cosmos/base/tendermint/v1beta1/node_info');if(n.default_node_info?.network!=='juno-1')throw Error('NETWORK MISMATCH');
   const latest=await this.get(base,'/cosmos/base/tendermint/v1beta1/blocks/latest');freshNamesBlock(latest,'juno-1');this.base=base;return;
  }catch(e){if(/MISMATCH/.test(e.message))throw e;failures.push(uni7Failure(base,e));}}
  throw Error('Fresh Juno mainnet data unavailable. '+failures.join(' | '));
 }
 async code(role,id){
  const c=(await this.get(this.base,'/cosmwasm/wasm/v1/code/'+id)).code_info;
  if(c?.creator!==this.owner||codeHash(c.data_hash)!==ARTIFACTS[role].sha256)throw Error('Uploaded code identity mismatch.');
 }
 async contract(role,address,codeId,migrationAdmin=MAINNET_UPGRADE_ADMIN){
  if(!this.bundle.validAddress(address))throw Error('Invalid deployed contract address.');
  const c=(await this.get(this.base,'/cosmwasm/wasm/v1/contract/'+address)).contract_info;
  if(Number(c?.code_id)!==codeId||c.creator!==this.owner||(c.admin||'')!==migrationAdmin)throw Error('Deployed contract identity or approved upgrade administrator mismatch. Preserve receipts; do not redeploy automatically.');
  await this.code(role,codeId);
 }
 async artifact(role){
  const spec=ARTIFACTS[role];if(!spec)throw Error('Unknown setup role.');
  const r=await this.fetcher(spec.path,{cache:'no-store'});if(!r.ok)throw Error('Reviewed WASM artifact unavailable.');const bytes=new Uint8Array(await r.arrayBuffer());
  if(hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))!==spec.sha256)throw Error('WASM artifact checksum mismatch.');return bytes64(bytes);
 }
 recipe(kind,role,s=this.state()){
  if(!Object.hasOwn(ARTIFACTS,role))throw Error('Unknown setup role.');
  const target=s.roles[role]||{},spec=ARTIFACTS[role];if(!spec)throw Error('Unknown setup role.');
  if(kind==='store'){if(target.codeId)throw Error('This role already has an uploaded code.');return {owner:this.owner,kind,role,checksum:spec.sha256,memo:'Upload NNS '+role+' on Juno mainnet'};}
  if(kind==='instantiate'){
   if(!Number.isSafeInteger(target.codeId)||target.codeId<1||target.address)throw Error('Upload this role first or use its existing instance.');let msg;
   if(role==='registry'){msg={token:NETA,treasury:DAO,admin:MAINNET_REGISTRY_ADMIN,quote_public_key:this.publicKey,testnet_only:false};}
   if(role==='profiles'){if(!s.roles.registry?.address)throw Error('Instantiate the registry first.');msg={registry:s.roles.registry.address};}
   return {owner:this.owner,kind,role,migrationAdmin:MAINNET_UPGRADE_ADMIN,codeId:target.codeId,label:role==='registry'?'NETA Names v0.3.1':'NETA Validator Profiles v0.1.0',msg,memo:'Instantiate NNS '+role+' on Juno mainnet'};
  }
  throw Error('Unknown setup action.');
 }
 async prepare(kind,role){return this.lock(async()=>{await this.assertWallet(this.owner);const s=this.state();if(s.pending)throw Error('Reconcile the pending setup transaction first.');const request=this.recipe(kind,role,s);if(kind==='store')await this.artifact(role);await this.network();await this.verifyRoles(s);return {kind,role,request};});}
 async verifyPending(){
  await this.assertWallet(this.owner);await this.network();const s=this.state(),pending=s.pending;if(!pending)throw Error('No persisted setup intent.');
  const expected=this.recipe(pending.kind,pending.role,s);
  // An old pending no-admin creation can only be reconciled as originally signed.
  if(this.recovering&&pending.kind==='instantiate'&&!Object.hasOwn(pending.request,'migrationAdmin'))delete expected.migrationAdmin;
  const request={...pending.request};delete request.intentId;
  if(stable(expected)!==stable(request))throw Error('Setup request changed.');
  await this.verifyRoles(s,{recovering:this.recovering});
 }
 async verifyRoles(s,{recovering=false}={}){
  for(const [role,r] of Object.entries(s.roles))if(r.address)await this.contract(role,r.address,r.codeId,recovering?(r.migrationAdmin||''):MAINNET_UPGRADE_ADMIN);else if(r.codeId)await this.code(role,r.codeId);
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
  if(!receipt.notBroadcast&&(!/^[A-F0-9]{64}$/.test(receipt.transactionHash)||receipt.chainId!=='juno-1'||!Number.isInteger(receipt.code)))throw Error('Invalid setup receipt.');
  if(!receipt.notBroadcast&&receipt.code===0){
   await this.network();const role=p.role;
   if(p.kind==='store'){
    const id=Number(eventValue(receipt,'store_code','code_id'));if(!Number.isSafeInteger(id)||id<1)throw Error('Invalid stored code ID.');await this.code(role,id);s.roles[role]={codeId:id};
   }else if(p.kind==='instantiate'){
    const address=eventValue(receipt,'instantiate','_contract_address');const migrationAdmin=p.request.migrationAdmin||'';await this.contract(role,address,p.request.codeId,migrationAdmin);s.roles[role]={codeId:p.request.codeId,address,migrationAdmin};
   }
  }
  s.history.push({request:p.request,receipt});s.pending=null;this.save(s);return receipt;
 }
 async recover(hash=null){return this.lock(async()=>{const p=this.state().pending;if(!p)throw Error('No pending setup transaction.');const full={...p.request};if(p.kind==='store')full.wasm=await this.artifact(p.role);this.recovering=true;try{const receipt=await this.bridge.recover(full,hash||null);return await this.settle(receipt);}finally{this.recovering=false;}});}
 async manifest(){
  const s=this.state();if(s.pending)throw Error('Reconcile the pending transaction first.');
  for(const role of ['registry','profiles'])if(!s.roles[role]?.address)throw Error('Finish both contract instances first.');
  const m={version:3,pricing_protocol:'treasury-snapshot-v1',chain_id:'juno-1',testnet_only:false,registry:s.roles.registry.address,token:NETA,profile_contract:s.roles.profiles.address,admin:MAINNET_REGISTRY_ADMIN,treasury:DAO,quote_public_key:this.publicKey,signer_version:1,
   contracts:Object.fromEntries(['registry','profiles'].map(role=>[role,{code_id:s.roles[role].codeId,sha256:ARTIFACTS[role].sha256,creator:this.owner,admin:MAINNET_UPGRADE_ADMIN}]))};
  const observations=[];
  for(const base of NETWORK.rests){
   const reader=new NamesV2Reader({deployment:m,fetcher:this.fetcher});
   // Require each independent provider, not a successful fallback to the same one.
   reader.network={...NETWORK,rests:[base]};const config=await reader.verify();
   if(config.purchases_paused!==true)throw Error('Expected purchases to remain paused.');
   for(const [role,r] of Object.entries(s.roles)){this.base=base;await this.contract(role,r.address,r.codeId);}
   observations.push({provider:base,block:reader.block,config});
  }
  if(stable(observations[0].config)!==stable(observations[1].config))throw Error('Providers disagree about registry configuration. Retry verification.');
  this.observations=observations;return m;
 }
 async exportBundle(){const manifest=await this.manifest();return {kind:'nns-mainnet-deployment-receipts',manifest,observations:this.observations,history:this.state().history};}

}
export async function connectMainnetSetup({keplr=globalThis.keplr,bundle=globalThis.NetaNamesSigning,storage=localStorage,locks=navigator.locks,fetcher=fetch}={}){
 if(!keplr||!bundle?.createBridge||!locks?.request)throw Error('Keplr and secure browser storage/locks are required.');
 await keplr.enable('juno-1');const signer=keplr.getOfflineSigner('juno-1');
 if(typeof signer.signDirect!=='function')throw Error('Use a Keplr Direct-signing account.');
 const owner=(await signer.getAccounts())[0]?.address;if(!bundle.validAddress(owner,true))throw Error('Invalid Juno mainnet wallet.');let active=true;
 const assertWallet=async address=>{if(!active||(await keplr.getOfflineSigner('juno-1').getAccounts())[0]?.address!==address)throw Error('Wallet changed. Reconnect.');};
 const wrapped={getAccounts:()=>signer.getAccounts(),signDirect:(address,doc)=>keplr.signDirect('juno-1',address,doc,{preferNoSetFee:true})};let client;
 for(const rpc of NETWORK.rpcs)try{client=await bundle.connect(rpc,wrapped,'juno-1');break;}catch{}
 if(!client)throw Error('Juno mainnet signing RPC unavailable.');
 const setup=new MainnetSetup({owner,publicKey:MAINNET_PRICE_KEY,client,bundle,assertWallet,storage,locks,fetcher});
 try{await setup.network();setup.state();}catch(error){active=false;client.disconnect();throw error;}
 return {owner,setup,disconnect(){active=false;client.disconnect();}};
}
