// Public reads and journal discovery only. No signing adapter or wallet enable.
import {NamesV2Reader} from './names-v2-reader.mjs?v=5';
import {normalizeName} from './names-profile-core.mjs';
import {readNamesIntent, nameState, NAME_GRACE} from './names-v2-view-state.mjs?v=1';
const $=id=>document.getElementById(id);
const manifests={'juno-1':'./docs/deployments/nns-mainnet.json','uni-7':'./docs/deployments/nns-uni7-owner-2026-10-04.json'};
let serial=0,controller=null,attempt='',checkedAt=0,owned=null,context=null,phase='disconnected';
const address=()=>window.NetaWorkspaceWallet?.getAddress()||null;
const chain=()=>$('nns-network').value;
const active=()=>document.body.dataset.workspaceView==='relay'&&['register','profile'].includes(document.body.dataset.relayPanel);
const scope=()=>chain()+':'+(address()||'');
const scopedContext=()=>context?.scope===scope()?context:null;
const date=value=>new Date(value*1000).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
function publish(text,{record=null,error='',state=record?.state||phase}={}){
  owned=record;phase=state;
  $('nns-owned').textContent=text;
  $('nns-owned').dataset.state=state;
  $('nns-owned-actions').hidden=!record||state==='released';
  $('nns-owned-retry').hidden=!error;
  $('nns-owned-error').textContent=error;
  window.dispatchEvent(new Event('neta:nns-account'));
}
function reset(){
  serial++;controller?.abort();controller=null;attempt='';checkedAt=0;context=null;
  publish(address()?'Loading your name…':'Connect your wallet to see your name.',{state:address()?'loading':'disconnected'});
}
function hints(deployment,owner){
  const names=[];
  const add=value=>{try{if(value)names.push(normalizeName(value));}catch{/* Invalid hints never authorize actions. */}};
  const prefix=deployment.chain_id+':'+deployment.registry+':'+owner;
  try{add(localStorage.getItem('neta-nns-last-name:'+prefix));}catch{}
  try{add(readNamesIntent(localStorage,deployment,owner)?.name);}catch{}
  try{
    const notices=JSON.parse(localStorage.getItem('neta-nns-notifications:v1:'+prefix)||'{}');
    for(const record of Object.values(notices.identities||{}))if(record.owner===owner)add(record.name);
  }catch{}
  const link=new URLSearchParams(location.search);
  if(link.get('nns-network')===deployment.chain_id)add(link.get('nns-name'));
  return [...new Set(names)].slice(0,8);
}
async function refresh({force=false}={}){
  if(!address()){reset();return;}
  if(!active())return;
  const key=scope();
  if(!force&&attempt===key&&Date.now()-checkedAt<60000)return;
  reset();attempt=key;checkedAt=Date.now();
  const request=serial,owner=address(),network=chain();
  const abort=new AbortController();controller=abort;
  const current=()=>serial===request&&scope()===key&&!abort.signal.aborted;
  const fetcher=(url,options={})=>fetch(url,{...options,signal:AbortSignal.any([abort.signal,options.signal||AbortSignal.timeout(12000)])});
  try{
    const response=await fetcher(manifests[network],{cache:'no-store'});
    if(!response.ok)throw Error('The selected name registry is unavailable.');
    const deployment=await response.json();
    if(deployment.chain_id!==network)throw Error('Name registry network mismatch.');
    const reader=new NamesV2Reader({deployment,fetcher});if(!current())return;
    context={scope:key,deployment:reader.deployment,reader,config:null};
    // Discover pending work as soon as its pinned storage scope is known, even
    // if the public provider is temporarily unavailable.
    window.dispatchEvent(new Event('neta:nns-account'));
    const config=await reader.verify();if(!current())return;
    context.config=config;
    const result=await reader.nameOf(owner);if(!current())return;
    if(result?.address!==owner||(result.name!==null&&typeof result.name!=='string'))throw Error('Name ownership is unavailable.');
    const candidates=result.name?[normalizeName(result.name)]:hints(deployment,owner);
    let released=null;
    for(const name of candidates){
      const record=await reader.identity(name);if(!current())return;
      if(record===null&&!result.name)continue;
      if(record?.name!==name)throw Error('Name identity is unavailable.');
      const state=nameState(record,owner,Math.max(reader.block.time,Date.now()/1000));
      if(!state)continue;
      const value={...record,chainId:network,state};
      if(state==='released'){released=value;continue;}
      try{localStorage.setItem('neta-nns-last-name:'+network+':'+deployment.registry+':'+owner,name);}catch{}
      publish(state==='active'?name+' · valid until '+date(record.expires_at):name+' · expired — renew before '+date(record.expires_at+NAME_GRACE),{record:value});return;
    }
    if(released)publish(released.name+' · renewal period ended. Check availability to register again.',{record:released});
    else publish('No active name for this wallet.',{state:'empty'});
  }catch(error){
    if(current())publish('Your name could not be loaded.',{error:error.message,state:'error'});
  }
}
window.NetaNamesAccount=Object.freeze({
  current:()=>owned&&owned.owner===address()&&owned.chainId===chain()&&nameState(owned,address())!=='released'?{...owned,state:nameState(owned,address())}:null,
  context:scopedContext,
  intent:()=>{const c=scopedContext();return c?readNamesIntent(localStorage,c.deployment,address()):null;},
  phase:()=>phase,
  refresh
});
for(const event of ['neta:wallet-change','keplr_keystorechange','neta:nns-network','neta:nns-updated'])window.addEventListener(event,()=>{reset();void refresh();});
for(const event of ['neta:relay-panel','hashchange'])window.addEventListener(event,()=>{void refresh();});
window.addEventListener('storage',event=>{if(event.key===null||event.key.startsWith('neta-nns-v2-intent:')){window.dispatchEvent(new Event('neta:nns-account'));}});
$('nns-owned-retry').onclick=()=>{void refresh({force:true});};
reset();void refresh();
