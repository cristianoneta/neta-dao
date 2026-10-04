import {connectNamesSetup} from './names-v2-setup-core.mjs';
import {getTestAuthority} from './names-v2-test-authority.mjs';
import {NAMES_TEST_ARTIFACTS} from './names-v2-artifacts.mjs';
const $=id=>document.getElementById(id);let session=null,authority=false,busy=false,review=null;
function state(){return session?.setup.state();}
function clear(){review=null;$('review').hidden=true;}
function render(){
 let s;try{s=state();}catch(e){$('status').textContent=e.message;}
 $('connect').disabled=busy||!authority||!!session;$('disconnect').hidden=!session;$('disconnect').disabled=busy;$('authority').disabled=busy||!!session;
 $('wallet').textContent=session?session.owner:'Wallet not connected.';$('pending').textContent=s?.pending?`${s.pending.kind} · ${s.pending.role} · confirmation pending`:session?'No pending setup transaction.':'No wallet connected.';
 for(const role of ['token','registry','profiles']){const r=s?.roles[role];$(role+'-state').textContent=r?`Code ${r.codeId}${r.address?' · '+r.address:' · ready to instantiate'}`:'Not deployed.';}
 for(const button of document.querySelectorAll('[data-role]')){
  const {role,kind}=button.dataset,r=s?.roles[role];let blocked=busy||!session||!!s?.pending;
  if(kind==='store')blocked||=!!r?.codeId;else blocked||=!r?.codeId||!!r.address||(role==='registry'&&!s?.roles.token?.address)||(role==='profiles'&&!s?.roles.registry?.address);
  button.disabled=blocked;
 }
 const complete=['token','registry','profiles'].every(role=>s?.roles[role]?.address);
 $('unpause').disabled=busy||!complete||!!s?.pending||s?.enabled===true;$('download').disabled=busy||!complete||!!s?.pending;
 $('recover').disabled=busy||!s?.pending;$('recovery-hash').disabled=busy;$('confirm').disabled=busy||!session||!review;$('discard-review').disabled=busy;
}
async function run(fn){if(busy)return;busy=true;render();try{await fn();}catch(e){$('status').textContent=e.message;}finally{busy=false;render();}}
function disconnected(){session?.disconnect();session=null;clear();$('status').textContent='Disconnected. Setup and transaction records are preserved.';render();}
$('authority').addEventListener('click',()=>run(async()=>{const a=await getTestAuthority({create:true});authority=true;$('authority-status').textContent='Local UNI-7 test signer ready · public key '+a.publicKey;$('status').textContent='Test key saved in this browser. Connect Keplr next.';}));
$('connect').addEventListener('click',()=>run(async()=>{session=await connectNamesSetup();$('status').textContent='Connected to UNI-7. Review one setup action at a time.';}));
$('disconnect').addEventListener('click',disconnected);window.addEventListener('keplr_keystorechange',disconnected);
async function prepare(kind,role){clear();const current=session,prepared=await current.setup.prepare(kind,role);if(session!==current)throw Error('Wallet connection changed.');review={current,prepared};$('review-text').textContent=`Network: UNI-7\nAction: ${kind} ${role}\nWallet: ${current.owner}\nReviewed WASM SHA-256: ${NAMES_TEST_ARTIFACTS[role].sha256}\n${JSON.stringify(prepared.request,null,2)}`;$('review').hidden=false;$('review-heading').focus();}
for(const button of document.querySelectorAll('[data-role]'))button.addEventListener('click',()=>run(()=>prepare(button.dataset.kind,button.dataset.role)));
$('unpause').addEventListener('click',()=>run(()=>prepare('unpause','registry')));
$('confirm').addEventListener('click',()=>run(async()=>{const r=review;clear();if(!r||session!==r.current)throw Error('Review the action again.');const receipt=await session.setup.execute(r.prepared);$('status').textContent='Exact transaction confirmed on UNI-7 · '+receipt.transactionHash;}));
$('discard-review').addEventListener('click',()=>{clear();render();});
$('recover').addEventListener('click',()=>run(async()=>{clear();const r=await session.setup.recover($('recovery-hash').value.trim().toUpperCase()||null);$('status').textContent=r.notBroadcast?'No broadcast was sent. Review a new attempt separately.':r.code===0?'Confirmed. Setup state recovered without resending.':'Included transaction failed (code '+r.code+'). Review a new attempt separately.';}));
$('download').addEventListener('click',()=>run(async()=>{const manifest=await session.setup.manifest(),url=URL.createObjectURL(new Blob([JSON.stringify(manifest,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='nns-uni7-deployment.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('status').textContent='Verified manifest saved. Load it in the Names test workspace in this browser.';}));
render();
