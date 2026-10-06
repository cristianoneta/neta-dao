// Gated component: no deployment, account, entitlement or crypto provider is
// inferred from the global DAO browsing selector or from localStorage.
export const DAO_INBOX_DEPLOYMENT = null;
const short = address => address.length>22 ? address.slice(0,12)+'…'+address.slice(-6) : address;
export function groupDaoConversations(records) {
  const groups=new Map(),seen=new Set();
  for(const row of [...records].sort((a,b)=>a.sequence-b.sequence)) {
    if(!Number.isSafeInteger(row.sequence)||row.sequence<1||typeof row.correspondent!=='string')throw Error('Invalid DAO message record');
    if(seen.has(row.sequence))continue;seen.add(row.sequence);
    if(!groups.has(row.correspondent))groups.set(row.correspondent,[]);
    groups.get(row.correspondent).push(row);
  }
  return [...groups].map(([address,messages])=>({address,messages,last:messages.at(-1)})).sort((a,b)=>b.last.sequence-a.last.sequence);
}
export function configurationProposal({contract,identity,enabled,readers,managers}) {
  if(!/^juno1[0-9a-z]{38,90}$/.test(contract)||!identity?.name?.endsWith('.dao.neta')||!Number.isSafeInteger(identity.revision)||identity.revision<1||typeof enabled!=='boolean'||!Array.isArray(managers))throw Error('Invalid mailbox configuration');
  if(readers!=='all_members'&&(!Array.isArray(readers?.selected)||new Set(readers.selected).size!==readers.selected.length||readers.selected.length>32))throw Error('Invalid reader selection');
  const addresses=[...managers,...(readers.selected||[])];
  if(managers.length>32||new Set(managers).size!==managers.length||addresses.some(a=>!/^juno1[0-9a-z]{38,90}$/.test(a)))throw Error('Invalid reader or manager');
  return {type:'wasm_execute',contract,msg:{dao:{configure:{name:identity.name,expected_revision:identity.revision,enabled,readers,managers}}},funds:[]};
}

/** Mount only after a verified deployment and its recovery-capable crypto adapter
 * exist. Tests supply isolated adapters; production does not mount a fake inbox.
 * client: list(wallet), page(name,after), thread(name,address), blockDraft(...),
 * assignDraft(...), submit(review), readable(record,wallet). All async results
 * are invalidated on account, selection, membership or visibility changes.
 */
