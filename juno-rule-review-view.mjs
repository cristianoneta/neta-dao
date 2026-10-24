import { comparison } from './juno-delegation-review.mjs';
import { historyCoverageText } from './juno-active-set-history.mjs';
import { participationText } from './juno-participation-history.mjs';
import {
  formatAmount,
  formatChange,
  allocationReason,
  rowStatus,
  stakeShare
} from './juno-delegation-view.mjs';
const el = (tag, text = '', className = '') => {
  const n = document.createElement(tag);
  n.textContent = text;
  if (className) n.className = className;
  return n;
};
const amount = (raw, exact = false) => (raw === null ? '—' : formatAmount(raw, exact));
const change = (raw, exact = false) => (raw === null ? '—' : formatChange(raw, exact));
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const abs = (v) => (v < 0n ? -v : v);
export function renderRuleChanges(host, rows, { onReset } = {}) {
  host.replaceChildren();
  host.classList.add('rule-review');
  const changed = rows.filter((r) => r.changed),
    unchanged = rows.filter((r) => !r.changed);
  const render = (items, target) => {
    for (const r of items) {
      const item = el('div', '', 'rr-rule'),
        label = el('div', '', 'rr-rule-name');
      label.append(el('strong', r.label));
      if (r.address) label.append(el('small', r.address));
      if (!r.numerical && r.changed)
        label.append(el('small', 'Reason changed · allocation criterion unchanged'));
      item.append(label);
      for (const [title, value] of [
        ['Previously approved', r.before],
        ['Proposed', r.after]
      ]) {
        const cell = el('div');
        cell.append(el('small', title), el('span', value));
        item.append(cell);
      }
      if (onReset && r.changed && r.before !== 'Not established') {
        const reset = el('button', 'Reset', 'rr-reset');
        reset.type = 'button';
        reset.setAttribute('aria-label', 'Reset ' + r.label + (r.address ? ' ' + r.address : ''));
        reset.onclick = () => onReset(r.key);
        item.append(reset);
      }
      target.append(item);
    }
  };
  host.append(
    el(
      'h3',
      changed.length
        ? `${changed.length} ${rows.every((r) => r.before === 'Not established') ? 'initial criteria' : 'rule changes'}`
        : 'No rule changes'
    )
  );
  render(changed, host);
  if (unchanged.length) {
    const detail = el('details');
    detail.append(el('summary', `${unchanged.length} unchanged criteria`));
    render(unchanged, detail);
    host.append(detail);
  }
}
export function renderRuleReview(
  host,
  review,
  { scope = 'draft', rules = true, distribution = true } = {}
) {
  const model = review.model,
    value = review.value;
  host.replaceChildren();
  host.classList.add('rule-review');
  if (rules) {
    const heading = el('div', '', 'rr-heading'),
      intro = el('div');
    intro.append(
      el('p', scope === 'published' ? 'PUBLISHED RULE REVIEW' : 'DECISION TO REVIEW', 'rr-eyebrow'),
      el(
        'h3',
        value.parent
          ? `Rule change · follows proposal #${value.parent.proposalId}`
          : 'Initial rule adoption'
      ),
      el('p', 'This vote approves rules. It does not move programme funds.')
    );
    heading.append(intro, el('span', 'No execution messages', 'rr-badge'));
    host.append(heading);
    if (value.parent) {
      const ref = el('a', `Baseline: proposal #${value.parent.proposalId} ↗`);
      ref.href = 'https://atomscan.com/juno/proposals/' + value.parent.proposalId;
      ref.target = '_blank';
      ref.rel = 'noopener noreferrer';
      host.append(ref);
    } else
      host.append(
        el(
          'p',
          'No prior Cosmoot-format approval was found at preparation. Existing holdings are still the actual baseline.',
          'rr-note'
        )
      );
    if (value.rationale) {
      const rationale = el('div', '', 'rr-rationale');
      rationale.append(el('strong', 'Why this change'), el('p', value.rationale));
      host.append(rationale);
    }
    const changes = el('section');
    renderRuleChanges(changes, model.changes);
    host.append(changes);
  }
  if (distribution) renderDistribution(host, model);
  const details = el('details', '', 'rr-provenance');
  details.append(el('summary', 'Exact rules, observations & calculation data'));
  details.append(
    el(
      'p',
      `Frozen ${new Date(value.createdAt).toLocaleString()} · snapshot ${value.snapshot.height.toLocaleString('en-US')} · ${value.snapshot.blockTime}`
    ),
    el(
      'p',
      `${value.snapshot.validators.length} retained of ${value.sourceValidatorCount} source validators: all holdings, active validators, possible recipients and relevant network stake. Omitted validators have no holdings, cannot receive funds under either policy and cannot enter the projected consensus set.`,
      'rr-note'
    ),
    el(
      'p',
      'The embedded provider observations reproduce the calculation. They are not independent proof of chain history or execution authority. Current data never replaces this published comparison.',
      'rr-note'
    )
  );
  const raw = el('pre', JSON.stringify(value, null, 2));
  raw.tabIndex = 0;
  details.append(raw, el('p', `Review SHA-256: ${review.hash}`, 'rr-hash'));
  host.append(details);
  if (scope === 'published')
    host.append(
      el(
        'p',
        'After rule approval: prepare a fresh allocation proposal pinned to the approved revision, verify movement constraints and authority, obtain the separate approval, then reconcile confirmed execution.',
        'rr-next'
      )
    );
}
function renderDistribution(host, model) {
  let mode = 'actual',
    page = 0;
  const pageSize = 10,
    expanded = new Set();
  const region = el('section', '', 'rr-distribution');
  region.append(el('h3', 'What changes in the distribution?'));
  const controls = el('div', '', 'rr-baselines'),
    actual = el('button', 'Today → proposed'),
    policy = el('button', 'Rule effect only');
  actual.type = policy.type = 'button';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Comparison baseline');
  controls.append(actual, policy);
  region.append(controls);
  policy.disabled = !model.previous?.result || !model.proposed.result;
  const note = el('p', '', 'rr-note'),
    unavailable = el('p', '', 'rr-unavailable');
  if (!model.proposed.result)
    unavailable.textContent =
      model.proposed.reason +
      ' Current holdings remain visible. No zero target or movement instruction is inferred.';
  else unavailable.hidden = true;
  const stats = el('div', '', 'rr-stats'),
    secondary = el('p', '', 'rr-note');
  region.append(note, unavailable, stats, secondary);
  if (model.proposed.coverage?.complete) {
    const coverage = el(
      'p',
      historyCoverageText(model.proposed.coverage),
      model.proposed.coverage.collecting ? 'rr-history rr-unavailable' : 'rr-history rr-note'
    );
    region.insertBefore(coverage, stats);
  }
  const toolbar = el('div', '', 'rr-toolbar');
  function field(title, tag, options) {
    const label = el('label', title),
      input = el(tag);
    input.setAttribute('aria-label', title);
    if (tag === 'input') {
      input.type = 'search';
      input.placeholder = 'Name or validator address';
    } else
      for (const [value, title] of options) {
        const option = el('option', title);
        option.value = value;
        input.append(option);
      }
    label.append(input);
    toolbar.append(label);
    return input;
  }
  const search = field('Find a validator', 'input'),
    filter = field('Show', 'select', [
      ['all', 'All comparison validators'],
      ['receiving', 'Receiving an allocation'],
      ['cap', 'Limited by voting power'],
      ['review', 'Evidence review required'],
      ['excluded', 'Not eligible'],
      ['inactive', 'Jailed'],
      ['standby', 'Outside the active set']
    ]),
    sort = field('Sort by', 'select', [
      ['change', 'Largest change first'],
      ['name', 'Validator name'],
      ['target', 'Largest target first'],
      ['power', 'Current stake share'],
      ['total', 'Projected total · highest first'],
      ['total-asc', 'Projected total · lowest first'],
      ['projected', 'Projected share · highest first'],
      ['projected-asc', 'Projected share · lowest first']
    ]);
  const only = el('label', '', 'rr-only'),
    checkbox = el('input');
  checkbox.type = 'checkbox';
  only.append(checkbox, document.createTextNode('Only changes'));
  toolbar.append(only);
  region.append(toolbar);
  const rowsHost = el('div', '', 'rr-rows'),
    pagination = el('div', '', 'rr-pagination'),
    count = el('span'),
    previous = el('button', '← Previous'),
    next = el('button', 'Next →');
  previous.type = next.type = 'button';
  count.setAttribute('role', 'status');
  pagination.append(count, previous, next);
  region.append(rowsHost, pagination);
  host.append(region);
  function draw() {
    const c = comparison(model, mode),
      baseline = mode === 'actual' ? 'Current' : 'Approved-rule target';
    actual.setAttribute('aria-pressed', String(mode === 'actual'));
    policy.setAttribute('aria-pressed', String(mode === 'policy'));
    checkbox.disabled = !c.available;
    note.textContent =
      mode === 'actual'
        ? 'Actual programme holdings → proposed target. Amounts are JUNO; this is an allocation estimate, not a transaction plan.'
        : 'Old target → new target. Both policies use the same snapshot, evidence and budget; existing portfolio drift is excluded.';
    if (!model.value.parent)
      note.textContent += ' Rule-only comparison starts after the first approval.';
    else if (!model.previous?.result)
      note.textContent += ' The approved-rule target is unavailable with these observations.';
    stats.replaceChildren();
    for (const [title, value, caption] of [
      ['Decreases', amount(c.decreases), 'JUNO below the selected baseline'],
      ['Increases', amount(c.increases), 'JUNO above the selected baseline'],
      [
        'Receiving validators',
        `${c.beforeCount ?? '—'} → ${c.afterCount ?? '—'}`,
        'Positive allocations only'
      ]
    ]) {
      const card = el('div');
      card.append(el('small', title), el('strong', value), el('small', caption));
      stats.append(card);
    }
    secondary.textContent = `Budget: ${amount(model.value.budgetRaw)} JUNO · Proposed total: ${amount(model.proposed.result?.allocatedRaw ?? null)} · Unallocated: ${amount(model.proposed.result?.unallocatedRaw ?? null)}. Net allocation change: ${change(c.net)} JUNO. Current holdings outside the active set: ${amount(c.outsideRaw)} JUNO.`;
    const q = search.value.trim().toLowerCase();
    const rows = c.rows
      .filter((v) => {
        if (!`${v.name} ${v.address}`.toLowerCase().includes(q)) return false;
        if (checkbox.checked && c.available && v.delta === '0') return false;
        if (filter.value === 'receiving') return v.after !== null && BigInt(v.after) > 0n;
        if (filter.value === 'cap') return v.next?.eligible && v.next.capReached;
        if (filter.value === 'review')
          return !v.next || (!v.next.eligible && v.next.upgrade.status !== 'observed');
        if (filter.value === 'excluded') return v.next && !v.next.eligible;
        if (filter.value === 'inactive') return v.jailed;
        if (filter.value === 'standby') return !v.active;
        return true;
      })
      .sort((a, b) => {
        let order = 0;
        if (sort.value === 'change')
          order = compare(
            abs(BigInt(b.delta ?? b.currentRaw)),
            abs(BigInt(a.delta ?? a.currentRaw))
          );
        if (sort.value === 'target') order = compare(BigInt(b.after ?? 0), BigInt(a.after ?? 0));
        if (sort.value === 'power')
          order =
            Number(b.active) - Number(a.active) ||
            compare(BigInt(b.tokensRaw), BigInt(a.tokensRaw));
        if (['total', 'total-asc', 'projected', 'projected-asc'].includes(sort.value))
          order =
            (sort.value.startsWith('projected')
              ? Number(!!b.next?.projectedActive) - Number(!!a.next?.projectedActive)
              : 0) ||
            compare(BigInt(b.next?.projectedRaw ?? 0), BigInt(a.next?.projectedRaw ?? 0)) *
              (sort.value.endsWith('-asc') ? -1 : 1);
        return order || a.name.localeCompare(b.name) || a.address.localeCompare(b.address);
      });
    page = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
    const max = c.rows.reduce(
      (n, v) => [BigInt(v.before ?? 0), BigInt(v.after ?? 0), n].reduce((a, b) => (a > b ? a : b)),
      1n
    );
    rowsHost.replaceChildren();
    for (const v of rows.slice(page * pageSize, (page + 1) * pageSize)) {
      const row = el('article', '', 'rr-validator'),
        top = el('div', '', 'rr-validator-top'),
        name = el('div', '', 'rr-identity');
      name.append(
        el('strong', v.name || v.address),
        el('small', v.jailed ? 'Jailed' : v.active ? 'Active set' : 'Outside active set')
      );
      top.append(name);
      const graph = el('div', '', 'rr-graph');
      graph.setAttribute('aria-hidden', 'true');
      if (v.after !== null) {
        const bar = el('span', '', 'rr-target');
        bar.style.width = Number((BigInt(v.after) * 10000n) / max) / 100 + '%';
        graph.append(bar);
      }
      if (v.before !== null) {
        const tick = el('span', '', 'rr-baseline');
        tick.style.left = Math.min(99.8, Number((BigInt(v.before) * 10000n) / max) / 100) + '%';
        graph.append(tick);
      }
      top.append(graph);
      for (const [label, number, css] of [
        [baseline, amount(v.before), ''],
        ['Proposed', amount(v.after), 'rr-proposed'],
        ['Change', change(v.delta), '']
      ]) {
        const cell = el('div', '', 'rr-number ' + css);
        cell.append(el('small', label), el('strong', number));
        top.append(cell);
      }
      const details = el('details');
      details.open = expanded.has(v.address);
      details.ontoggle = () =>
        details.open ? expanded.add(v.address) : expanded.delete(v.address);
      details.append(
        el(
          'summary',
          v.next
            ? rowStatus(v.next) + ' · Why this amount?'
            : 'Evidence incomplete · View holdings & criteria'
        )
      );
      if (v.next) {
        let reason = allocationReason(v.next);
        if (
          mode === 'policy' &&
          v.delta !== '0' &&
          v.old?.eligible &&
          v.next.eligible &&
          v.old.capacityRaw === v.next.capacityRaw
        )
          reason +=
            ' Its own eligibility and capacity are unchanged; the difference comes from redistribution after other rule effects (including rounding).';
        details.append(el('p', reason));
      } else details.append(el('p', model.proposed.reason));
      if (model.value.rule.schema >= 5 && v.next)
        details.append(el('p', participationText(v.next.participation), 'rr-participation'));
      const exact = el('dl', '', 'rr-exact');
      for (const [label, value] of [
        ['Actual holding', v.currentRaw],
        ['Approved-rule target', v.old?.targetRaw ?? null],
        ['Proposed target', v.after]
      ]) {
        const entry = el('div');
        entry.append(
          el('dt', label),
          el('dd', value === null ? 'Unavailable' : amount(value, true) + ' JUNO')
        );
        exact.append(entry);
      }
      details.append(
        exact,
        el('p', 'Change against selected baseline: ' + change(v.delta, true) + ' JUNO'),
        el('p', v.address, 'rr-hash')
      );
      if (v.next)
        details.append(
          el(
            'p',
            `All delegators after allocation: ${amount(v.next.projectedRaw, true)} JUNO · Projected stake share: ${v.next.projectedActive ? stakeShare(v.next.projectedRaw, model.proposed.result.projectedBondedRaw) : 'Outside projected set'} · Commission: ${v.commissionBps / 100}%`
          )
        );
      row.append(top, details);
      rowsHost.append(row);
    }
    if (!rows.length) rowsHost.append(el('p', 'No validators match these filters.'));
    count.textContent = rows.length
      ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, rows.length)} of ${rows.length} · ${checkbox.checked ? 'exact changes from ' + baseline.toLowerCase() : 'rounded to two decimals'}`
      : 'No matching validators.';
    previous.disabled = page === 0;
    next.disabled = (page + 1) * pageSize >= rows.length;
  }
  actual.onclick = () => {
    mode = 'actual';
    page = 0;
    draw();
  };
  policy.onclick = () => {
    mode = 'policy';
    page = 0;
    draw();
  };
  for (const input of [search, filter, sort, checkbox])
    input.addEventListener(input === search ? 'input' : 'change', () => {
      page = 0;
      draw();
    });
  previous.onclick = () => {
    page--;
    draw();
  };
  next.onclick = () => {
    page++;
    draw();
  };
  draw();
}
