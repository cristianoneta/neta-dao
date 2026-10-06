import { categories, period, validateLedger, summarize, usdNumber } from './treasury-pnl.mjs?v=20261006-1';

const root = document.querySelector('#treasury-pnl');
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const dollars = value => value === null ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usdNumber(value));
const date = value => new Date(value).toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });
let state = window.NetaTreasuryAccounting || {}, selected = 'nns_registration';
const today = new Date();
const year = root.querySelector('#pnl-year'), month = root.querySelector('#pnl-month');
for (let y = today.getUTCFullYear(); y >= 2022; y--) { const o = el('option', String(y)); o.value = String(y); year.append(o); }
[['all', 'Full year'], ...Array.from({ length: 12 }, (_, i) => [String(i + 1), new Date(Date.UTC(2026, i, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' })])].forEach(([value, label]) => { const o = el('option', label); o.value = value; month.append(o); });
month.value = String(today.getUTCMonth() + 1);

function render() {
  let entries = [], error = state.error || '';
  if (state.data) { try { entries = validateLedger(state.data, state.dao); } catch (e) { error = e.message; } }
  const range = period(Number(year.value), month.value === 'all' ? 'all' : Number(month.value));
  const summary = summarize(entries, range);
  root.querySelector('#pnl-period').textContent = `${range.annual ? (range.toDate ? 'Year to date' : 'Full year') : (range.toDate ? 'Month to date' : 'Month')} · UTC · ${date(range.start)} – ${date(range.end)} (end exclusive). Comparison: ${date(range.previousStart)} – ${date(range.previousEnd)}.`;
  root.querySelector('#pnl-coverage').textContent = state.loading ? 'Loading accounting evidence…' : error || (state.data ? 'Partial coverage · NNS figures are matched-receipt subtotals. Full income, expenses and operating result are unavailable; missing history is not zero.' : 'Accounting history is not connected for this DAO. No income or expense total can be inferred from balances.');
  root.querySelector('#pnl-observed').textContent = dollars(summary.observedIncome);
  root.querySelector('#pnl-observed-note').textContent = summary.rows.length ? `${summary.rows.length} matched payment${summary.rows.length === 1 ? '' : 's'} · included in income, not added twice` : 'No matched receipts available in this period; this does not establish zero revenue.';
  const tbody = root.querySelector('#pnl-rows'); tbody.replaceChildren();
  for (const category of summary.categories) {
    const tr = el('tr'); const cell = el('th'); cell.scope = 'row';
    const button = el('button', category.label); button.type = 'button'; button.setAttribute('aria-pressed', String(selected === category.id));
    button.addEventListener('click', () => { selected = category.id; render(); }); cell.append(button);
    tr.append(cell, el('td', dollars(category.observed)), el('td', dollars(category.previousObserved)), el('td', 'Unavailable'));
    tbody.append(tr);
  }
  const detail = root.querySelector('#pnl-detail'); detail.replaceChildren();
  const category = summary.categories.find(c => c.id === selected);
  detail.append(el('h3', category.label), el('p', category.observed === null ? 'No classified receipts available. This category is not verified as zero.' : `${dollars(category.observed)} · observed subtotal`, 'pnl-detail-total'));
  for (const row of category.rows) {
    const item = el('article', undefined, 'pnl-receipt');
    item.append(el('strong', `${row.name} · ${row.years} year${row.years === 1 ? '' : 's'}`),
      el('p', `${row.amount} NETA · $${Number(row.usd_value).toFixed(6)} · ${date(row.timestamp)} UTC`),
      el('p', `Payment conversion: $${Number(row.valuation.usd_per_neta_12) / 1e12} / NETA. Price observed ${date(row.valuation.observed_at * 1000)} UTC. Historical amount stays fixed.`));
    const tx = el('a', `View transaction · block ${row.height} ↗`); tx.href = `https://atomscan.com/juno/transactions/${row.tx_hash}`; tx.target = '_blank'; tx.rel = 'noopener noreferrer'; item.append(tx);
    const evidence = el('small', row.evidence?.kind === 'archived-provider-receipt' ? 'Archived provider receipt · not a new live verification' : 'Matched provider receipt · not a light-client proof'); item.append(evidence); detail.append(item);
  }
  const source = root.querySelector('#pnl-source');
  source.textContent = state.data && !error ? `Last successful receipt refresh: ${state.data.last_success_at ? date(state.data.last_success_at) + ' UTC' : 'unavailable'}. Latest attempt: ${state.data.refresh_status}. Buyer-paid gas is not a DAO expense. Conversion uses the registry-accepted snapshot, not today’s market price.` : 'Payment-time prices and source evidence are required before a receipt can enter the statement.';
}
year.addEventListener('change', render); month.addEventListener('change', render);
window.addEventListener('neta:treasury-accounting', event => { state = event.detail; render(); });
render();
