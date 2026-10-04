import test from 'node:test';
import assert from 'node:assert/strict';
import {amountToMicro,formatMicro,rewardsMicro,messagesFor,Uni7Reader} from '../juno-faucet-core.mjs';
test('wallet reads use SDK routes and retain paginated delegations; failed reads never become zero stake',async()=>{
  const address='juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt';
  const stakePath='/cosmos/staking/v1beta1/delegations/'+address;
  let failStake=false, stakeReads=0;
  const reader=new Uni7Reader(async url=>{
    const u=new URL(url);let data;
    if(u.pathname===stakePath){
      if(failStake)return {ok:false,status:501};
      stakeReads++;
      data={delegation_responses:[{delegation:{validator_address:u.searchParams.has('pagination.key')?'validator-b':'validator-a'},balance:{denom:'ujunox',amount:'5000000'}}],pagination:{next_key:u.searchParams.has('pagination.key')?null:'next+/='}};
    } else {
      const routes={
        ['/cosmos/bank/v1beta1/balances/'+address+'/by_denom']:{balance:{denom:'ujunox',amount:'20000000'}},
        ['/cosmos/staking/v1beta1/delegators/'+address+'/unbonding_delegations']:{unbonding_responses:[],pagination:{}},
        ['/cosmos/distribution/v1beta1/delegators/'+address+'/rewards']:{rewards:[],total:[]},
        ['/cosmos/distribution/v1beta1/delegators/'+address+'/withdraw_address']:{withdraw_address:address},
      };
      data=routes[u.pathname];
    }
    return data?{ok:true,json:async()=>data}:{ok:false,status:501};
  });reader.base='https://test.invalid';
  const data=await reader.account(address);
  assert.equal(data.balance,'20000000');assert.equal(data.withdraw,address);
  assert.deepEqual(data.delegations.map(x=>x.delegation.validator_address),['validator-a','validator-b']);
  assert.equal(stakeReads,2);assert.deepEqual(data.unbondings,[]);
  failStake=true;await assert.rejects(reader.account(address),/501/);
});
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
