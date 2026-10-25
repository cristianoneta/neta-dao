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
  const head = node('div', undefined, 'impact-heading');
  const heading = node('div');
  heading.append(
    node('h2', 'Allocation impact'),
    node('p', 'Programme evidence · updates as you edit', 'policy-subtitle')
  );
  head.append(
    heading,
    node('span', model.historical ? 'Historical snapshot' : 'Live-data model', 'impact-source')
  );
  const metrics = node('div', undefined, 'impact-metrics');
  const result = model.result;
  for (const [label, value, help] of [
    [
      'Eligible validators',
      result ? `${result.eligibleCount} / ${result.rows.length}` : '—',
      'All mandatory checks must pass'
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
      `Equal allocation within the voting-power limit · ${formatAmount(result.unallocatedRaw)} JUNO unallocated`,
      'policy-subtitle'
    )
  );
  host.append(
    mix,
    node(
      'p',
      'Bonus evidence is not connected. These targets use the current equal-allocation rules; the points explorer does not change proposals.',
      'impact-notice'
    )
  );
  const toolbar = node('div', undefined, 'impact-toolbar');
  toolbar.append(
    node('h3', 'Validator outcomes'),
    node('span', 'Current → target', 'policy-subtitle')
  );
  const table = node('table', undefined, 'impact-table');
  const caption = node('caption', 'Estimated programme allocations in JUNO');
  caption.className = 'sr-only';
  const thead = node('thead');
  const tr = node('tr');
  for (const name of ['Validator', 'Current · JUNO', 'Target · JUNO', 'Change']) {
    const th = node('th', name);
    th.scope = 'col';
    tr.append(th);
  }
  thead.append(tr);
  const tbody = node('tbody');
  table.append(caption, thead, tbody);
  const rows = [...result.rows].sort((a, b) => {
    const x = BigInt(a.targetRaw),
      y = BigInt(b.targetRaw);
    return x === y ? a.name.localeCompare(b.name) : x > y ? -1 : 1;
  });
  let expanded = false;
  const toggle = node('button', `Show all ${rows.length} validators`, 'impact-show-all');
  toggle.type = 'button';
  toggle.hidden = rows.length <= 8;
  const renderRows = () => {
    tbody.replaceChildren();
    for (const row of expanded ? rows : rows.slice(0, 8)) {
      const line = node('tr');
      const name = node('td');
      const details = node('details');
      const summary = node('summary', row.name);
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
      name.append(
        details,
        node(
          'small',
          row.eligible ? 'Eligible' : 'Excluded · inspect evidence',
          row.eligible ? 'impact-eligible' : 'impact-excluded'
        )
      );
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
        line.append(cell);
      }
      tbody.append(line);
    }
    toggle.textContent = expanded
      ? 'Show first 8 validators'
      : `Show all ${rows.length} validators`;
    toggle.setAttribute('aria-expanded', String(expanded));
  };
  toggle.onclick = () => {
    expanded = !expanded;
    renderRows();
  };
  renderRows();
  host.append(
    toolbar,
    table,
    toggle,
    node(
      'p',
      'Exploration only. Compare freezes the rules and evidence for review. No funds move here.',
      'policy-subtitle'
    )
  );
}