export function mountDaoInboxes({document,window,client,account}) {
  const card=document.querySelector('.relay-feed-card'), heading=card?.querySelector('header>div');
  if(!card||!heading||!client||typeof account!=='function')throw Error('DAO inbox dependencies unavailable');
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const title=heading.querySelector('h2'), titleRow=make('div','dao-inbox-heading');heading.prepend(titleRow);titleRow.append(title);
  const picker=make('label','dao-mailbox-picker'), select=make('select');select.setAttribute('aria-label','Select inbox');picker.append(select);picker.hidden=true;titleRow.append(picker);
  const panel=make('section','dao-inbox-panel');panel.hidden=true;panel.setAttribute('aria-label','DAO inbox');
  const notice=make('p','names-help');notice.setAttribute('role','status');
  const layout=make('div','relay-inbox'),list=make('div','relay-feed'),reader=make('article','relay-reader');
  list.setAttribute('aria-label','DAO conversations');reader.setAttribute('aria-label','DAO conversation');
  const more=make('button',null,'Load more messages');more.type='button';more.hidden=true;
  layout.append(list,reader);panel.append(notice,layout,more);card.append(panel);
  const personal=[...card.querySelectorAll('.relay-header-actions,.relay-feed-controls,.relay-toolbar,.relay-inbox,#relay-nns-status,#relay-status')].filter(el=>!panel.contains(el));
  const original=new Map(personal.map(el=>[el,el.hidden]));
  let epoch=0, disposed=false, selected='',owner='',boxes=[],records=[],cursor=null,conversation=null,busy=false,reviewOpen=false;
  function toggle() {const active=!!selected;panel.hidden=!active;for(const el of personal)el.hidden=active?true:original.get(el);}
  function clear() {reviewOpen=false;records=[];cursor=null;conversation=null;list.replaceChildren();reader.replaceChildren();more.hidden=true;}
  function valid(token,wallet,name=selected){return !disposed&&token===epoch&&account()===wallet&&selected===name;}
  async function access(name,wallet) {return (await client.list(wallet)).some(b=>b.name===name&&b.enabled);}
  function options() {
    select.replaceChildren();const own=make('option',null,'My inbox');own.value='';select.append(own);
    for(const box of boxes){const opt=make('option',null,box.label||box.name);opt.value=box.name;select.append(opt);}
    select.value=selected;picker.hidden=!boxes.length;
  }
  async function refresh() {
    const token=++epoch,wallet=account();
    // Immediately remove old decrypted content, including while membership RPC fails.
    clear();boxes=[];options();
    if(owner!==wallet){selected='';owner=wallet||'';}toggle();
    if(!wallet){selected='';toggle();return;}
    try{
      const current=await client.list(wallet);if(disposed||token!==epoch||account()!==wallet)return;
      boxes=current.filter(b=>b.enabled);if(selected&&!boxes.some(b=>b.name===selected))selected='';options();toggle();
      if(selected)await load(false);
    }catch{
      if(disposed||token!==epoch||account()!==wallet)return;
      // No stale entitlement survives a failed refresh.
      selected='';toggle();options();
    }
  }
  function renderList() {
    list.replaceChildren();
    for(const thread of groupDaoConversations(records)) {
      const button=make('button','relay-event'+(thread.address===conversation?' selected':''));button.type='button';
      button.setAttribute('aria-label','Conversation with '+thread.address);button.setAttribute('aria-pressed',String(thread.address===conversation));
      button.append(make('strong',null,short(thread.address)),make('span',null,thread.messages.length+' messages'));
      button.onclick=()=>open(thread.address);list.append(button);
    }
    if(!records.length)list.append(make('p','relay-empty','No conversations in this DAO inbox.'));
  }
  async function load(append) {
    const token=++epoch,wallet=account(),name=selected;
    if(!name||!wallet)return;
    notice.textContent='Checking DAO inbox access…';more.disabled=true;
    try{
      if(!await access(name,wallet)){if(valid(token,wallet,name))await refresh();return;}
      const page=await client.page(name,append?cursor:null);
      if(!valid(token,wallet,name))return;
      // Membership may have changed while history was loading.
      if(!await access(name,wallet)){if(valid(token,wallet,name))await refresh();return;}
      if(!valid(token,wallet,name))return;
      records=append?[...records,...page.items]:page.items;cursor=page.next;more.hidden=cursor===null;more.disabled=false;
      notice.textContent=name+' · Shared DAO inbox';renderList();
    }catch(error){if(valid(token,wallet,name)){clear();notice.textContent='DAO inbox unavailable. Access could not be verified.';}}
  }
  async function open(address) {
    const token=++epoch,wallet=account(),name=selected;conversation=address;reader.replaceChildren();renderList();
    try{
      if(!await access(name,wallet)){if(valid(token,wallet,name))await refresh();return;}
      const state=await client.thread(name,address);
      const messages=[];
      for(const record of records.filter(r=>r.correspondent===address).sort((a,b)=>a.sequence-b.sequence)) {
        const text=await client.readable(record,wallet);messages.push({record,text});
      }
      if(!valid(token,wallet,name)||conversation!==address)return;
      if(!await access(name,wallet)){if(valid(token,wallet,name))await refresh();return;}
      if(!valid(token,wallet,name))return;
      const back=make('button','relay-reader-back','← Inbox');back.type='button';back.onclick=()=>{reader.classList.remove('open');list.querySelector('[aria-pressed="true"]')?.focus();};
      reader.append(back,make('small',null,name),make('h3',null,short(address)),make('p','names-help',`${state.status}${state.assignee?' · '+short(state.assignee):''}`));
      const take=make('button',null,state.assignee===wallet?'Release conversation':'Take conversation');take.type='button';take.onclick=()=>review(()=>client.assignDraft(name,address,state.revision,state.assignee!==wallet),'Review conversation assignment',name,address);
      reader.append(take);
      if(state.canBlock){const menu=make('details','relay-more'),summary=make('summary',null,'⋯');summary.setAttribute('aria-label','Conversation actions');const block=make('button',null,state.blocked?'Unblock sender':'Block sender');block.type='button';block.onclick=()=>review(()=>client.blockDraft(name,address,!state.blocked),'Review sender blocking',name,address);menu.append(summary,block);reader.append(menu);}
      for(const {record,text} of messages){const entry=make('section','dao-message');entry.append(make('small',null,(record.reply?'DAO reply · ':'')+short(record.author)),make('p',null,text??'Encrypted message · not available on this device'));reader.append(entry);}
      reader.classList.add('open');
    }catch{if(valid(token,wallet,name))reader.replaceChildren(make('p',null,'Conversation unavailable. Your keys and saved history are preserved.'));}
  }
  async function review(prepare,title,name,address) {
    if(busy||reviewOpen)return;busy=true;const token=epoch,wallet=account();
    try{
      const request=await prepare();if(!valid(token,wallet,name)||conversation!==address)return;
      const box=make('section','dao-action-review'),label=make('strong',null,title),details=make('pre',null,JSON.stringify(request.message,null,2)),confirm=make('button',null,'Confirm in Keplr'),cancel=make('button',null,'Cancel');confirm.type=cancel.type='button';
      box.append(label,make('p',null,name+' · '+short(address)),details,confirm,cancel);reader.append(box);reviewOpen=true;
      cancel.onclick=()=>{reviewOpen=false;box.remove();};confirm.onclick=async()=>{confirm.disabled=true;busy=true;try{if(!valid(token,wallet,name)||!await access(name,wallet))throw Error('Access changed');await client.submit(request);if(valid(token,wallet,name))await open(address);}catch{label.textContent='Action not confirmed. Refresh before retrying; any pending transaction is preserved.';}finally{busy=false;reviewOpen=false;}};
    }catch{if(valid(token,wallet,name))notice.textContent='Action unavailable. Refresh access before trying again.';}finally{busy=false;}
  }
  select.onchange=()=>{epoch++;selected=select.value;clear();toggle();if(selected)load(false);};more.onclick=()=>load(true);
  const walletChanged=()=>{epoch++;selected='';owner='';clear();toggle();refresh();};
  const visibility=()=>{epoch++;clear();if(document.hidden){selected='';toggle();options();}else refresh();};
  window.addEventListener('neta:wallet-change',walletChanged);document.addEventListener('visibilitychange',visibility);
  const interval=window.setInterval(()=>{if(!document.hidden&&!busy&&!reviewOpen)refresh();},30000);
  refresh();
  return {refresh,destroy(){disposed=true;epoch++;window.clearInterval(interval);window.removeEventListener('neta:wallet-change',walletChanged);document.removeEventListener('visibilitychange',visibility);selected='';toggle();heading.prepend(title);titleRow.remove();panel.remove();}};
}
