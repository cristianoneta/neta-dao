import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateLedger,summarize,period,accountsFor} from '../treasury-pnl.mjs';
import {eventTags} from '../treasury-event-tags.mjs';
const dao=JSON.parse(readFileSync(new URL('../data/dao-directory.json',import.meta.url))).daos.find(d=>d.id==='juno');
const q={method:'historical-daily-opening-reference',day:'2026-10-01',timestamp_ms:Date.parse('2026-10-01T00:00:00Z'),denom:'ujuno',coin_id:'juno-network',decimals:6,usd_price:'0.01'};
function entry(){return {id:'juno-1:distribution:20-21:0',receipt_id:'juno-1:distribution:20-21:0',chain_id:'juno-1',treasury_address:dao.accountingSource.treasuries[0].address,counterparty:'juno17xpfvakm2amg962yls6f84z3kell8c5lxtqmvp',tx_hash:null,category:'community_tax',classification:'community_tax',direction:'in',height:21,timestamp:'2026-10-01T00:00:04Z',message_index:0,denom:'ujuno',decimals:6,raw_amount:'2000000.000000000000000001',usd_value:'0.020000000000000000',valuation:structuredClone(q),evidence:{kind:'block-distribution',start:{height:20,timestamp:'2026-10-01T00:00:01Z',hash:'A'.repeat(64)},end:{height:21,timestamp:'2026-10-01T00:00:04Z',hash:'B'.repeat(64)},blocks:2,results_sha256:'a'.repeat(64),method:'fee-collector-transfers-minus-validator-rewards'}};}
function ledger(){return {schema_version:3,dao_id:'juno',chain_id:'juno-1',...dao.accountingSource,accounting_start:'2026-10-01T00:00:00Z',coverage_gaps:['Other module income remains incomplete'],entries:[entry()]};}
test('exact block tax appears in partial income, with no fabricated total expense/result',()=>{
 const d=ledger(),entries=validateLedger(d,dao),s=summarize(entries,period(2026,10,new Date('2026-10-06T14:00:00Z')),accountsFor(dao),d);
 assert.equal(s.observedIncome,20000000000000000n);assert.equal(s.result,null);assert.equal(s.expenses,null);
 const r=entries[0],event={id:'juno-1:distribution:20-21',chain_id:r.chain_id,treasury_address:r.treasury_address,tx_hash:null,timestamp:r.timestamp,evidence:r.evidence,movements:[r]};
 assert.deepEqual(eventTags(event,d,dao),['Income · Community Tax']);
 event.movements=[{...r,id:'foreign'}];assert.deepEqual(eventTags(event,d,dao),['Unclassified']);
});
test('tampered block ranges, duplicate entries, foreign pool and incorrect historical conversion fail closed',()=>{
 for(const mutate of [d=>d.entries.push(entry()),d=>d.entries[0].evidence.blocks=1,d=>d.entries[0].evidence.start.timestamp='2026-09-30T23:59:59Z',d=>d.entries[0].usd_value='0.03',d=>d.entries[0].valuation.denom='uatom',d=>d.entries[0].valuation.timestamp_ms+=3600000,d=>d.entries[0].treasury_address='wrong',d=>d.entries[0].tx_hash='A'.repeat(64)]){
 const d=ledger();mutate(d);assert.throws(()=>validateLedger(d,dao));
 }
});
test('unpriced allocation stays visible and does not become zero USD',()=>{
 const d=ledger();d.entries[0].valuation=null;d.entries[0].usd_value=null;
 const s=summarize(validateLedger(d,dao),period(2026,10,new Date('2026-10-06T14:00:00Z')),accountsFor(dao),d);
 assert.equal(s.rows.length,1);assert.equal(s.observedIncome,null);assert.equal(s.result,null);
});
test('overlapping ranges or duplicate denominations cannot inflate Community Tax',()=>{
 for(const overlap of [true,false]){
  const d=ledger(),r=entry();
  if(overlap){r.evidence.start.height=21;r.evidence.end.height=22;r.height=22;r.evidence.end.timestamp='2026-10-01T00:00:07Z';r.timestamp=r.evidence.end.timestamp;r.id='juno-1:distribution:21-22:0';}
  else {r.message_index=1;r.id='juno-1:distribution:20-21:1';}
  r.receipt_id=r.id;d.entries.push(r);assert.throws(()=>validateLedger(d,dao));
 }
 const d=ledger();d.block_coverage={from_height:20,through_height:25,blocks:2,ranges:1,through_time:d.entries[0].timestamp};
 assert.throws(()=>validateLedger(d,dao));
});
