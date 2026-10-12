import { ASSETS, amount, display, initialState, poolFor, featured, quote,
  swap, depositQuote, addLiquidity, withdraw, createPool, buybackPreview, incentivePlan } from './model.mjs';

const $ = id => document.getElementById(id);
const fmt = value => display(value).toLocaleString('en-US', { maximumFractionDigits: 6 });
const usd = value => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const money = (value, symbol) => `${fmt(value)} ${symbol}`;
let state = initialState(), netaIn = false, liquidityToken = '', confirmAction;
let incentiveToken = '', plans = [];

function notice(text) { $('notice').textContent = text; $('notice').hidden = false; }
function view() {
  const name = ['swap', 'pools', 'dao'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'swap';
  for (const link of document.querySelectorAll('[data-view]')) {
    const active = link.dataset.view === name;
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    $(`view-${link.dataset.view}`).hidden = !active;
  }
}
function metric(label, value) {
  const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
  dt.textContent = label; dd.textContent = value; row.append(dt, dd); return row;
}
function metrics(rows) { const dl = document.createElement('dl'); dl.className = 'metrics'; for (const r of rows) dl.append(metric(...r)); return dl; }
function paragraph(text) { const p = document.createElement('p'); p.textContent = text; return p; }
function review(title, nodes, label, action) {
  $('review-title').textContent = title; $('review-content').replaceChildren(...nodes);
  $('confirm').textContent = label; $('confirm').disabled = false; $('review-error').textContent = '';
  confirmAction = action; $('review').showModal();
}
function renderQuote() {
  const pool = poolFor(state, $('swap-pair').value);
  const inputSymbol = netaIn ? 'NETA' : pool.token, outputSymbol = netaIn ? pool.token : 'NETA';
  $('pay-token').textContent = inputSymbol; $('receive-token').textContent = outputSymbol;
  $('pay-balance').textContent = `Demo balance ${fmt(state.balances[inputSymbol])}`;
  $('swap-error').textContent = ''; $('swap-submit').disabled = true;
  for (const id of ['swap-output', 'impact', 'lp-fee', 'protocol-fee']) $(id).textContent = '—';
  if (!$('swap-input').value.trim()) return;
  try {
    const input = amount($('swap-input').value), q = quote(pool, input, netaIn);
    $('swap-output').textContent = fmt(q.received); $('impact').textContent = `${q.impact.toFixed(2)}%`;
    $('lp-fee').textContent = money(q.lp, q.out); $('protocol-fee').textContent = money(q.protocol, q.out);
    if (state.balances[q.in] < input) throw Error(`Not enough demo ${q.in}.`);
    if (q.impact > 5) $('swap-error').textContent = 'High price impact in this demo pool. Review the estimated receipt carefully.';
    $('swap-submit').disabled = false;
  } catch (error) { $('swap-error').textContent = error.message; }
}
function selectOptions(select, tokens) {
  const previous = select.value;
  select.replaceChildren(...tokens.map(token => { const option = document.createElement('option'); option.value = token; option.textContent = `${token} / NETA`; return option; }));
  if (tokens.includes(previous)) select.value = previous;
}
function showSwap(token) { $('swap-pair').value = token; netaIn = false; location.hash = 'swap'; renderQuote(); $('swap-input').focus(); }
function openLiquidity(token) {
  liquidityToken = token;
  $('liquidity-title').textContent = `Add ${token} / NETA liquidity`;
  $('liquidity-label').textContent = `${token} amount · demo balance ${fmt(state.balances[token])}`;
  $('liquidity-error').textContent = ''; $('liquidity-input').value = '100';
  renderDeposit(); $('liquidity').showModal();
}
function renderDeposit() {
  try { const q = depositQuote(poolFor(state, liquidityToken), amount($('liquidity-input').value));
    $('liquidity-quote').textContent = `Also deposit ${money(q.neta, 'NETA')} · Demo NETA balance ${fmt(state.balances.NETA)}`;
  } catch { $('liquidity-quote').textContent = 'Enter an amount to calculate the matching NETA deposit.'; }
}
function actionButton(label, action) {
  const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
  button.addEventListener('click', action); return button;
}
function poolRow(pool) {
  const row = document.createElement('div'); row.className = 'pool-row';
  const title = document.createElement('div'), strong = document.createElement('strong'); strong.textContent = `${pool.token} / NETA`;
  title.append(strong, paragraph('Demo pool · 0.30% fee'));
  const values = document.createElement('div'); values.className = 'pool-values';
  values.append(document.createTextNode(`${money(pool.neta, 'NETA')} · ${usd(display(pool.neta) * 4)}`), paragraph(money(pool.reserve, pool.token)));
  const actions = document.createElement('div'); actions.className = 'pool-actions';
  actions.append(actionButton('Swap', () => showSwap(pool.token)), actionButton('Add liquidity', () => openLiquidity(pool.token)), actionButton('Plan incentives', () => openIncentive(pool.token)));
  row.append(title, values, actions); return row;
}
function renderPools() {
  const large = state.pools.filter(featured), small = state.pools.filter(p => !featured(p));
  $('featured-pools').replaceChildren(...large.map(poolRow));
  if (!large.length) $('featured-pools').append(paragraph('No demo pools meet the featured threshold.'));
  $('small-pools').replaceChildren(...small.map(poolRow)); $('small-count').textContent = `(${small.length})`;
  if (!small.length) $('small-pools').append(paragraph('No demo pools below the threshold.'));
  const positions = state.pools.filter(p => p.owned > 0n);
  $('positions').replaceChildren();
  if (!positions.length) $('positions').append(paragraph('No demo positions yet. Add liquidity to a pool to try deposits and withdrawals.'));
  for (const pool of positions) {
    const row = document.createElement('div'); row.className = 'pool-row';
    const title = document.createElement('strong'); title.textContent = `${pool.token} / NETA`;
    const a = pool.reserve * pool.owned / pool.shares, b = pool.neta * pool.owned / pool.shares;
    const values = paragraph(`${money(a, pool.token)} + ${money(b, 'NETA')}`);
    row.append(title, values, actionButton('Remove liquidity', () => review('Remove demo liquidity',
      [metrics([['Receive', money(a, pool.token)], ['Receive', money(b, 'NETA')]]), paragraph('Remove your full demo position. No staking or unbonding wait.')],
      'Simulate withdrawal', () => { withdraw(state, pool.token); notice(`Demo ${pool.token} / NETA liquidity removed.`); })));
    $('positions').append(row);
  }
}
function render() {
  selectOptions($('swap-pair'), state.pools.map(p => p.token)); renderQuote(); renderPools();
  $('balances').replaceChildren(...Object.entries(state.balances).map(([token, value]) => metric(token, fmt(value))));
  $('swap-count').textContent = String(state.swaps); $('burned').textContent = fmt(state.burned);
  const fees = Object.entries(state.fees).filter(([, value]) => value > 0n);
  $('fee-balances').replaceChildren(fees.length ? metrics(fees.map(([token, value]) => [token, fmt(value)])) : paragraph('No protocol fees yet. Simulate a swap to fund the first buyback.'));
  $('buyback').disabled = !fees.length;
}
$('swap-input').addEventListener('input', renderQuote);
$('swap-pair').addEventListener('change', renderQuote);
$('reverse').addEventListener('click', () => { netaIn = !netaIn; renderQuote(); });
$('swap-form').addEventListener('submit', event => {
  event.preventDefault(); if ($('swap-submit').disabled) return;
  try {
    const token = $('swap-pair').value, input = amount($('swap-input').value), direction = netaIn;
    const q = quote(poolFor(state, token), input, direction);
    review('Review demo swap', [metrics([['You pay', money(input, q.in)], ['You receive', money(q.received, q.out)],
      ['LP fee', money(q.lp, q.out)], ['Buyback fee', money(q.protocol, q.out)], ['Price impact', `${q.impact.toFixed(2)}%`]]),
      paragraph('Updates example reserves and balances in this tab only. No wallet signature or network fee.')], 'Simulate swap', () => {
        swap(state, token, input, direction); notice(`Demo swap completed: ${money(input, q.in)} → ${money(q.received, q.out)}.`);
      });
  } catch (error) { $('swap-error').textContent = error.message; }
});
$('confirm').addEventListener('click', () => {
  if (!confirmAction) return;
  try { confirmAction(); confirmAction = null; $('review').close(); render(); }
  catch (error) { $('review-error').textContent = error.message; }
});
$('review').addEventListener('close', () => { confirmAction = null; });
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => $(button.dataset.close).close());
$('liquidity-input').addEventListener('input', () => { $('liquidity-error').textContent = ''; renderDeposit(); });
$('liquidity-form').addEventListener('submit', event => {
  event.preventDefault();
  try { addLiquidity(state, liquidityToken, amount($('liquidity-input').value)); $('liquidity').close(); render(); notice(`Demo liquidity added to ${liquidityToken} / NETA.`); }
  catch (error) { $('liquidity-error').textContent = error.message; }
});
$('new-pool').addEventListener('click', () => {
  const available = ASSETS.filter(token => !state.pools.some(p => p.token === token));
  selectOptions($('create-token'), available); $('create-submit').disabled = !available.length;
  $('create-error').textContent = available.length ? '' : 'All demo asset pairs already exist. Reset the demo to start again.';
  $('create').showModal();
});
$('create-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const token = $('create-token').value;
    createPool(state, token, amount($('create-amount').value), amount($('create-neta').value));
    $('create').close(); render(); document.querySelector('.smaller-pools').open = true;
    notice(`Demo ${token} / NETA pool created. Its NETA reserve determines featured status.`);
  } catch (error) { $('create-error').textContent = error.message; }
});
$('buyback').addEventListener('click', () => {
  const preview = buybackPreview(state), list = document.createElement('ul');
  for (const route of preview.routes) {
    const li = document.createElement('li');
    li.textContent = route.skipped ? `${money(route.input, route.asset)} — skipped: ${route.skipped}` :
      `${money(route.input, route.asset)} · ${route.path} · ${money(route.received, 'DAO')} burned`;
    list.append(li);
  }
  review('Review demo buyback & burn', [list, metrics([['DAO tokens to burn', fmt(preview.burned)]]),
    paragraph('This local simulation uses example reserves. Trade fees apply to conversion routes; any new fees remain for a later batch. No real tokens are burned.')],
    'Simulate buyback & burn', () => { state = preview.next; notice(`Demo buyback complete: ${money(preview.burned, 'DAO')} burned.`); });
  $('confirm').disabled = preview.burned === 0n;
});
function openIncentive(token) {
  incentiveToken = token; $('incentive-pool').textContent = `${token} / NETA`;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  $('incentive-start').min = tomorrow; $('incentive-start').value = tomorrow;
  $('incentive-error').textContent = ''; renderSchedule(); $('incentive').showModal();
}
function getPlan() { return incentivePlan({ token: incentiveToken, reward: $('incentive-reward').value,
  total: $('incentive-total').value, start: $('incentive-start').value }); }
