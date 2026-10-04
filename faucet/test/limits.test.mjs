import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FaucetLedger} from '../service/ledger.mjs';
import {readLimits} from '../service/limits.mjs';

const HASH='A'.repeat(64);
test('request quotas persist after restart and reset independently at UTC boundaries',()=>{
  const dir=mkdtempSync(join(tmpdir(),'faucet-quotas-')),file=join(dir,'ledger.sqlite');
  let now=Date.UTC(2026,9,4,23,59,0);
  const options={now:()=>now,limits:{requestsPerMinute:1,requestsPerDay:2,requestsPerMonth:3}};
  let l=new FaucetLedger(file,{},options);
  assert.equal(l.guard.admitRequest(),null);assert.match(l.guard.admitRequest().reason,/minute/);l.close();
  l=new FaucetLedger(file,{},options);assert.match(l.guard.admitRequest().reason,/minute/);
  now+=60000;assert.equal(l.guard.admitRequest(),null); // New day, same month.
  now+=60000;assert.equal(l.guard.admitRequest(),null);assert.match(l.guard.admitRequest().reason,/month/);
  now=Date.UTC(2026,10,1);assert.equal(l.guard.admitRequest(),null);l.close();rmSync(dir,{recursive:true});
});
test('daily request budget cannot be bypassed with new minutes',()=>{
  let now=Date.UTC(2026,9,4,12);const l=new FaucetLedger(':memory:',{},{now:()=>now,limits:{requestsPerDay:1}});
  assert.equal(l.guard.admitRequest(),null);now+=60000;assert.match(l.guard.admitRequest().reason,/day/);l.close();
});
test('payout budget counts failed reservations and existing claims, preserves replay, survives restart',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'faucet-payout-cap-')),file=join(dir,'ledger.sqlite');
  let now=Date.UTC(2026,9,4,12),prepared=0;
  const adapter={prepare:async()=>{prepared++;throw Error('RPC failed');},lookup:async()=>null};
  const options={now:()=>now,verify:async()=>true,domain:'test',limits:{payoutsPerDay:1,payoutsPerMonth:2}};
  let l=new FaucetLedger(file,adapter,options);
  const a=l.challenge('alice'),b=l.challenge('bob');await assert.rejects(l.claim(a),/RPC failed/);
  assert.equal((await l.claim(a)).status,'failed');await assert.rejects(l.claim(b),/day payout limit/);
  assert.throws(()=>l.challenge('carol'),/day payout limit/);assert.equal(prepared,1);l.close();
  l=new FaucetLedger(file,adapter,options);assert.match(l.guard.payoutPause().reason,/day/);
  now+=86400000;assert.equal(l.guard.payoutPause(),null);
  await assert.rejects(l.claim(l.challenge('carol')),/RPC failed/);assert.match(l.guard.payoutPause().reason,/month/);
  now=Date.UTC(2026,10,1);assert.equal(l.guard.payoutPause(),null);l.close();rmSync(dir,{recursive:true});
});
test('competing wallets cannot exceed global payout cap or reset a pending journal',async()=>{
  let release;const wait=new Promise(r=>release=r);let broadcasts=0;
  const adapter={prepare:async()=>{await wait;return {hash:HASH,bytes:'YWJj'};},broadcast:async()=>{broadcasts++;throw Error('unknown');},lookup:async()=>null};
  const l=new FaucetLedger(':memory:',adapter,{verify:async()=>true,domain:'test',limits:{payoutsPerDay:1}});
  const a=l.challenge('alice'),b=l.challenge('bob'),first=l.claim(a);
  await new Promise(setImmediate);await assert.rejects(l.claim(b),/day payout limit/);release();
  assert.equal((await first).status,'pending');assert.equal(l.blocked(),true);assert.equal(broadcasts,1);l.close();
});
test('operator limits fail closed on zero, invalid, or above-ceiling settings',()=>{
  for(const value of ['0','-1','NaN','1.2','50001',''])assert.throws(()=>readLimits({FAUCET_REQUESTS_PER_MONTH:value}));
  assert.equal(readLimits({FAUCET_REQUESTS_PER_MONTH:'10'}).requestsPerMonth,10);
});
