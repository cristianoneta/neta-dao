import { usdNumber } from './treasury-pnl.mjs?v=20261006-2';
export const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
export const dollars = value => value === null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usdNumber(value));
export const date = value => new Date(value).toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });
export function setupPeriods(year, month, params = new URLSearchParams(), now = new Date()) {
  const last = Math.max(2028, now.getUTCFullYear());
  for (let y = 2026; y <= last; y++) { const o = el('option', String(y)); o.value = String(y); year.append(o); }
  [['all', 'Full year'], ...Array.from({ length: 12 }, (_, i) => [String(i + 1), new Date(Date.UTC(2026, i, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' })])].forEach(([value, label]) => { const o = el('option', label); o.value = value; month.append(o); });
  const y = params.get('year') || params.get('pnl_year'), m = params.get('month') || params.get('pnl_month');
  year.value = /^\d{4}$/.test(y || '') && Number(y) >= 2026 && Number(y) <= last ? y : String(Math.max(2026, now.getUTCFullYear()));
  month.value = /^(all|[1-9]|1[0-2])$/.test(m || '') ? m : String(now.getUTCMonth() + 1);
}
