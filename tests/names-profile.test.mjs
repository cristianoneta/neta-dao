import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeContacts, normalizeName, operatorAccount, validatePair, proofChallenge, collectOperatorProofs, testnetBonusEligibility, contactLinks, PROFILE_DEPLOYMENT} from '../names-profile-core.mjs';

// Public addresses from the earlier read-only UNI-7 audit; no real signatures.
const pair = {
  mainnet: {chain_id:'juno-1', address:'junovaloper1my0kxfxzxvmgg0tj0gx63lzp6zrj5vjwcsutpe'},
  testnet: {chain_id:'uni-7', address:'junovaloper1a2m9f5u4qrnr45euqqwwuv8kvadv7twptqm02y'},
};
const now = 1700000000;
const deployment = {chain_id:'uni-7', contract:'juno13uft9dl34x9wdzcxnm80q8m8sh5cw04lkskzknm9vc0wduxchdxsrnr4pa', registry:'juno18d3mzk3ver06zfr5nf752aycss75vtcqd8fsdcuuzmh5mzj4cm6qrgx3fw'};
const profile = {identity:{name:'alice.neta', owner:'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57', generation:1, ownership_revision:1, expires_at:now+10000}, revision:0, validators:pair};
const args = () => structuredClone({deployment, profile, pair, expiresAt:now+300, now});

test('the browser challenge equals the fixture independently verified by the Rust contract', () => {
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/nns-adr36.json',import.meta.url)));
  assert.equal(proofChallenge({...fixture,expiresAt:fixture.expires_at}),fixture.text);
});

test('names and optional contacts are canonical and never imply contact verification', () => {
  assert.equal(normalizeName(' ALICE.NETA '), 'alice.neta');
  for (const name of ['ab','admin','x.dao.neta','-alice','alice--bob']) assert.throws(()=>normalizeName(name));
  const contacts = normalizeContacts({telegram:'@operator', twitter:'@operator', email:'hello@example.org', website:'https://example.org'});
  assert.equal(contacts.telegram,'operator');
  assert.equal(contactLinks(contacts).find(x=>x.label==='Telegram').href,'https://t.me/operator');
  assert.equal(contactLinks({discord:'operator.1'})[0].href,null);
  assert.deepEqual(normalizeContacts({}), {description:'',discord:'',telegram:'',twitter:'',email:'',website:''});
  for (const input of [{website:'javascript:alert(1)'},{website:'https://user:password@example.org'},{website:'https://example.org\\@evil.org'}, {email:'a@example.org?bcc=other'}, {telegram:'https://t.me/operator'}, {description:'a\nb'}, {description:'é'.repeat(251)}]) assert.throws(()=>normalizeContacts(input));
});

test('operator role, checksum and chain pair are checked', () => {
  assert.match(operatorAccount(pair.testnet.address),/^juno1/);
  assert.throws(()=>operatorAccount(pair.testnet.address.slice(0,-1)+'x'));
  assert.throws(()=>operatorAccount(pair.testnet.address.toUpperCase()));
  assert.throws(()=>operatorAccount(operatorAccount(pair.testnet.address)));
  assert.throws(()=>validatePair({...pair,testnet:{...pair.testnet,chain_id:'other'}}));
  assert.equal(PROFILE_DEPLOYMENT,null,'an unreviewed deployment must never become live');
});

test('human-readable challenge binds every ownership and replay context', () => {
  const original=proofChallenge(args());
  for (const mutate of [a=>a.deployment.chain_id='juno-1',a=>a.deployment.contract=a.deployment.registry,
    a=>a.profile.identity.name='other.neta',a=>a.profile.identity.generation++,a=>a.profile.identity.ownership_revision++,
    a=>a.profile.revision++,a=>a.pair.testnet.address=a.pair.mainnet.address,a=>a.revoke=true,a=>a.expiresAt++]) {
    const a=args();mutate(a);assert.notEqual(proofChallenge(a),original);
  }
  assert.match(original,/Purpose: link-validators\nRegistry chain: uni-7/);
  assert.throws(()=>proofChallenge({...args(),expiresAt:now}));
  assert.throws(()=>proofChallenge({...args(),expiresAt:now+601}));
  const a=args();a.profile.identity.owner='juno1invalid';assert.throws(()=>proofChallenge(a));
});

test('operator proof flow checks wallet identity, signs both contexts and never broadcasts', async () => {
  const calls=[];
  const keplr={enable:async c=>calls.push(['enable',c]),getKey:async c=>({bech32Address:operatorAccount(c==='juno-1'?pair.mainnet.address:pair.testnet.address)}),
    signArbitrary:async(c,a,text)=>{calls.push(['sign',c,a,text]);return {pub_key:{type:'tendermint/PubKeySecp256k1',value:'fixture-key'},signature:'fixture-signature'};}};
  const msg=await collectOperatorProofs({...args(),keplr,now:()=>now});
  assert.equal(calls.filter(c=>c[0]==='sign').length,2);
  assert.equal(calls[1][3],calls[3][3]);
  assert.equal(msg.link_validators.name,'alice.neta');
  assert.equal(msg.link_validators.expected_revision,0);
  let signed=0;
  await assert.rejects(collectOperatorProofs({...args(),now:()=>now,keplr:{...keplr,getKey:async()=>({bech32Address:profile.identity.owner}),signArbitrary:async()=>signed++}}),/Select the mainnet operator wallet/);
  assert.equal(signed,0);
  let reads=0;
  await assert.rejects(collectOperatorProofs({...args(),now:()=>now,keplr:{...keplr,getKey:async()=>({bech32Address:++reads===1?operatorAccount(pair.mainnet.address):profile.identity.owner})}}),/Wallet changed/);
});

function observations() {
  return {profileResponse:{active:true,profile:structuredClone(profile)}, now,
    mainnet:{chain_id:'juno-1',height:100,validator:{operator_address:pair.mainnet.address,status:'BOND_STATUS_UNBONDED',jailed:false}},
    testnet:{chain_id:'uni-7',height:200,validator:{operator_address:pair.testnet.address,status:'BOND_STATUS_BONDED',jailed:false,consensus_pubkey:{key:'consensus-fixture'}},consensus_pubkeys:['consensus-fixture']}};
}
test('bonus needs active testnet, never mainnet active set or an uptime minimum', () => {
  const a=observations();a.testnet.validator.uptime=1;
  assert.equal(testnetBonusEligibility(a).status,'eligible');
  a.testnet.validator.jailed=true;assert.equal(testnetBonusEligibility(a).status,'ineligible');
  a.testnet.validator.jailed=false;a.testnet.consensus_pubkeys=[];assert.equal(testnetBonusEligibility(a).status,'ineligible');
  a.testnet.consensus_pubkeys=null;assert.equal(testnetBonusEligibility(a).status,'unknown');
});
test('missing chain/name data stay unknown; expired names and missing links earn no bonus', () => {
  for(const mutate of [a=>a.testnet=null,a=>a.mainnet.chain_id='wrong',a=>a.testnet.validator.operator_address=pair.mainnet.address,
    a=>a.testnet.validator.jailed=undefined,a=>a.profileResponse=null]){
    const a=observations();mutate(a);assert.equal(testnetBonusEligibility(a).status,'unknown');
  }
  let a=observations();a.profileResponse.profile.identity.expires_at=now;assert.equal(testnetBonusEligibility(a).status,'ineligible');
  a=observations();a.profileResponse.profile.validators=null;assert.equal(testnetBonusEligibility(a).status,'ineligible');
});
