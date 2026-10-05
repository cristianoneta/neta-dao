import {MAINNET_UPGRADE_ADMIN,MAINNET_REGISTRY_ADMIN} from './mainnet-config.mjs';
import {CHAIN,NETA,DAO} from './service/constants.mjs';
import {SNAPSHOT_ARTIFACTS} from './mainnet-artifacts.mjs';
import {validateJunoAddress} from '../names-profile-core.mjs';
export function validateSnapshotDeployment(m) {
  if(m?.version!==3 || m.pricing_protocol!=='treasury-snapshot-v1' || m.chain_id!==CHAIN || m.testnet_only!==false || m.token!==NETA || m.treasury!==DAO || m.admin!==MAINNET_REGISTRY_ADMIN) throw Error('Mainnet snapshot deployment identity mismatch.');
  for(const field of ['registry','profile_contract']) validateJunoAddress(m[field]);
  if(new Set([m.registry,m.profile_contract,NETA,DAO]).size!==4) throw Error('Contract roles overlap.');
  const key=Uint8Array.from(atob(m.quote_public_key||''),c=>c.charCodeAt(0));
  if(key.length!==32||key.every(b=>b===0)||btoa(String.fromCharCode(...key))!==m.quote_public_key||!Number.isSafeInteger(m.signer_version)||m.signer_version<1) throw Error('Pin the public price key and signer version.');
  for(const role of ['registry','profiles']) {
    const pin=m.contracts?.[role];
    if(!pin||!Number.isSafeInteger(pin.code_id)||pin.code_id<1||pin.sha256!==SNAPSHOT_ARTIFACTS[role].sha256||pin.admin!==MAINNET_UPGRADE_ADMIN) throw Error('Snapshot contract code identity mismatch.');
    validateJunoAddress(pin.creator);
  }
  return structuredClone(m);
}
