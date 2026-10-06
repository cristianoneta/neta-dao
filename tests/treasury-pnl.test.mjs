import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { period, validateLedger, summarize, usdUnits, accountsFor } from '../treasury-pnl.mjs';
const manifest = JSON.parse(readFileSync(new URL('../docs/deployments/nns-mainnet.json', import.meta.url)));
const dao = { id: 'neta', network: manifest.chain_id, core: manifest.treasury, tokenContract: manifest.token };
const row = { id: `juno-1:${'A'.repeat(64)}:0`, chain_id: 'juno-1', tx_hash: 'A'.repeat(64), message_index: 0,
  treasury_address: manifest.treasury, registry: manifest.registry, token: manifest.token,
  timestamp: '2026-10-05T18:20:13Z', category: 'nns_registration', raw_amount: '4755098',
  usd_value: '5.000000976594010594', valuation: { method: 'executed-snapshot-rate', usd_per_neta_12: '1051503244853' } };
const ledger = { schema_version: 1, scope: 'neta-main-dao', chain_id: 'juno-1', treasury_address: manifest.treasury,
  registry: manifest.registry, token: manifest.token, entries: [row] };
test('source identity, duplicate receipts, price arithmetic and categories fail closed', () => {
  assert.equal(validateLedger(ledger, dao).length, 1);
  for (const changed of [ { ...ledger, treasury_address: 'wrong' }, { ...ledger, entries: [row, row] },
    { ...ledger, entries: [{ ...row, usd_value: '8' }] }, { ...ledger, entries: [{ ...row, category: 'funding' }] } ]) {
    assert.throws(() => validateLedger(changed, dao));
  }
});
test('known NNS receipt is counted once; missing expenses and total are never zero', () => {
  const s = summarize([row], period(2026, 10, new Date('2026-10-06T09:00:00Z')));
  assert.equal(s.observedIncome, usdUnits(row.usd_value));
  assert.equal(s.expenses, null); assert.equal(s.income, null); assert.equal(s.result, null);
  assert.equal(s.categories.find(c => c.id === 'nns_renewal').observed, null);
  assert.equal(s.categories[0].change, null);
});
test('UTC half-open periods, future/empty periods and equal elapsed comparison', () => {
  const r = period(2026, 10, new Date('2026-10-06T09:00:00Z'));
  assert.equal(r.end - r.start, r.previousEnd - r.previousStart);
  assert.equal(summarize([{ ...row, timestamp: '2026-11-01T00:00:00Z' }], r).observedIncome, null);
  assert.equal(summarize([row], period(2026, 11, new Date('2026-10-06T09:00:00Z'))).observedIncome, null);
  const jan = period(2026, 1, new Date('2026-10-06T09:00:00Z'));
  assert.equal(new Date(jan.previousStart).toISOString(), '2025-12-01T00:00:00.000Z');
  const leap = period(2024, 2, new Date('2026-10-06T09:00:00Z'));
  assert.equal((leap.end - leap.start) / 86400000, 29);
  assert.equal(summarize([row], period(2026, 'all', new Date('2026-10-06T09:00:00Z'))).rows.length, 1);
});

test('shared statement config isolates DAO income sources and supports other account mappings', () => {
  assert.equal(accountsFor({id:'neta'}).filter(a=>a.id.startsWith('nns_')).length,2);
  assert.equal(accountsFor({id:'juno'}).some(a=>a.id.startsWith('nns_')),false);
  const accounts = accountsFor({id:'example'}, { example:{accounts:[{id:'service_fees',label:'Service fees',section:'income'}]} });
  const s = summarize([{...row,category:'service_fees'}],period(2026,10,new Date('2026-10-06')),accounts);
  assert.equal(s.categories.find(a=>a.id==='service_fees').observed,usdUnits(row.usd_value));
  assert.equal(s.observedIncome,usdUnits(row.usd_value));
  assert.equal(s.categories.some(a=>a.id.startsWith('nns_')),false);
  const expense = summarize([{...row,category:'grants'}],period(2026,10,new Date('2026-10-06')),accounts);
  assert.equal(expense.observedIncome,null);
  assert.throws(()=>validateLedger(ledger,{...dao,id:'juno'}));
});


