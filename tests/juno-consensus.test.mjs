import test from 'node:test';import assert from 'node:assert/strict';
import {parseConsensus,percent,observationsAgree} from '../juno-consensus-core.mjs';
function fixture(){
  const validators=[40,20,15,15,10].map((p,i)=>({address:String(i+1).repeat(40),voting_power:String(p)}));
  const vote=(i,type,block='B'.repeat(12))=>`Vote{${i}:${validators[i].address.slice(0,12)} 42452001/00/SIGNED_MSG_TYPE_${type}(${type==='PREVOTE'?'Prevote':'Precommit'}) ${block} signature @ 2026-10-07T07:00:00Z}`;
  return {result:{round_state:{height:'42452001',round:0,step:4,validators:{validators},votes:[{round:0,prevotes:[vote(0,'PREVOTE'),vote(1,'PREVOTE','0'.repeat(12)),vote(2,'PREVOTE'),'nil-Vote','nil-Vote'],precommits:validators.map(()=> 'nil-Vote')}]}}};
}
test('weights block agreement separately from nil participation and absent votes',()=>{
 const c=parseConsensus(fixture());assert.equal(c.total,'100');assert.equal(c.prevotes.power,'55');assert.equal(c.prevotes.observed,'75');assert.equal(c.prevotes.nil,'20');assert.equal(c.prevotes.missing,'25');assert.equal(c.prevotes.needed,'12');assert.equal(c.precommits.power,'0');assert.equal(c.prevotes.quorum,false);assert.equal(percent('16302719','29766214'),54.77);
});
test('quorum requires strictly more than two thirds for one block',()=>{
 const f=fixture();f.result.round_state.validators.validators.forEach((v,i)=>v.voting_power=String([3,1,3,1,1][i]));const c=parseConsensus(f);assert.equal(c.total,'9');assert.equal(c.threshold,'7');assert.equal(c.prevotes.power,'6');assert.equal(c.prevotes.quorum,false);
 f.result.round_state.validators.validators[0].voting_power='4';const d=parseConsensus(f);assert.equal(d.prevotes.power,'7');assert.equal(d.prevotes.quorum,true);
});
test('malformed, different-height/round and mismatched-identity votes never turn into zero',()=>{
 for(const change of [s=>s.votes[0].prevotes.pop(),s=>s.round=1,s=>s.votes[0].prevotes[0]=s.votes[0].prevotes[0].replace('42452001','42452002'),s=>s.votes[0].prevotes[0]=s.votes[0].prevotes[0].replace('Vote{0:','Vote{1:'),s=>s.validators.validators[0].voting_power='-1',s=>s.validators.validators[1].address=s.validators.validators[0].address]){const f=fixture();change(f.result.round_state);assert.throws(()=>parseConsensus(f));}
});
test('two observer snapshots must match height, round, power and individual votes',()=>{
 const a=parseConsensus(fixture()),b=structuredClone(a);assert.equal(observationsAgree(a,b),true);b.height++;assert.equal(observationsAgree(a,b),false);b.height--;b.rows[0].prevote.block='C'.repeat(12);assert.equal(observationsAgree(a,b),false);
});

import {parseCommitWindow,commitWindowsAgree} from '../juno-consensus-core.mjs';
import {commitFixture} from './fixtures/juno-commits.mjs';
test('canonical block signatures remain stable when the next live round is empty',()=>{
 const f=commitFixture(),c=parseCommitWindow(f.commits,f.set,f.height);
 assert.equal(c.signedPower,'90');assert.equal(c.latestPower,'90');assert.equal(c.missingPower,'10');assert.equal(c.signedCount,3);assert.equal(c.rows[0].signed,5);assert.equal(c.rows[3].signed,0);
 const round=fixture();round.result.round_state.votes[0].prevotes.fill('nil-Vote');assert.equal(parseConsensus(round).prevotes.power,'0');assert.equal(c.signedPower,'90');
});
test('recent participation is not a fabricated single-block quorum; nil is separate',()=>{
 const f=commitFixture();const sig=f.commits[0].result.signed_header.commit.signatures;
 sig[2].block_id_flag=3;const c=parseCommitWindow(f.commits,f.set,f.height);
 assert.equal(c.latestPower,'70');assert.equal(c.signedPower,'90');assert.equal(c.rows[2].signed,4);assert.equal(c.rows[2].nil,1);assert.equal(c.rows[2].latest,'nil');
});
test('incomplete, wrong-chain, malformed and noncanonical evidence fails, never yields zero',()=>{
 const changes=[f=>f.set.result.block_height='1',f=>f.set.result.total='6',f=>f.set.result.validators[1].address=f.set.result.validators[0].address,f=>f.commits.pop(),f=>f.commits[0].result.canonical=false,f=>f.commits[0].result.signed_header.header.chain_id='uni-7',f=>f.commits[0].result.signed_header.commit.height='42452151',f=>f.commits[0].result.signed_header.commit.signatures.pop(),f=>f.commits[0].result.signed_header.commit.signatures[0].validator_address='F'.repeat(40),f=>f.commits[0].result.signed_header.commit.signatures[0].signature=null,f=>f.commits[0].result.signed_header.commit.signatures[0].block_id_flag=3,f=>f.commits[0].result.signed_header.header.last_block_id.hash='F'.repeat(64)];
 for(const change of changes){const f=commitFixture();change(f);assert.throws(()=>parseCommitWindow(f.commits,f.set,f.height));}
});
test('window stops at the upgrade and at a validator-set change',()=>{
 const first=commitFixture(undefined,42452001);assert.equal(parseCommitWindow(first.commits,first.set,first.height).count,1);
 const f=commitFixture();f.commits[2].result.signed_header.header.validators_hash='B'.repeat(64);const c=parseCommitWindow(f.commits,f.set,f.height);assert.equal(c.count,2);assert.equal(c.rows[0].signed,2);
});
test('cross-check compares exact heights, identities, powers and each commit',()=>{
 const f=commitFixture(),a=parseCommitWindow(f.commits,f.set,f.height),b=structuredClone(a);assert.equal(commitWindowsAgree(a,b),true);b.blocks[4].kinds[0]='missing';assert.equal(commitWindowsAgree(a,b),false);assert.equal(commitWindowsAgree(a,null),false);
});
