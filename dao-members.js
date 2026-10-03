(()=>{
  'use strict';
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
  const cache=new Map();
  function snapshot(source,refresh=false){
    if(refresh)cache.delete(source.file);
    if(!cache.has(source.file)){
      const request=fetch(`data/daos/${source.file}`,{cache:'no-store',signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('Membership source unavailable');return r.json()}).catch(e=>{cache.delete(source.file);throw e});
      cache.set(source.file,request);
    }
    return cache.get(source.file);
  }
  function quantity(raw,decimals){
    const value=BigInt(raw),scale=10n**BigInt(decimals),whole=(value/scale).toLocaleString(),fraction=(value%scale).toString().padStart(decimals,'0').replace(/0+$/,'');
    const separator=new Intl.NumberFormat(undefined,{minimumFractionDigits:1}).formatToParts(1.1).find(p=>p.type==='decimal')?.value||'.';
    return whole+(fraction?separator+fraction:'');
  }
  function valid(data,dao){
    const source=dao.membershipSource;
    if(!source||data.chain_id!==dao.network||data.core!==dao.core||data.adapter!==source.adapter||data.power_decimals!==source.decimals||data.power_unit!==source.unit||!data.members_complete||!Array.isArray(data.members))return false;
    if(source.adapter==='cw20-staked-legacy'&&(data.voting_module!==dao.votingModule||data.staking_contract!==dao.stakingContract||data.token_contract!==dao.tokenContract))return false;
    if(source.adapter==='cw4-group'&&(data.voting_module!==dao.votingModule||data.group_contract!==dao.groupContract))return false;
    if(!['cw20-staked-legacy','cw4-group','native-staking'].includes(source.adapter))return false;
    const seen=new Set();let sum=0n;
    for(const m of data.members){if(!/^juno1[023456789acdefghjklmnpqrstuvwxyz]{38,58}$/.test(m.address)||seen.has(m.address)||!/^\d+$/.test(m.power_raw)||BigInt(m.power_raw)<=0n)return false;seen.add(m.address);sum+=BigInt(m.power_raw)}
    return sum===BigInt(data.total_power_raw);
  }
  async function mount(host,dao,{refresh=false}={}){
    const marker={};host._membershipRequest=marker;host.replaceChildren(el('h2','Members'),el('p',dao?.membership||'Governance membership depends on this DAO’s voting model.'));
    const source=dao?.membershipSource;
    if(!source){host.append(el('p','Membership data is not connected for this DAO yet. This does not mean it has no members.','names-help'));return;}
    const status=el('p','Loading verified membership snapshot…','names-help');status.setAttribute('role','status');host.append(status);
    try{
      const data=await snapshot(source,refresh);if(host._membershipRequest!==marker)return;
      if(!valid(data,dao))throw Error('Membership identity, power or completeness check failed');
      const native=source.adapter==='native-staking',group=source.adapter==='cw4-group',description=native?'bonded delegator addresses':group?'weighted member addresses':'active staking addresses';
      status.textContent=`${data.members.length} ${description} · ${quantity(data.total_power_raw,source.decimals)} ${source.unit} voting power · block ${data.height} · ${new Date(data.generated_at).toLocaleString()}`;
      const age=Date.now()-Date.parse(data.generated_at);
      if(!Number.isFinite(age)||age>2*3600000)host.append(el('p','Snapshot is more than two hours old or its timestamp is invalid. Refresh to check for a newer published snapshot.','treasury-warning'));
      host.append(el('p','Voting power reflects this snapshot. Eligibility for each proposal follows its voting rules and reference height.','names-help'));
      const toolbar=el('div',undefined,'member-controls'),label=el('label','Find a member','names-label'),input=el('input');input.type='search';input.placeholder='Search Juno address';label.append(input);
      const refreshButton=el('button','Refresh members');refreshButton.type='button';refreshButton.onclick=()=>mount(host,dao,{refresh:true});toolbar.append(label,refreshButton);host.append(toolbar);
      const list=el('div',undefined,'dao-member-list'),more=el('button','Show more'),count=el('p',undefined,'names-help');more.type='button';host.append(count,list,more);let limit=25;
      function render(){
        const q=input.value.trim().toLowerCase(),rows=data.members.filter(m=>m.address.includes(q));list.replaceChildren();
        for(const m of rows.slice(0,limit)){
          const row=el('article',undefined,'dao-member-row'),identity=el('div',undefined,'member-identity'),link=el('a',m.address);link.href='https://atomscan.com/juno/accounts/'+m.address;link.target='_blank';link.rel='noopener';identity.append(link);
          const power=el('div',undefined,'member-power');power.append(el('strong',`${quantity(m.power_raw,source.decimals)} ${group?'votes':source.unit}`),el('small',group?'Assigned voting weight':native?'Bonded delegation':'Active stake'));
          if(BigInt(data.total_power_raw)>0n)power.append(el('small',`${Number(BigInt(m.power_raw)*10000n/BigInt(data.total_power_raw))/100}% of listed power`));
          const details=el('details',undefined,'member-addresses');details.append(el('summary','Addresses & voting source'),el('p',`Juno · ${m.address}`,'names-address'));
          const copy=el('button','Copy address');copy.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(m.address);copy.textContent='Copied'}catch{copy.textContent='Select the address above to copy'}};details.append(copy);
          details.append(el('p','No verified .neta identity or additional linked wallets are connected. Addresses are not grouped by assumed ownership.','names-help'));
          if(native&&m.delegations?.length){details.append(el('p','Bonded delegations (validator totals are not added again):'));for(const d of m.delegations){const v=data.validators?.find(v=>v.address===d.validator);details.append(el('p',`${v?.name||d.validator} · ${quantity(d.power_raw,source.decimals)} JUNO`))}}
          else details.append(el('p',`Voting source · ${dao.stakingContract||dao.groupContract}`,'names-address'));
          row.append(identity,power,details);list.append(row);
        }
        count.textContent=`Showing ${Math.min(limit,rows.length)} of ${rows.length} members`;
        if(!rows.length)list.append(el('p','No member matches this search.'));more.hidden=rows.length<=limit;
      }
      input.oninput=()=>{limit=25;render()};more.onclick=()=>{limit+=25;render()};render();
      const provenance=el('details',undefined,'names-info');provenance.append(el('summary','Snapshot source and coverage'),el('p',`${data.membership_method}. Source: ${data.source}.`));
      if(native)provenance.append(el('p',`${data.validators?.length||0} bonded validators. Each delegator address is counted once across its active delegations; validator voting is inherited unless overridden. Per-delegation rounding may leave fractional micro-JUNO outside the displayed sum.`));
      provenance.append(el('p','Names will appear when a verified NNS identity source is connected. The naming registry is not active yet.'));
      host.append(provenance);
    }catch(e){if(host._membershipRequest===marker){status.textContent='Membership unavailable · '+e.message+'. This is not evidence that the DAO has no members.';const retry=el('button','Retry');retry.type='button';retry.onclick=()=>mount(host,dao,{refresh:true});host.append(retry)}}
  }
  window.NetaDaoMembers={mount};
  const panel=document.querySelector('#dao-members-panel');
  function select(id){const dao=window.NetaDaoDirectory.find(d=>d.id===id);mount(panel,dao)}
  window.addEventListener('neta:dao-change',e=>select(e.detail.id));select(window.NETA_SELECTED_DAO||'neta-operations');
})();
