import {createValidatorPanel} from './names-v2-validator-ui.mjs?v=1';
import {NamesV2Reader} from './names-v2-reader.mjs?v=4';
import {connectNamesWallet} from './names-v2-wallet.mjs?v=4';
import {normalizeName,normalizeContacts,validateJunoAddress} from './names-profile-core.mjs';
import {createTestQuote} from './names-v2-test-authority.mjs';
import {validateQuote} from './names-v2-core.mjs';
const $=id=>document.getElementById(id);
let deployment=null,session=null,busy=false,review=null,validators=null,connectionEpoch=0;
const now=()=>Math.floor(Date.now()/1000);
const micro=value=>{const n=BigInt(value);return `${n/1000000n}.${(n%1000000n).toString().padStart(6,'0')}`;};
function clearReview(){review=null;$('review').hidden=true;}
function status(text){$('status').textContent=text;}
function render(){
 let intent=null;try{if(session)intent=session.client.load(session.owner);}catch(e){status(e.message);}
 const connected=!!session,pending=['commit_pending','payment_pending','write_pending'].includes(intent?.phase),open=intent&&intent.phase!=='complete';
 $('connect').disabled=busy||!deployment||connected;$('disconnect').hidden=!connected;$('disconnect').disabled=busy;$('verify').disabled=busy||connected;
 $('wallet').textContent=connected?session.owner:'Wallet not connected.';
 $('intent').textContent=intent?`${intent.name} · ${intent.phase}${intent.payment_hash||intent.commit_hash?' · TX '+(intent.payment_hash||intent.commit_hash):''}`:connected?'No saved Names transaction.':'No wallet connected.';
 $('recover').disabled=busy||!pending;$('cancel-registration').disabled=busy||!['prepared','committed'].includes(intent?.phase);
 $('prepare').disabled=busy||!connected||open||$('operation').value!=='register';$('commit').disabled=busy||!connected||intent?.phase!=='prepared';
 $('review-quote').disabled=busy||!connected||pending||($('operation').value==='register'?intent?.phase!=='committed':!!open);
 $('local-quote').disabled=$('review-quote').disabled;
 for(const id of ['review-transfer','review-profile'])$(id).disabled=busy||!connected||!!open;
 for(const id of ['name','years','operation'])$(id).disabled=busy||!!open;
 for(const id of ['manifest','quote','transfer-name','transfer-action','recipient','hours','profile-name','recovery-hash'])$(id).disabled=busy;
 $('manifest').disabled=busy||connected;
 for(const node of $('profile-form').querySelectorAll('[name]'))node.disabled=busy;
 $('confirm').disabled=busy||!session||!review;$('discard-review').disabled=busy;
 validators?.render();
}
async function run(fn){if(busy)return;busy=true;render();try{await fn();}catch(e){status(e.message);}finally{busy=false;render();}}
async function jsonFile(id){const file=$(id).files[0];if(!file||file.size>30000)throw Error('Choose a JSON file smaller than 30 KB.');return JSON.parse(await file.text());}
function showReview(text,action){review={action};$('review-text').textContent=text;$('review').hidden=false;render();$('review-heading').focus();}
function disconnect(){connectionEpoch++;session?.disconnect();session=null;clearReview();status('Disconnected. Saved intents and transaction journals are preserved.');render();}
$('verify').addEventListener('click',()=>run(async()=>{deployment=null;clearReview();const reader=new NamesV2Reader({deployment:await jsonFile('manifest')});const config=await reader.verify();validators?.reset();deployment=reader.deployment;$('deployment-status').textContent=`UNI-7 manifest matches chain · registry ${deployment.registry} · ${config.purchases_paused?'purchases paused':'test purchases enabled'}`;status('Deployment verified. Connect Keplr to continue.');}));
$('manifest').addEventListener('change',()=>{if(!session){deployment=null;validators?.reset();$('deployment-status').textContent='Manifest changed. Verify again.';render();}});
$('connect').addEventListener('click',()=>run(async()=>{const epoch=connectionEpoch,next=await connectNamesWallet({deployment});if(epoch!==connectionEpoch){next.disconnect();throw Error('Wallet changed during connection. Reconnect.');}session=next;const i=session.client.load(session.owner);if(i&&i.phase!=='complete'){ $('name').value=i.name;$('years').value=String(i.years||1);$('operation').value='register';}status('Connected to UNI-7. No transaction has been sent.');}));
$('disconnect').addEventListener('click',disconnect);
window.addEventListener('keplr_keystorechange',disconnect);
$('name-form').addEventListener('submit',event=>{event.preventDefault();run(async()=>{clearReview();const i=await session.client.prepareRegistration({owner:session.owner,name:$('name').value,years:Number($('years').value)});$('name').value=i.name;status('Reservation secret saved. Click Reserve name to review the first transaction in Keplr.');});});
$('commit').addEventListener('click',()=>run(async()=>{clearReview();await session.client.commit(session.owner);status('Reservation confirmed. Obtain a fresh signed test quote, then review the exact payment.');}));
$('cancel-registration').addEventListener('click',()=>run(async()=>{clearReview();await session.client.cancelRegistration(session.owner);status('Registration cancelled. An on-chain reservation cancellation requires its own JUNOX fee.');}));
$('recover').addEventListener('click',()=>run(async()=>{clearReview();const r=await session.recover($('recovery-hash').value.trim().toUpperCase());status(r.result.notBroadcast?'No broadcast was made. Review a new attempt separately.':r.result.code===0?'Exact transaction confirmed. Nothing was resent.':`Transaction failed on-chain (code ${r.result.code}). No name payment succeeded; the network fee was charged. Review a new attempt separately.`);}));
async function reviewPayment(offer){
 clearReview();const operation=$('operation').value,name=normalizeName($('name').value),years=Number($('years').value);const current=session;
 if(operation==='register')await current.client.registrationQuote(current.owner,async()=>offer);
 else {const config=await current.reader.verify(),r=await current.reader.identity(name);await validateQuote({deployment,config,offer,expected:{operation,payer:current.owner,owner:r.owner,name,generation:r.generation,ownership_revision:r.ownership_revision,expected_expires_at:r.expires_at,years},now:now()});}
 const q=offer.quote;showReview(`${operation==='register'?'Register':'Renew'} ${q.name}\nTerm: ${q.years} year(s)\nPayer: ${q.payer}\nOwner: ${q.owner}\nExact debit: ${micro(q.amount)} mock NETA\nRecipient treasury: ${deployment.treasury}\nQuote expires: ${new Date(q.expires_at*1000).toISOString()}\nNetwork: UNI-7`,async()=>{if(session!==current)throw Error('Wallet connection changed.');if(operation==='register')await current.client.register(current.owner,offer);else await current.client.renew({payer:current.owner,name,years,reviewedOffer:offer});});
}
$('review-quote').addEventListener('click',()=>run(async()=>reviewPayment(await jsonFile('quote'))));
$('local-quote').addEventListener('click',()=>run(async()=>{const offer=await createTestQuote({reader:session.reader,request:{operation:$('operation').value,payer:session.owner,name:$('name').value,years:Number($('years').value)}});await reviewPayment(offer);}));
$('transfer-form').addEventListener('submit',event=>{event.preventDefault();run(async()=>{
 clearReview();const name=normalizeName($('transfer-name').value),action=$('transfer-action').value,current=session,r=await current.reader.identity(name);let args={owner:current.owner,name,action},detail;
 if(action==='offer'){const recipient=validateJunoAddress($('recipient').value.trim()),hours=Number($('hours').value);if(!Number.isInteger(hours)||hours<1||hours>168)throw Error('Choose 1–168 hours.');args={...args,recipient,expiresAt:Math.min(now()+hours*3600,r.expires_at)};detail=`Recipient: ${recipient}\nOffer expires: ${new Date(args.expiresAt*1000).toISOString()}`;}
 else {const offer=await current.reader.transferOffer(name);if(!offer)throw Error('No active transfer offer.');args.offerId=offer.id;detail=`Offer ID: ${offer.id}\nCurrent owner: ${offer.owner}\nRecipient: ${offer.recipient}`;}
 showReview(`${action.toUpperCase()} transfer · ${name}\n${detail}\nName expiry is preserved. Old-owner profile and proofs do not transfer.\nNetwork: UNI-7`,async()=>{if(session!==current)throw Error('Wallet connection changed.');await current.client.transfer(args);});
});});
$('profile-form').addEventListener('submit',event=>{event.preventDefault();if(busy)return;
 // Snapshot before run() disables controls: FormData omits disabled fields.
 const profileName=$('profile-name').value,profileFields=Object.fromEntries(new FormData(event.currentTarget));
 run(async()=>{
 clearReview();const current=session,name=normalizeName(profileName),contacts=normalizeContacts(profileFields);const result=await current.reader.profile(name),p=result?.profile;
 if(!result?.active||p?.identity.owner!==current.owner)throw Error('This wallet must own the active test name.');
 const args={owner:current.owner,name,contacts,expectedRevision:p.revision};showReview(`Publish public contacts · ${name}\nProfile revision: ${p.revision}\n${JSON.stringify(contacts,null,2)}\nThese fields will be public on UNI-7.`,async()=>{if(session!==current)throw Error('Wallet connection changed.');await current.client.updateProfile(args);});
});});
$('confirm').addEventListener('click',()=>run(async()=>{const current=review;if(!current)throw Error('Review an action first.');clearReview();await current.action();status('Exact transaction confirmed on UNI-7.');}));
$('discard-review').addEventListener('click',()=>{clearReview();render();});
for(const id of ['name-form','transfer-form','profile-form','quote'])$(id).addEventListener('input',()=>{clearReview();render();});
$('operation').addEventListener('change',()=>{clearReview();render();});
validators=createValidatorPanel({getSession:()=>session,getDeployment:()=>deployment,isBusy:()=>busy,run,showReview,clearReview,status});
render();
