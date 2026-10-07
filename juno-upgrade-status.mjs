import {CONSENSUS_OBSERVERS,JUNO_UPGRADE_HEIGHT,parseConsensus,percent,observationsAgree} from './juno-consensus-core.mjs';
const $=id=>document.getElementById(id),names=new Map();let snapshots=[],busy=false,namesLoaded=0,namesSnapshotLoaded=false,namesLoading=false;
const pct=(p,t)=>percent(p,t).toFixed(2)+'%';
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
async function get(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(d.error)throw Error(d.error.message||'RPC error');return d;}
async function observer(source){
  const [status,dump]=await Promise.all([get(source.url+'/status'),get(source.url+'/dump_consensus_state')]);
  if(status.result?.node_info?.network!=='juno-1')throw Error('Observer returned a different chain.');
  const sync=status.result.sync_info,latest=Number(sync?.latest_block_height),blockTime=Date.parse(sync?.latest_block_time);
  if(!Number.isSafeInteger(latest)||latest<1||!Number.isFinite(blockTime))throw Error('Latest block unavailable.');
  return {source,consensus:parseConsensus(dump),latest,blockTime,fetched:Date.now()};
}
async function loadNames(){
  if(namesLoading||Date.now()-namesLoaded<1800000)return;namesLoading=true;
  if(!namesSnapshotLoaded){
    namesSnapshotLoaded=true;
    try{const saved=await get('data/juno-validator-names-2026-10-07.json');
      if(saved.chainId==='juno-1'&&Array.isArray(saved.validators))for(const row of saved.validators){if(/^[A-F0-9]{40}$/.test(row.address)&&typeof row.name==='string')names.set(row.address,row.name.slice(0,160));}
      $('names-state').textContent='Names from the 7 October 2026 snapshot; checking current metadata…';renderRows();
    }catch{}
  }
  try{
    const found=new Map();let key='';
    for(let page=0;page<10;page++){
      const d=await get('https://juno.api.m.stavr.tech/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=100'+(key?'&pagination.key='+encodeURIComponent(key):''));
      if(!Array.isArray(d.validators))throw Error('Validator names unavailable.');
      for(const v of d.validators){const pk=v.consensus_pubkey;if(pk?.['@type']!=='/cosmos.crypto.ed25519.PubKey')continue;
        const bytes=Uint8Array.from(atob(pk.key),c=>c.charCodeAt(0));if(bytes.length!==32)continue;
        const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));const address=Array.from(hash.subarray(0,20),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
        found.set(address,String(v.description?.moniker||address).trim().slice(0,160));
      }
      key=d.pagination?.next_key;if(!key)break;if(page===9)throw Error('Validator name pagination incomplete.');
    }
    names.clear();for(const [address,name] of found)names.set(address,name);namesLoaded=Date.now();$('names-state').textContent='Validator names from STAVR staking metadata; matched by consensus public key.';
  }catch{$('names-state').textContent=names.size?(namesLoaded?'Previously loaded names retained. Current metadata is unavailable.':'Names from the 7 October 2026 snapshot. Current metadata is unavailable; voting power and votes still come from the selected observer.'):'Names unavailable. Consensus addresses are shown instead.';}
  finally{namesLoading=false;}
  renderRows();
}
function voteCell(v){const cell=el('td',v.kind==='block'?'For block':v.kind==='nil'?'Nil vote':'No vote observed','vote-'+v.kind);if(v.block)cell.append(el('small',v.block));return cell;}
function renderRows(){
  const snapshot=snapshots[Number($('observer').value)],body=$('validators');body.replaceChildren();
  if(!snapshot?.consensus){$('round').textContent='This observer is unavailable. Choose the other observer or refresh.';return;}
  const c=snapshot.consensus;$('round').textContent=`Height ${c.height.toLocaleString('en-US')} · round ${c.round} · ${c.rows.length} validators · observed ${new Date(snapshot.fetched).toLocaleTimeString()}`;
  for(const row of c.rows){const tr=el('tr'),known=names.get(row.address),name=el('td',known||row.address.slice(0,12)+'…');name.title=row.address;if(known)name.append(el('small',row.address.slice(0,12)+'…'));tr.append(name,el('td',pct(row.power,c.total)),voteCell(row.prevote),voteCell(row.precommit));body.append(tr);}
}
function render(){
  const root=$('observers');root.replaceChildren();
  for(const [i,source] of CONSENSUS_OBSERVERS.entries()){
    const card=el('section'),s=snapshots[i];card.append(el('h2',source.name));root.append(card);
    if(!s?.consensus){card.append(el('p','Unavailable · '+(s?.error||'No response'),'error'));continue;}
    const c=s.consensus,p=c.prevotes;card.append(el('p',pct(p.power,c.total),'metric'),el('p','Largest block agreement · prevotes'));
    const bar=el('progress');bar.max=100;bar.value=percent(p.power,c.total);bar.setAttribute('aria-label',source.name+' prevote agreement for one block');card.append(bar);
    card.append(el('p',p.quorum?'Prevote quorum observed. A block still needs precommits.':pct(p.needed,c.total)+' more voting power needed for a prevote quorum.'));
    card.append(el('p',`All prevotes: ${pct(p.observed,c.total)} · nil: ${pct(p.nil,c.total)} · no vote observed: ${pct(p.missing,c.total)}`));
    card.append(el('p',`Largest precommit agreement: ${pct(c.precommits.power,c.total)}${c.precommits.quorum?' · quorum observed':''}`));
    card.append(el('p',`Consensus height ${c.height.toLocaleString('en-US')} · round ${c.round}${p.block?' · block '+p.block:''}`,'muted'));
    card.append(el('p',`Last committed block ${s.latest.toLocaleString('en-US')} · ${new Date(s.blockTime).toLocaleString()}`,'muted'));
    const a=el('a','Observer data ↗');a.href=source.url+'/consensus_state';a.target='_blank';a.rel='noopener noreferrer';card.append(a);
  }
  const available=snapshots.filter(s=>s.consensus),resumed=available.some(s=>s.latest>JUNO_UPGRADE_HEIGHT);
  $('network-state').textContent=resumed?'Blocks after the upgrade observed':available.length?'Waiting for the first block after the upgrade':'Current network status unavailable';
  $('agreement').textContent=available.length===2?(observationsAgree(available[0].consensus,available[1].consensus)?'Both observers report the same votes at the same height and round.':'Observer snapshots differ. Read each separately; votes are not combined.'):'Only one or no observer is available. Cross-check is incomplete.';
  renderRows();
}
async function refresh(){
  if(busy)return;busy=true;$('refresh').disabled=true;$('updated').textContent='Checking both observers…';
  try{snapshots=await Promise.all(CONSENSUS_OBSERVERS.map(async source=>{try{return await observer(source);}catch(error){return {source,error:error.message};}}));render();$('updated').textContent='Last check: '+new Date().toLocaleString()+' · '+Intl.DateTimeFormat().resolvedOptions().timeZone+'.';}
  finally{busy=false;$('refresh').disabled=false;}
  void loadNames();
}
$('refresh').addEventListener('click',refresh);$('observer').addEventListener('change',renderRows);
setInterval(()=>{if($('auto').checked&&!document.hidden)void refresh();},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('auto').checked)void refresh();});
void refresh();
