import {parseConsensus,observationsAgree,CONSENSUS_OBSERVERS} from './juno-consensus-core.mjs';

// Earliest archived vote, including nil, establishes participation, not installation time.
// Retain observer capture time separately from the validator's reported vote time.
export function parseReadiness(data,upgrade){
 const halt=Date.parse(data?.haltTime);
 if(data?.schema!==1||data.upgradeId!==upgrade.id||data.chainId!==upgrade.chainId||data.upgradeHeight!==upgrade.height||!Number.isFinite(halt)||!['partial','recording'].includes(data.coverage)||!Array.isArray(data.captures)||!data.captures.length||data.captures.length>600)throw Error('Invalid readiness archive.');
 const records=new Map(),captures=[];let baseline;
 for(const capture of data.captures){
  const pair=capture.snapshots;
  if(!Array.isArray(pair)||pair.length!==2||pair.some((s,i)=>s.source!==CONSENSUS_OBSERVERS[i].url||!Number.isFinite(Date.parse(s.savedAt))||Date.parse(s.savedAt)<halt||!s.roundState))throw Error('Invalid readiness sources.');
  const parsed=pair.map(s=>parseConsensus({result:{round_state:s.roundState}}));
  if(!observationsAgree(...parsed)||parsed[0].height!==upgrade.height+1)throw Error('Readiness observers disagree or wrong height.');
  const c=parsed[0],identities=JSON.stringify(c.rows.map(r=>[r.address,r.power]));
  if(baseline&&baseline!==identities)throw Error('Readiness set changed.');baseline=identities;
  const events=[];
  for(let i=0;i<c.rows.length;i++)for(const [kind,key] of [['prevote','prevotes'],['precommit','precommits']]){
   const row=c.rows[i];if(row[kind].kind==='missing')continue;
   const strings=pair.map(s=>s.roundState.votes.find(v=>v.round===c.round)[key][i]);
   if(strings[0]!==strings[1])throw Error('Readiness vote timestamps differ.');
   const timestamp=strings[0].match(/ @ (\d{4}-\d\d-\d\dT[^ }]+Z)\}$/)?.[1],at=Date.parse(timestamp);
   if(!Number.isFinite(at)||at<halt||pair.some(s=>at>Date.parse(s.savedAt)+60000))throw Error('Implausible readiness vote clock.');
   const event={address:row.address,power:row.power,height:c.height,round:c.round,kind,block:row[kind].block,timestamp,secondsFromHalt:Math.floor((at-halt)/1000),capturedAt:pair[1].savedAt};
   events.push(event);const old=records.get(row.address);
   if(!old||at<Date.parse(old.timestamp))records.set(row.address,event);
  }
  captures.push({height:c.height,round:c.round,capturedAt:pair[1].savedAt,total:c.total,rows:c.rows,events,prevotes:c.prevotes,precommits:c.precommits});
 }
 return {...data,records,captures,latest:captures.at(-1)};
}

// Timeline is scoped to ONE height and round; nil contributes only to participation.
export function readinessTimeline(capture){
 const first=new Map(),blocks=new Map();let observed=0n;
 return [...capture.events].filter(e=>e.kind==='prevote').sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp)).map(e=>{
  if(!first.has(e.address)){observed+=BigInt(e.power);first.set(e.address,e);}
  if(e.block)blocks.set(e.block,(blocks.get(e.block)||0n)+BigInt(e.power));
  const agreement=[...blocks.values()].reduce((a,b)=>a>b?a:b,0n);
  return {...e,observed:observed.toString(),agreement:agreement.toString()};
 });
}
