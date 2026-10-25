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
  const card = node('section', undefined, 'planner-card points-preview');
  const heading = node('div', undefined, 'policy-heading');
  heading.append(
    node('h3', 'A shared base. A bonus for useful work.'),
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
  const baseValue = node('strong', '900'),
    bonusValue = node('strong', '100');
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
    baseValue.textContent = String(b);
    bonusValue.textContent = String(w);
    slider.setAttribute('aria-valuetext', `${b} base points and up to ${w} bonus points`);
    effect.textContent =
      (b
        ? `Before caps, a full-bonus validator can receive up to ${(1000 / b).toLocaleString('en-US', { maximumFractionDigits: 2 })}× the points of a base-only validator. `
        : 'With no base, a validator with no verified bonus earns no points. If nobody earns points, the budget stays unallocated. ') +
      'Preview only: the current equal-allocation rules and proposal remain unchanged.';
  };
  slider.addEventListener('input', update);
  update();
  card.append(label, slider, effect);
  const details = node('details', undefined, 'policy-details');
  details.id = `${prefix}-bonus-details`;
  details.append(node('summary', 'Bonus criteria · illustrative weights'));
  for (const [name, value, help] of bonuses) {
    const row = node('div', undefined, 'bonus-preview-row');
    row.append(node('strong', name), node('span', `${value}%`), node('p', help));
    details.append(row);
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
