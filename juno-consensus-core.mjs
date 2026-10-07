// Read-only RPC observations. Never used as transaction authorization.
export const JUNO_UPGRADE_HEIGHT = 42452000;
export const CONSENSUS_OBSERVERS = Object.freeze([
  {name:'PublicNode',url:'https://juno-rpc.publicnode.com'},
  {name:'STAVR',url:'https://juno.rpc.m.stavr.tech'}
]);
export function percent(power,total){
  const p=BigInt(power),t=BigInt(total);
  return t>0n?Number((p*10000n+t/2n)/t)/100:0;
}
export function parseConsensus(data){
  const s=data?.result?.round_state,height=Number(s?.height),round=s?.round;
  if(!Number.isSafeInteger(height)||height<1||!Number.isSafeInteger(round)||round<0)throw Error('Consensus height or round unavailable.');
  const validators=s.validators?.validators,seen=new Set();
  if(!Array.isArray(validators)||!validators.length||validators.length>10000)throw Error('Validator set unavailable.');
  const votes=s.votes?.find(v=>v.round===round);
  if(!votes||!['prevotes','precommits'].every(k=>Array.isArray(votes[k])&&votes[k].length===validators.length))throw Error('Current-round votes unavailable.');
  function vote(value,index,address,type){
    if(value==='nil-Vote')return {kind:'missing',block:null};
    const m=typeof value==='string'&&value.match(/^Vote\{(\d+):([A-F0-9]{12}) (\d+)\/(\d+)\/SIGNED_MSG_TYPE_(PREVOTE|PRECOMMIT)\((?:Prevote|Precommit)\) ([A-F0-9]{12}) /);
    if(!m||Number(m[1])!==index||!address.startsWith(m[2])||Number(m[3])!==height||Number(m[4])!==round||m[5]!==type)throw Error('Vote does not match its validator, height or round.');
    return {kind:m[6]==='000000000000'?'nil':'block',block:m[6]==='000000000000'?null:m[6]};
  }
  const rows=validators.map((v,index)=>{
    if(!/^[A-F0-9]{40}$/.test(v.address)||seen.has(v.address)||!/^[1-9]\d*$/.test(v.voting_power)||BigInt(v.voting_power)>9223372036854775807n)throw Error('Invalid validator identity or voting power.');
    seen.add(v.address);
    return {address:v.address,power:v.voting_power,prevote:vote(votes.prevotes[index],index,v.address,'PREVOTE'),precommit:vote(votes.precommits[index],index,v.address,'PRECOMMIT')};
  });
  const total=rows.reduce((sum,r)=>sum+BigInt(r.power),0n),threshold=total*2n/3n+1n;
  function tally(type){
    let observed=0n,nil=0n,count=0;const blocks=new Map();
    for(const row of rows){const v=row[type],p=BigInt(row.power);if(v.kind==='missing')continue;observed+=p;count++;
      if(v.kind==='nil')nil+=p;else blocks.set(v.block,(blocks.get(v.block)||0n)+p);
    }
    const [block,power]=[...blocks].sort((a,b)=>a[1]>b[1]?-1:a[1]<b[1]?1:0)[0]||[null,0n];
    return {observed:observed.toString(),nil:nil.toString(),missing:(total-observed).toString(),count,block,power:power.toString(),quorum:power>=threshold,needed:(power>=threshold?0n:threshold-power).toString()};
  }
  return {height,round,step:s.step,total:total.toString(),threshold:threshold.toString(),rows,prevotes:tally('prevote'),precommits:tally('precommit')};
}
export function observationsAgree(a,b){
  if(!a||!b||a.height!==b.height||a.round!==b.round||a.total!==b.total||a.rows.length!==b.rows.length)return false;
  const rows=new Map(b.rows.map(r=>[r.address,r]));
  return a.rows.every(r=>{const s=rows.get(r.address);return s&&r.power===s.power&&['prevote','precommit'].every(k=>r[k].kind===s[k].kind&&r[k].block===s[k].block);});
}
