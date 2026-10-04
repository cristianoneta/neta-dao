import {normalizeName,validatePair,operatorAccount,proofChallenge} from './names-profile-core.mjs';

export const profileDeployment = deployment => ({chain_id:deployment.chain_id,contract:deployment.profile_contract,registry:deployment.registry});
export const samePair = (a,b) => !!a && !!b && ['mainnet','testnet'].every(role=>a[role]?.chain_id===b[role]?.chain_id&&a[role]?.address===b[role]?.address);
const sameIdentity = (a,b) => ['name','owner','generation','ownership_revision','expires_at'].every(key=>a?.[key]===b?.[key]);
export function validateOperatorProof(proof) {
  for(const [field,size] of [['public_key',33],['signature',64]]) {
    const value=proof?.[field];
    if(typeof value!=='string'||value.length>100||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('Malformed operator signature.');
    const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));
    if(bytes.length!==size||btoa(String.fromCharCode(...bytes))!==value||(field==='public_key'&&![2,3].includes(bytes[0])))throw Error('Malformed operator signature.');
  }
  return structuredClone(proof);
}

// Uses only the pinned UNI-7 profile contract. Remote validator existence and
// active-set membership are separate programme observations, not inferred here.
export async function checkValidatorSnapshot(reader,snapshot,now=Math.floor(Date.now()/1000)) {
  if(reader.deployment?.chain_id!=='uni-7')throw Error('Validator proof publication is UNI-7 only.');
  const domain=profileDeployment(reader.deployment);
  if(['chain_id','contract','registry'].some(key=>snapshot?.deployment?.[key]!==domain[key]))throw Error('Validator proof deployment changed. Prepare again.');
  if(!['link','revoke'].includes(snapshot.purpose))throw Error('Unknown validator proof purpose.');
  const text=proofChallenge({...snapshot,now,revoke:snapshot.purpose==='revoke'});
  if(text!==snapshot.text)throw Error('Validator proof context changed. Prepare again.');
  await reader.verify();
  const response=await reader.profile(snapshot.profile.identity.name),current=response?.profile;
  if(!response?.active||!sameIdentity(current?.identity,snapshot.profile.identity)||current?.revision!==snapshot.profile.revision)throw Error('Name owner, expiry or profile revision changed. Prepare new proofs.');
  if(snapshot.purpose==='revoke'&&!samePair(current.validators,snapshot.pair))throw Error('Validator link changed. Prepare a new revocation.');
  const challenge=await reader.validatorChallenge({name:current.identity.name,expected_revision:current.revision,pair:snapshot.pair,expires_at:snapshot.expiresAt,revoke:snapshot.purpose==='revoke'});
  if(challenge?.text!==text||challenge.mainnet_signer!==operatorAccount(snapshot.pair.mainnet.address)||challenge.testnet_signer!==operatorAccount(snapshot.pair.testnet.address))throw Error('Contract ownership challenge does not match.');
  if(snapshot.purpose==='link') {
    for(const op of [snapshot.pair.mainnet,snapshot.pair.testnet]) {
      const binding=await reader.operatorBinding(op);
      if(binding!==null&&binding?.identity?.name!==current.identity.name)throw Error('Operator already linked to another active name, or binding unavailable.');
    }
  }
  return structuredClone(current);
}

// Public consent signatures stay in this tab only. Wallet changes between the
// two explicit signing steps are expected; changes during signing are rejected.
export class NamesValidatorProofs {
  constructor({reader,keplr=globalThis.keplr,now=()=>Math.floor(Date.now()/1000)}) {
    this.reader=reader;this.keplr=keplr;this.now=now;this.epoch=0;this.snapshot=null;this.proofs={};this.signing=false;
  }
  reset(){this.epoch++;this.snapshot=null;this.proofs={};}
  assertCurrent(epoch){if(this.epoch!==epoch)throw Error('Validator proof preparation changed. Review again.');}
  async prepare({name,pair,owner,purpose='link',role=null}) {
    this.reset();const epoch=this.epoch;
    if(!['link','revoke'].includes(purpose)||(purpose==='revoke'&&!['mainnet','testnet'].includes(role)))throw Error('Choose a validator proof action.');
    name=normalizeName(name);await this.reader.verify();
    const response=await this.reader.profile(name),profile=response?.profile;
    if(!response?.active||profile?.identity?.name!==name||profile.identity.expires_at<=this.now())throw Error('An active name is required.');
    if(purpose==='link'&&profile.identity.owner!==owner)throw Error('Connect the current name owner to prepare a link.');
    if(purpose==='revoke'){pair=profile.validators;if(!pair)throw Error('There is no validator link to revoke.');}
    validatePair(pair);
    const snapshot={deployment:profileDeployment(this.reader.deployment),profile:structuredClone(profile),pair:structuredClone(pair),purpose,role,expiresAt:Math.min(this.now()+540,profile.identity.expires_at)};
    snapshot.text=proofChallenge({...snapshot,now:this.now(),revoke:purpose==='revoke'});
    await checkValidatorSnapshot(this.reader,snapshot,this.now());this.assertCurrent(epoch);
    this.snapshot=snapshot;return structuredClone(snapshot);
  }
  async sign(role) {
    if(this.signing)throw Error('Another operator signature is in progress.');
    if(!this.snapshot||!['mainnet','testnet'].includes(role)||(this.snapshot.purpose==='revoke'&&this.snapshot.role!==role))throw Error('Prepare this operator proof first.');
    const snapshot=structuredClone(this.snapshot),epoch=this.epoch,keplr=this.keplr;
    if(!keplr?.enable||!keplr?.getKey||!keplr?.signArbitrary)throw Error('Keplr ownership signing is unavailable.');
    this.signing=true;
    try {
      await checkValidatorSnapshot(this.reader,snapshot,this.now());this.assertCurrent(epoch);
      const op=snapshot.pair[role],signer=operatorAccount(op.address);
      await keplr.enable(op.chain_id);
      if((await keplr.getKey(op.chain_id)).bech32Address!==signer)throw Error(`Select the ${role} operator wallet ${signer} in Keplr, then retry this signature.`);
      this.assertCurrent(epoch);proofChallenge({...snapshot,now:this.now(),revoke:snapshot.purpose==='revoke'});
      const signed=await keplr.signArbitrary(op.chain_id,signer,snapshot.text);
      if((await keplr.getKey(op.chain_id)).bech32Address!==signer)throw Error('Operator wallet changed during signing. Review again.');
      if(signed?.pub_key?.type!=='tendermint/PubKeySecp256k1')throw Error('Only ordinary secp256k1 operator accounts are supported.');
      const proof=validateOperatorProof({public_key:signed.pub_key.value,signature:signed.signature});
      await checkValidatorSnapshot(this.reader,snapshot,this.now());this.assertCurrent(epoch);
      proofChallenge({...snapshot,now:this.now(),revoke:snapshot.purpose==='revoke'});
      this.proofs[role]=proof;return structuredClone(proof);
    }finally{this.signing=false;}
  }
  ready(){return !!this.snapshot&&this.snapshot.expiresAt>this.now()&&(this.snapshot.purpose==='link'?!!this.proofs.mainnet&&!!this.proofs.testnet:!!this.proofs[this.snapshot.role]);}
  async review(){
    if(!this.ready())throw Error('Collect the required signatures before they expire.');
    const epoch=this.epoch,snapshot=structuredClone(this.snapshot),proofs=structuredClone(this.proofs);
    await checkValidatorSnapshot(this.reader,snapshot,this.now());this.assertCurrent(epoch);
    return {snapshot,proofs};
  }
}
