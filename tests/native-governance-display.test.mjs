import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { formatVoteAmount, nativeTally, normalizeNativeProposal, readNativeVoting, linkedNativeId } from '../native-governance-display.mjs';
import { finalizedReview } from '../juno-community-governance.mjs';
import { claimProposal } from '../planner-proposal-draft.mjs';
import { fixture } from './fixtures/delegation-planner.mjs';

const tally = { yes_count: '2099071009805', no_count: '123456', abstain_count: '0', no_with_veto_count: '9007199254740993' };
const proposal = { id: '381', status: 'PROPOSAL_STATUS_VOTING_PERIOD', final_tally_result: { yes_count:'0', no_count:'0', abstain_count:'0', no_with_veto_count:'0' } };
test('open proposals never use the zero-filled final tally; all four integer amounts remain exact', () => {
  assert.equal(normalizeNativeProposal(proposal).proposal.votes, null);
  assert.deepEqual(nativeTally(tally), { yes:'2099071009805', no:'123456', abstain:'0', veto:'9007199254740993' });
  assert.throws(() => nativeTally({ ...tally, no_with_veto_count: undefined }));
  assert.throws(() => nativeTally({ ...tally, yes_count: '-1' }));
  assert.throws(() => nativeTally({ ...tally, yes_count: 10 }));
});
function transport(p = proposal, fail = false) {
  const calls=[];
  return { calls, fetcher: async (url, options) => {
    calls.push({url, options});
    if (fail && url.includes('one.example')) throw Error('Source down');
    let data;
    if(url.endsWith('/blocks/latest')) data={block:{header:{chain_id:'juno-1',height:'42710000',time:new Date().toISOString()}}};
    else if(url.endsWith('/tally')) data={tally};
    else data={proposal:p};
    return new Response(JSON.stringify(data),{headers:{'x-cosmos-block-height':'42710000'}});
  }};
}
test('live tally uses a fresh same-height proposal and tally, with provider fallback',async()=>{
  const t=transport(proposal,true);
  const result=await readNativeVoting(['https://one.example','https://two.example'],'381',t);
  assert.equal(result.votes.yes,tally.yes_count);
  assert.equal(result.height,'42710000');
  assert.equal(result.endpoint,'https://two.example');
  assert.equal(t.calls.at(-1).options.headers['x-cosmos-block-height'],'42710000');
});
test('closed proposals use final tally without a live tally call; deposit has no invented votes',async()=>{
  for(const status of ['PROPOSAL_STATUS_PASSED','PROPOSAL_STATUS_DEPOSIT_PERIOD']) {
    const t=transport({...proposal,status,final_tally_result:tally});
    const r=await readNativeVoting(['https://one.example'],'381',t);
    assert.equal(t.calls.some(c=>c.url.endsWith('/tally')),false);
    assert.equal(r.votes?.yes||null,status.endsWith('PASSED')?tally.yes_count:null);
  }
});
test('identity mismatch, wrong chain, stale data and incomplete tallies fail instead of showing zero',async()=>{
  await assert.rejects(readNativeVoting(['https://one.example'],'381',transport({...proposal,id:'382'})),/identity/);
  for(const edit of [
    d=>{if(d.block)d.block.header.chain_id='uni-7';},
    d=>{if(d.block)d.block.header.time='2020-01-01T00:00:00Z';},
    d=>{if(d.tally)delete d.tally.no_count;}
  ]) {
    const t=transport();
    await assert.rejects(readNativeVoting(['https://one.example'],'381',{fetcher:async(...args)=>{
      const r=await t.fetcher(...args),d=await r.json();edit(d);
      return new Response(JSON.stringify(d),{headers:r.headers});
    }}));
  }
});
test('review linking checks finalized hash, chain/contract marker and complete content, preserving ambiguity',async()=>{
  const values=claimProposal(fixture()).values;
  const review={id:17,latest_version:1,finalized_version:1,finalized_hash:createHash('sha256').update(JSON.stringify(values)).digest('hex')};
  const revision={...values,proposal_id:17,version:1};
  const final=await finalizedReview(review,revision,'juno-1');
  const raw={...final.content,id:'381',messages:final.content.messages.map(m=>({...m,msg:Buffer.from(JSON.stringify(m.msg)).toString('base64')}))};
  const records=[normalizeNativeProposal(raw)];
  assert.equal(await linkedNativeId(review,revision,'juno-1',records),381);
  assert.equal(await linkedNativeId(review,revision,'uni-7',records),null);
  assert.equal(await linkedNativeId(review,{...revision,body:'edited'},'juno-1',records),null);
  for(const field of ['metadata','summary','title','messages']) {
    assert.equal(await linkedNativeId(review,revision,'juno-1',[normalizeNativeProposal({...raw,[field]:field==='messages'?[]:'copied'})]),null);
  }
  assert.equal(await linkedNativeId(review,revision,'juno-1',[...records,normalizeNativeProposal({...raw,id:'382'})]),null);
});

test('display rounds with integer arithmetic and keeps small nonzero votes visible',()=>{
  assert.equal(formatVoteAmount('2099071009805','en-US'),'2,099,071.01 JUNO');
  assert.equal(formatVoteAmount('2099071009805','de-DE'),'2.099.071,01 JUNO');
  assert.equal(formatVoteAmount('999999','en-US'),'1.00 JUNO');
  assert.equal(formatVoteAmount('1','en-US'),'<0.01 JUNO');
  assert.equal(formatVoteAmount('0','en-US'),'0 JUNO');
});
