import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NamesValidatorProofs,checkValidatorSnapshot,validateOperatorProof} from '../names-v2-validator-proofs.mjs';
import {proofChallenge,operatorAccount} from '../names-profile-core.mjs';
import {NamesV2Client} from '../names-v2-client.mjs';
const f=JSON.parse(readFileSync(new URL('./fixtures/nns-adr36.json',import.meta.url)));
function harness(){
 let clock=f.now,profile=structuredClone(f.profile),binding=null,wrongChallenge=false,fail=false,wallet=profile.identity.owner,signer=operatorAccount(f.pair.mainnet.address),signCalls=[],writes=[];
 const deployment={chain_id:'uni-7',registry:f.deployment.registry,profile_contract:f.deployment.contract,token:'test-token',treasury:f.profile.identity.owner};
 const records=new Map(),storage={getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)};
 const reader={deployment,verify:async()=>({...deployment,testnet_only:true,purchases_paused:false}),profile:async()=>({active:profile.identity.expires_at>clock,profile:structuredClone(profile)}),
 operatorBinding:async()=>binding,validatorChallenge:async a=>({text:wrongChallenge?'wrong':proofChallenge({deployment:f.deployment,profile,pair:a.pair,expiresAt:a.expires_at,now:clock,revoke:a.revoke}),mainnet_signer:operatorAccount(a.pair.mainnet.address),testnet_signer:operatorAccount(a.pair.testnet.address)})};
 const keplr={enable:async()=>{},getKey:async()=>({bech32Address:signer}),signArbitrary:async(chain,address,text)=>{signCalls.push({chain,address,text});const p=f.proofs[chain==='juno-1'?0:1];return {pub_key:{type:'tendermint/PubKeySecp256k1',value:p.public_key},signature:p.signature};}};
 const flow=new NamesValidatorProofs({reader,keplr,now:()=>clock});
 const client=new NamesV2Client({deployment,reader,storage,walletAddress:async()=>wallet,withLock:async(_,fn)=>fn(),now:()=>clock,execute:async request=>{writes.push(request);if(fail)throw Error('Unknown transaction outcome');return {transactionHash:'A'.repeat(64),chainId:'uni-7',code:0,height:101};}});
 return {flow,reader,client,keplr,storage,profile:()=>profile,writes,signCalls,prepare:()=>flow.prepare({name:'alice',pair:f.pair,owner:profile.identity.owner}),setClock:x=>clock=x,setProfile:fn=>fn(profile),setBinding:x=>binding=x,setWrongChallenge:()=>wrongChallenge=true,setFail:()=>fail=true,setWallet:x=>wallet=x,setSigner:x=>signer=x};
}
async function signed(h){await h.prepare();await h.flow.sign('mainnet');h.setSigner(operatorAccount(f.pair.testnet.address));await h.flow.sign('testnet');return h.flow.review();}

