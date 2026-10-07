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

// Canonical commits are included in the following block. Unlike the live round,
// they do not reset between heights. All powers come from the height-pinned set.
export function parseCommitWindow(data,validatorData,height,upgradeHeight=JUNO_UPGRADE_HEIGHT){
  if(!Number.isSafeInteger(height)||height<=upgradeHeight)throw Error('No confirmed post-upgrade block.');
  const set=validatorData?.result,validators=set?.validators;
  if(Number(set?.block_height)!==height||!Array.isArray(validators)||!validators.length||validators.length>100||Number(set.total)!==validators.length||Number(set.count)!==validators.length)throw Error('Incomplete or wrong-height validator set.');
  const seen=new Set();
  const rows=validators.map(v=>{
    if(!/^[A-F0-9]{40}$/.test(v.address)||seen.has(v.address)||!/^[1-9]\d*$/.test(v.voting_power)||BigInt(v.voting_power)>9223372036854775807n)throw Error('Invalid validator identity or voting power.');
    seen.add(v.address);return {address:v.address,power:v.voting_power,signed:0,nil:0,latest:'missing'};
  });
  const count=Math.min(5,height-upgradeHeight);
  if(!Array.isArray(data)||data.length!==count)throw Error('Incomplete block history.');
  const total=rows.reduce((sum,r)=>sum+BigInt(r.power),0n),threshold=total*2n/3n+1n;
  const blocks=[];let setHash;
  for(let i=0;i<data.length;i++){
    const result=data[i]?.result,header=result?.signed_header?.header,commit=result?.signed_header?.commit;
    if(result?.canonical!==true||header?.chain_id!=='juno-1'||Number(header.height)!==height-i||Number(commit?.height)!==height-i||!Number.isSafeInteger(commit.round)||commit.round<0||!/^[A-F0-9]{64}$/.test(commit.block_id?.hash)||!/^[A-F0-9]{64}$/.test(header.validators_hash)||!Number.isFinite(Date.parse(header.time)))throw Error('Invalid canonical block identity.');
    if(i===0)setHash=header.validators_hash;
    // At a validator-set transition, show only the consecutive matching suffix.
    // Never apply today's power to an earlier, different validator set.
    if(header.validators_hash!==setHash)break;
    if(i&&data[i-1].result.signed_header.header.last_block_id?.hash!==commit.block_id.hash)throw Error('Block history is not contiguous.');
    if(!Array.isArray(commit.signatures)||commit.signatures.length!==rows.length)throw Error('Incomplete commit signatures.');
    let power=0n;
    const kinds=commit.signatures.map((sig,index)=>{
      if(sig?.block_id_flag===1){if(sig.validator_address||sig.signature)throw Error('Invalid absent signature.');return 'missing';}
      if(![2,3].includes(sig?.block_id_flag)||sig.validator_address!==rows[index].address||typeof sig.signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(sig.signature)||!Number.isFinite(Date.parse(sig.timestamp)))throw Error('Signature does not match its validator.');
      if(sig.block_id_flag===2)power+=BigInt(rows[index].power);
      return sig.block_id_flag===2?'block':'nil';
    });
    if(power<threshold)throw Error('Committed block has insufficient signing power.');
    kinds.forEach((kind,index)=>{if(kind==='block')rows[index].signed++;if(kind==='nil')rows[index].nil++;if(i===0)rows[index].latest=kind;});
    blocks.push({height:height-i,hash:commit.block_id.hash,power:power.toString(),kinds});
  }
  const signedPower=rows.reduce((sum,r)=>sum+(r.signed?BigInt(r.power):0n),0n);
  return {height,blockTime:Date.parse(data[0].result.signed_header.header.time),total:total.toString(),threshold:threshold.toString(),rows,blocks,count:blocks.length,signedPower:signedPower.toString(),missingPower:(total-signedPower).toString(),signedCount:rows.filter(r=>r.signed).length,latestPower:blocks[0].power};
}
export function commitWindowsAgree(a,b){
  return Boolean(a&&b&&a.height===b.height&&a.count===b.count&&a.total===b.total&&a.rows.length===b.rows.length&&a.rows.every((r,i)=>r.address===b.rows[i].address&&r.power===b.rows[i].power)&&a.blocks.every((v,i)=>v.hash===b.blocks[i].hash&&v.kinds.every((kind,j)=>kind===b.blocks[i].kinds[j])));
}
