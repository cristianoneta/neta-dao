import { period, validateLedger, summarize } from './treasury-pnl.mjs?v=20261006-5';
import { setupPeriods, dollars, date, el } from './treasury-report-ui.mjs?v=20261006-5';
const $ = id => document.getElementById(id);
const year = $('nns-year'), month = $('nns-month'), type = $('nns-type');
const params = new URLSearchParams(location.search);
setupPeriods(year, month, params);
if (['all', 'nns_registration', 'nns_renewal'].includes(params.get('type'))) type.value = params.get('type');
let data = null, entries = [], error = '', loading = false;
function render() {
  const query = new URLSearchParams({ year: year.value, month: month.value, type: type.value });
  history.replaceState(null, '', `${location.pathname}?${query}`);
  $('nns-back').href = `index.html?${new URLSearchParams({ dao: 'neta', pnl_year: year.value, pnl_month: month.value })}#treasury`;
  const range = period(Number(year.value), month.value === 'all' ? 'all' : Number(month.value));
  const selected = entries.filter(row => type.value === 'all' || row.category === type.value);
  const summary = summarize(selected, range), rows = summary.rows.slice().sort((a,b) => Date.parse(b.timestamp)-Date.parse(a.timestamp));
  $('nns-summary').textContent = loading ? 'Loading receipts…' : error || `${rows.length} matched payment${rows.length === 1 ? '' : 's'} · Partial coverage${range.start > Date.now() ? ' · Future period' : ''}`;
  $('nns-total').textContent = summary.observedIncome === null ? '' : `${dollars(summary.observedIncome)} · observed subtotal`;
  const tbody = $('nns-payments'); tbody.replaceChildren();
  for (const row of rows) {
    const tr = el('tr'), identity = el('th'); identity.scope = 'row';
    identity.append(el('strong', row.name), el('small', `${row.years} year${row.years === 1 ? '' : 's'}`));
    const link = el('a', `${row.tx_hash.slice(0,8)}…${row.tx_hash.slice(-6)} ↗`); link.href = `https://atomscan.com/juno/transactions/${row.tx_hash}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', `View transaction for ${row.name}`); identity.append(link);
    const n = BigInt(row.raw_amount), amount = `${n / 1000000n}.${String(n % 1000000n).padStart(6,'0')}`;
    const usd = el('td'); usd.append(el('strong', `$${Number(row.usd_value).toFixed(6)}`));
    const detail = el('details'), label = el('summary', 'Conversion');
    detail.append(label, el('p', `$${Number(row.valuation.usd_per_neta_12) / 1e12} / NETA · observed ${date(row.valuation.observed_at * 1000)} UTC. Block ${row.height}. ${row.evidence?.kind === 'archived-provider-receipt' ? 'Archived' : 'Matched'} provider receipt.`)); usd.append(detail);
    tr.append(identity, el('td', date(row.timestamp)), el('td', row.category === 'nns_registration' ? 'Registration' : 'Renewal'), el('td', amount), usd); tbody.append(tr);
  }
  $('nns-empty').hidden = rows.length > 0 || loading;
  $('nns-empty').textContent = error ? 'Payments could not be loaded. Retry using Refresh.' : range.start > Date.now() ? 'This period has not started yet.' : 'No matched payments available for this selection. Try another period or payment type.';
  $('nns-source').textContent = data ? `Last successful refresh: ${data.last_success_at ? date(data.last_success_at) + ' UTC' : 'unavailable'}. Latest attempt: ${data.refresh_status}. Selected interval: ${date(range.start)} – ${date(range.end)} (end exclusive). Registry: ${data.registry}.` : 'Receipt source unavailable.';
}
async function load() {
  loading = true; error = ''; entries = []; data = null; $('nns-refresh').disabled = true; render();
  try { const response = await fetch('data/treasury/neta-main-accounting.json', { cache: 'no-store', signal: AbortSignal.timeout(20000) }); if (!response.ok) throw Error('Receipt source unavailable'); const next = await response.json(); entries = validateLedger(next, window.NetaDaoDirectory.find(d => d.id === 'neta')); data = next; }
  catch (e) { error = `Unable to load verified receipts: ${e.message}`; }
  finally { loading = false; $('nns-refresh').disabled = false; render(); }
}
[year,month,type].forEach(control => control.addEventListener('change', render));
$('nns-refresh').addEventListener('click', load);
load();
