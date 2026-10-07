import {CONSENSUS_OBSERVERS,JUNO_UPGRADE_HEIGHT,parseConsensus,parseCommitWindow,percent,observationsAgree,commitWindowsAgree} from './juno-consensus-core.mjs?v=3';
import {parseUpgradeHistory,duration} from './juno-upgrade-history.mjs';
const $=id=>document.getElementById(id),names=new Map();let snapshots=[],busy=false,namesLoaded=0,namesSnapshotLoaded=false,namesLoading=false,history=null,historyError='',historyFetched=0;
const upgrade={id:document.body.dataset.upgrade||'juno-v31',chainId:'juno-1',height:Number(document.body.dataset.upgradeHeight)||JUNO_UPGRADE_HEIGHT};
const pct=(p,t)=>percent(p,t).toFixed(2)+'%',number=n=>n.toLocaleString('en-US');
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
async function get(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(d.error)throw Error(d.error.message||'RPC error');return d;}
async function status(source){
 const d=await get(source.url+'/status');if(d.result?.node_info?.network!=='juno-1')throw Error('Observer returned a different chain.');
 const sync=d.result.sync_info,latest=Number(sync?.latest_block_height),blockTime=Date.parse(sync?.latest_block_time);
 if(!Number.isSafeInteger(latest)||latest<1||!Number.isFinite(blockTime)||blockTime>Date.now()+60000)throw Error('Latest block unavailable.');
 return {source,latest,blockTime,catchingUp:sync.catching_up===true};
}
async function observer(s,target){
 if(s.error)return s;
 try{
  if(s.latest>upgrade.height+1){
   const height=Math.min(target,s.latest-1),count=Math.min(5,height-upgrade.height);
   const [validators,...commits]=await Promise.all([get(s.source.url+'/validators?height='+height+'&per_page=100'),...Array.from({length:count},(_,i)=>get(s.source.url+'/commit?height='+(height-i)))]);
   return {...s,commits:parseCommitWindow(commits,validators,height,upgrade.height)};
  }
  const consensus=parseConsensus(await get(s.source.url+'/dump_consensus_state'));
  if(consensus.height<s.latest||consensus.height>s.latest+2)throw Error('Consensus and latest block are inconsistent.');
  return {...s,consensus};
 }catch(error){return {...s,error:error.message};}
}
async function loadNames(){
  if(namesLoading||Date.now()-namesLoaded<1800000)return;namesLoading=true;
  if(!namesSnapshotLoaded){
    namesSnapshotLoaded=true;
    try{const saved=await get('/data/juno-validator-names-2026-10-07.json');
      if(saved.chainId==='juno-1'&&Array.isArray(saved.validators))for(const row of saved.validators){if(/^[A-F0-9]{40}$/.test(row.address)&&typeof row.name==='string')names.set(row.address,row.name.slice(0,160));}
      $('names-state').textContent='Names from the 7 October 2026 snapshot; checking current metadata…';render();
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
  }catch{$('names-state').textContent=names.size?(namesLoaded?'Previously loaded names retained. Current metadata is unavailable.':'Names from the 7 October 2026 snapshot. Current metadata is unavailable; participation still comes from live block data.'):'Names unavailable. Consensus addresses are shown instead.';}
  finally{namesLoading=false;}
  render();
}
async function loadHistory(){
 if(Date.now()-historyFetched<300000)return;historyFetched=Date.now();
 try{history=parseUpgradeHistory(await get('/data/validator-upgrades/'+upgrade.id+'.json'),upgrade);historyError='';}
 catch{historyError=history?'History refresh unavailable; last checked record retained.':'First-signature history unavailable.';}
 render();
}
function historyCell(address){
 const cell=el('td',undefined,'first-signature'),record=history?.records.get(address);
 if(record){
  const link=el('a',duration(record.secondsFromHalt));link.href=CONSENSUS_OBSERVERS[0].url+'/commit?height='+record.height;link.target='_blank';link.rel='noopener noreferrer';cell.append(link,el('small',record.blocksAfterRestart===0?'First resumed block':'+'+record.blocksAfterRestart+' blocks'));
  cell.title='First included signature '+new Date(record.timestamp).toLocaleString()+' · height '+number(record.height);
 }else{cell.append(el('span',history?(history.records.has(address)?'Not observed':'Not in upgrade set'):'—'));}
 return cell;
}
function renderHistory(){
 $('history-state').textContent=history?`First signatures: scanned through ${number(history.scannedThrough)} · delays include the shared network halt.${historyError?' '+historyError:''}`:historyError||'Loading first-signature history…';
 $('history-details').textContent=history?`Halt reference: ${new Date(history.halt.time).toLocaleString()}. First resumed signature: ${history.firstResumedSignatureTime?new Date(history.firstResumedSignatureTime).toLocaleString():'not observed'}. Archive checked ${new Date(history.updatedAt).toLocaleString()}. The scan starts at the first post-upgrade block and does not skip gaps. PublicNode and STAVR must agree on each canonical commit.`:'';
}
function selected(){
 if($('observer').value!=='auto')return snapshots[Number($('observer').value)];
 const resumed=snapshots.some(s=>s.latest>upgrade.height+1);
 return snapshots.filter(s=>s.commits||(!resumed&&s.consensus)).sort((a,b)=>Number(Boolean(b.commits))-Number(Boolean(a.commits))||Number(a.catchingUp)-Number(b.catchingUp)||b.blockTime-a.blockTime)[0];
}
function render(){
 const s=selected(),body=$('validators');body.replaceChildren();renderHistory();
 const available=snapshots.filter(s=>s.commits||s.consensus),both=available.length===2;
 const agree=both&&(available[0].commits?commitWindowsAgree(available[0].commits,available[1].commits):observationsAgree(available[0].consensus,available[1].consensus));
 const quality=both?(agree?'Both sources agree.':'Sources differ; showing '+(s?.source.name||'selected source')+' only.'):'Single source · cross-check unavailable.';
 $('agreement').textContent=quality;
 $('observers').replaceChildren(...snapshots.map(v=>{
  const line=el('p',v.source.name+': '+(v.error?'Unavailable · '+v.error:v.commits?`blocks ${number(v.commits.height-v.commits.count+1)}–${number(v.commits.height)}`:`live round ${v.consensus.round} at ${number(v.consensus.height)}`),'source-line');
  const a=el('a',' Open source ↗');a.href=v.source.url+(v.commits?'/commit?height='+v.commits.height:'/consensus_state');a.target='_blank';a.rel='noopener noreferrer';line.append(a);return line;
 }));
 $('empty').hidden=true;$('power-bar').hidden=false;$('quality').textContent=available.length?quality:'';$('quality').className=agree?'muted':'muted warning';
 if(!s?.commits&&!s?.consensus){
  $('network-state').textContent='Current participation unavailable';for(const id of ['power','count','missing'])$(id).textContent='—';
  $('basis').textContent='Block data could not be checked. Refresh to retry; missing data is not zero participation.';$('power-bar').hidden=true;return;
 }
 const c=s.commits||s.consensus,stale=Date.now()-(s.commits?.blockTime||s.blockTime)>120000||s.catchingUp;
 document.querySelector('table').classList.toggle('committed',Boolean(s.commits));
 document.querySelector('.overview').classList.toggle('stale',stale);
 let rows;
 if(s.commits){
  $('network-state').textContent=stale?'Last confirmed participation · block data is stale':'Juno is producing blocks';
  $('power').textContent=pct(c.signedPower,c.total);$('count').textContent=`${c.signedCount} / ${c.rows.length}`;$('missing').textContent=pct(c.missingPower,c.total);
  $('power-label').textContent=`Signed in last ${c.count} blocks`;$('count-label').textContent='Validators signing';$('missing-label').textContent='No block signature';
  $('basis').textContent=`Blocks ${number(c.height-c.count+1)}–${number(c.height)} · latest: ${pct(c.latestPower,c.total)} signing power · ${new Date(c.blockTime).toLocaleTimeString()} · ${s.source.name}`;
  $('scope').textContent='“Signed” = a block signature in this window. No signature does not prove a failed upgrade.';
  $('sample-heading').textContent='Blocks';$('power-bar').value=percent(c.signedPower,c.total);
  rows=c.rows.map(r=>({...r,active:r.signed>0,kind:r.signed?'block':r.nil?'nil':'missing',label:r.signed?'Signed':r.nil?'Nil votes only':'No signature',sample:`${r.signed} / ${c.count}`}));
 }else{
  $('network-state').textContent='Waiting for confirmed post-upgrade blocks';
  const active=c.rows.filter(r=>r.prevote.kind!=='missing'||r.precommit.kind!=='missing'),power=active.reduce((sum,r)=>sum+BigInt(r.power),0n);
  $('power').textContent=pct(power,c.total);$('count').textContent=`${active.length} / ${c.rows.length}`;$('missing').textContent=pct(BigInt(c.total)-power,c.total);
  $('power-label').textContent='Voting in this round';$('count-label').textContent='Validators observed';$('missing-label').textContent='Not yet observed';
  $('basis').textContent=`Live round ${c.round} · height ${number(c.height)} · block prevotes ${pct(c.prevotes.power,c.total)} · precommits ${pct(c.precommits.power,c.total)} · ${s.source.name}`;
  $('scope').textContent='Current-round snapshot only. Votes reset each round; an empty round does not mean validators are unready.';
  $('sample-heading').textContent='Vote';$('power-bar').value=percent(power,c.total);
  rows=c.rows.map(r=>{const kind=r.precommit.kind!=='missing'?r.precommit.kind:r.prevote.kind;return {...r,active:kind!=='missing',kind,label:kind==='block'?'Block vote':kind==='nil'?'Nil vote':'Not observed',sample:r.precommit.kind!=='missing'?'Precommit':r.prevote.kind!=='missing'?'Prevote':'—'};});
 }
 $('filter').options[1].textContent=s.commits?'Signed':'Vote observed';$('filter').options[2].textContent=s.commits?'No block signature':'Not yet observed';
 const filter=$('filter').value;
 rows.sort((a,b)=>Number(a.active)-Number(b.active)||(BigInt(a.power)>BigInt(b.power)?-1:BigInt(a.power)<BigInt(b.power)?1:a.address.localeCompare(b.address)));
 for(const row of rows){
  if(filter==='signed'&&!row.active||filter==='missing'&&row.active)continue;
  const tr=el('tr'),name=el('td',names.get(row.address)||row.address.slice(0,12)+'…');name.title=row.address;
  const state=el('td',row.label,'status vote-'+row.kind);state.title=s.commits?`Latest block: ${row.latest==='block'?'signed':row.latest==='nil'?'nil vote':'no signature'}; ${row.nil} nil votes in window.`:row.label;
  tr.append(name,el('td',pct(row.power,c.total)),state,el('td',row.sample),historyCell(row.address));body.append(tr);
 }
 $('empty').hidden=body.children.length>0;
}
async function refresh(){
 if(busy)return;busy=true;$('refresh').disabled=true;$('updated').textContent='Checking both sources…';
 try{
  const states=await Promise.all(CONSENSUS_OBSERVERS.map(async source=>{try{return await status(source);}catch(error){return {source,error:error.message};}}));
  const healthy=states.filter(s=>!s.error&&!s.catchingUp&&Date.now()-s.blockTime<120000),usable=healthy.length?healthy:states.filter(s=>!s.error);
  const advanced=usable.filter(s=>s.latest>upgrade.height+1);
  const target=advanced.length?Math.min(...advanced.map(s=>s.latest))-1:0;
  snapshots=await Promise.all(states.map(s=>observer(s,target)));render();$('updated').textContent='Checked '+new Date().toLocaleString()+' · '+Intl.DateTimeFormat().resolvedOptions().timeZone;
 }finally{busy=false;$('refresh').disabled=false;}
 void loadNames();void loadHistory();
}
$('refresh').addEventListener('click',refresh);$('observer').addEventListener('change',render);$('filter').addEventListener('change',render);
setInterval(()=>{if(document.hidden)return;if($('auto').checked)void refresh();else render();},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('auto').checked)void refresh();});
void refresh();
