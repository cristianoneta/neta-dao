// Recovery UI. The workspace mounts this only for a source-pinned release and
// an explicitly opened mainnet wallet session. No fixtures here.
export function mountPersonalInbox({root,controller,authorizeBackup}){
  if(!root||!controller||typeof authorizeBackup!=='function')throw Error('Personal inbox dependencies required');
  const doc=root.ownerDocument,make=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  root.classList.add('personal-inbox');root.replaceChildren();let review=null,action=null,working=false,disposed=false,wasOpen=false;
  const heading=make('h3','Personal messages'),notice=make('p'),error=make('p'),actions=make('div'),history=make('ol');
  notice.setAttribute('role','status');error.setAttribute('role','alert');history.setAttribute('aria-label','Encrypted message history');
  const field=(label,tag='input')=>{const wrap=make('label',label),input=make(tag);wrap.append(input);return {wrap,input};};
  const recovery=field('Recovery code');recovery.input.type='password';recovery.input.autocomplete='off';recovery.input.spellcheck=false;
  const saved=make('input');saved.type='checkbox';const savedLabel=make('label','I saved this recovery code separately.');savedLabel.prepend(saved);
  const address=field('Contact wallet'),message=field('Message','textarea');address.input.autocomplete='off';message.input.maxLength=1800;
  const reviewPanel=make('section'),reviewText=make('pre'),reviewSummary=make('p'),technical=make('details'),confirm=make('button','Confirm in Keplr');reviewPanel.hidden=true;reviewPanel.tabIndex=-1;reviewPanel.setAttribute('aria-label','Review personal action');technical.append(make('summary','Transaction details'),reviewText);reviewPanel.append(make('h4','Review'),reviewSummary,technical,confirm);
  const controls=[];
  function button(label,fn){const b=make('button',label);b.type='button';b.onclick=()=>perform(fn);controls.push(b);return b;}
  async function perform(fn){if(working||disposed)return;working=true;error.textContent='';render(controller.status());try{await fn();}catch(e){if(!disposed)error.textContent=e.message;}finally{working=false;if(!disposed)render(controller.status());}}
  function clearReview(){review=null;action=null;reviewPanel.hidden=true;reviewText.textContent='';}
  function show(value,submit){review=value;action=submit;const request=value.request||value;const kind=Object.keys(request.msg||{})[0]||'action';const target=request.msg?.[kind]?.recipient||request.msg?.[kind]?.address||request.owner;reviewSummary.textContent='Juno mainnet · '+kind.replaceAll('_',' ')+'\nWallet: '+request.owner+'\nFor: '+target+'\nKeplr will show the network fee.';reviewText.textContent=JSON.stringify(value.request||value,null,2);reviewPanel.hidden=false;reviewPanel.focus();}
  const generate=button('Generate recovery code',()=>{recovery.input.value=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');recovery.input.type='text';saved.checked=false;});
  const auth=button('Authorize encrypted backup',authorizeBackup);
  const create=button('Create encrypted inbox',async()=>{if(!saved.checked)throw Error('Save the recovery code before creating your inbox');await controller.create(recovery.input.value);recovery.input.value='';recovery.input.type='password';});
  const unlock=button('Unlock this browser',async()=>{await controller.unlock(recovery.input.value);recovery.input.value='';});
  const restore=button('Restore in this browser',async()=>{await controller.restore(recovery.input.value);recovery.input.value='';});
  const registration=button('Review registration',async()=>show(await controller.reviewRegistration(),r=>controller.submitRegistration(r)));
  const refresh=button('Read new messages',()=>controller.receive());
  const recover=button('Recover pending actions',()=>controller.recover());
  const rotation=button('Review new device generation',async()=>show(await controller.prepareRotation(),r=>controller.submitLifecycle(r)));
  const prepared=button('Review saved device action',async()=>show(await controller.reviewPrepared(),r=>controller.submitLifecycle(r)));
  const refill=button('Review prekey refill',async()=>show(await controller.prepareRefill(),r=>controller.submitLifecycle(r)));
  const send=button('Review encrypted message',async()=>show(await controller.prepareMessage(address.input.value.trim(),message.input.value),r=>controller.submitMessage(r)));
  const allow=button('Review contact consent',async()=>show(await controller.reviewContact('consent',address.input.value.trim(),true),r=>controller.submitLifecycle(r)));
  const deny=button('Review consent removal',async()=>show(await controller.reviewContact('consent',address.input.value.trim(),false),r=>controller.submitLifecycle(r)));
  const block=button('Review block',async()=>show(await controller.reviewContact('block',address.input.value.trim(),true),r=>controller.submitLifecycle(r)));
  const unblock=button('Review unblock',async()=>show(await controller.reviewContact('block',address.input.value.trim(),false),r=>controller.submitLifecycle(r)));
  const pending=make('div'),close=button('Lock inbox',async()=>{clearReview();recovery.input.value='';message.input.value='';await controller.lockInbox();});
  confirm.type='button';confirm.onclick=()=>perform(async()=>{const value=review,submit=action;clearReview();if(!value||!submit)throw Error('Review the action again');await submit(value);message.input.value='';});
  for(const input of [address.input,message.input,recovery.input])input.addEventListener('input',clearReview);
  const deviceTools=make('details');deviceTools.append(make('summary','Device and backup'),rotation,prepared,refill);actions.append(generate,auth,create,unlock,restore,registration,refresh,recover,close,deviceTools);
  const contacts=make('details');contacts.append(make('summary','Contact permissions'),allow,deny,block,unblock);send.className=confirm.className='personal-primary';
  root.append(heading,notice,error,recovery.wrap,savedLabel,actions,address.wrap,contacts,message.wrap,send,pending,reviewPanel,history);
  function render(state){
    if(disposed)return;
    for(const b of [...controls,confirm])b.disabled=working||state.busy||state.closed;
    const open=state.open;
    if(open&&auth.parentNode!==deviceTools)deviceTools.append(auth);
    if(!open&&auth.parentNode!==actions)actions.insertBefore(auth,create);
    for(const el of [recovery.wrap,savedLabel,generate,create,unlock,restore])el.hidden=open;
    for(const b of [registration,refresh,recover,rotation,prepared,refill,send,allow,deny,block,unblock,close])b.hidden=!open;
    address.wrap.hidden=message.wrap.hidden=contacts.hidden=!open;
    if(open){registration.hidden=state.registered;refresh.disabled||=!state.registered;for(const b of [send,allow,deny,block,unblock,refill])b.disabled||=state.readOnly||state.needsRecovery;}
    notice.textContent=!open?'Authorize encrypted backup, then create, unlock or restore your inbox.':state.needsRecovery?'Action interrupted. Recover the saved state before continuing.':state.readOnly?'Restored read-only. Review a new device generation before sending.':state.backupPending?'Encrypted backup awaiting confirmation.':'Encrypted backup confirmed · device generation '+state.generation;
    history.replaceChildren();for(const row of state.history||[]){const li=make('li'),meta=make('small',(row.direction==='in'?'From ':'To ')+(row.direction==='in'?row.meta.sender:row.meta.recipient)),body=make('p',row.text);li.append(meta,body);history.append(li);}
    pending.replaceChildren();for(const row of state.pending||[]){const label=make('p','Pending message · '+row.state+' · '+(row.outcome||'review/recovery required')),retry=make('button','Review saved message');retry.type='button';retry.disabled=working||state.busy||state.readOnly||state.needsRecovery;retry.onclick=()=>perform(async()=>show(await controller.reviewPending(row.id),r=>controller.submitMessage(r)));pending.append(label,retry);}
    if(state.closed||(!open&&wasOpen)){clearReview();message.input.value='';recovery.input.value='';address.input.value='';saved.checked=false;recovery.input.type='password';error.textContent='';}wasOpen=open;
  }
  const previous=controller.onState;controller.onState=state=>{previous(state);render(state);};render(controller.status());
  return {dispose(){disposed=true;controller.onState=previous;root.replaceChildren();void controller.close();}};
}
