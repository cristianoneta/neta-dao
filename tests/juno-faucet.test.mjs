import test from 'node:test';
import assert from 'node:assert/strict';
import {amountToMicro,formatMicro,rewardsMicro,messagesFor,Uni7Reader} from '../juno-faucet-core.mjs';
import {lookupTransaction,reconcilePendingTransaction} from '../juno-faucet-transactions.mjs';
import {createHash} from 'node:crypto';
test('indexed UNI-7 fallback confirms exact transaction bytes; unavailable, wrong-chain or mismatched results stay locked',async()=>{
  const tx=new TextEncoder().encode('synthetic signed transaction'),hash=createHash('sha256').update(tx).digest('hex').toUpperCase();
  let mode='confirmed',calls=[];
  const fetcher=async url=>{
    calls.push(url);let result;
    if(url.endsWith('/status'))result={node_info:{network:mode==='wrong-chain'?'juno-1':'uni-7'}};
    else if(mode!=='unavailable')result={hash,height:'123',index:0,tx:Buffer.from(mode==='wrong-bytes'?'other':tx).toString('base64'),tx_result:{code:mode==='failed'?7:0,gas_wanted:'100',gas_used:'90'}};
    return {ok:true,json:async()=>result?{result}:{error:{message:'transaction indexing is disabled'}}};
  };
  const included=await lookupTransaction(hash,fetcher);assert.equal(included.hash,hash);assert.equal(included.code,0);
  assert.match(calls[0],/stavr/);assert.equal(calls.length,2);
  const map=new Map(),key='neta-pending-tx-v1:uni-7:wallet';
  const row=JSON.stringify({version:1,status:'pending',chain:'uni-7',sender:'wallet',hash,bytes:Buffer.from(tx).toString('base64')});
  const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},locks={request:async(k,o,fn)=>{assert.equal(k,key);return fn({});}};
  const options={storage,locks,lookup:h=>lookupTransaction(h,fetcher)};map.set(key,row);
  for(mode of ['unavailable','wrong-chain','wrong-bytes']){
    await assert.rejects(reconcilePendingTransaction('wallet',options),/confirmation is pending/);
    assert.equal(map.get(key),row);
  }
  mode='confirmed';assert.equal((await reconcilePendingTransaction('wallet',options)).code,0);assert.equal(map.has(key),false);
  map.set(key,row);mode='failed';assert.equal((await reconcilePendingTransaction('wallet',options)).code,7);assert.equal(map.has(key),false);
  map.set(key,row);assert.equal(await reconcilePendingTransaction('wallet',{...options,locks:{request:async(k,o,fn)=>fn(null)}}),null);assert.equal(map.get(key),row);
  map.set(key,JSON.stringify({...JSON.parse(row),bytes:Buffer.from('tampered').toString('base64')}));
  await assert.rejects(reconcilePendingTransaction('wallet',options),/Invalid transaction journal/);assert.ok(map.has(key));
});
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
