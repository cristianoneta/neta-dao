import {ValidatorStatusReader,validatorStatusText} from './names-v2-validator-status.mjs?v=1';
import {NamesV2Reader} from './names-v2-reader.mjs?v=4';
import {NamesValidatorProofs} from './names-v2-validator-proofs.mjs?v=1';
import {normalizeName,operatorAccount} from './names-profile-core.mjs';

export function createValidatorPanel({getSession,getDeployment,isBusy,run,showReview,clearReview,status}) {
 const $=id=>document.getElementById(id);let flow=null,observationEpoch=0,observationController=null;
 const pairInput=()=>({mainnet:{chain_id:'juno-1',address:$('validator-mainnet').value.trim()},testnet:{chain_id:'uni-7',address:$('validator-testnet').value.trim()}});
 function clearObservation(){observationEpoch++;observationController?.abort();observationController=null;$('validator-observation').textContent='No independent chain check yet.';}
 async function checkPair(pair,label){
  clearObservation();const epoch=observationEpoch,controller=new AbortController();observationController=controller;
  $('validator-observation').textContent='Checking '+label+'…';
  try{const result=await new ValidatorStatusReader().pair(pair,{signal:controller.signal});if(epoch===observationEpoch)$('validator-observation').textContent=label+'\n\n'+validatorStatusText(result);}
  catch(error){if(epoch===observationEpoch)$('validator-observation').textContent='Check unavailable · '+error.message;}
 }
 function reset(){clearObservation();$('validator-current').textContent='No validator link queried.';flow?.reset();flow=null;$('validator-challenge').textContent='';$('validator-proof-details').hidden=true;clearReview();render();}
 function blocked(){const session=getSession();if(!session)return true;try{const i=session.client.load(session.owner);return !!i&&i.phase!=='complete';}catch{return true;}}
 function render(){
  const busy=isBusy(),deployment=getDeployment(),session=getSession(),prepared=flow?.snapshot,mode=$('validator-action').value;
  for(const id of ['validator-name','validator-action','validator-mainnet','validator-testnet'])$(id).disabled=busy;
  for(const id of ['validator-mainnet','validator-testnet'])$(id).disabled=busy||mode!=='link';
  $('validator-pair-fields').hidden=mode!=='link';
  $('validator-check').disabled=busy; $('validator-check').hidden=mode!=='link';
  $('validator-prepare').disabled=busy||!deployment||(mode==='link'&&blocked());
  $('validator-refresh').disabled=busy||!deployment;
  $('validator-unlink').disabled=busy||!deployment||blocked();
  $('validator-discard').disabled=busy||!prepared;
  $('validator-publish').disabled=busy||blocked()||!flow?.ready()||(prepared?.purpose==='link'&&session?.owner!==prepared.profile.identity.owner);
  for(const role of ['mainnet','testnet']) {
   $('validator-sign-'+role).disabled=busy||!prepared||prepared.expiresAt<=Math.floor(Date.now()/1000)||(prepared.purpose==='revoke'&&prepared.role!==role)||!!flow?.proofs[role];
   $('validator-proof-'+role).textContent=!prepared?'Not prepared':prepared.purpose==='revoke'&&prepared.role!==role?'Not required for this revocation':prepared.expiresAt<=Math.floor(Date.now()/1000)?'Expired · prepare again':flow.proofs[role]?'Signature collected · not yet published':'Awaiting operator signature';
  }
  $('validator-progress').textContent=!prepared?'Verify the manifest and prepare the exact name and validator pair.':prepared.expiresAt<=Math.floor(Date.now()/1000)?'Proofs expired. Prepare again; no transaction was sent automatically.':`Prepared for ${prepared.profile.identity.name} · name owner ${prepared.profile.identity.owner} · expires ${new Date(prepared.expiresAt*1000).toLocaleTimeString()}. ${prepared.purpose==='link'?'After both signatures, reconnect this name owner to publish.':'After the operator signature, connect a UNI-7 wallet to pay the revocation network fee.'}`;
 }
 async function readCurrent(name){
  const reader=new NamesV2Reader({deployment:getDeployment()});await reader.verify();
  const response=await reader.profile(normalizeName(name)),p=response?.profile;
  if(!response?.active||!p)throw Error('No active profile for this name.');
  const lines=[`${p.identity.name} · current owner ${p.identity.owner}`,`Profile revision: ${p.revision}`,p.validators?'Operator ownership link stored on UNI-7. Use the separate chain observation below for validator existence and UNI-7 consensus membership. Programme eligibility is not decided here.':'No current validator link.'];
  if(p.validators)for(const role of ['mainnet','testnet'])lines.push(`${role}: ${p.validators[role].chain_id} · ${p.validators[role].address}`);
  $('validator-current').textContent=lines.join('\n');return p;
 }
 $('validator-form').addEventListener('submit',event=>{event.preventDefault();if(isBusy())return;
  const name=$('validator-name').value,pair=pairInput(),mode=$('validator-action').value,owner=getSession()?.owner;
  run(async()=>{reset();flow=new NamesValidatorProofs({reader:new NamesV2Reader({deployment:getDeployment()})});
   const prepared=await flow.prepare({name,pair,owner,purpose:mode==='link'?'link':'revoke',role:mode==='link'?null:mode.replace('revoke-','')});
   $('validator-name').value=prepared.profile.identity.name.replace(/\.neta$/,'');
   $('validator-challenge').textContent=prepared.text;
   $('validator-proof-details').hidden=false;
   for(const role of ['mainnet','testnet'])$('validator-signer-'+role).textContent=`${prepared.pair[role].chain_id} · ${operatorAccount(prepared.pair[role].address)}`;
   status('Ownership challenge checked against the UNI-7 contract. Each operator signs separately; this sends no transaction.');
  });
 });
 for(const role of ['mainnet','testnet'])$('validator-sign-'+role).addEventListener('click',()=>run(async()=>{
  clearReview();if(!flow)throw Error('Prepare the validator challenge first.');await flow.sign(role);
  status(`${role==='mainnet'?'Mainnet':'UNI-7'} ownership signature collected. No transaction sent. ${flow.ready()?'Reconnect the publishing wallet, then Review publication.':'Select the other operator wallet and sign its proof.'}`);
 }));
 $('validator-publish').addEventListener('click',()=>run(async()=>{
  clearReview();const prepared=await flow.review(),current=getSession(),s=prepared.snapshot;
  if(!current)throw Error('Connect the publishing wallet.');
  if(s.purpose==='link'&&current.owner!==s.profile.identity.owner)throw Error('Reconnect the name owner to publish.');
  const action=s.purpose==='link'?'Publish validator ownership link':'Revoke operator consent and remove validator link';
  showReview(`${action} · ${s.profile.identity.name}\nName owner: ${s.profile.identity.owner}\nTransaction payer: ${current.owner}\nProfile revision: ${s.profile.revision}\nMainnet operator: ${s.pair.mainnet.address}\nUNI-7 operator: ${s.pair.testnet.address}\nProof expires: ${new Date(s.expiresAt*1000).toISOString()}\nDestination: ${getDeployment().profile_contract}\nNetwork: UNI-7 · no mainnet transaction\n${s.purpose==='link'?'The contract verifies both signatures. No programme points are awarded by this action.':'The operator signature withdraws the link without requiring name-owner consent.'}`,async()=>{
   if(getSession()!==current)throw Error('Wallet connection changed. Review again.');
   await current.client.validatorWrite({payer:current.owner,prepared});reset();
  });
 }));
 $('validator-unlink').addEventListener('click',()=>run(async()=>{
  clearReview();const current=getSession(),name=normalizeName($('validator-name').value),p=await readCurrent(name);
  if(!current||p.identity.owner!==current.owner||!p.validators)throw Error('Connect the current name owner with an existing validator link.');
  const args={owner:current.owner,name,expectedRevision:p.revision,expectedPair:p.validators};
  showReview(`Remove validator link · ${name}\nOwner: ${current.owner}\nMainnet: ${p.validators.mainnet.address}\nUNI-7: ${p.validators.testnet.address}\nProfile revision: ${p.revision}\nPublic contacts and name ownership remain unchanged.\nNetwork: UNI-7`,async()=>{
   if(getSession()!==current)throw Error('Wallet connection changed. Review again.');await current.client.unlinkValidators(args);reset();
  });
 }));
 $('validator-check').addEventListener('click',()=>run(async()=>{await checkPair(pairInput(),'Entered operator addresses · ownership not checked');status('Read-only chain check completed. No wallet signature or transaction.');}));
 $('validator-refresh').addEventListener('click',()=>run(async()=>{clearObservation();const p=await readCurrent($('validator-name').value);if(p.validators)await checkPair(p.validators,'Stored ownership link · '+p.identity.name);status('Current profile and available chain observations read. No transaction sent.');}));
 $('validator-discard').addEventListener('click',()=>{reset();status('Unpublished ownership proofs discarded from this tab. Pending transaction records are preserved.');});
 $('validator-form').addEventListener('input',reset);
 $('validator-action').addEventListener('change',reset);
 // Only update the small local expiry display; no background network polling.
 const timer=setInterval(()=>{if(flow?.snapshot&&!document.hidden)render();},1000);
 window.addEventListener('pagehide',()=>{clearInterval(timer);observationController?.abort();},{once:true});
 render();return {render,reset};
}
