// Read-only account summary. No signing adapter, wallet enable or form mutation.
import {NamesV2Reader} from './names-v2-reader.mjs?v=5';
import {normalizeName} from './names-profile-core.mjs';
const $=id=>document.getElementById(id);
const manifests={'juno-1':'./docs/deployments/nns-mainnet.json','uni-7':'./docs/deployments/nns-uni7-owner-2026-10-04.json'};
let serial=0,controller=null,attempt='',checkedAt=0,owned=null;
const address=()=>window.NetaWorkspaceWallet?.getAddress()||null;
const chain=()=>$('nns-network').value;
const active=()=>document.body.dataset.workspaceView==='relay'&&['register','profile'].includes(document.body.dataset.relayPanel);
const scope=()=>chain()+':'+(address()||'');
function publish(text,{record=null,error=''}={}){
  owned=record;
  $('nns-owned').textContent=text;
  $('nns-owned-actions').hidden=!record;
  $('nns-owned-retry').hidden=!error;
  $('nns-owned-error').textContent=error;
  window.dispatchEvent(new Event('neta:nns-account'));
}
function reset(){
  serial++;controller?.abort();controller=null;attempt='';checkedAt=0;
  publish(address()?'Loading your name…':'Connect your wallet to see your name.');
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
    const reader=new NamesV2Reader({deployment,fetcher});
    await reader.verify();if(!current())return;
    const result=await reader.nameOf(owner);if(!current())return;
    if(result?.address!==owner||(result.name!==null&&typeof result.name!=='string'))throw Error('Name ownership is unavailable.');
    if(result.name===null){publish('No active name for this wallet.');return;}
    const name=normalizeName(result.name),record=await reader.identity(name);if(!current())return;
    if(record?.name!==name||record.owner!==owner||!Number.isSafeInteger(record.expires_at)||record.expires_at<=Math.max(reader.block.time,Date.now()/1000))throw Error('Name ownership changed or expired. Please retry.');
    publish(name+' · valid until '+new Date(record.expires_at*1000).toLocaleDateString(),{record:{...record,chainId:network}});
  }catch(error){
    if(current())publish('Your name could not be loaded.',{error:error.message});
  }
}
window.NetaNamesAccount=Object.freeze({
  current:()=>owned&&owned.owner===address()&&owned.chainId===chain()&&owned.expires_at>Date.now()/1000?{...owned}:null,
  refresh
});
for(const event of ['neta:wallet-change','keplr_keystorechange','neta:nns-network','neta:nns-updated']){
  window.addEventListener(event,()=>{reset();void refresh();});
}
for(const event of ['neta:relay-panel','hashchange'])window.addEventListener(event,()=>{void refresh();});
$('nns-owned-retry').onclick=()=>{void refresh({force:true});};
reset();void refresh();
