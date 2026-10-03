import {FAUCET} from './juno-faucet-config.mjs';
import {CHAIN, DENOM, RPCS, CHAIN_CONFIG, Uni7Reader, amountToMicro, formatMicro, rewardsMicro, messagesFor} from './juno-faucet-core.mjs';
const $ = id => document.getElementById(id), reader = new Uni7Reader(), bundle = window.NetaFaucetSigning;
const state = {address:null, data:null, validators:[], unbonding:null, busy:false, revision:0, service:null, action:null};
const text = (id,value) => { $(id).textContent=value; };
const active = v => v.status === 'BOND_STATUS_BONDED' && !v.jailed;
const stakeOf = v => state.data?.delegations.find(d=>d.delegation.validator_address===v)?.balance.amount || '0';
function notice(message, error=false) { text('action-message',message); $('action-status').hidden=false; $('action-status').dataset.error=String(error); }
function controls() {
  $('connect').disabled=state.busy; $('refresh').disabled=state.busy;
  $('request').disabled=state.busy || !state.address || !state.service?.ready || (state.service.nextClaimAt && Date.parse(state.service.nextClaimAt)>Date.now()) || state.service.pending;
  $('donate').disabled=state.busy || !state.address || !state.data || !state.service;
  $('claim').disabled=state.busy || !state.data || BigInt(rewardsMicro(state.data.rewards.total))<1n;
  $('transaction-confirm').disabled=state.busy;
  for(const b of document.querySelectorAll('[data-action]')) b.disabled=state.busy || !state.data || (b.dataset.action==='stake' ? !active(state.validators.find(v=>v.operator_address===b.dataset.validator)) : BigInt(stakeOf(b.dataset.validator))===0n);
}
function resetAccount() {
  state.address=null; state.data=null; state.service=null; state.revision++; state.action=null;
  $('transaction-dialog').close(); text('connect','Connect Keplr'); text('wallet','Your wallet is not connected.');
  renderWallet(); renderValidators(); controls();
}
async function assertWallet(expected = state.address) {
  if(!expected || expected!==state.address) throw Error('Connect Keplr again before continuing.');
  const accounts=await window.keplr.getOfflineSigner(CHAIN).getAccounts();
  if(accounts[0]?.address!==expected) { resetAccount(); throw Error('Your Keplr account changed. Connect again.'); }
}
async function run(task) {
  if(state.busy)return;
  state.busy=true; controls();
  try { await task(); } catch(error) { notice(error.message || 'The action could not be completed.',true); }
  finally { state.busy=false; controls(); }
}
async function api(path, options={}) {
  if(!FAUCET.api || !FAUCET.address) throw Error('Faucet payouts are not active yet.');
  const response=await fetch(FAUCET.api+path,{...options,headers:{'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(75000)});
  const data=await response.json();
  if(!response.ok) throw Error(data.error || 'Faucet service unavailable.');
  return data;
}
async function serviceStatus() {
  state.service=null;
  if(!FAUCET.api || !FAUCET.address) return;
  const address=state.address, revision=state.revision;
  try {
    const data=await api('/status'+(address?'?address='+encodeURIComponent(address):''));
    if(data.chainId!==CHAIN || data.amount!=='10000000' || data.intervalSeconds!==86400 || data.address!==FAUCET.address || !bundle.validAddress(data.address)) throw Error('Faucet configuration mismatch.');
    if(revision!==state.revision)return;
    state.service=data;
    text('faucet-status', data.pending ? 'Your previous request is pending. Refresh to check its outcome.' : data.nextClaimAt && Date.parse(data.nextClaimAt)>Date.now() ? 'Next payout available '+new Date(data.nextClaimAt).toLocaleString('en-GB')+'.' : data.ready ? address ? 'Ready. Confirm wallet ownership in Keplr to receive 10 JUNOX. No fee is charged to you.' : 'Connect Keplr to receive 10 JUNOX.' : 'Payouts are temporarily paused. Please check back later.');
    text('faucet-balance','Faucet balance: '+formatMicro(data.balance)+' JUNOX · '+data.address);
  } catch(error) { if(revision===state.revision) { text('faucet-status',error.message); text('faucet-balance','Faucet balance unavailable.'); } }
  controls();
}
function renderWallet() {
  const d=state.data;
  for(const id of ['available','staked','unbonding','rewards'])text(id,'—');
  $('unbonding-list').replaceChildren(); $('unbonding-list').hidden=true; $('withdraw-address').hidden=true;
  if(!d) { text('wallet-help',state.address?'Wallet data unavailable. Refresh before submitting a transaction.':'Connect Keplr to see your balances, stake and rewards.'); return; }
  text('available',formatMicro(d.balance)); text('staked',formatMicro(d.delegations.reduce((n,x)=>n+BigInt(x.balance.amount),0n)));
  text('unbonding',formatMicro(d.unbondings.flatMap(x=>x.entries).reduce((n,x)=>n+BigInt(x.balance),0n))); text('rewards',formatMicro(rewardsMicro(d.rewards.total)));
  text('wallet-help','Balances refreshed '+new Date().toLocaleTimeString('en-GB')+'. Keep some JUNOX available for transaction fees.');
  text('withdraw-address','Rewards are paid to '+d.withdraw+(d.withdraw===state.address?' (your connected wallet).':' (your configured withdrawal address).'));
  $('withdraw-address').hidden=false;
  for(const row of d.unbondings)for(const e of row.entries){const li=document.createElement('li');li.textContent=formatMicro(e.balance)+' JUNOX · available '+new Date(e.completion_time).toLocaleString('en-GB');$('unbonding-list').append(li);}
  $('unbonding-list').hidden=!$('unbonding-list').children.length;
}
function renderValidators() {
  const list=$('validators'), query=$('validator-search').value.trim().toLowerCase(), filter=$('validator-filter').value;
  list.replaceChildren();
  const rows=state.validators.filter(v=>(filter==='all'||filter==='active'&&active(v)||filter==='mine'&&BigInt(stakeOf(v.operator_address))>0n)&&((v.description?.moniker||'')+' '+v.operator_address).toLowerCase().includes(query));
  text('validator-count',rows.length+' shown · '+state.validators.length+' total');
  for(const v of rows){
    const row=document.createElement('article'); row.className='validator-row';
    const name=document.createElement('div'); name.className='validator-name';
    const title=document.createElement('strong');title.textContent=v.description?.moniker||'Unnamed validator';
    const address=document.createElement('small');address.textContent=v.operator_address;
    name.append(title,address);
    if(!active(v)){const status=document.createElement('span');status.className='validator-state';status.textContent=v.jailed?'Jailed':'Inactive';name.append(status);}
    row.append(name);
    for(const [label,value] of [['Commission',Number(v.commission?.commission_rates?.rate)*100],['Your stake',state.data?formatMicro(stakeOf(v.operator_address))+' JUNOX':'Connect wallet']]){
      const metric=document.createElement('div');metric.className='validator-metric';const small=document.createElement('small'),span=document.createElement('span');small.textContent=label;
      span.textContent=typeof value==='number'?(Number.isFinite(value)?value.toLocaleString('en-US',{maximumFractionDigits:2})+'%':'Unavailable'):value;metric.append(small,span);row.append(metric);
    }
    const actions=document.createElement('div');actions.className='validator-actions';
    for(const action of ['stake','unstake']){const b=document.createElement('button');b.type='button';b.dataset.action=action;b.dataset.validator=v.operator_address;b.textContent=action==='stake'?'Stake':'Unstake';b.setAttribute('aria-label',b.textContent+' with '+(v.description?.moniker||v.operator_address));actions.append(b);}
    row.append(actions);list.append(row);
  }
  if(!rows.length){const p=document.createElement('p');p.textContent=state.validators.length?'No validators match this view.':'Validator data is unavailable.';list.append(p);}
  controls();
}
async function refresh() {
  const address=state.address, revision=++state.revision;
  state.data=null; state.validators=[]; renderWallet();renderValidators();controls();text('chain-status','Reading the current UNI-7 validator set…');
  try {
    await reader.verify();
    const [v,d]=await Promise.allSettled([reader.validators(),address?reader.account(address):Promise.resolve(null)]);
    if(revision!==state.revision)return;
    if(v.status==='fulfilled'){
      state.validators=v.value.rows;state.unbonding=v.value.unbonding;
      const seconds=Number.parseFloat(state.unbonding);
      text('unstaking-help',Number.isFinite(seconds)?'Unstaking takes approximately '+(seconds/86400).toLocaleString('en-US',{maximumFractionDigits:2})+' days. Tokens and rewards may change until your transaction is included.':'Unstaking starts the network’s unbonding period.');
      text('chain-status','Live UNI-7 data · refreshed '+new Date().toLocaleTimeString('en-GB')+' · alphabetical order');
    }else text('chain-status',v.reason.message);
    if(d.status==='fulfilled')state.data=d.value; else notice(d.reason.message,true);
  }catch(error){if(revision===state.revision)text('chain-status',error.message);}
  if(revision!==state.revision)return;
  renderWallet();renderValidators();controls();await serviceStatus();
}
async function sign(messages,memo,address) {
  await assertWallet(address); await reader.verify();
  const keplr=window.keplr, signer=keplr.getOfflineSigner(CHAIN);
  const wrapped={getAccounts:()=>signer.getAccounts(),signDirect:async(a,doc)=>{await assertWallet(address);if(a!==address||doc.chainId!==CHAIN)throw Error('Unexpected signing account or chain');return keplr.signDirect(CHAIN,a,doc,{preferNoSetFee:true});},signAmino:async(a,doc)=>{await assertWallet(address);if(a!==address||doc.chain_id!==CHAIN)throw Error('Unexpected signing account or chain');return keplr.signAmino(CHAIN,a,doc,{preferNoSetFee:true});}};
  let client;
  for(const rpc of RPCS){try{client=await bundle.connect(rpc,wrapped);break;}catch(error){if(/mismatch/.test(error.message))throw error;}}
  if(!client)throw Error('UNI-7 signing is currently unavailable.');
  try {await assertWallet(address);notice('Review the transaction and fee in Keplr.');const result=await bundle.broadcast(client,address,messages,memo);notice('Transaction confirmed on UNI-7 · '+result.transactionHash);return result;}
  finally{client.disconnect();}
}
$('dismiss-status').addEventListener('click',()=>{$('action-status').hidden=true;});
$('connect').addEventListener('click',()=>run(async()=>{
  if(!window.keplr)throw Error('Install the Keplr browser extension to connect your UNI-7 wallet.');
  await window.keplr.experimentalSuggestChain(CHAIN_CONFIG);await window.keplr.enable(CHAIN);
  const address=(await window.keplr.getOfflineSigner(CHAIN).getAccounts())[0]?.address;
  if(!bundle.validAddress(address))throw Error('Invalid UNI-7 wallet address.');
  state.address=address;text('connect','Reconnect Keplr');text('wallet','Connected on UNI-7 · '+address);await refresh();
}));
$('refresh').addEventListener('click',()=>run(refresh));
$('validator-search').addEventListener('input',renderValidators);$('validator-filter').addEventListener('change',renderValidators);
window.addEventListener('keplr_keystorechange',()=>{resetAccount();notice('Keplr account changed. Connect again to load the current wallet.');});
$('request').addEventListener('click',()=>run(async()=>{
  const address=state.address;await assertWallet(address);await serviceStatus();if(!state.service?.ready || state.service.pending || Date.parse(state.service.nextClaimAt)>Date.now())throw Error('A payout is not available for this wallet yet.');
  const challenge=await api('/challenge',{method:'POST',body:JSON.stringify({address})});
  if(challenge.address!==address || challenge.chainId!==CHAIN || typeof challenge.message!=='string' || !challenge.message.startsWith('NETA JUNOX faucet\n'))throw Error('Unexpected faucet challenge.');
  const signature=await window.keplr.signArbitrary(CHAIN,address,challenge.message);await assertWallet(address);
  notice('Requesting 10 JUNOX. Please wait for confirmation.');
  try {
    const result=await api('/claim',{method:'POST',body:JSON.stringify({id:challenge.id,address,signature})});
    if(state.address!==address)return;
    notice(result.status==='confirmed'?'10 JUNOX received · '+result.hash:result.status==='failed'?'The payout failed. No tokens were transferred; you can request again.':'Payout pending. Refresh to check confirmation; do not submit a second request.',result.status==='failed');
  }catch(error){notice(error.message+' Refresh to check whether the payout was received.',true);}
  await refresh();
}));
function openAction(action,target){
  state.action={action,target,address:state.address};text('transaction-error','');
  text('transaction-heading',action==='donate'?'Donate JUNOX':action==='stake'?'Stake JUNOX':'Unstake JUNOX');
  const validator=state.validators.find(v=>v.operator_address===target);
  text('transaction-target',action==='donate'?'Faucet · '+target:(validator?.description?.moniker||'Validator')+' · '+target);
  $('transaction-amount').value=action==='donate'?$('donation').value:'';
  $('transaction-amount').inputMode=action==='donate'?'numeric':'decimal';
  text('transaction-help',action==='unstake'?'Currently staked: '+formatMicro(stakeOf(target))+' JUNOX. '+$('unstaking-help').textContent:'Available: '+formatMicro(state.data.balance)+' JUNOX. Leave enough for the network fee; Keplr shows the final fee.');
  $('transaction-dialog').showModal();$('transaction-amount').focus();
}
$('donate-form').addEventListener('submit',event=>{event.preventDefault();try{amountToMicro($('donation').value,true);if(!state.service||!state.data||state.busy)return;openAction('donate',FAUCET.address);}catch(error){notice(error.message,true);}});
$('validators').addEventListener('click',event=>{const b=event.target.closest('[data-action]');if(b&&!b.disabled)openAction(b.dataset.action,b.dataset.validator);});
$('transaction-cancel').addEventListener('click',()=>$('transaction-dialog').close());
$('transaction-form').addEventListener('submit',event=>{event.preventDefault();run(async()=>{
  const action=state.action;if(!action)throw Error('Choose an action again.');
  try {
    const amount=$('transaction-amount').value, micro=BigInt(amountToMicro(amount,action.action==='donate'));
    await assertWallet(action.address);await reader.verify();
    const fresh=await reader.account(action.address);await assertWallet(action.address);
    if(action.action==='unstake'){
      const staked=fresh.delegations.find(d=>d.delegation.validator_address===action.target)?.balance.amount||'0';
      if(micro>BigInt(staked))throw Error('Amount exceeds your current stake with this validator.');
    }else if(micro>=BigInt(fresh.balance))throw Error('Leave JUNOX in your wallet for transaction fees.');
    if(action.action==='donate') {await serviceStatus();if(!state.service||action.target!==FAUCET.address)throw Error('Faucet funding address could not be verified.');}
    if(action.action==='stake') {const validator=(await reader.validators()).rows.find(v=>v.operator_address===action.target);if(!validator||!active(validator))throw Error('This validator is no longer active.');}
    await sign(messagesFor(action.action,action.address,action.target,amount),'NETA UNI-7 '+action.action,action.address);
    $('transaction-dialog').close();await refresh();
  }catch(error){text('transaction-error',error.message);throw error;}
});});
$('claim').addEventListener('click',()=>run(async()=>{
  const address=state.address;await assertWallet(address);await reader.verify();const d=await reader.account(address);await assertWallet(address);
  state.data=d;renderWallet();
  const validators=d.rewards.rewards.filter(r=>BigInt(rewardsMicro(r.reward))>0n).map(r=>r.validator_address);
  if(!validators.length)throw Error('No whole micro-JUNOX rewards are available to claim.');
  // Bound transaction gas/size. Further validators can be claimed after refresh.
  const batch=validators.slice(0,20);
  await sign(batch.map(validatorAddress=>({typeUrl:'/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',value:{delegatorAddress:address,validatorAddress}})),'NETA UNI-7 claim rewards',address);
  if(validators.length>20)notice('Rewards claimed for 20 validators. Claim again for the remaining validators.');
  await refresh();
}));
await refresh();