test('all DAO summaries exclude activity before the October accounting start', () => {
  const old = {...row, timestamp:'2026-09-30T23:59:59Z'};
  const first = {...row, timestamp:'2026-10-01T00:00:00Z'};
  const annual = summarize([old, first], period(2026, 'all', new Date('2026-11-01')));
  assert.equal(annual.rows.length, 1);
  assert.equal(annual.rows[0].timestamp, first.timestamp);
  assert.equal(summarize([old], period(2026, 10, new Date('2026-11-01'))).categories[0].previousObserved, null);
});

const now = Date.parse('2026-10-06T14:00:00Z');
function reviewed() {
  return { ...structuredClone(ledger),refresh_status:'completed',last_success_at:'2026-10-06T13:30:00Z',
    movement_review:{status:'PARTIAL',event_refresh_status:'PARTIAL',accounting_start:'2026-10-01T00:00:00Z',matched_receipts:1,unmatched_receipt_ids:[],unreviewed_movements:0,
      movements:[{id:row.id,tx_hash:row.tx_hash,timestamp:row.timestamp,denom:`cw20:${row.token}`,direction:'in',raw_amount:row.raw_amount,counterparty:row.registry,classification:row.category,usd_value:row.usd_value,receipt_id:row.id}]}};
}
const current = period(2026,10,new Date(now));
test('reviewed receipts give provisional zeros and a result while pre-cutoff comparisons stay unavailable', () => {
  const s=summarize([row],current,accountsFor(dao),reviewed(),now);
  assert.equal(s.provisional,true); assert.equal(s.income,usdUnits(row.usd_value));
  assert.equal(s.expenses,0n); assert.equal(s.result,s.income);
  assert.equal(s.categories.find(a=>a.id==='nns_renewal').observed,0n);
  assert.equal(s.previousResult,null);
  const empty=reviewed();empty.entries=[];empty.movement_review.movements=[];empty.movement_review.matched_receipts=0;
  assert.equal(summarize([],current,accountsFor(dao),empty,now).result,0n);
  assert.equal(summarize([],period(2026,11,new Date(now)),accountsFor(dao),empty,now).result,null);
});
test('failed, stale, missing and tampered reviews cannot produce zeros or totals', () => {
  for(const modify of [d=>d.refresh_status='unavailable',d=>d.last_success_at='2026-10-06T10:00:00Z',d=>d.last_success_at='2026-10-07T00:00:00Z',d=>d.movement_review.event_refresh_status='UNAVAILABLE',d=>d.movement_review.matched_receipts=0,d=>d.movement_review.movements[0].raw_amount='1',d=>d.movement_review.movements.push(d.movement_review.movements[0]),d=>d.movement_review.unmatched_receipt_ids=[row.id]]) {
    const data=reviewed();modify(data);assert.equal(summarize([row],current,accountsFor(dao),data,now).result,null);
  }
  const data=reviewed();data.movement_review.movements.push({id:'unresolved',tx_hash:'B'.repeat(64),timestamp:'2026-10-06T10:00:00Z',direction:'out',raw_amount:'1',classification:'unreviewed',receipt_id:null,usd_value:null});data.movement_review.unreviewed_movements++;
  assert.equal(summarize([row],current,accountsFor(dao),data,now).result,null);
});

const {eventTags} = await import('../treasury-event-tags.mjs');
const event={chain_id:row.chain_id,treasury_address:row.treasury_address,tx_hash:row.tx_hash,timestamp:row.timestamp,movements:[{message_index:0,direction:'in',denom:`cw20:${row.token}`,counterparty:row.registry,raw_amount:row.raw_amount}]};
test('event tags use exact receipts and expose unmatched legs instead of inferring income from direction', () => {
  assert.deepEqual(eventTags(event,ledger,dao),['Income · NNS registrations']);
  assert.deepEqual(eventTags(event,ledger,{...dao,id:'juno'}),['Unclassified']);
  assert.deepEqual(eventTags({...event,movements:[{...event.movements[0],raw_amount:'1'}]},ledger,dao),['Unclassified']);
  assert.deepEqual(eventTags({...event,movements:[...event.movements,{direction:'out'}]},ledger,dao),['Income · NNS registrations','Unclassified']);
  assert.deepEqual(eventTags(event,null,dao),['Unclassified']);
});
