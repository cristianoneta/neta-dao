(()=>{
  'use strict';
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
  const cache=new Map();
  function snapshot(id){if(!cache.has(id)){const request=fetch(`data/daos/${id}.json`,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Membership source unavailable');return r.json()}).catch(e=>{cache.delete(id);throw e});cache.set(id,request)}return cache.get(id)}
  async function mount(host,dao){
    const marker={};host._membershipRequest=marker;host.replaceChildren(el('h2','Governance members'),el('p',dao.membership));
    const status=el('p','Loading verified staking snapshot…','names-help');host.append(status);
    try{
      const data=await snapshot(dao.id);if(host._membershipRequest!==marker)return;
      if(data.chain_id!==dao.network||data.token_contract!==dao.tokenContract||data.core!==dao.core||data.voting_module!==dao.votingModule||data.staking_contract!==dao.stakingContract||!data.members_complete||!Array.isArray(data.members))throw Error('Membership identity or completeness check failed');
      status.textContent=`${data.members.length} active staking addresses · ${(Number(data.total_power_raw)/1e6).toLocaleString(undefined,{maximumFractionDigits:6})} NETA voting power · block ${data.height} · ${new Date(data.generated_at).toLocaleString()}`;
      host.append(el('p','Positive active stake establishes on-chain voting power. This list does not establish legal membership, contributor roles or a current-proposal voting entitlement.','names-help'));
      const label=el('label','Find a member address','names-label'),input=el('input');input.type='search';input.placeholder='Search Juno address';label.append(input);host.append(label);
      const list=el('div',undefined,'dao-member-list'),more=el('button','Show more');more.type='button';host.append(list,more);let limit=25;
      function render(){const q=input.value.trim().toLowerCase(),rows=data.members.filter(m=>m.address.includes(q));list.replaceChildren();for(const m of rows.slice(0,limit)){const row=el('article',undefined,'dao-member-row'),a=el('a',m.address);a.href='https://atomscan.com/juno/accounts/'+m.address;a.target='_blank';a.rel='noopener';row.append(a,el('span',`${(Number(m.power_raw)/1e6).toLocaleString(undefined,{maximumFractionDigits:6})} NETA staked`));list.append(row)}if(!rows.length)list.append(el('p','No active staking address matches this search.'));more.hidden=rows.length<=limit;}
      input.oninput=()=>{limit=25;render()};more.onclick=()=>{limit+=25;render()};render();
    }catch(e){if(host._membershipRequest===marker)status.textContent='Membership unavailable · '+e.message+'. This is not evidence that the DAO has no members.';}
  }
  window.NetaDaoMembers={mount};
  const page=document.querySelector('#contributors-view'),panel=el('section',undefined,'names-panel');panel.id='dao-members-panel';panel.hidden=true;page.append(panel);
  function select(id){const dao=window.NetaDaoDirectory.find(d=>d.id===id);panel._membershipRequest={};panel.hidden=id==='neta-operations';if(panel.hidden)return;page.querySelector('.dao-scope-empty')?.setAttribute('hidden','');if(id==='neta')mount(panel,dao);else{panel._membershipRequest={};panel.replaceChildren(el('h2','Governance participation'),el('p',dao.membership),el('p','Juno validators and their delegators participate through native governance. A complete delegator/member directory is not connected here.','names-help'));}}
  window.addEventListener('neta:dao-change',e=>select(e.detail.id));select(window.NETA_SELECTED_DAO||'neta-operations');
})();
