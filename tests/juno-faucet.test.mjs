import test from 'node:test';
import assert from 'node:assert/strict';
import {amountToMicro,formatMicro,rewardsMicro,messagesFor,Uni7Reader} from '../juno-faucet-core.mjs';
test('donations require whole positive JUNOX; staking keeps exact micro-units',()=>{
  assert.equal(amountToMicro('10',true),'10000000');assert.equal(amountToMicro('0.000001'),'1');assert.equal(formatMicro('900719925474099100'),'900,719,925,474.0991');
  for(const bad of ['0','-1','1.5','1e2',' 10','01','+1','NaN','1.000000','1000000000000'])assert.throws(()=>amountToMicro(bad,true));
  for(const bad of ['0','0.0000001','1e3','Infinity'])assert.throws(()=>amountToMicro(bad));
});
test('fixed message denominations and exact reward sums',()=>{
  const donate=messagesFor('donate','from','to','17')[0];assert.deepEqual(donate.value.amount,[{denom:'ujunox',amount:'17000000'}]);
  assert.equal(messagesFor('unstake','a','v','1.234567')[0].typeUrl,'/cosmos.staking.v1beta1.MsgUndelegate');
  assert.equal(rewardsMicro([{denom:'ujunox',amount:'0.9'},{denom:'ujunox',amount:'0.9'},{denom:'ujuno',amount:'999'}]),'1');
});
test('wrong chain fails closed; pagination retrieves all pages and rejects repeated cursors',async()=>{
  let calls=0;const wrong=new Uni7Reader(async()=>({ok:true,json:async()=>({default_node_info:{network:'juno-1'}})}));
  await assert.rejects(wrong.verify(),/mismatch/);assert.equal(wrong.base,null);
  const reader=new Uni7Reader(async url=>{calls++;return {ok:true,json:async()=>({validators:[calls],pagination:{next_key:url.includes('pagination.key')?'':'next+/='}})};});reader.base='test:';
  assert.deepEqual(await reader.pages('/validators','validators'),[1,2]);
  reader.fetcher=async()=>({ok:true,json:async()=>({validators:[],pagination:{next_key:'loop'}})});
  await assert.rejects(reader.pages('/validators','validators'),/Repeated/);
});
