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
