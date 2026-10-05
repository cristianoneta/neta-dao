import test from 'node:test';
import assert from 'node:assert/strict';
import {FaucetLedger} from '../service/ledger.mjs';
import {createFaucetServer} from '../service/http.mjs';
import {CONFIRMATION_VERSION} from '../service/confirmation.mjs';
const origin='https://dao.netareborn.com';
async function setup(t,{limits,paused=false,balance,clock}={}){
  let calls=0;const adapter={confirmation:CONFIRMATION_VERSION,address:'juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt',balance:async()=>{calls++;return balance?balance():'100000000';},lookup:async()=>null};
  const ledger=new FaucetLedger(':memory:',adapter,{verify:async()=>false,domain:'https://faucet.test',limits,...(clock?{now:clock}:{})});
  const server=createFaucetServer({ledger,adapter,origin,paused,...(clock?{now:clock}:{})});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));ledger.close();});
  return {ledger,get calls(){return calls;},get:path=>fetch(`http://127.0.0.1:${server.address().port}${path}`)};
}
test('request cap rejects every route before RPC and reports reset time',async t=>{
  const s=await setup(t,{limits:{requestsPerDay:1}});
  assert.equal((await s.get('/status')).status,200);const blocked=await s.get('/status');
  assert.equal(blocked.status,429);assert.ok(blocked.headers.get('retry-after'));assert.match((await blocked.json()).error,/day request limit/);
  assert.equal((await s.get('/unknown')).status,429);assert.equal(s.calls,1);
});
test('concurrent status reads share one RPC refresh and cache it for 30 seconds',async t=>{
  let now=Date.UTC(2026,9,4,12),release;const pending=new Promise(r=>release=r);
  const s=await setup(t,{clock:()=>now,balance:async()=>{await pending;return '100000000';}});
  const requests=Array.from({length:4},()=>s.get('/status'));await new Promise(r=>setTimeout(r,25));release();
  const results=await Promise.all(requests);assert.ok(results.every(r=>r.status===200));assert.equal(s.calls,1);
  const status=await (await s.get('/status')).json();assert.equal(status.ready,true);assert.equal(status.protection,'usage-guards-v1');assert.equal(status.confirmation,CONFIRMATION_VERSION);assert.equal(s.calls,1);
  now+=30001;await s.get('/status');assert.equal(s.calls,2);
});
test('failed RPC is cached too, without exposing its error',async t=>{
  const s=await setup(t,{balance:()=>{throw Error('sensitive RPC detail');}});
  for(let i=0;i<3;i++){const r=await s.get('/status');assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/sensitive/);}
  assert.equal(s.calls,1);
});
test('operator pause causes no chain calls',async t=>{
  const s=await setup(t,{paused:true});assert.equal((await s.get('/status')).status,503);assert.equal(s.calls,0);
});
test('status reports not ready when global payout budget is exhausted',async t=>{
  const s=await setup(t,{limits:{payoutsPerDay:1}});
  s.ledger.db.prepare("INSERT INTO claims(id,address,status,created) VALUES('old','alice','failed',?)").run(Date.now());
  const status=await (await s.get('/status')).json();assert.equal(status.ready,false);assert.match(status.pause.reason,/day payout limit/);
});
test('readiness covers the 25 JUNOX payout plus 2 JUNOX buffer',async t=>{
  let now=1800000000000,balance='26999999';
  const s=await setup(t,{clock:()=>now,balance:()=>balance});
  let status=await (await s.get('/status')).json();
  assert.equal(status.amount,'25000000');assert.equal(status.intervalSeconds,86400);assert.equal(status.ready,false);
  balance='27000000';now+=30001;status=await (await s.get('/status')).json();assert.equal(status.ready,true);
});
