// Block evidence is distinct from a bank transaction; no invented transaction hashes.
import { validateGenericLedger, reviewedGenericPeriod } from './treasury-generic-accounting.mjs?v=20261006-9';
const start = Date.parse('2026-10-01T00:00:00Z');
const address = 'juno1jv65s3grqf6v6jl3dp4t6c9t9rk99cd83d88wr';
const fees = 'juno17xpfvakm2amg962yls6f84z3kell8c5lxtqmvp';
const fixed = value => {
  if(typeof value !== 'string' || !/^\d+(\.\d{1,18})?$/.test(value)) throw Error('Invalid block accounting amount');
  const [w,f='']=value.split('.'); return BigInt(w)*10n**18n+BigInt(f.padEnd(18,'0'));
};
export function validateCommunityLedger(data, dao) {
  if(data?.schema_version !== 3 || dao?.id !== 'juno' || data.dao_id !== 'juno'
    || data.chain_id !== 'juno-1' || data.scope !== 'juno-community-pool'
    || data.adapter !== 'native-community-pool' || data.accounting_start !== '2026-10-01T00:00:00Z'
    || data.treasuries?.length !== 1 || data.treasuries[0].chain_id !== 'juno-1' || data.treasuries[0].address !== address
    || !Array.isArray(data.entries) || !data.coverage_gaps?.length) throw Error('Community Pool evidence identity unavailable');
  const bank = data.entries.filter(r=>r.evidence?.kind!=='block-distribution');
  validateGenericLedger({...data,schema_version:2,entries:bank},dao);
  const ids=new Set(bank.map(r=>r.id));
  const ranges=new Map();
  for(const r of data.entries.filter(r=>r.evidence?.kind==='block-distribution')){
    const e=r.evidence,a=e.start,b=e.end;
    if(r.chain_id!=='juno-1'||r.treasury_address!==address||r.counterparty!==fees||r.tx_hash!==null
      || r.category!=='community_tax'||r.direction!=='in'||r.classification!=='community_tax'
      || !Number.isSafeInteger(a?.height)||!Number.isSafeInteger(b?.height)||a.height>b.height
      || e.blocks!==b.height-a.height+1 || e.blocks>1000 || r.height!==b.height
      || !/^[A-F0-9]{64}$/.test(a.hash)||!/^[A-F0-9]{64}$/.test(b.hash)||!/^[a-f0-9]{64}$/.test(e.results_sha256)
      || !Number.isFinite(Date.parse(a.timestamp))||!Number.isFinite(Date.parse(b.timestamp))
      || Date.parse(a.timestamp)<start||Date.parse(a.timestamp)>Date.parse(b.timestamp)
      || a.timestamp.slice(0,10)!==b.timestamp.slice(0,10)||r.timestamp!==b.timestamp
      || r.id!==`juno-1:distribution:${a.height}-${b.height}:${r.message_index}`||!Number.isSafeInteger(r.message_index)||r.message_index<0
      || r.receipt_id!==r.id||ids.has(r.id)||fixed(r.raw_amount)<=0n
      || e.method!=='fee-collector-transfers-minus-validator-rewards') throw Error('Community Pool block evidence failed validation');
    ids.add(r.id);
    const key=`${a.height}-${b.height}`;
    const prior=ranges.get(key);
    if(prior){
      if(prior.denoms.has(r.denom)||JSON.stringify(prior.evidence)!==JSON.stringify(e)) throw Error('Duplicate or inconsistent allocation range');
      prior.denoms.add(r.denom);
    }else ranges.set(key,{evidence:e,denoms:new Set([r.denom])});
    if(r.usd_value===null){if(r.valuation!==null)throw Error('Unpriced allocation has valuation');continue;}
    const q=r.valuation;
    if(!q||q.method!=='historical-daily-opening-reference'||q.denom!==r.denom||q.day!==a.timestamp.slice(0,10)
      || !Number.isInteger(q.decimals)||q.decimals<0||q.decimals>18||r.decimals!==q.decimals
      || (r.denom==='ujuno'&&(q.decimals!==6||q.coin_id!=='juno-network'))
      || !Number.isSafeInteger(q.timestamp_ms)||Date.parse(q.day+'T00:00:00Z')-q.timestamp_ms<0
      || Date.parse(q.day+'T00:00:00Z')-q.timestamp_ms>3600000||fixed(q.usd_price)<=0n
      || fixed(r.usd_value)!==fixed(r.raw_amount)*fixed(q.usd_price)/(10n**BigInt(q.decimals)*10n**18n)) throw Error('Historical Community Pool valuation failed validation');
  }
  const ordered=[...ranges.values()].sort((a,b)=>a.evidence.start.height-b.evidence.start.height);
  for(let i=1;i<ordered.length;i++){
    if(ordered[i].evidence.start.height!==ordered[i-1].evidence.end.height+1) throw Error('Community Pool allocation interval has a gap or overlap');
  }
  if(data.block_coverage && ordered.length){
    const c=data.block_coverage;
    if(c.from_height!==ordered[0].evidence.start.height || c.through_height!==ordered.at(-1).evidence.end.height
      || c.through_time!==ordered.at(-1).evidence.end.timestamp || c.ranges!==ordered.length
      || c.blocks!==ordered.reduce((n,r)=>n+r.evidence.blocks,0)) throw Error('Community Pool coverage does not match allocations');
  }
  return data.entries;
}
// These are explicitly recorded totals, not a claim of complete module accounting.
export function reviewedCommunityPeriod(entries,data,from,to,now){
 const c=data.block_coverage,r=data.recorded_cash_review;
 if(!c||c.status!=='CURRENT'||!r||r.status!=='reviewed'||r.method!=='distribution-outflows-less-reward-withdrawals'
  ||r.from_height!==c.from_height||r.through_height!==c.through_height||r.unresolved?.length!==0
  ||!Number.isInteger(r.transactions_checked)||r.transactions_checked<0
  ||from>=Date.parse(c.through_time)||now-Date.parse(c.through_time)>7200000
  ||entries.some(e=>e.usd_value===null&&e.category!=='funding'))return false;
 return reviewedGenericPeriod(entries.filter(e=>e.evidence?.kind!=='block-distribution'),{...data,coverage_gaps:[]},from,to,now);
}