function renderSchedule() {
  try { const plan = getPlan(); $('incentive-schedule').textContent = `${plan.start} → ${plan.end} · 00:00 UTC · ≈ ${money(plan.total / 12n, plan.reward)} per week`; }
  catch { $('incentive-schedule').textContent = 'Choose a future start date and a positive reward budget.'; }
}
for (const id of ['incentive-start', 'incentive-total', 'incentive-reward']) $(id).addEventListener('input', renderSchedule);
function renderPlans() {
  $('incentive-plans').replaceChildren();
  if (!plans.length) $('incentive-plans').append(paragraph('No campaigns planned. Choose “Plan incentives” on a pool to start.'));
  for (const plan of plans) {
    const row = document.createElement('div'); row.className = 'campaign';
    const title = document.createElement('strong'); title.textContent = `${plan.token} / NETA · ${money(plan.total, plan.reward)}`;
    row.append(title, paragraph(`${plan.start} → ${plan.end} · 12 weeks / 84 days · UTC`), paragraph('Demo plan · Not funded · Reward distribution unavailable'));
    row.append(actionButton('Remove plan', () => { plans = plans.filter(p => p !== plan); renderPlans(); }));
    $('incentive-plans').append(row);
  }
}
$('incentive-form').addEventListener('submit', event => {
  event.preventDefault();
  try { plans.push(getPlan()); renderPlans(); $('incentive').close(); notice('12-week demo incentive plan saved. No funds transferred.'); }
  catch (error) { $('incentive-error').textContent = error.message; }
});
$('reset').addEventListener('click', () => review('Reset demo session?', [paragraph('Clears your simulated swaps, pools, liquidity positions and burns. Restores all example balances.')], 'Reset demo', () => {
  state = initialState(); plans = []; renderPlans(); netaIn = false; $('swap-input').value = '100'; notice('Demo reset. All example balances restored.');
}));
window.addEventListener('hashchange', view);
render(); view();
