import {createPriceKey,restorePriceKey,validatePricePublicKey} from './price-key.mjs';
import {deploymentPlan} from './plan-core.mjs';
const $=id=>document.getElementById(id), storageKey='neta-nns-mainnet-price-public-v1';
let publicKey=null, privatePem=null, busy=false, unreadable=false;
try {const saved=localStorage.getItem(storageKey);if(saved)publicKey=validatePricePublicKey(saved);}catch{unreadable=true;$('status').textContent='The saved public key cannot be read. Restore your existing backup; do not replace an installed key.';}
function render(){
  $('create-key').disabled=busy||!!publicKey||unreadable;
  $('restore-key').disabled=busy;
  for(const id of ['copy-public','download-plan'])$(id).disabled=busy||!publicKey;
  for(const id of ['download-private','copy-private'])$(id).disabled=busy||!privatePem;
  $('public-key').value=publicKey||'';
  $('key-status').textContent=privatePem?'Price key ready. Save its backup and install the GitHub secret.':publicKey?'Public key remembered. Restore the matching PEM backup to copy or download the private key again.':'No price key loaded.';
}
async function run(fn){if(busy)return;busy=true;render();try{await fn();}catch{$('status').textContent='This step could not be completed. Check browser permissions or restore the matching PEM backup. No secret was sent.';}finally{busy=false;render();}}
function retain(key){
  // Set memory first so a storage failure still leaves an exportable backup.
  publicKey=key.publicKey;privatePem=key.privatePem;
  localStorage.setItem(storageKey,publicKey);
  if(localStorage.getItem(storageKey)!==publicKey)throw Error('Public key storage failed.');
}
function download(filename,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('create-key').onclick=()=>run(async()=>{if(publicKey||unreadable||!navigator.locks)throw Error('Key already exists or storage unavailable.');await navigator.locks.request(storageKey,async()=>{if(localStorage.getItem(storageKey))throw Error('Key already exists.');retain(await createPriceKey());});$('status').textContent='Created locally. Download the private backup next.';});
$('restore-key').onchange=()=>run(async()=>{const file=$('restore-key').files[0];if(!file||file.size>4096)throw Error('Invalid backup.');const key=await restorePriceKey(await file.text(),publicKey);retain(key);$('restore-key').value='';$('status').textContent='Matching backup restored locally.';});
$('download-private').onclick=()=>{download('nns-price-key.pem',privatePem,'application/x-pem-file');$('status').textContent='Private backup download started. Keep it private and verify the file was saved.';};
$('copy-private').onclick=()=>run(async()=>{await navigator.clipboard.writeText(privatePem);$('status').textContent='Private key copied. Paste it only into the GitHub Actions secret, then copy the public key to replace your clipboard.';});
$('copy-public').onclick=()=>run(async()=>{await navigator.clipboard.writeText(publicKey);$('status').textContent='Public key copied. This value is safe to share.';});
$('download-plan').onclick=()=>download('nns-mainnet-plan.json',JSON.stringify(deploymentPlan(publicKey),null,2)+'\n','application/json');
render();

window.addEventListener('storage',event=>{if(event.key===storageKey||event.key===null){privatePem=null;try{publicKey=validatePricePublicKey(localStorage.getItem(storageKey));}catch{unreadable=true;}render();}});
