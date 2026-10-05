import {validatePair} from './names-profile-core.mjs';

// Read-only observations from pinned public providers, not light-client proofs or
// a programme eligibility decision. Staking records are latest-state reads;
// consensus membership is pinned to the explicitly displayed block height.
export const VALIDATOR_SOURCES=Object.freeze({
 'juno-1':Object.freeze(['https://juno-api.polkachu.com','https://juno.api.m.stavr.tech']),
 'uni-7':Object.freeze(['https://juno.test.api.nodeshub.online','https://juno.api.t.stavr.tech'])
});
const ROOT='/cosmos/base/tendermint/v1beta1',MAX_BYTES=2000000;
function integer(value){if(typeof value!=='string'||!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw Error('Invalid chain integer.');return Number(value);}
function header(data,chain,now){
 const h=data?.sdk_block?.header??data?.block?.header;
 if(h?.chain_id!==chain)throw Error('Chain identity mismatch.');
 const height=integer(h.height),time=Date.parse(h.time);
 if(height<1||!Number.isFinite(time)||time>now+30000||now-time>120000)throw Error('Node block is stale or device time is incorrect.');
 return {height,time:h.time};
}
function key(value){
 if(value?.['@type']!=='/cosmos.crypto.ed25519.PubKey'||typeof value.key!=='string'||value.key.length!==44)throw Error('Unsupported or malformed consensus key.');
 const bytes=atob(value.key);if(bytes.length!==32||btoa(bytes)!==value.key)throw Error('Malformed consensus key.');return value.key;
}
async function json(fetcher,url,signal){
 const r=await fetcher(url,{method:'GET',cache:'no-store',credentials:'omit',redirect:'error',signal});
 if(Number(r.headers.get('content-length'))>MAX_BYTES)throw Error('Chain response too large.');
 const reader=r.body?.getReader();if(!reader)throw Error('Empty chain response.');
 let length=0;const chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_BYTES)throw Error('Chain response too large.');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{throw Error('Invalid chain response.');}
 if(!r.ok){if(r.status===404&&data?.code===5)return {notFound:true};throw Error('Chain data unavailable ('+r.status+').');}
 return data;
}
async function consensus(get,height,target){
 let total=null,offset=0;const seen=new Set();let present=false;
 for(let page=0;page<20;page++){
  const d=await get(`${ROOT}/validatorsets/${height}?pagination.limit=100&pagination.offset=${offset}&pagination.count_total=true`);
  const n=integer(d.pagination?.total);
  if(integer(d.block_height)!==height||n<1||n>2000||(total!==null&&n!==total)||!Array.isArray(d.validators))throw Error('Inconsistent consensus set.');
  total=n;
  if(d.validators.length!==Math.min(100,total-offset))throw Error('Incomplete consensus set.');
  for(const v of d.validators){const k=key(v.pub_key);if(seen.has(k)||integer(v.voting_power)<1)throw Error('Invalid or repeated consensus member.');seen.add(k);if(k===target)present=true;}
  offset+=d.validators.length;if(offset===total)return {active:present,height,total};
 }
 throw Error('Consensus set exceeds the page limit.');
}
export class ValidatorStatusReader {
 constructor({fetcher=globalThis.fetch,now=Date.now,timeout=15000}={}){this.fetcher=(...args)=>fetcher(...args);this.now=now;this.timeout=timeout;}
 async observe(operator,{signal}={}){
  const sources=VALIDATOR_SOURCES[operator.chain_id];if(!sources)throw Error('Unsupported validator chain.');
  const failures=[];
  for(const source of sources){
   if(signal?.aborted)throw signal.reason;
   const deadline=AbortSignal.timeout(this.timeout),combined=signal?AbortSignal.any([signal,deadline]):deadline;
   const get=path=>json(this.fetcher,source+path,combined);
   try{
    const block=header(await get(ROOT+'/blocks/latest'),operator.chain_id,this.now());
    const data=await get('/cosmos/staking/v1beta1/validators/'+encodeURIComponent(operator.address));
    if(data.notFound)return {...operator,source,checkedAt:new Date(this.now()).toISOString(),block,exists:false,consensus:null};
    const v=data.validator;
    if(v?.operator_address!==operator.address||typeof v.jailed!=='boolean'||!['BOND_STATUS_BONDED','BOND_STATUS_UNBONDED','BOND_STATUS_UNBONDING'].includes(v.status)||typeof v.description?.moniker!=='string'||v.description.moniker.length>256)throw Error('Validator record mismatch or incomplete.');
    const consensusKey=key(v.consensus_pubkey);
    let membership=null,consensusError=null;
    if(operator.chain_id==='uni-7')try{membership=await consensus(get,block.height,consensusKey);}catch(error){if(signal?.aborted)throw error;consensusError=error.message;}
    // An observation taking too long must not retain a fresh-looking active flag.
    header({block:{header:{chain_id:operator.chain_id,height:String(block.height),time:block.time}}},operator.chain_id,this.now());
    return {...operator,source,checkedAt:new Date(this.now()).toISOString(),block,exists:true,moniker:v.description.moniker,jailed:v.jailed,stakingStatus:v.status,consensus:membership,consensusError};
   }catch(error){if(signal?.aborted)throw error;failures.push(new URL(source).hostname+': '+error.message);}
  }
  return {...operator,exists:null,consensus:null,checkedAt:new Date(this.now()).toISOString(),error:failures.join(' | ')};
 }
 async pair(pair,{signal}={}){
  validatePair(pair);
  const [mainnet,testnet]=await Promise.all(['mainnet','testnet'].map(role=>this.observe(pair[role],{signal})));
  return {mainnet,testnet};
 }
}
export function validatorStatusText(result){
 return ['mainnet','testnet'].map(role=>{
  const r=result[role],lines=[`${role==='mainnet'?'Juno mainnet':'UNI-7'} · ${r.address}`];
  if(r.exists===null)lines.push('UNAVAILABLE · '+r.error);
  else if(!r.exists)lines.push('NOT FOUND · no validator record at this provider.');
  else{
   lines.push(`EXISTS · ${r.moniker}`,`Latest staking record: ${r.stakingStatus.replace('BOND_STATUS_','')} · jailed: ${r.jailed?'yes':'no'}`);
   if(role==='testnet')lines.push(r.consensus?`${r.consensus.active?'IN':'NOT IN'} ACTIVE CONSENSUS SET · block ${r.consensus.height} · ${r.consensus.total} validators`:'ACTIVE SET UNAVAILABLE · '+r.consensusError);
  }
  if(r.source)lines.push('Source: '+r.source,`Observed block: ${r.block.height} · ${r.block.time}`);
  lines.push('Checked: '+r.checkedAt);return lines.join('\n');
 }).join('\n\n');
}
