import { accountingStart, accountsFor, period, validateLedger, summarize } from './treasury-pnl.mjs?v=20261006-5';
import { setupPeriods, dollars, date, el } from './treasury-report-ui.mjs?v=20261006-5';
const root = document.querySelector('#treasury-pnl');
let state = window.NetaTreasuryAccounting || {};
const expanded = new Set();
const year = root.querySelector('#pnl-year'), month = root.querySelector('#pnl-month');
setupPeriods(year, month, new URLSearchParams(location.search));
function render() {
  let entries = [], error = state.error || '';
  if (state.data) { try { entries = validateLedger(state.data, state.dao); } catch (e) { error = e.message; } }
  const range = period(Number(year.value), month.value === 'all' ? 'all' : Number(month.value));
  const summary = summarize(entries, range, accountsFor(state.dao), error || state.loading ? null : state.data);
  const future = range.start > Date.now();
  root.querySelector('#pnl-period').textContent = `${month.selectedOptions[0].textContent} ${year.value}${range.toDate ? ' · to date' : ''} · UTC`;
  root.querySelector('#pnl-coverage').textContent = state.loading ? 'Loading accounting evidence…' : error || (future ? 'Future period · no actuals yet' : state.data ? summary.provisional ? 'Provisional · recorded transactions' : state.data.refresh_status !== 'completed' ? 'Accounting refresh unavailable · retained evidence' : state.data.coverage_gaps?.length ? 'Connected · module coverage incomplete' : 'Partial coverage · totals incomplete' : 'Accounting history is not connected for this DAO.');
  const tbody = root.querySelector('#pnl-rows'); tbody.replaceChildren();
  function amount(value, detail, provisional = false) {
    const td = el('td');
    const node = el(detail ? 'a' : 'span', value === null ? '—' : dollars(value));
    if (value === null) node.setAttribute('aria-label', 'Unavailable');
    if (detail) { const q = new URLSearchParams({ year: year.value, month: month.value, type: detail.filter }); node.href = `${detail.detail}?${q}`; node.setAttribute('aria-label', `${detail.label}: ${value === null ? 'amount unavailable' : dollars(value)}. View transactions`); }
    td.append(node); if (value !== null) td.append(el('small', provisional ? 'Provisional' : 'Partial', 'pnl-partial')); return td;
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
    tr.append(th, amount(summary.provisional ? summary[section] : subtotal('observed'), null, summary.provisional), amount(summary.previousProvisional ? summary[section === 'income' ? 'previousIncome' : 'previousExpenses'] : subtotal('previousObserved'), null, summary.previousProvisional)); tbody.append(tr);
    for (const account of accounts) {
      const row = el('tr', undefined, 'pnl-account'); row.id = `pnl-account-${account.id}`; row.hidden = !expanded.has(section);
      const title = el('th'); title.scope = 'row';
      if (account.detail) { const link = el('a', `${account.label} ↗`); link.href = `${account.detail}?${new URLSearchParams({ year: year.value, month: month.value, type: account.filter })}`; title.append(link); }
      else title.textContent = account.label;
      row.append(title, amount(account.observed, account.detail ? account : null, summary.provisional), amount(account.previousObserved, null, summary.previousProvisional)); tbody.append(row);
    }
  }
  const result = el('tr', undefined, 'pnl-result'), title = el('th', 'Operating surplus / deficit'); title.scope = 'row'; result.append(title, amount(summary.result, null, summary.provisional), amount(summary.previousResult, null, summary.previousProvisional)); tbody.append(result);
  root.querySelector('#pnl-source').textContent = state.data && !error ? `Last successful receipt refresh: ${state.data.last_success_at ? date(state.data.last_success_at) + ' UTC' : 'unavailable'}. Latest attempt: ${state.data.refresh_status}. ${state.data.schema_version === 1 ? "Conversion is fixed at the accepted payment rate. Buyer-paid gas is not a DAO expense." : "Funding is separate from operating income. Unknown payment purpose or missing historical prices prevents booking."} Selected interval: ${date(Math.max(accountingStart, range.start))} – ${date(range.end)} (end exclusive). Comparison: ${date(range.previousStart)} – ${date(range.previousEnd)}.` : 'Classified receipts with payment-time prices are required. Treasury balances alone do not establish income or expenses.';
  root.querySelector('#pnl-source').textContent += ' Accounting starts 1 October 2026 UTC for every DAO. Earlier comparison periods are outside coverage. Provisional zeros and results describe successfully refreshed, reviewed transactions only; public-index coverage remains partial. Unreviewed movements, failed refreshes or stale current-period snapshots prevent provisional totals.';
  if (state.data?.coverage_gaps?.length && !error) root.querySelector('#pnl-source').textContent += ' ' + state.data.coverage_gaps.join(' ');
  if (state.data?.execution_candidates?.length && !error) root.querySelector('#pnl-source').textContent += ` ${state.data.execution_candidates.length} passed spending proposals await verified execution receipts.`;
  if (state.data?.movement_review && !error) root.querySelector('#pnl-source').textContent += ` Movement review: ${state.data.movement_review.matched_receipts} linked receipts; ${state.data.movement_review.unreviewed_movements} observed movements awaiting classification. Balance reconciliation remains unavailable.`;
}
year.addEventListener('change', render); month.addEventListener('change', render);
window.addEventListener('neta:treasury-accounting', event => { const changed = state.dao?.id !== event.detail.dao?.id; state = event.detail; if (changed) expanded.clear(); render(); });
render();
