import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateLedger,summarize,period,accountsFor} from '../treasury-pnl.mjs';
import {summarizeOrganization} from '../treasury-consolidation.mjs';
const dao=JSON.parse(readFileSync(new URL('../data/dao-directory.json',import.meta.url))).daos.find(d=>d.id==='juno-delegation');
const now=Date.parse('2026-10-06T15:30:00Z'), range=period(2026,10,new Date(now));
function ledger(){
 const stamp='2026-10-06T15:20:00Z',a={height:100,hash:'A'.repeat(64),timestamp:'2026-10-06T13:00:00Z',rewards:{ujuno:'1000000000'},method:'withdrawable-rewards-truncated-per-validator'},b={height:200,hash:'B'.repeat(64),timestamp:stamp,rewards:{ujuno:'1100000000'},method:a.method};
 const id='juno-1:staking:100-200:0';
 const entry={id,receipt_id:id,chain_id:'juno-1',treasury_address:dao.core,tx_hash:null,height:200,timestamp:stamp,message_index:0,denom:'ujuno',raw_amount:'100000000',amount:'100',decimals:6,direction:'in',counterparty:'juno1jv65s3grqf6v6jl3dp4t6c9t9rk99cd83d88wr',classification:'staking_rewards',category:'staking_rewards',usd_value:'1',valuation:{method:'historical-daily-opening-reference',day:'2026-10-06',timestamp_ms:Date.parse('2026-10-06T00:00:00Z'),usd_price:'0.01',denom:'ujuno',decimals:6,coin_id:'juno-network'},evidence:{kind:'staking-accrual',method:'closing-withdrawable-minus-opening-plus-claims',start:a,end:b,claims:[]}};
 return {schema_version:4,dao_id:dao.id,chain_id:dao.network,...dao.accountingSource,accounting_start:'2026-10-01T00:00:00Z',entries:[entry],reward_settlements:[],coverage_gaps:['Earlier October rewards unavailable'],last_success_at:stamp,refresh_status:'completed',sources:dao.accountingSource.treasuries.map(t=>({...t,adapter:'cosmos-rest-receipts',accounting_start:'2026-10-01T00:00:00Z',last_scanned_height:200,anchor_hash:'A'.repeat(64)})),movement_review:{status:'PARTIAL',event_refresh_status:'PARTIAL',accounting_start:'2026-10-01T00:00:00Z',movements:[],matched_receipts:0,unreviewed_movements:0,unmatched_receipt_ids:[]},accrual_coverage:{status:'CURRENT',from_time:a.timestamp,through_time:stamp,through_height:200,intervals:1}};
}
test('daily increase is revenue, opening stock excluded; empty accounts and consolidation have provisional zeros',()=>{
 const d=ledger(),entries=validateLedger(d,dao),s=summarize(entries,range,accountsFor(dao),d,now);
 assert.equal(s.income,10n**18n);assert.equal(s.expenses,0n);assert.equal(s.result,10n**18n);assert.equal(s.categories.find(a=>a.id==='other_income').observed,0n);
 const group=summarizeOrganization([{dao,data:d}],range,now);assert.equal(group.result,10n**18n);assert.equal(group.expenses,0n);
});
test('claim cancels reward-balance decrease without creating second income',()=>{
 const d=ledger(),r=d.entries[0];r.evidence.end.rewards.ujuno='50000000';r.evidence.claims=[{id:'claim:0',height:150,tx_hash:'C'.repeat(64),amounts:{ujuno:'1050000000'}}];
 assert.equal(summarize(validateLedger(d,dao),range,accountsFor(dao),d,now).income,10n**18n);
 r.evidence.claims.push(r.evidence.claims[0]);assert.throws(()=>validateLedger(d,dao));
});
test('missing prices, failed receipt scan, stale samples and unknown payment block totals',()=>{
 for(const mutate of [d=>{d.entries[0].usd_value=null;d.entries[0].valuation=null;},d=>d.refresh_status='unavailable',d=>d.accrual_coverage.status='STALE',d=>{d.movement_review.movements=[{id:'unknown',timestamp:'2026-10-06T14:00:00Z',direction:'out',raw_amount:'1',chain_id:dao.network,treasury_address:dao.core,classification:'unreviewed',usd_value:null,receipt_id:null}];d.movement_review.unreviewed_movements=1;}]){
 const d=ledger();mutate(d);const s=summarize(validateLedger(d,dao),range,accountsFor(dao),d,now);assert.equal(s.result,null);
 assert.equal(summarizeOrganization([{dao,data:d}],range,now).result,null);
 }
});
test('foreign identity, wrong arithmetic, duplicate intervals and changed prices fail validation',()=>{
 for(const mutate of [d=>d.entries[0].raw_amount='1100000000',d=>d.entries.push(structuredClone(d.entries[0])),d=>d.entries[0].usd_value='2',d=>d.entries[0].treasury_address='foreign']){const d=ledger();mutate(d);assert.throws(()=>validateLedger(d,dao));}
});
