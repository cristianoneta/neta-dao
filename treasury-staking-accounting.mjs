import {validateGenericLedger, reviewedGenericPeriod} from './treasury-generic-accounting.mjs?v=20261006-9';
const address='juno1nmezpepv3lx45mndyctz2lzqxa6d9xzd2xumkxf7a6r4nxt0y95qypm6c0';
const distribution='juno1jv65s3grqf6v6jl3dp4t6c9t9rk99cd83d88wr';
const integer=v=>{if(typeof v!=='string'||!/^\d+$/.test(v))throw Error('Invalid reward quantity');return BigInt(v);};
const fixed=v=>{if(typeof v!=='string'||!/^\d+(\.\d{1,18})?$/.test(v))throw Error('Invalid reward price');const [w,f='']=v.split('.');return BigInt(w)*10n**18n+BigInt(f.padEnd(18,'0'));};
export function validateStakingLedger(data,dao){
 if(data?.schema_version!==4||dao?.id!=='juno-delegation'||dao.core!==address||!data.accrual_coverage||!Array.isArray(data.reward_settlements))throw Error('Staking accounting identity unavailable');
 const bank=data.entries.filter(r=>r.evidence?.kind!=='staking-accrual');
 validateGenericLedger({...data,schema_version:2,entries:bank},dao);
 const ids=new Set(bank.map(r=>r.id)), ranges=new Map();
 for(const r of data.entries.filter(r=>r.evidence?.kind==='staking-accrual')){
  const e=r.evidence,a=e.start,b=e.end;
  if(r.chain_id!=='juno-1'||r.treasury_address!==address||r.counterparty!==distribution||r.tx_hash!==null
   ||r.category!=='staking_rewards'||r.classification!==r.category||r.direction!=='in'
   ||e.method!=='closing-withdrawable-minus-opening-plus-claims'||!Array.isArray(e.claims)
   ||!Number.isSafeInteger(a?.height)||!Number.isSafeInteger(b?.height)||a.height>=b.height||r.height!==b.height
   ||!Number.isFinite(Date.parse(a.timestamp))||!Number.isFinite(Date.parse(b.timestamp))||Date.parse(a.timestamp)>=Date.parse(b.timestamp)
   ||a.timestamp<'2026-10-01'||(a.boundary_at||a.timestamp).slice(0,10)!==b.timestamp.slice(0,10)||r.timestamp!==b.timestamp
   ||!Number.isInteger(r.message_index)||r.message_index<0||r.id!==`juno-1:staking:${a.height}-${b.height}:${r.message_index}`||r.receipt_id!==r.id||ids.has(r.id)
   ||![a,b].every(s=>/^[A-F0-9]{64}$/.test(s.hash)&&s.method==='withdrawable-rewards-truncated-per-validator'))throw Error('Invalid staking interval');
  ids.add(r.id);let claimed=0n;const claims=new Set();
  for(const c of e.claims){
   if(claims.has(c.id)||!/^[A-F0-9]{64}$/.test(c.tx_hash)||c.height<=a.height||c.height>b.height)throw Error('Invalid/duplicate reward claim');
   claims.add(c.id);claimed+=integer(c.amounts[r.denom]||'0');
  }
  if(integer(r.raw_amount)<=0n||integer(r.raw_amount)!==integer(b.rewards[r.denom]||'0')-integer(a.rewards[r.denom]||'0')+claimed)throw Error('Reward accrual does not reconcile');
  const key=`${a.height}-${b.height}`, prior=ranges.get(key);
  if(prior){if(prior.denoms.has(r.denom)||JSON.stringify(prior.e)!==JSON.stringify(e))throw Error('Duplicate reward interval');prior.denoms.add(r.denom);}
  else ranges.set(key,{e,denoms:new Set([r.denom])});
  if(r.usd_value===null){if(r.valuation!==null)throw Error('Unpriced reward has valuation');continue;}
  const q=r.valuation,target=Date.parse((a.boundary_at||a.timestamp).slice(0,10)+'T00:00:00Z');
  if(!q||q.method!=='historical-daily-opening-reference'||q.day!==(a.boundary_at||a.timestamp).slice(0,10)||q.denom!==r.denom
    ||!Number.isInteger(q.decimals)||q.decimals<0||q.decimals>18||r.decimals!==q.decimals
    ||(r.denom==='ujuno'&&(q.decimals!==6||q.coin_id!=='juno-network'))
    ||!Number.isSafeInteger(q.timestamp_ms)||target-q.timestamp_ms<0||target-q.timestamp_ms>3600000||fixed(q.usd_price)<=0n
    ||fixed(r.usd_value)!==integer(r.raw_amount)*fixed(q.usd_price)/10n**BigInt(q.decimals))throw Error('Invalid historical reward valuation');
 }
 const ordered=[...ranges.values()].sort((a,b)=>a.e.start.height-b.e.start.height);
 for(let i=1;i<ordered.length;i++)if(ordered[i].e.start.height<ordered[i-1].e.end.height)throw Error('Overlapping reward intervals');
 for(const s of data.reward_settlements){
  if(ids.has(s.id)||s.treasury_address!==address||s.chain_id!=='juno-1'||s.counterparty!==distribution||s.direction!=='in'
    ||s.classification!=='reward_settlement'||s.usd_value!==null||!/^[A-F0-9]{64}$/.test(s.tx_hash)||!Array.isArray(s.withdrawals)||!s.withdrawals.length
    ||integer(s.raw_amount)<=0n||s.evidence?.kind!=='provider-receipt')throw Error('Invalid reward settlement');
  ids.add(s.id);
 }
 return data.entries;
}
export function reviewedStakingPeriod(entries,data,from,to,now){
 const c=data.accrual_coverage;
 if(data.reward_withdrawal_gaps?.length||!c||c.status!=='CURRENT'||!Number.isFinite(Date.parse(c.from_time))||!Number.isFinite(Date.parse(c.through_time))
  ||from>=Date.parse(c.through_time)||to<=Date.parse(c.from_time)||now-Date.parse(c.through_time)>172800000
  ||entries.some(r=>r.usd_value===null&&r.category!=='funding'))return false;
 return reviewedGenericPeriod(entries.filter(r=>r.evidence?.kind!=='staking-accrual'),{...data,coverage_gaps:[]},from,to,now);
}
