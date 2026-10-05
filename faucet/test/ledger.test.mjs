import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FaucetLedger,DAY} from '../service/ledger.mjs';
const HASH='A'.repeat(64);
function setup(options={}){let now=1800000000000, prepares=0,broadcasts=0,included=null;
 const adapter={prepare:async()=>{prepares++;return {hash:HASH,bytes:'YWJj'};},broadcast:async()=>{broadcasts++;included={hash:HASH,height:1,code:0};},lookup:async()=>included,...options};
 const ledger=new FaucetLedger(':memory:',adapter,{now:()=>now,verify:async()=>true,domain:'https://faucet.example'});
 return {ledger,adapter,setTime:t=>now=t,get now(){return now;},get prepares(){return prepares;},get broadcasts(){return broadcasts;},confirm:()=>included={hash:HASH,height:2,code:0}};
}
test('exact rolling 24h boundary and same-id replay cannot pay twice',async()=>{
 const s=setup(),c=s.ledger.challenge('alice');const result=await s.ledger.claim({...c,signature:{}});assert.equal(result.status,'confirmed');
 assert.equal((await s.ledger.claim({...c,signature:{}})).hash,HASH);assert.equal(s.broadcasts,1);
 assert.throws(()=>s.ledger.challenge('alice'),/Only 25/);s.setTime(s.now+DAY-1);assert.throws(()=>s.ledger.challenge('alice'),/Only 25/);
 s.setTime(s.now+1);assert.ok(s.ledger.challenge('alice').id);s.ledger.close();
});
test('parallel claims for one account and competing accounts serialize payout signing',async()=>{
 let release;const wait=new Promise(r=>release=r);const s=setup({prepare:async()=>{await wait;return {hash:HASH,bytes:'YWJj'};}});
 const a=s.ledger.challenge('alice'),b=s.ledger.challenge('bob');const first=s.ledger.claim(a);
 await new Promise(setImmediate);
 const same=await s.ledger.claim(a);assert.equal(same.status,'signing');await assert.rejects(s.ledger.claim(b),/confirming/);
 release();assert.equal((await first).status,'confirmed');assert.equal(s.broadcasts,1);s.ledger.close();
});
test('ambiguous broadcasts survive restart and never trigger a second payment',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'neta-faucet-')),file=join(dir,'ledger.sqlite');let broadcasts=0,included=null;
 const adapter={prepare:async()=>({hash:HASH,bytes:'YWJj'}),broadcast:async()=>{broadcasts++;throw Error('timeout');},lookup:async()=>included};
 let l=new FaucetLedger(file,adapter,{verify:async()=>true,domain:'test'});const c=l.challenge('alice');assert.equal((await l.claim(c)).status,'pending');l.close();
 l=new FaucetLedger(file,adapter,{verify:async()=>true,domain:'test'});await l.reconcile();assert.equal(l.blocked(),true);assert.equal(l.eligibility('alice').pending,true);assert.equal((await l.claim(c)).status,'pending');assert.equal(broadcasts,1);
 included={hash:HASH,height:7,code:0};await l.reconcile();assert.equal(l.blocked(),false);assert.throws(()=>l.challenge('alice'),/Only 25/);l.close();rmSync(dir,{recursive:true});
});
test('invalid and expired signatures never reserve or broadcast',async()=>{
 const s=setup(),c=s.ledger.challenge('alice');s.ledger.verify=async()=>false;await assert.rejects(s.ledger.claim(c),/invalid/);assert.equal(s.prepares,0);
 s.ledger.verify=async()=>true;s.setTime(s.now+300001);await assert.rejects(s.ledger.claim(c),/expired/);assert.equal(s.prepares,0);s.ledger.close();
});
test('known on-chain failures release lock, missing or mismatched proof does not',async()=>{
 const s=setup({lookup:async()=>({hash:'B'.repeat(64),height:1,code:0})});const c=s.ledger.challenge('alice');assert.equal((await s.ledger.claim(c)).status,'pending');assert.equal(s.ledger.blocked(),true);
 s.adapter.lookup=async()=>({hash:HASH,height:2,code:5});await s.ledger.reconcile();assert.equal(s.ledger.blocked(),false);assert.equal(s.ledger.eligibility('alice').nextClaimAt,null);s.ledger.close();
});
test('upgrade rejects unused old-amount proofs but preserves existing claim replay',async()=>{
 const s=setup(),c=s.ledger.challenge('alice');assert.match(c.message,/Request: exactly 25 JUNOX/);
 s.ledger.db.prepare('UPDATE challenges SET message=? WHERE id=?').run(c.message.replace('25 JUNOX','10 JUNOX'),c.id);
 await assert.rejects(s.ledger.claim(c),/fresh wallet signature/);assert.equal(s.prepares,0);
 s.ledger.db.prepare("INSERT INTO claims(id,address,status,hash,confirmed,created) VALUES(?,?,'confirmed',?,?,?)").run(c.id,'alice',HASH,s.now,s.now);
 assert.equal((await s.ledger.claim(c)).hash,HASH);assert.equal(s.prepares,0);
 assert.throws(()=>s.ledger.challenge('alice'),/Only 25/);s.ledger.close();
});
