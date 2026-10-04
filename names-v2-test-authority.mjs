// Isolated UNI-7 test authority. Not a market feed or a mainnet price service.
import {quotePreimage,feeAmount,renewalExpiry,QUOTE_TTL} from './names-v2-core.mjs';
import {normalizeName} from './names-profile-core.mjs';
const DB='neta-nns-uni7-test-authority-v1',STORE='authority';
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function saved(mode,callback){const db=await openDB();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),request=callback(tx.objectStore(STORE));let value;request.onsuccess=()=>{value=request.result;};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Test authority storage aborted.'));});}finally{db.close();}}
const b64=bytes=>btoa(String.fromCharCode(...bytes));
export async function getTestAuthority({create=false}={}){
  if(!navigator.locks?.request)throw Error('Browser locks required for the test authority.');
  return navigator.locks.request(DB,{mode:'exclusive'},async()=>{
    let record=await saved('readonly',s=>s.get('key'));
    if(!record&&create){
      const pair=await crypto.subtle.generateKey({name:'Ed25519'},false,['sign','verify']);
      record={version:1,publicKey:b64(new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey))),privateKey:pair.privateKey};
      await saved('readwrite',s=>s.put(record,'key'));record=await saved('readonly',s=>s.get('key'));
    }
    if(!record)throw Error('This browser has no UNI-7 test authority. Open the setup page in the original browser.');
    if(record.version!==1||record.privateKey?.extractable!==false||record.privateKey?.algorithm?.name!=='Ed25519')throw Error('Invalid saved test authority. Preserve storage.');
    return record;
  });
}
export async function createTestQuote({reader,request,now=Math.floor(Date.now()/1000),authorityProvider=getTestAuthority,cryptoProvider=globalThis.crypto}){
  const deployment=reader.deployment,config=await reader.verify();
  if(deployment.chain_id!=='uni-7'||config.testnet_only!==true||config.purchases_paused!==false)throw Error('Only an unpaused UNI-7 test registry can use synthetic test quotes.');
  const authority=await authorityProvider();
  if(authority.publicKey!==config.quote_public_key)throw Error('This browser is not the pinned test quote authority.');
  const name=normalizeName(request.name);let owner,generation,ownership_revision,expected_expires_at;
  if(request.operation==='register'){
    const r=await reader.resolve(name);if(r?.available!==true||r.name!==name)throw Error('Test name unavailable.');
    owner=request.payer;generation=r.next_generation;ownership_revision=1;expected_expires_at=0;
  }else if(request.operation==='renew'){
    const r=await reader.identity(name);renewalExpiry(r,request.years,now);
    ({owner,generation,ownership_revision}=r);expected_expires_at=r.expires_at;
  }else throw Error('Unknown quote action.');
  const price='2000000000000'; // Fixed fictional USD 2 / mock NETA. Never a market quote.
  const nonce=[...cryptoProvider.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const quote={operation:request.operation,payer:request.payer,owner,name,generation,ownership_revision,expected_expires_at,years:request.years,
    tariff_version:config.tariff_version,signer_version:config.signer_version,usd_per_neta_12:price,amount:feeAmount(name,request.years,price,config.tariff),nonce,issued_at:now,expires_at:now+QUOTE_TTL};
  const text=quotePreimage(deployment,config,quote);
  const signature=b64(new Uint8Array(await cryptoProvider.subtle.sign('Ed25519',authority.privateKey,new TextEncoder().encode(text))));
  return {quote,signature};
}
