import { expenseAccounts } from './treasury-accounting-config.mjs?v=20261006-7';

export const accountingType = 'dao_accounting_v1';
export const accountingOptions = [...expenseAccounts, { id: 'not_expense', label: 'Treasury transfer / not an expense' }];
const allowed = new Set(accountingOptions.map(a => a.id));
// A canonical action binding survives formatting changes, but not changed payment details.
export function actionKey(value) {
  if (Array.isArray(value)) return '[' + value.map(actionKey).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + actionKey(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function isSpend(action) {
  if (action?.bank?.send || action?.type === 'bank_send' || /Msg(Send|MultiSend|CommunityPoolSpend)$/.test(action?.['@type'] || action?.typeUrl || '')) return true;
  const execute = action?.wasm?.execute || (action?.type === 'wasm_execute' ? action : null);
  if (!execute) return false;
  if (Array.isArray(execute.funds) && execute.funds.length) return true;
  let msg = execute.msg;
  if (typeof msg === 'string') { try { msg = JSON.parse(atob(msg)); } catch { return true; } }
  return !!(msg?.transfer || msg?.send || msg?.burn);
}
export function categoriesFor(actions, records = []) {
  return actions.map((action, index) => {
    const matches = records.filter(r => r && r.action_index === index && r.action_key === actionKey(action) && allowed.has(r.category));
    return matches.length === 1 ? matches[0].category : '';
  });
}
export function categoryRecords(actions, categories) {
  return actions.flatMap((action, index) => allowed.has(categories[index]) ? [{ action_index: index, action_key: actionKey(action), category: categories[index] }] : []);
}
export function validateCategories(actions, records) {
  const categories = categoriesFor(actions, records);
  if (records.length !== categories.filter(Boolean).length) throw Error('SPENDING CATEGORIES NO LONGER MATCH THE ACTIONS; SELECT THEM AGAIN');
  actions.forEach((action, index) => { if (isSpend(action) && !categories[index]) throw Error(`SELECT A SPENDING CATEGORY FOR ACTION ${index + 1}`); });
}
