// Cash-basis reporting over explicitly classified receipts. No balance-derived income.
import { accountsFor } from './treasury-accounting-config.mjs?v=20261006-2';
export { accountsFor };
export const categories = accountsFor({ id: 'neta' }).map(a => [a.id, a.label]);
const known = new Set(categories.map(([id]) => id));
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
export function summarize(entries, range, accounts = accountsFor({ id: 'neta' })) {
  const selected = entries.filter(row => Date.parse(row.timestamp) >= range.start && Date.parse(row.timestamp) < range.end);
  const previous = entries.filter(row => Date.parse(row.timestamp) >= range.previousStart && Date.parse(row.timestamp) < range.previousEnd);
  const subtotal = rows => rows.length ? rows.reduce((sum, row) => sum + usdUnits(row.usd_value), 0n) : null;
  return { rows: selected, observedIncome: subtotal(selected.filter(row => accounts.some(a => a.id === row.category && a.section === 'income'))),
    // Receipt coverage does not establish a complete period, even when the scan succeeds.
    income: null, expenses: null, result: null,
    categories: accounts.map(account => ({ ...account,
      rows: selected.filter(row => row.category === account.id),
      observed: subtotal(selected.filter(row => row.category === account.id)),
      previousObserved: subtotal(previous.filter(row => row.category === account.id)), change: null })) };
}
