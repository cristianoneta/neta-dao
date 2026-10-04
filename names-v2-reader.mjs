import {normalizeName,validateJunoAddress} from './names-profile-core.mjs';
import {NAMES_V2_DEPLOYMENT} from './names-v2-core.mjs';

export const UNI7_RESTS=Object.freeze(['https://juno.test.api.nodeshub.online','https://juno.api.t.stavr.tech']);
export const UNI7_RPCS=Object.freeze(['https://juno.test.rpc.nodeshub.online','https://juno.rpc.t.stavr.tech']);
const hex=/^[a-f0-9]{64}$/;
const address=validateJunoAddress;
export function freshUni7Block(latest,now=Math.floor(Date.now()/1000)){
  const header=latest?.block?.header??latest?.sdk_block?.header;
  if(!header)throw Error('Latest block response has no header.');
  if(header.chain_id!=='uni-7')throw Error('UNI-7 block IDENTITY MISMATCH');
  const time=Date.parse(header.time)/1000,height=Number(header.height);
  if(!Number.isSafeInteger(height)||height<=0||!Number.isFinite(time))throw Error('Latest block has an invalid height or timestamp.');
  if(time>now+30||now-time>120)throw Error(`Block time ${header.time}; browser time ${new Date(now*1000).toISOString()}. Outside the freshness window. Check automatic device date/time; if correct, retry when the node catches up.`);
  return {height,time};
}
export function uni7Failure(base,error){return `${new URL(base).hostname}: ${error?.message||'Request failed'}`;}
function digest(value){
  if(typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value))return value.toLowerCase();
  const bytes=Uint8Array.from(atob(value||''),c=>c.charCodeAt(0));
  if(bytes.length!==32||btoa(String.fromCharCode(...bytes))!==value)throw Error('Invalid code checksum.');
  return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function validateManifest(input){
  if(input?.version!==1||input.chain_id!=='uni-7'||input.testnet_only!==true)throw Error('A reviewed UNI-7 deployment manifest is required.');
  const m=structuredClone(input);
  for(const key of ['registry','token','treasury','admin','profile_contract'])address(m[key]);
  if(new Set([m.registry,m.token,m.profile_contract]).size!==3)throw Error('Contract roles must be distinct.');
  for(const role of ['registry','token','profiles']){
    const c=m.contracts?.[role];
    if(!c||!Number.isSafeInteger(c.code_id)||c.code_id<=0||!hex.test(c.sha256))throw Error('Pin every contract code ID and SHA-256.');
    address(c.creator);if(c.admin!==null)address(c.admin);
  }
  const key=Uint8Array.from(atob(m.quote_public_key||''),c=>c.charCodeAt(0));
  if(key.length!==32||key.every(b=>b===0)||btoa(String.fromCharCode(...key))!==m.quote_public_key||!Number.isSafeInteger(m.signer_version)||m.signer_version<1)throw Error('Pin the quote authority and version.');
  return m;
}
// Every request is read-only. Chain data is trusted to the pinned RPC providers;
// this verifies deployment identity, not Tendermint light-client proofs.
export class NamesV2Reader {
  constructor({deployment=NAMES_V2_DEPLOYMENT,fetcher=globalThis.fetch,now=()=>Math.floor(Date.now()/1000)}={}){
    this.deployment=validateManifest(deployment);this.fetcher=fetcher.bind(globalThis);this.now=now;this.base=null;
  }
  async get(base,path){
    const r=await this.fetcher(base+path,{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw Error('UNI-7 data unavailable ('+r.status+').');
    return r.json();
  }
  async raw(base,contract,query){
    const encoded=encodeURIComponent(btoa(JSON.stringify(query)));
    const result=await this.get(base,`/cosmwasm/wasm/v1/contract/${contract}/smart/${encoded}`);
    if(!Object.hasOwn(result,'data'))throw Error('Missing contract query result.');return result.data;
  }
  async verify(deployment=this.deployment){
    if(JSON.stringify(validateManifest(deployment))!==JSON.stringify(this.deployment))throw Error('Deployment manifest changed.');
    this.base=null;const m=this.deployment,failures=[];
    for(const base of UNI7_RESTS){
      try {
        const node=await this.get(base,'/cosmos/base/tendermint/v1beta1/node_info');
        if(node.default_node_info?.network!=='uni-7')throw Error('UNI-7 IDENTITY MISMATCH');
        const latest=await this.get(base,'/cosmos/base/tendermint/v1beta1/blocks/latest');
        const {height,time}=freshUni7Block(latest,this.now());
        for(const [role,contract] of [['registry',m.registry],['token',m.token],['profiles',m.profile_contract]]){
          const pin=m.contracts[role];
          const info=(await this.get(base,`/cosmwasm/wasm/v1/contract/${contract}`)).contract_info;
          if(Number(info?.code_id)!==pin.code_id||info.creator!==pin.creator||(info.admin||null)!==pin.admin)throw Error(role+' IDENTITY MISMATCH');
          const code=(await this.get(base,`/cosmwasm/wasm/v1/code/${pin.code_id}`)).code_info;
          if(digest(code?.data_hash)!==pin.sha256)throw Error(role+' CODE IDENTITY MISMATCH');
        }
        const config=await this.raw(base,m.registry,{config:{}});
        for(const key of ['chain_id','token','treasury','admin','quote_public_key','signer_version','testnet_only'])if(config?.[key]!==m[key])throw Error('Registry configuration IDENTITY MISMATCH');
        if(typeof config.purchases_paused!=='boolean'||!Number.isSafeInteger(config.tariff_version)||config.tariff_version<1)throw Error('Invalid registry configuration.');
        for(const key of ['three_cents','four_cents','standard_cents'])if(!Number.isSafeInteger(config.tariff?.[key])||config.tariff[key]<1)throw Error('Invalid registry tariff.');
        const token=await this.raw(base,m.token,{token_info:{}});
        if(token?.decimals!==6)throw Error('Token decimals IDENTITY MISMATCH');
        const profile=await this.raw(base,m.profile_contract,{config:{}});
        if(profile?.registry!==m.registry)throw Error('Profile registry IDENTITY MISMATCH');
        this.base=base;this.block={height,time};this.verifiedAt=this.now();return config;
      }catch(error){if(/MISMATCH/.test(error.message))throw error;failures.push(uni7Failure(base,error));}
    }
    throw Error('Verified UNI-7 deployment unavailable. '+failures.join(' | '));
  }
  async smart(query,contract=this.deployment.registry){if(!this.base||this.now()-this.verifiedAt>=10)await this.verify();return this.raw(this.base,contract,query);}
  resolve(name){return this.smart({resolve:{name:normalizeName(name)}});}
  identity(name){return this.smart({identity:{name:normalizeName(name)}});}
  nameOf(owner){address(owner);return this.smart({name_of:{address:owner}});}
  commitment(owner){address(owner);return this.smart({commitment:{address:owner}});}
  transferOffer(name){return this.smart({transfer_offer:{name:normalizeName(name)}});}
  profile(name){return this.smart({profile:{name:normalizeName(name)}},this.deployment.profile_contract);}
}
