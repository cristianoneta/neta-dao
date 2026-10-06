import { validateCommunityLedger, reviewedCommunityPeriod } from './treasury-community-accounting.mjs?v=20261006-9';
import { validateStakingLedger, reviewedStakingPeriod } from './treasury-staking-accounting.mjs?v=20261006-9';
import { validateGenericLedger, reviewedGenericPeriod } from './treasury-generic-accounting.mjs?v=20261006-9';
// Cash-basis reporting over explicitly classified receipts. No balance-derived income.
import { accountsFor } from './treasury-accounting-config.mjs?v=20261006-9';
export { accountsFor };
export const categories = accountsFor({ id: 'neta' }).map(a => [a.id, a.label]);
const known = new Set(categories.map(([id]) => id));
export const accountingStart = Date.parse('2026-10-01T00:00:00Z');
const scale = 10n ** 18n;
export function usdUnits(value) {
  if (typeof value !== 'string' || !/^\d+(\.\d{1,18})?$/.test(value)) throw Error('Invalid fixed USD value');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * scale + BigInt(fraction.padEnd(18, '0'));
}
export function usdNumber(units) { return Number(units) / Number(scale); }
export function period(year, month, now = new Date()) {
  if (!Number.isInteger(year) || year < 2000 || year > 9998 || !(month === 'all' || Number.isInteger(month) && month >= 1 && month <= 12)) throw Error('Invalid period');
  const annual = month === 'all';
  const start = Date.UTC(year, annual ? 0 : month - 1, 1);
  const naturalEnd = Date.UTC(annual ? year + 1 : year, annual ? 0 : month, 1);
  const end = Math.max(start, Math.min(now.getTime(), naturalEnd));
  const previousStart = Date.UTC(annual ? year - 1 : year, annual ? 0 : month - 2, 1);
  const previousEnd = end < naturalEnd ? Math.min(start, previousStart + end - start) : start;
  return { start, end, previousStart, previousEnd, toDate: now.getTime() >= start && now.getTime() < naturalEnd, annual };
}
export function validateLedger(data, dao) {
  if (data?.schema_version === 4) return validateStakingLedger(data, dao);
  if (data?.schema_version === 3) return validateCommunityLedger(data, dao);
  if (data?.schema_version === 2) return validateGenericLedger(data, dao);
  if (!data || data.schema_version !== 1 || data.scope !== 'neta-main-dao' || dao.id !== 'neta'
      || data.chain_id !== dao.network || data.treasury_address !== dao.core
      || data.token !== dao.tokenContract || data.registry !== 'juno1pc8wrq89ljuhu2qt6rtk5lkkrptxajtf3un5llu8prg7r4z50vlszfhhza'
      || !Array.isArray(data.entries)) throw Error('Accounting source identity unavailable');
  const entries = new Map();
  for (const row of data.entries) {
    if (row.chain_id !== data.chain_id || row.treasury_address !== data.treasury_address || row.registry !== data.registry || row.token !== data.token
        || !/^nns_(registration|renewal)$/.test(row.category) || !known.has(row.category)
        || !/^[A-F0-9]{64}$/.test(row.tx_hash) || !Number.isInteger(row.message_index) || row.message_index < 0
        || row.id !== `${row.chain_id}:${row.tx_hash}:${row.message_index}`
        || !Number.isFinite(Date.parse(row.timestamp)) || !/(Z|[+-]\d{2}:\d{2})$/.test(row.timestamp)
        || !/^[1-9]\d*$/.test(row.raw_amount) || !/^[1-9]\d*$/.test(row.valuation?.usd_per_neta_12 || '')
        || row.valuation.method !== 'executed-snapshot-rate'
        || usdUnits(row.usd_value) !== BigInt(row.raw_amount) * BigInt(row.valuation.usd_per_neta_12)) throw Error('Accounting receipt validation failed');
    if (entries.has(row.id)) throw Error('Duplicate accounting receipt');
    entries.set(row.id, row);
  }
  return [...entries.values()];
}
// Zero means no recorded activity in a successfully refreshed and reviewed snapshot.
// It is a provisional result, never a completeness or balance-reconciliation claim.
export function reviewedPeriod(entries, data, start, end, now = Date.now()) {
  if (data?.schema_version === 4) return reviewedStakingPeriod(entries,data,start,end,now);
  if (data?.schema_version === 3) return reviewedCommunityPeriod(entries,data,start,end,now);
  if (data?.schema_version === 2) return reviewedGenericPeriod(entries, data, start, end, now);
  const review = data?.movement_review, refreshed = Date.parse(data?.last_success_at);
  if (data?.refresh_status !== 'completed' || review?.status !== 'PARTIAL'
      || review.event_refresh_status !== 'PARTIAL' || review.accounting_start !== '2026-10-01T00:00:00Z'
      || !Array.isArray(review.movements) || !Array.isArray(review.unmatched_receipt_ids)
      || !Number.isFinite(refreshed) || refreshed > now + 60000
      || start >= end || end <= accountingStart || start >= refreshed
      || (end > refreshed && now - refreshed > 2 * 60 * 60 * 1000)) return false;
  const inside = value => Date.parse(value) >= Math.max(accountingStart, start) && Date.parse(value) < end;
  const receipts = new Map(entries.map(row => [row.id, row])), matched = new Set(), ids = new Set();
  let unresolved = 0, blocked = false;
  for (const movement of review.movements) {
    if (!movement || typeof movement.id !== 'string' || ids.has(movement.id)
        || !Number.isFinite(Date.parse(movement.timestamp)) || !['in','out'].includes(movement.direction)
        || !/^[0-9]+$/.test(movement.raw_amount)) return false;
    ids.add(movement.id);
    if (movement.classification === 'unreviewed' && movement.receipt_id === null && movement.usd_value === null) {
      unresolved++; if (inside(movement.timestamp)) blocked = true; continue;
    }
    const receipt = receipts.get(movement.receipt_id);
    if (!receipt || matched.has(receipt.id) || movement.classification !== receipt.category
        || movement.tx_hash !== receipt.tx_hash || movement.timestamp !== receipt.timestamp
        || movement.direction !== 'in' || movement.denom !== `cw20:${data.token}`
        || movement.counterparty !== data.registry || movement.raw_amount !== receipt.raw_amount
        || movement.usd_value !== receipt.usd_value) return false;
    matched.add(receipt.id);
  }
  const unmatched = entries.filter(row => !matched.has(row.id)).map(row => row.id);
  if (review.matched_receipts !== matched.size || review.unreviewed_movements !== unresolved
      || unmatched.length !== review.unmatched_receipt_ids.length
      || new Set(review.unmatched_receipt_ids).size !== unmatched.length
      || unmatched.some(id => !review.unmatched_receipt_ids.includes(id))) return false;
  return !blocked && entries.filter(row => inside(row.timestamp)).every(row => matched.has(row.id));
}
export function summarize(entries, range, accounts = accountsFor({ id: 'neta' }), data = null, now = Date.now()) {
  const selected = entries.filter(row => Date.parse(row.timestamp) >= Math.max(accountingStart, range.start) && Date.parse(row.timestamp) < range.end);
  const previous = entries.filter(row => Date.parse(row.timestamp) >= Math.max(accountingStart, range.previousStart) && Date.parse(row.timestamp) < range.previousEnd);
  const currentReady = reviewedPeriod(entries, data, range.start, range.end, now);
  const previousReady = reviewedPeriod(entries, data, range.previousStart, range.previousEnd, now);
  const subtotal = (rows, ready = false) => { const priced=rows.filter(row=>row.usd_value!==null); return priced.length ? priced.reduce((sum,row)=>sum+usdUnits(row.usd_value),0n) : ready && !rows.length ? 0n : null; };
  const section = (rows, kind, ready) => subtotal(rows.filter(row => accounts.some(a => a.id === row.category && a.section === kind)), ready);
  const income = currentReady ? section(selected, 'income', true) : null;
  const expenses = currentReady ? section(selected, 'expenses', true) : null;
  const previousIncome = previousReady ? section(previous, 'income', true) : null;
  const previousExpenses = previousReady ? section(previous, 'expenses', true) : null;
  return { rows: selected, observedIncome: section(selected, 'income', currentReady),
    provisional: currentReady, previousProvisional: previousReady,
    income, expenses, result: currentReady ? income - expenses : null,
    previousIncome, previousExpenses, previousResult: previousReady ? previousIncome - previousExpenses : null,
    categories: accounts.map(account => ({ ...account,
      rows: selected.filter(row => row.category === account.id),
      observed: subtotal(selected.filter(row => row.category === account.id), currentReady),
      previousObserved: subtotal(previous.filter(row => row.category === account.id), previousReady), change: null })) };
}
