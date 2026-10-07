// State-driven recovery UI. Rendering, polling and reconciliation never sign.
import {contactInvitation,invitedContact} from './relay-personal-contacts.mjs';
export function mountPersonalInbox({root,controller,authorizeBackup,pollInterval=30000}){
  if(!root||!controller||typeof authorizeBackup!=='function')throw Error('Personal inbox dependencies required');
  const doc=root.ownerDocument,win=doc.defaultView,make=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  root.classList.add('personal-inbox');root.replaceChildren();
  let review=null,action=null,working=false,disposed=false,wasOpen=false,mode='loading',authNeeded=false,timer=null;
  const heading=make('h3','Personal messages'),notice=make('p'),error=make('p'),setup=make('section'),actions=make('div'),history=make('ol');
  notice.setAttribute('role','status');error.setAttribute('role','alert');history.setAttribute('aria-label','Encrypted message history');setup.setAttribute('aria-label','Open your encrypted inbox');
  const field=(label,tag='input')=>{const wrap=make('label',label),input=make(tag);wrap.append(input);return {wrap,input};};
  const recovery=field('Recovery code');recovery.input.type='password';recovery.input.autocomplete='off';recovery.input.spellcheck=false;
  const saved=make('input');saved.type='checkbox';const savedLabel=make('label','I saved this recovery code separately.');savedLabel.prepend(saved);
  const setupText=make('p'),setupTitle=make('h4'),codeHelp=make('p','Keep this code in your password manager or another safe place. It unlocks your messages; it is not your wallet seed.');
  const address=field('Contact .neta name or wallet'),message=field('Message','textarea');address.input.autocomplete='off';message.input.maxLength=1800;
  address.input.value=invitedContact(win.location);
  const invitation=make('p',address.input.value?'Contact invitation: review this address before allowing messages.':'');
  const reviewPanel=make('section'),reviewText=make('pre'),reviewSummary=make('p'),technical=make('details'),confirm=make('button','Confirm in Keplr');reviewPanel.hidden=true;reviewPanel.tabIndex=-1;reviewPanel.setAttribute('aria-label','Review personal action');technical.append(make('summary','Transaction details'),reviewText);reviewPanel.append(make('h4','Confirm action'),reviewSummary,technical,confirm);
  const controls=[];
  const authError=e=>/Backup authentication expired|Backup authorization expired|Authorize encrypted backup/.test(e.message||'');
  function button(label,fn){const b=make('button',label);b.type='button';b.onclick=()=>void perform(fn);controls.push(b);return b;}
  async function perform(fn,{reconcile=true}={}){
    if(working||disposed||controller.busy)return;working=true;error.textContent='';render(controller.status());
    try{await fn();}
    catch(e){
      if(disposed)return;
      error.textContent=e.message;authNeeded=authError(e);
      // Only inspect saved evidence. Never repeat the failed action or sign.
      if(reconcile&&!authNeeded&&controller.status().needsRecovery){
        try{await controller.recover();}catch(next){authNeeded=authError(next);}
      }
    }finally{working=false;if(!disposed)render(controller.status());}
  }
  function clearReview(){review=null;action=null;reviewPanel.hidden=true;reviewText.textContent='';reviewSummary.textContent='';}
  function show(value,submit){
    if(disposed)return;review=value;action=submit;
    const request=value.request||value,kind=Object.keys(request.msg||{})[0]||'action',target=request.msg?.[kind]?.recipient||request.msg?.[kind]?.address||request.owner;
    const labels={register:'Register this inbox',allow_sender:request.msg.allow_sender?.allowed?'Allow messages from this contact':'Remove contact permission',set_block:request.msg.set_block?.blocked?'Block this contact':'Unblock this contact',send:'Send encrypted message',send_initial:'Send encrypted message',add_prekeys:'Refresh device keys'};
    reviewSummary.textContent=(value.kind==='rotate'?'Use a new messaging device':labels[kind]||kind)+' · Juno mainnet\nFrom: '+request.owner+'\nContact: '+target+'\nKeplr will show the network fee.'+(value.kind==='rotate'?'\nExisting device permissions must be renewed. Your saved history is preserved.':'');
    reviewText.textContent=JSON.stringify(request,null,2);reviewPanel.hidden=false;reviewPanel.focus();
  }
  async function inspect(remote=false){mode=await controller.entryMode({remote});if(mode==='create'){recovery.input.value=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');recovery.input.type='text';saved.checked=false;}render(controller.status());}
  async function authorize(){await authorizeBackup();authNeeded=false;}
  const entry=button('Continue with wallet',async()=>{
    await authorize();
    if(mode==='check_backup'||mode==='loading'){await inspect(true);return;}
    if(mode==='create'){
      if(!saved.checked)throw Error('Save your recovery code before continuing');
      await controller.create(recovery.input.value);recovery.input.value='';recovery.input.type='password';
      show(await controller.reviewRegistration(),r=>controller.submitRegistration(r));
    }else{
      const chosen=mode;
      if(!['unlock','restore'].includes(chosen))throw Error('Check your inbox setup again');
      await controller[chosen](recovery.input.value);recovery.input.value='';
    }
  });entry.className='personal-primary';
  const copyCode=button('Copy recovery code',()=>win.navigator.clipboard.writeText(recovery.input.value));
  const registration=button('Register inbox',async()=>show(await controller.reviewRegistration(),r=>controller.submitRegistration(r)));
  const auth=button('Renew backup access',async()=>{await authorize();if(controller.status().open)await controller.recover();else await inspect(true);});
  const refresh=button('Check for new messages',()=>controller.receive());
  const recover=button('Check pending actions',()=>controller.recover());
  const rotation=button('Use this as my messaging device',async()=>show(await controller.prepareRotation(),r=>controller.submitLifecycle(r)));
  const prepared=button('Review prepared device change',async()=>show(await controller.reviewPrepared(),r=>controller.submitLifecycle(r)));
  const refill=button('Refresh device keys',async()=>show(await controller.prepareRefill(),r=>controller.submitLifecycle(r)));
  const send=button('Send message',async()=>show(await controller.prepareMessage(address.input.value.trim(),message.input.value),r=>controller.submitMessage(r)));
  const allow=button('Allow messages',async()=>show(await controller.reviewContact('consent',address.input.value.trim(),true),r=>controller.submitLifecycle(r)));
  const deny=button('Remove permission',async()=>show(await controller.reviewContact('consent',address.input.value.trim(),false),r=>controller.submitLifecycle(r)));
  const block=button('Block contact',async()=>show(await controller.reviewContact('block',address.input.value.trim(),true),r=>controller.submitLifecycle(r)));
  const unblock=button('Unblock contact',async()=>show(await controller.reviewContact('block',address.input.value.trim(),false),r=>controller.submitLifecycle(r)));
  const share=button('Copy my contact invitation',async()=>{await win.navigator.clipboard.writeText(contactInvitation(win.location,controller.scopeObject.wallet));invitation.textContent='Invitation copied. The other person must explicitly allow your address.';});
  const pending=make('div'),close=button('Lock inbox',async()=>{clearReview();recovery.input.value='';message.input.value='';await controller.lockInbox();await inspect();});
  confirm.type='button';confirm.onclick=()=>void perform(async()=>{const value=review,submit=action;clearReview();if(!value||!submit)throw Error('Review the action again');await submit(value);message.input.value='';});
  for(const input of [address.input,message.input,recovery.input])input.addEventListener('input',clearReview);
  const deviceTools=make('details');deviceTools.append(make('summary','Device and backup'),refill,rotation,prepared,refresh,share);
  const contacts=make('details');contacts.append(make('summary','Contact permissions'),allow,deny,block,unblock);send.className=confirm.className='personal-primary';
  setup.append(setupTitle,setupText,recovery.wrap,codeHelp,copyCode,savedLabel,entry);
  actions.append(registration,auth,recover,close,deviceTools);
  root.append(heading,notice,error,setup,actions,history,invitation,address.wrap,contacts,message.wrap,send,pending,reviewPanel);
  function render(state){
    if(disposed)return;
    for(const b of [...controls,confirm])b.disabled=working||state.busy||state.closed;
    const open=state.open,blocked=state.needsRecovery||authNeeded||!!state.pending?.length||state.operation==='pending';
    setup.hidden=open;actions.hidden=!open;history.hidden=!open;invitation.hidden=!open;
    for(const el of [address.wrap,contacts,message.wrap,send])el.hidden=!open||!state.registered;
    const showCode=!open&&['create','unlock','restore'].includes(mode);recovery.wrap.hidden=!showCode;
    for(const el of [codeHelp,copyCode,savedLabel])el.hidden=open||mode!=='create';
    entry.disabled||=mode==='loading'||(mode==='create'&&!saved.checked);
    setupTitle.textContent={loading:'Checking this browser…',check_backup:'Open your inbox',create:'Save your recovery code',unlock:'Unlock this browser',restore:'Restore your inbox'}[mode]||'Open your inbox';
    setupText.textContent={loading:'Your saved state stays in place.',check_backup:'Continue with a wallet signature to check your encrypted backup. No network fee.',create:'Save this code first. The next step registers your inbox in Keplr.',unlock:'Your encrypted inbox is already saved on this browser.',restore:'An encrypted backup was found. Restore it here with your recovery code.'}[mode]||'';
    entry.textContent={loading:'Checking…',check_backup:'Continue with wallet',create:'Create inbox',unlock:'Unlock inbox',restore:'Restore inbox'}[mode]||'Continue';
    registration.hidden=!open||state.registered;registration.disabled||=blocked;
    auth.hidden=!open||!authNeeded;recover.hidden=!open||authNeeded||(!state.needsRecovery&&!state.pending?.length&&state.operation!=='pending');
    deviceTools.hidden=!open||!state.registered;
    prepared.hidden=!state.prepared;rotation.hidden=!!state.prepared;
    if(state.readOnly&&open&&state.registered)deviceTools.open=true;
    for(const b of [send,allow,deny,block,unblock,refill])b.disabled||=state.readOnly||blocked;
    rotation.disabled||=blocked;prepared.disabled||=blocked;refresh.disabled||=blocked;
    notice.textContent=!open?'':authNeeded?'Backup access expired. Renew it to continue safely.':state.needsRecovery?'A saved action needs checking. Your keys and pending messages are preserved.':state.readOnly?'History restored. Confirm this browser as your messaging device before sending.':!state.registered?'Your encrypted inbox is saved. Confirm its registration in Keplr.':state.pending?.length?'Message saved. Waiting for confirmation or your review.':state.backupPending?'Saving encrypted backup…':'Inbox ready · encrypted backup confirmed';
    const followHistory=history.scrollHeight-history.scrollTop-history.clientHeight<32;
    history.replaceChildren();for(const row of state.history||[]){const li=make('li'),meta=make('small',(row.direction==='in'?'From ':'To ')+(row.direction==='in'?row.meta.sender:row.meta.recipient)),body=make('p',row.text);li.append(meta,body);history.append(li);}
    if(followHistory)history.scrollTop=history.scrollHeight;
    pending.replaceChildren();for(const row of state.pending||[]){
      const retryable=row.state==='ready'&&(!row.outcome||['not_broadcast','failed'].includes(row.outcome));
      const label=make('p',retryable?'Saved message · review to send':'Checking transaction confirmation. This message will not be resent automatically.');pending.append(label);
      if(retryable){const retry=make('button','Review saved message');retry.type='button';retry.disabled=working||state.busy||state.readOnly||state.needsRecovery||authNeeded;retry.onclick=()=>void perform(async()=>show(await controller.reviewPending(row.id),r=>controller.submitMessage(r)));pending.append(retry);}
    }
    if(state.closed||(!open&&wasOpen)){clearReview();message.input.value='';recovery.input.value='';saved.checked=false;recovery.input.type='password';if(state.closed){address.input.value='';error.textContent='';}}
    wasOpen=open;
  }
  saved.addEventListener('change',()=>render(controller.status()));
  async function tick(){
    timer=null;if(disposed)return;
    const s=controller.status();
    if(doc.visibilityState==='visible'&&s.open&&s.registered&&!working&&!s.busy&&!authNeeded&&!s.needsRecovery&&!review){
      if(s.pending?.length||s.operation==='pending')await perform(()=>controller.recover(),{reconcile:false});
      else await perform(()=>controller.receive());
    }
    if(!disposed&&pollInterval>0)timer=win.setTimeout(tick,pollInterval);
  }
  const previous=controller.onState;controller.onState=state=>{previous(state);render(state);};render(controller.status());
  void perform(()=>inspect(),{reconcile:false});if(pollInterval>0)timer=win.setTimeout(tick,pollInterval);
  return {dispose(){disposed=true;if(timer)win.clearTimeout(timer);controller.onState=previous;recovery.input.value='';root.replaceChildren();void controller.close();}};
}
