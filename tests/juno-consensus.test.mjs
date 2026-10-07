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
