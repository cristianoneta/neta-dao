import {
  appendPointsDetails,
  pointsText,
  governanceWindowText
} from './juno-governance-points-view.mjs';
import {
  allocationBreakdown,
  budgetBreakdown,
  appendFixedDetails
} from './juno-fixed-allocation-view.mjs';
import { rowStatus } from './juno-delegation-view.mjs';
import { simulate, amount } from './juno-delegation-core.mjs';
import { formatAmount } from './juno-delegation-view.mjs';

const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
const percent = (value, total) =>
  total > 0n ? (Number((value * 10000n) / total) / 100).toFixed(2) + '%' : '—';

const impactState = new WeakMap();
const sortColumns = [
  ['currentRaw', 'Current · JUNO'],
  ['targetRaw', 'Target · JUNO'],
  ['deltaRaw', 'Change']
];
export function sortImpactRows(rows, key = 'targetRaw', direction = 'descending') {
  if (!sortColumns.some(([field]) => field === key)) throw Error('Unknown allocation column.');
  return [...rows].sort((a, b) => {
    const x = BigInt(a[key]),
      y = BigInt(b[key]);
    const order = x < y ? -1 : x > y ? 1 : 0;
    return (
      (direction === 'ascending' ? order : -order) ||
      (a.name.trim() || a.address).localeCompare(b.name.trim() || b.address) ||
      a.address.localeCompare(b.address)
    );
  });
}

// This is an unfrozen view of the existing production engine, never a proposal.
export function policyImpact({ rules, data, evidence, budget, valid = true }) {
  if (!valid) return { error: 'Check the highlighted criteria before calculating the impact.' };
  if (!data || !evidence) return { error: 'Waiting for a complete programme snapshot.' };
  try {
    const result = simulate(rules, data, amount(budget), evidence, data.activeSetHistory);
    const targets = result.rows
      .map((v) => BigInt(v.targetRaw))
      .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
    const total = BigInt(result.budgetRaw);
    return {
      result,
      governanceSource: data.governanceHistory?.source,
      largest: percent(targets[0] || 0n, total),
      topThree: percent(
        targets.slice(0, 3).reduce((a, b) => a + b, 0n),
        total
      ),
      historical:
        Math.max(
          Date.now() - Date.parse(data.blockTime),
          Date.now() - Date.parse(data.collectedAt)
        ) > 3600000
    };
  } catch (error) {
    return { error: error.message };
  }
}

