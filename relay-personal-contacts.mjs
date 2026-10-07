import {normalizeName,validateJunoAddress} from './names-profile-core.mjs';
import {PERSONAL_MAINNET_POLICY} from './relay-personal-network.mjs';
import {freshNamesBlock} from './names-v2-reader.mjs';

export async function resolvePersonalContact(adapter,input){
  const value=String(input||'').trim();
  if(value.startsWith('juno1'))return {address:validateJunoAddress(value,true),name:null};
  const name=normalizeName(value);
  if(adapter.profile.chain!=='juno-1'||adapter.profile.policy?.nns_registry!==PERSONAL_MAINNET_POLICY.nns_registry)
    throw Error('Verified mainnet name registry required');
  const base=await adapter.verify();
  const block=freshNamesBlock(await adapter.get(base,'/cosmos/base/tendermint/v1beta1/blocks/latest'),'juno-1');
  const query=async msg=>(await adapter.get(base,'/cosmwasm/wasm/v1/contract/'+PERSONAL_MAINNET_POLICY.nns_registry+'/smart/'+encodeURIComponent(btoa(JSON.stringify(msg))))).data;
  const identity=await query({identity:{name}});
  if(identity?.name!==name||!Number.isSafeInteger(identity.expires_at)||identity.expires_at<=Math.max(block.time,Date.now()/1000))
    throw Error('Name is expired or unavailable');
  const address=validateJunoAddress(identity.owner,true),reverse=await query({name_of:{address}});
  if(reverse?.address!==address||reverse.name!==name)throw Error('Name owner changed. Review the contact again.');
  return {name,address};
}
export async function checkPersonalContact(adapter,name,address){
  if(name&&(await resolvePersonalContact(adapter,name)).address!==address)throw Error('Name owner changed. Review the contact again.');
}
export function contactInvitation(location,address){
  validateJunoAddress(address,true);
  const url=new URL(location.href);url.search='';url.searchParams.set('relayContact',address);url.hash='relay';return url.href;
}
export function invitedContact(location){
  const input=new URL(location.href).searchParams.get('relayContact');
  try{return input?validateJunoAddress(input,true):'';}catch{return '';}
}
