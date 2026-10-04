import {createHash} from 'node:crypto';

export const CONFIRMATION_VERSION='uni7-exact-hash-v1';
const INDEXED_RPC='https://juno.rpc.t.stavr.tech';
const MAX_RESPONSE_BYTES=512*1024;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex').toUpperCase();

async function readJson(fetcher,url,signal){
  const response=await fetcher(url,{signal,redirect:'error',cache:'no-store'});
  if(!response.ok)throw Error('Confirmation RPC unavailable.');
  let size=0;const chunks=[];
  for await(const chunk of response.body){
    size+=chunk.length;if(size>MAX_RESPONSE_BYTES)throw Error('Confirmation response too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// Trusted UNI-7 RPC receipts, with fresh network identity and exact signed-byte
// hash verification. This is not a light-client inclusion proof. Missing or
// malformed receipts always remain unknown; no signing/rebroadcast happens here.
export function createTransactionLookup({rpc,fetcher=fetch}){
  const configured=new URL(rpc);
  if(configured.protocol!=='https:'||configured.username||configured.password||configured.search||configured.hash)throw Error('Confirmation RPC must use HTTPS without credentials or query parameters.');
  const endpoints=[...new Set([INDEXED_RPC,rpc.replace(/\/$/,'')])];
  const inFlight=new Map();
  async function find(hash){
    const completed=new AbortController();
    async function inspect(endpoint){
      const controller=new AbortController();
      const signal=AbortSignal.any([completed.signal,controller.signal,AbortSignal.timeout(12000)]);
      try{
        // Both trusted endpoints run in parallel, as do their two read-only
        // requests. One slow index must not delay a valid receipt from the other.
        const [status,response]=await Promise.all([
          readJson(fetcher,endpoint+'/status',signal),
          readJson(fetcher,endpoint+'/tx?hash=0x'+hash,signal)
        ]);
        if(status.error||status.result?.node_info?.network!=='uni-7')throw Error('Wrong chain.');
        const r=response.result;
        if(response.error||r?.hash?.toUpperCase()!==hash||typeof r.tx!=='string')throw Error('Unknown receipt.');
        const tx=Buffer.from(r.tx,'base64'),height=Number(r.height),code=r.tx_result?.code;
        if(!tx.length||tx.toString('base64')!==r.tx||digest(tx)!==hash)throw Error('Invalid signed bytes.');
        if(!/^\d+$/.test(String(r.height))||!Number.isSafeInteger(height)||height<1||!Number.isInteger(code)||code<0||code>0xffffffff)throw Error('Invalid receipt result.');
        return {hash,height,code};
      }finally{controller.abort();}
    }
    try{return await Promise.any(endpoints.map(inspect));}
    catch{return null;} // Unavailable indexes never prove rejection or allow retry.
    finally{completed.abort();}
  }
  return async hash=>{
    if(typeof hash!=='string'||!/^[0-9A-F]{64}$/.test(hash))throw Error('Invalid transaction hash.');
    if(inFlight.has(hash))return inFlight.get(hash);
    const pending=find(hash);inFlight.set(hash,pending);
    try{return await pending;}finally{inFlight.delete(hash);}
  };
}

export function transactionTransport(client,options){
  return {
    confirmation:CONFIRMATION_VERSION,
    lookup:createTransactionLookup(options),
    // Submit once without CosmJS's getTx polling against a disabled index.
    // The durable ledger alone decides inclusion from the verified lookup.
    async broadcast(bytes){
      if(await client.getChainId()!=='uni-7')throw Error('UNI-7 network mismatch. Payouts disabled.');
      return client.broadcastTxSync(Buffer.from(bytes,'base64'));
    }
  };
}
