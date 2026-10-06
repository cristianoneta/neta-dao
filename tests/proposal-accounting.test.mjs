import test from 'node:test';
import assert from 'node:assert/strict';
import { actionKey, categoriesFor, categoryRecords, validateCategories, isSpend } from '../proposal-accounting.mjs';
const action = { bank: { send: { to_address: 'recipient', amount: [{denom:'ujuno',amount:'1000000'}] } } };
test('each payment requires its own category; internal transfers remain outside expenses', () => {
  assert.throws(() => validateCategories([action], []), /ACTION 1/);
  const records = categoryRecords([action,action], ['grants','not_expense']);
  validateCategories([action,action], records);
  assert.deepEqual(categoriesFor([action,action], records), ['grants','not_expense']);
  assert.throws(() => validateCategories([action,action], records.slice(0,1)), /ACTION 2/);
});
test('bindings survive JSON formatting; amount, recipient, position and category tampering fail closed', () => {
  const records = categoryRecords([action], ['development']);
  assert.equal(actionKey(JSON.parse(JSON.stringify(action,null,2))), actionKey(action));
  for (const updated of [{bank:{send:{...action.bank.send,to_address:'other'}}},{bank:{send:{...action.bank.send,amount:[]}}}]) {
    assert.deepEqual(categoriesFor([updated],records), ['']);
    assert.throws(() => validateCategories([updated],records));
  }
  assert.throws(() => validateCategories([{},action], records));
  assert.throws(() => validateCategories([action],[{...records[0],category:'made_up'}]));
  assert.throws(() => validateCategories([action],[...records,...records]));
});
test('CW20 transfers and native execution funds require categories without modifying actions', () => {
  const cw20 = {wasm:{execute:{contract_addr:'token',msg:btoa(JSON.stringify({transfer:{recipient:'recipient',amount:'10'}})),funds:[]}}};
  assert.equal(isSpend(cw20),true);
  assert.equal(isSpend({type:'wasm_execute',msg:{send:{contract:'pool',amount:'1'}}}),true);
  assert.equal(isSpend({wasm:{execute:{msg:{},funds:[{amount:'1',denom:'ujuno'}]}}}),true);
  assert.equal(isSpend({wasm:{execute:{msg:'invalid'}}}),true);
  assert.equal(isSpend({wasm:{execute:{msg:btoa('{}'),funds:[]}}}),false);
  const original=JSON.stringify(cw20);
  validateCategories([cw20],categoryRecords([cw20],['marketing']));
  assert.equal(JSON.stringify(cw20),original);
});
