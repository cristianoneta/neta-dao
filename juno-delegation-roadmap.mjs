// Interactive explanation only. No values from this module enter a policy or proposal.
const bonuses = [
  [
    'Public RPC / API',
    40,
    'Verified operator linkage, availability, freshness and latency; aliases earn no extra points.'
  ],
  [
    'Testnet participation',
    30,
    'Sustained, verifiable participation and useful results on the approved testnet.'
  ],
  ['Archive services', 20, 'Independent checks of access and historical coverage.'],
  [
    'Governance participation',
    10,
    'Own votes on completed proposals; every voting option counts equally.'
  ]
];
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
export function renderFuturePolicy(host, prefix) {
  const explorer = prefix === 'rules';
  const card = node('section', undefined, 'planner-card points-preview');
  const heading = node('div', undefined, 'policy-heading');
  heading.append(
    node('h3', 'Base & bonus points'),
    node('span', 'Planned · preview only', 'state-pill neutral')
  );
  card.append(
    heading,
    node(
      'p',
      'All mandatory checks must pass first. Every eligible validator then receives the same base; verified contributions can earn additional points.'
    )
  );
  const values = node('div', undefined, 'point-values');
  const base = node('div'),
    bonus = node('div');
  const baseValue = explorer ? node('input') : node('strong', '900'),
    bonusValue = node('strong', '100');
  if (explorer) {
    baseValue.type = 'number';
    baseValue.min = '0';
    baseValue.max = '1000';
    baseValue.step = '10';
    baseValue.value = '900';
    baseValue.className = 'base-points-entry';
    baseValue.setAttribute('aria-label', 'Base points per eligible validator · preview');
  }
  baseValue.id = `${prefix}-base-points`;
  bonusValue.id = `${prefix}-bonus-points`;
  base.append(baseValue, node('span', 'Base points · each eligible validator'));
  bonus.append(bonusValue, node('span', 'Maximum bonus · each validator'));
  values.append(base, bonus);
  card.append(values);
  const label = node('label', 'Explore the base / bonus balance');
  label.htmlFor = `${prefix}-points-balance`;
  const slider = node('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '1000';
  slider.step = '10';
  slider.value = '900';
  slider.id = label.htmlFor;
  const effect = node('p', undefined, 'field-help');
  effect.id = `${prefix}-points-effect`;
  slider.setAttribute('aria-describedby', effect.id);
  const update = () => {
    const b = Number(slider.value),
      w = 1000 - b;
    if (explorer) baseValue.value = String(b);
    else baseValue.textContent = String(b);
    bonusValue.textContent = String(w);
    slider.setAttribute('aria-valuetext', `${b} base points and up to ${w} bonus points`);
    effect.textContent =
      (b
        ? `Before caps, a full-bonus validator can receive up to ${(1000 / b).toLocaleString('en-US', { maximumFractionDigits: 2 })}× the points of a base-only validator. `
        : 'With no base, a validator with no verified bonus earns no points. If nobody earns points, the budget stays unallocated. ') +
      'Preview only: the current equal-allocation rules and proposal remain unchanged.';
  };
  slider.addEventListener('input', update);
  if (explorer)
    baseValue.addEventListener('input', () => {
      if (baseValue.value !== '' && baseValue.checkValidity()) {
        slider.value = baseValue.value;
        update();
      }
    });
  update();
  card.append(label, slider, effect);
  const details = node('details', undefined, 'policy-details');
  details.id = `${prefix}-bonus-details`;
  if (explorer) details.open = true;
  details.append(node('summary', 'Bonus criteria · illustrative weights'));
  const weights = [];
  const weightTotal = node('p', '', 'field-help');
  const updateWeights = () => {
    const total = weights.reduce((sum, item) => sum + Number(item.input.value || 0), 0);
    for (const item of weights)
      item.share.textContent = total
        ? `${Math.round((Number(item.input.value || 0) / total) * 100)}% of bonus`
        : 'Disabled';
    weightTotal.textContent = total
      ? 'Relative weights, normalized across enabled criteria. No production bonus measurements are connected.'
      : 'All bonus criteria are disabled in this exploration. No bonus could be earned.';
  };
  for (const [name, value, help] of bonuses) {
    const row = node('div', undefined, 'bonus-preview-row');
    if (explorer) {
      const label = node('div', undefined, 'criterion-label');
      const button = node('button', name, 'criterion-help');
      button.type = 'button';
      const tip = node('div', help, 'criterion-tooltip');
      tip.id = `${prefix}-bonus-help-${weights.length}`;
      tip.hidden = true;
      tip.setAttribute('role', 'tooltip');
      button.setAttribute('aria-controls', tip.id);
      button.setAttribute('aria-expanded', 'false');
      label.append(button, tip);
      const weight = node('input');
      weight.type = 'number';
      weight.min = '0';
      weight.max = '100';
      weight.step = '1';
      weight.value = String(value);
      weight.className = 'bonus-weight-input';
      weight.setAttribute('aria-label', `${name} relative weight · preview`);
      const share = node('small');
      const control = node('div', undefined, 'bonus-weight-control');
      control.append(weight, share);
      weights.push({ input: weight, share });
      weight.addEventListener('input', updateWeights);
      row.append(label, control);
    } else row.append(node('strong', name), node('span', `${value}%`), node('p', help));
    details.append(row);
  }
  if (explorer) {
    updateWeights();
    details.append(weightTotal);
  }
  details.append(
    node(
      'p',
      'Each criterion needs an approved measurement, observation window, reviewer and expiry. Unknown bonus evidence earns no verified points and remains labelled unknown. Bonus points never override a failed mandatory check.',
      'field-help'
    )
  );
  const methods = node('details', undefined, 'policy-details');
  methods.id = `${prefix}-points-details`;
  methods.append(node('summary', 'Points, budget shares & launch requirements'));
  methods.append(
    node(
      'p',
      'Points per validator = base + maximum bonus × verified contribution. Allocations follow each validator’s share of all earned points, subject to separately approved caps. 900 / 100 points does not reserve exactly 10% of the tokens for bonus.'
    )
  );
  methods.append(
    node(
      'p',
      'A fixed budget split would instead reserve a defined pool for bonus. It can concentrate that pool in a few recipients. This alternative is not the selected model.'
    )
  );
  methods.append(
    node(
      'p',
      'Before activation: approve evidence and scoring rules, prevent duplicate operator rewards, define appeals and transition periods, and validate the allocation and execution paths. Production bonus data is not connected yet.'
    )
  );
  card.append(details, methods);
  host.replaceChildren(card);
}