test('separate operator steps preserve one challenge across wallet switches and publish only on explicit call',async()=>{
 const h=harness(),prepared=await signed(h);
 assert.equal(h.signCalls.length,2);assert.equal(h.signCalls[0].text,h.signCalls[1].text);assert.equal(h.writes.length,0);
 assert.equal(h.flow.ready(),true);
 await h.client.validatorWrite({payer:f.profile.identity.owner,prepared});
 assert.equal(h.writes.length,1);const request=h.writes[0];assert.equal(request.contract,f.deployment.contract);
 assert.deepEqual(request.msg.link_validators.pair,f.pair);assert.equal(request.msg.link_validators.expected_revision,0);
 assert.equal(h.client.load(f.profile.identity.owner).phase,'complete');
});
test('wrong signer, wallet change during popup, malformed signatures and changed contract challenge fail closed',async()=>{
 const h=harness();await h.prepare();h.setSigner(f.profile.identity.owner);
 await assert.rejects(h.flow.sign('mainnet'),/Select the mainnet/);assert.equal(h.signCalls.length,0);
 h.setSigner(operatorAccount(f.pair.mainnet.address));const original=h.keplr.signArbitrary;
 h.keplr.signArbitrary=async(...args)=>{const r=await original(...args);h.setSigner(f.profile.identity.owner);return r;};
 await assert.rejects(h.flow.sign('mainnet'),/wallet changed/);assert.equal(h.flow.ready(),false);
 for(const p of [{},{...f.proofs[0],signature:'not-base64'},{...f.proofs[0],public_key:Buffer.alloc(33).toString('base64')}])assert.throws(()=>validateOperatorProof(p));
 const c=harness();c.setWrongChallenge();await assert.rejects(c.prepare(),/challenge does not match/);assert.equal(c.flow.snapshot,null);
});
test('reset during a signature rejects late results and concurrent signatures cannot start',async()=>{
 const h=harness();await h.prepare();let release,entered;
 const start=new Promise(r=>entered=r),wait=new Promise(r=>release=r),original=h.keplr.signArbitrary;
 h.keplr.signArbitrary=async(...args)=>{entered();await wait;return original(...args);};
 const pending=h.flow.sign('mainnet');await start;
 await assert.rejects(h.flow.sign('mainnet'),/in progress/);h.flow.reset();release();
 await assert.rejects(pending,/preparation changed/);assert.deepEqual(h.flow.proofs,{});
});
test('transfer, profile edits, expiry, wrong deployment and exclusive bindings invalidate prepared publication',async()=>{
 for(const mutate of [h=>h.setProfile(p=>p.revision++),h=>h.setProfile(p=>p.identity.ownership_revision++),h=>h.setProfile(p=>p.identity.owner=operatorAccount(f.pair.testnet.address)),h=>h.setClock(f.now+541),h=>h.setBinding({identity:{name:'other.neta'}})]){
  const h=harness(),prepared=await signed(h);mutate(h);
  await assert.rejects(h.client.validatorWrite({payer:f.profile.identity.owner,prepared}));assert.equal(h.writes.length,0);
 }
 const h=harness(),prepared=await signed(h);prepared.snapshot.deployment.contract=f.deployment.registry;
 await assert.rejects(h.client.validatorWrite({payer:f.profile.identity.owner,prepared}),/deployment changed/);assert.equal(h.writes.length,0);
 const main=harness();main.reader.deployment.chain_id='juno-1';await assert.rejects(main.prepare(),/UNI-7 only/);
});
test('operator revocation can be relayed by a non-owner wallet but binds the current pair and role',async()=>{
 const h=harness();h.setProfile(p=>p.validators=structuredClone(f.pair));
 await h.flow.prepare({name:'alice',purpose:'revoke',role:'testnet'});
 await assert.rejects(h.flow.sign('mainnet'),/Prepare this operator/);
 h.setSigner(operatorAccount(f.pair.testnet.address));await h.flow.sign('testnet');const prepared=await h.flow.review();
 const payer=operatorAccount(f.pair.mainnet.address);h.setWallet(payer);await h.client.validatorWrite({payer,prepared});
 assert.equal(h.writes.length,1);assert.deepEqual(h.writes[0].msg.revoke_by_operator.operator,f.pair.testnet);
 const c=harness();await assert.rejects(c.flow.prepare({name:'alice',purpose:'revoke',role:'mainnet'}),/no validator link/);
});
test('owner unlink preserves the expected pair, requires owner and journals unknown results without resend',async()=>{
 const h=harness();h.setProfile(p=>p.validators=structuredClone(f.pair));
 const args={owner:f.profile.identity.owner,name:'alice',expectedRevision:0,expectedPair:f.pair};
 h.setWallet(operatorAccount(f.pair.testnet.address));await assert.rejects(h.client.unlinkValidators(args),/Wallet changed/);
 h.setWallet(args.owner);await assert.rejects(h.client.unlinkValidators({...args,expectedRevision:1}),/changed/);assert.equal(h.writes.length,0);
 h.setFail();await assert.rejects(h.client.unlinkValidators(args),/Unknown/);assert.equal(h.client.load(args.owner).phase,'write_pending');
 await assert.rejects(h.client.unlinkValidators(args),/reconcile/);assert.equal(h.writes.length,1);
});
test('unknown link result stays recoverable and blocks a duplicate; incomplete proofs never execute',async()=>{
 const h=harness(),prepared=await signed(h);const payer=f.profile.identity.owner;
 const missing=structuredClone(prepared);delete missing.proofs.testnet;await assert.rejects(h.client.validatorWrite({payer,prepared:missing}),/signature/);assert.equal(h.writes.length,0);
 h.setFail();await assert.rejects(h.client.validatorWrite({payer,prepared}),/Unknown/);assert.equal(h.client.load(payer).phase,'write_pending');
 await assert.rejects(h.client.validatorWrite({payer,prepared}),/reconcile/);assert.equal(h.writes.length,1);
 const recovered=await h.client.recoverPending(payer,async()=>({transactionHash:'A'.repeat(64),chainId:'uni-7',code:0,height:101,intentMatched:true}));
 assert.equal(recovered.intent.phase,'complete');assert.equal(h.writes.length,1);
});
