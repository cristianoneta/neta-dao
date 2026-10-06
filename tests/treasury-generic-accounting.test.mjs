import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateLedger,summarize,period,accountsFor} from '../treasury-pnl.mjs';
import {validateEventFeed} from '../treasury-generic-accounting.mjs';
const daos=JSON.parse(readFileSync(new URL('../data/dao-directory.json',import.meta.url))).daos;
const ops=daos.find(d=>d.id==='neta-operations'),cp=daos.find(d=>d.id==='juno');
const now=Date.parse('2026-10-06T14:00:00Z'),range=period(2026,10,new Date(now));
function ledger(dao=ops){return {schema_version:2,dao_id:dao.id,chain_id:dao.network,...dao.accountingSource,
  accounting_start:'2026-10-01T00:00:00Z',refresh_status:'completed',last_success_at:'2026-10-06T13:30:00Z',
  entries:[],coverage_gaps:dao.id==='juno'?['block allocations incomplete']:[],
  sources:dao.accountingSource.treasuries.map(t=>({...t,adapter:'cosmos-rest-receipts',accounting_start:'2026-10-01T00:00:00Z',last_scanned_height:100,anchor_hash:'A'.repeat(64)})),
  movement_review:{status:'PARTIAL',event_refresh_status:'PARTIAL',accounting_start:'2026-10-01T00:00:00Z',movements:[],unmatched_receipt_ids:[],matched_receipts:0,unreviewed_movements:0}};}
const summary=(d,dao=ops)=>summarize(validateLedger(d,dao),range,accountsFor(dao),d,now);
test('Operations connected empty review shows provisional zeros without NNS leakage',()=>{
 const s=summary(ledger());assert.equal(s.result,0n);assert.equal(s.expenses,0n);assert.equal(s.income,0n);
 assert.equal(s.categories.some(a=>a.id.startsWith('nns')),false);
 assert.throws(()=>validateLedger(ledger(),cp));
});
test('missing chain, stale refresh, failure, and unknown movements block zero totals',()=>{
 for(const mutate of [d=>d.sources.pop(),d=>d.refresh_status='unavailable',d=>d.last_success_at='2026-10-06T09:00:00Z',
 d=>d.movement_review.event_refresh_status='UNAVAILABLE',d=>d.coverage_gaps.push('gap'),
 d=>{d.movement_review.movements.push({id:'unknown',chain_id:'juno-1',treasury_address:ops.core,tx_hash:'B'.repeat(64),timestamp:'2026-10-04T00:00:00Z',direction:'in',raw_amount:'1',classification:'unreviewed',receipt_id:null,usd_value:null});d.movement_review.unreviewed_movements=1;}]){
 const d=ledger();mutate(d);assert.equal(summary(d).result,null);
 }
});
test('Community Pool adapter is connected but module gaps never become zero revenue',()=>{
 const d=ledger(cp);assert.deepEqual(validateLedger(d,cp),[]);assert.equal(summary(d,cp).result,null);
 d.coverage_gaps=[];assert.throws(()=>validateLedger(d,cp));
});
test('event identity validation applies to Operations proxy and Community Pool',()=>{
 for(const dao of [ops,cp]){
  const d={scope:dao.accountingSource.scope,treasuries:dao.accountingSource.treasuries,events:[]};assert.equal(validateEventFeed(d,dao),true);
  assert.equal(validateEventFeed({...d,scope:'neta-main-dao'},dao),false);
  assert.equal(validateEventFeed({...d,events:[{id:'foreign',chain_id:'juno-1',treasury_address:'wrong'}]},dao),false);
 }
});
