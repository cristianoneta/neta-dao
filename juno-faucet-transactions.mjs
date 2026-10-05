import {namesNetwork} from './names/networks.mjs';
import {CHAIN} from './juno-faucet-core.mjs?v=2';

const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
const decode = value => Uint8Array.from(atob(value),c=>c.charCodeAt(0));

// Only reads chain data. Never signs or rebroadcasts an uncertain transaction.
export async function lookupTransaction(hash, fetcher=fetch, chainId=CHAIN) {
  const network=namesNetwork(chainId);
  if(!/^[0-9A-F]{64}$/.test(hash))throw Error('Invalid transaction hash');
  const get=async url=>{const r=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Transaction lookup unavailable');return r.json();};
  // STAVR indexes transactions; NodesHub currently disables its transaction index.
  for(const rpc of [...network.rpcs].reverse()){
    try{
      const status=await get(rpc+'/status');
      if(status.result?.node_info?.network!==chainId)continue;
      const response=await get(rpc+'/tx?hash=0x'+hash),r=response.result;
      if(!r||r.hash?.toUpperCase()!==hash||!r.tx)continue;
      const height=Number(r.height),code=r.tx_result?.code,tx=decode(r.tx);
      if(!Number.isSafeInteger(height)||height<1||!Number.isInteger(code)||await digest(tx)!==hash)continue;
      return {hash,height,code,tx,txIndex:r.index,events:r.tx_result.events||[],rawLog:r.tx_result.log||'',gasWanted:BigInt(r.tx_result.gas_wanted||0),gasUsed:BigInt(r.tx_result.gas_used||0),msgResponses:[]};
    }catch{/* Try the next allowlisted UNI-7 endpoint; absence never means failure. */}
  }
  return null;
}

// Shares the signing bundles' origin-wide lock and journal. A record is removed
// only after its exact signed bytes are confirmed in a UNI-7 block.
export async function reconcilePendingTransaction(address,options={}) {
  const storage=options.storage||globalThis.localStorage,locks=options.locks||globalThis.navigator?.locks;
  const lookup=options.lookup||lookupTransaction,key='neta-pending-tx-v1:'+CHAIN+':'+address;
  if(!storage||!locks?.request)throw Error('Transaction recovery requires persistent storage and browser locks.');
  return locks.request(key,{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock)return null;
    const raw=storage.getItem(key);if(raw===null)return null;
    const row=JSON.parse(raw);
    if(row?.version!==1||row.chain!==CHAIN||row.sender!==address||!['signing','pending'].includes(row.status))throw Error('Invalid transaction journal. Recovery remains locked.');
    if(row.status==='signing')throw Error('Interrupted signature. Check wallet history before continuing.');
    if(!/^[0-9A-F]{64}$/.test(row.hash)||typeof row.bytes!=='string'||await digest(decode(row.bytes))!==row.hash)throw Error('Invalid transaction journal. Recovery remains locked.');
    const included=await lookup(row.hash);
    if(!included||included.hash!==row.hash||!Number.isSafeInteger(included.height)||included.height<1||!Number.isInteger(included.code)||!included.tx||await digest(included.tx)!==row.hash)throw Error('Transaction confirmation is pending. No repeat transaction will be sent. TX '+row.hash);
    if(storage.getItem(key)!==raw)throw Error('Transaction journal changed. Recovery remains locked.');
    storage.removeItem(key);
    return included;
  });
}