export function renderPolicyImpact(host, model) {
  const state = impactState.get(host) || {
    key: 'targetRaw',
    direction: 'descending',
    expanded: false,
    fixedOnly: false
  };
  impactState.set(host, state);
  const head = node('div', undefined, 'impact-heading');
  const heading = node('div');
  heading.append(
    node('h2', 'Allocation impact'),
    node('p', 'Programme evidence · updates as you edit', 'policy-subtitle')
  );
  head.append(
    heading,
    node('span', model.historical ? 'Historical snapshot' : 'Programme snapshot', 'impact-source')
  );
  const metrics = node('div', undefined, 'impact-metrics');
  const result = model.result;
  for (const [label, value, help] of [
    [
      'Regular eligibility',
      result ? `${result.eligibleCount} / ${result.rows.length}` : '—',
      'Fixed allocations remain separate'
    ],
    ['Largest allocation', model.largest || '—', 'Of the total target budget'],
    ['Top-three share', model.topThree || '—', 'Concentration indicator']
  ]) {
    const cell = node('div');
    cell.append(node('span', label), node('strong', value), node('small', help));
    metrics.append(cell);
  }
  host.replaceChildren(head, metrics);
  if (!result) {
    host.append(node('p', model.error, 'impact-notice'));
    return;
  }
  if (result.fixedRaw !== undefined)
    host.append(node('p', budgetBreakdown(result), 'fixed-budget'));
  const mix = node('div', undefined, 'impact-mix');
  const mixHead = node('div', undefined, 'impact-mix-heading');
  mixHead.append(
    node('span', 'Where the budget goes'),
    node('strong', `${percent(BigInt(result.allocatedRaw), BigInt(result.budgetRaw))} allocated`)
  );
  const meter = node('progress');
  meter.max = 100;
  meter.value = Number((BigInt(result.allocatedRaw) * 10000n) / BigInt(result.budgetRaw)) / 100;
  meter.setAttribute('aria-label', 'Share of the target budget allocated');
  mix.append(
    mixHead,
    meter,
    node(
      'p',
      `Regular allocation within the voting-power limit · ${formatAmount(result.unallocatedRaw)} JUNO unallocated`,
      'policy-subtitle'
    )
  );
  host.append(mix, node('p', governanceWindowText(result), 'impact-notice'));
  const toolbar = node('div', undefined, 'impact-toolbar');
  toolbar.append(
    node('h3', 'Validator outcomes'),
    node('span', 'Current → target', 'policy-subtitle')
  );
  const sortLabel = node('label', 'Sort by', 'impact-sort-mobile');
  const sortSelect = node('select');
  sortSelect.setAttribute('aria-label', 'Sort validator outcomes');
  for (const [key, label] of sortColumns) {
    for (const [direction, title] of [
      ['descending', 'High to low'],
      ['ascending', 'Low to high']
    ]) {
      const option = node('option', `${label} · ${title}`);
      option.value = `${key}:${direction}`;
      sortSelect.append(option);
    }
  }
  sortLabel.append(sortSelect);
  const fixedFilter = node('label', undefined, 'fixed-filter'),
    fixedCheckbox = node('input');
  fixedCheckbox.type = 'checkbox';
  fixedCheckbox.checked = state.fixedOnly;
  fixedFilter.append(fixedCheckbox, document.createTextNode('Fixed allocations only'));
  toolbar.append(fixedFilter);
  const table = node('table', undefined, 'impact-table');
  const caption = node('caption', 'Estimated programme allocations in JUNO');
  caption.className = 'sr-only';
  const thead = node('thead');
  const tr = node('tr');
  const headers = [];
  for (const [key, name] of [['name', 'Validator'], ...sortColumns]) {
    const th = node('th');
    th.scope = 'col';
    if (key === 'name') th.textContent = name;
    else {
      const button = node('button', undefined, 'impact-sort');
      button.type = 'button';
      const arrow = node('span');
      arrow.setAttribute('aria-hidden', 'true');
      button.append(node('span', name), arrow);
      button.onclick = () => {
        state.direction =
          state.key === key && state.direction === 'descending' ? 'ascending' : 'descending';
        state.key = key;
        renderRows();
      };
      th.append(button);
      headers.push({ th, button, arrow, key, name });
    }
    tr.append(th);
  }
  thead.append(tr);
  const tbody = node('tbody');
  table.append(caption, thead, tbody);
  const toggle = node('button', '', 'impact-show-all');
  toggle.type = 'button';
  toggle.hidden = result.rows.length <= 8;
  const renderRows = () => {
    const rows = sortImpactRows(
      result.rows.filter((r) => !state.fixedOnly || BigInt(r.fixedRaw || '0') > 0n),
      state.key,
      state.direction
    );
    sortSelect.value = `${state.key}:${state.direction}`;
    for (const { th, button, arrow, key, name } of headers) {
      const active = state.key === key;
      th.setAttribute('aria-sort', active ? state.direction : 'none');
      arrow.textContent = active ? (state.direction === 'ascending' ? '↑' : '↓') : '↕';
      button.setAttribute(
        'aria-label',
        `${name}: sort ${active && state.direction === 'descending' ? 'ascending' : 'descending'}`
      );
    }
    tbody.replaceChildren();
    for (const row of state.expanded ? rows : rows.slice(0, 8)) {
      const line = node('tr');
      const name = node('td');
      const details = node('details');
      const summary = node('summary', row.name.trim() || row.address);
      details.append(
        summary,
        node(
          'p',
          row.reasons.length
            ? row.reasons.join(' · ')
            : 'All mandatory criteria passed. Voting-power capacity may limit the target.'
        )
      );
      const amounts = node(
        'p',
        `Exact JUNO: current ${formatAmount(row.currentRaw, true)} · target ${formatAmount(row.targetRaw, true)} · change ${formatAmount(row.deltaRaw, true)}`
      );
      details.append(amounts);
      appendPointsDetails(details, row.points, model.governanceSource);
      if (row.fixedAllocation) appendFixedDetails(details, row.fixedAllocation);
      name.append(
        details,
        node(
          'small',
          BigInt(row.fixedRaw || '0') > 0n
            ? rowStatus(row)
            : row.eligible
              ? 'Eligible'
              : 'Excluded · inspect evidence',
          row.eligible ? 'impact-eligible' : 'impact-excluded'
        )
      );
      if (row.points) name.append(node('small', pointsText(row.points)));
      line.append(name);
      for (const [label, value] of [
        ['Current', row.currentRaw],
        ['Target', row.targetRaw],
        ['Change', row.deltaRaw]
      ]) {
        const cell = node(
          'td',
          (label === 'Change' && BigInt(value) > 0n ? '+' : '') + formatAmount(value)
        );
        cell.dataset.label = label;
        if (label === 'Target' && BigInt(row.fixedRaw || '0') > 0n)
          cell.append(node('small', allocationBreakdown(row), 'fixed-breakdown'));
        line.append(cell);
      }
      tbody.append(line);
    }
    if (!rows.length) {
      const line = node('tr'),
        cell = node('td', 'No fixed allocations in this calculation.');
      cell.colSpan = 4;
      line.append(cell);
      tbody.append(line);
    }
    toggle.hidden = rows.length <= 8;
    toggle.textContent = state.expanded
      ? 'Show first 8 validators'
      : `Show all ${rows.length} validators`;
    toggle.setAttribute('aria-expanded', String(state.expanded));
  };
  fixedCheckbox.onchange = () => {
    state.fixedOnly = fixedCheckbox.checked;
    renderRows();
  };
  sortSelect.onchange = () => {
    [state.key, state.direction] = sortSelect.value.split(':');
    renderRows();
  };
  toggle.onclick = () => {
    state.expanded = !state.expanded;
    renderRows();
  };
  renderRows();
  host.append(
    toolbar,
    sortLabel,
    table,
    toggle,
    node(
      'p',
      'Exploration only. Review freezes the rules and evidence for the proposal. No funds move here.',
      'policy-subtitle'
    )
  );
}
