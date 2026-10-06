import { accountsFor, period, validateLedger, summarize } from './treasury-pnl.mjs?v=20261006-2';
import { setupPeriods, dollars, date, el } from './treasury-report-ui.mjs?v=20261006-2';
const root = document.querySelector('#treasury-pnl');
let state = window.NetaTreasuryAccounting || {};
const expanded = new Set();
const year = root.querySelector('#pnl-year'), month = root.querySelector('#pnl-month');
setupPeriods(year, month, new URLSearchParams(location.search));
function render() {
  let entries = [], error = state.error || '';
  if (state.data) { try { entries = validateLedger(state.data, state.dao); } catch (e) { error = e.message; } }
  const range = period(Number(year.value), month.value === 'all' ? 'all' : Number(month.value));
  const summary = summarize(entries, range, accountsFor(state.dao));
  const future = range.start > Date.now();
  root.querySelector('#pnl-period').textContent = `${month.selectedOptions[0].textContent} ${year.value}${range.toDate ? ' · to date' : ''} · UTC`;
  root.querySelector('#pnl-coverage').textContent = state.loading ? 'Loading accounting evidence…' : error || (future ? 'Future period · no actuals yet' : state.data ? 'Partial coverage · totals incomplete' : 'Accounting history is not connected for this DAO.');
  const tbody = root.querySelector('#pnl-rows'); tbody.replaceChildren();
  function amount(value, detail) {
    const td = el('td');
    const node = el(detail ? 'a' : 'span', value === null ? '—' : dollars(value));
    if (value === null) node.setAttribute('aria-label', 'Unavailable');
    if (detail) { const q = new URLSearchParams({ year: year.value, month: month.value, type: detail.filter }); node.href = `${detail.detail}?${q}`; node.setAttribute('aria-label', `${detail.label}: ${value === null ? 'amount unavailable' : dollars(value)}. View transactions`); }
    td.append(node); if (value !== null) td.append(el('small', 'Partial', 'pnl-partial')); return td;
  }
  for (const [section, label] of [['income', 'Income'], ['expenses', 'Expenses']]) {
    const accounts = summary.categories.filter(a => a.section === section);
    const tr = el('tr', undefined, 'pnl-group');
    const th = el('th'); th.scope = 'row';
    const button = el('button'); button.type = 'button'; button.dataset.section = section;
    button.setAttribute('aria-expanded', String(expanded.has(section))); button.setAttribute('aria-controls', accounts.map(a => `pnl-account-${a.id}`).join(' '));
    button.append(el('span', expanded.has(section) ? '−' : '+', 'pnl-disclosure'), el('span', label));
    button.addEventListener('click', () => { expanded.has(section) ? expanded.delete(section) : expanded.add(section); render(); root.querySelector(`[data-section="${section}"]`).focus({ preventScroll: true }); });
    th.append(button);
    const subtotal = (key) => { const values = accounts.map(a => a[key]).filter(v => v !== null); return values.length ? values.reduce((a,b) => a+b, 0n) : null; };
    tr.append(th, amount(subtotal('observed')), amount(subtotal('previousObserved'))); tbody.append(tr);
    for (const account of accounts) {
      const row = el('tr', undefined, 'pnl-account'); row.id = `pnl-account-${account.id}`; row.hidden = !expanded.has(section);
      const title = el('th'); title.scope = 'row';
      if (account.detail) { const link = el('a', `${account.label} ↗`); link.href = `${account.detail}?${new URLSearchParams({ year: year.value, month: month.value, type: account.filter })}`; title.append(link); }
      else title.textContent = account.label;
      row.append(title, amount(account.observed, account.detail ? account : null), amount(account.previousObserved)); tbody.append(row);
    }
  }
  const result = el('tr', undefined, 'pnl-result'), title = el('th', 'Operating surplus / deficit'); title.scope = 'row'; result.append(title, amount(null), amount(null)); tbody.append(result);
  root.querySelector('#pnl-source').textContent = state.data && !error ? `Last successful receipt refresh: ${state.data.last_success_at ? date(state.data.last_success_at) + ' UTC' : 'unavailable'}. Latest attempt: ${state.data.refresh_status}. Conversion is fixed at the accepted payment rate. Buyer-paid gas is not a DAO expense. Selected interval: ${date(range.start)} – ${date(range.end)} (end exclusive). Comparison: ${date(range.previousStart)} – ${date(range.previousEnd)}.` : 'Classified receipts with payment-time prices are required. Treasury balances alone do not establish income or expenses.';
}
year.addEventListener('change', render); month.addEventListener('change', render);
window.addEventListener('neta:treasury-accounting', event => { const changed = state.dao?.id !== event.detail.dao?.id; state = event.detail; if (changed) expanded.clear(); render(); });
render();
