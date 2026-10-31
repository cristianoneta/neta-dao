import { defaultPoints } from './juno-governance-points.mjs';
const criteria = [
  [
    'governance',
    'Governance participation',
    'Own accepted votes ÷ applicable completed proposals. Yes, No, Abstain, veto and weighted votes count equally; repeat votes count once.'
  ],
  ['rpc', 'Public RPC / API (not live)', 'Operator linkage, availability, freshness and latency.'],
  ['testnet', 'Testnet participation (not live)', 'Verified testnet participation.'],
  ['archive', 'Archive services (not live)', 'Verified access and historical coverage.']
];
const node = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
export function renderFuturePolicy(
  host,
  prefix,
  { getRule = () => null, onChange = () => {} } = {}
) {
  const editable = prefix === 'rules',
    card = node('section', undefined, 'planner-card points-preview');
  const heading = node('div', undefined, 'policy-heading'),
    state = node('span', '', 'state-pill neutral');
  heading.append(node('h3', 'Base & bonus points'), state);
  card.append(
    heading,
    node(
      'p',
      'Fixed commitments are reserved first. Eligible validators share the remaining budget in proportion to their points, within the voting-power cap.'
    )
  );
  const values = node('div', undefined, 'point-values'),
    baseGroup = node('div'),
    bonusGroup = node('div');
  const base = node(editable ? 'input' : 'strong'),
    bonus = node('strong');
  base.id = `${prefix}-base-points`;
  bonus.id = `${prefix}-bonus-points`;
  if (editable) {
    base.type = 'number';
    base.min = '0';
    base.max = '1000';
    base.step = '10';
    base.className = 'base-points-entry';
    base.setAttribute('aria-label', 'Base points per eligible validator');
  }
  baseGroup.append(base, node('span', 'Base points · each eligible validator'));
  bonusGroup.append(bonus, node('span', 'Maximum bonus · each validator'));
  values.append(baseGroup, bonusGroup);
  card.append(values);
  const label = node('label', 'Base / bonus balance'),
    slider = node('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '1000';
  slider.step = '10';
  slider.disabled = !editable;
  slider.id = `${prefix}-points-balance`;
  label.htmlFor = slider.id;
  const effect = node('p', '', 'field-help');
  effect.id = `${prefix}-points-effect`;
  slider.setAttribute('aria-describedby', effect.id);
  card.append(label, slider, effect);
  const details = node('details', undefined, 'policy-details');
  details.id = `${prefix}-bonus-details`;
  details.open = editable;
  details.append(node('summary', 'Bonus criteria'));
  const controls = [];
  for (const [key, name, help] of criteria) {
    const row = node('div', undefined, 'bonus-preview-row'),
      label = node('div', undefined, 'criterion-label'),
      button = node('button', name, 'criterion-help');
    button.type = 'button';
    const tip = node('div', help, 'criterion-tooltip');
    tip.id = `${prefix}-bonus-help-${controls.length}`;
    tip.hidden = true;
    tip.setAttribute('role', 'tooltip');
    button.setAttribute('aria-controls', tip.id);
    button.setAttribute('aria-expanded', 'false');
    label.append(button, tip);
    const input = node('input');
    input.type = 'number';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    input.disabled = !editable || key !== 'governance';
    input.className = 'bonus-weight-input';
    input.setAttribute('aria-label', `${name} relative weight`);
    const share = node('small'),
      control = node('div', undefined, 'bonus-weight-control');
    control.append(input, share);
    row.append(label, control);
    details.append(row);
    controls.push({ key, input, share });
    input.oninput = () => commit();
  }
  const validation = node('p', '', 'field-help');
  validation.setAttribute('role', 'status');
  details.append(validation);
  const methods = node('details', undefined, 'policy-details');
  methods.id = `${prefix}-points-details`;
  methods.append(
    node('summary', 'How participation becomes points'),
    node(
      'p',
      'Points = base + maximum bonus × sum of normalized criterion weight × verified contribution. A 900/100 balance does not reserve 10% of tokens for bonus.'
    ),
    node(
      'p',
      'Use completed voting periods fully captured in our own continuous history: the last 90 days, extended toward ten proposals within 180 available days. A smaller sample is valid. Proposals starting before a validator’s first observed active-set entry do not count against it.'
    ),
    node(
      'p',
      'No completed proposals means no verified governance bonus, not a 0% participation rate. Missing or corrupt evidence blocks a new points-based review. Frozen reviews and approved rules never change automatically.'
    )
  );
  card.append(details, methods);
  host.replaceChildren(card);
  const valid = () =>
    !editable ||
    (base.value !== '' &&
      base.checkValidity() &&
      controls.every((c) => c.input.value !== '' && c.input.checkValidity()));
  function explain() {
    if (!valid()) {
      validation.textContent =
        'Enter base points from 0 to 1,000 in steps of 10 and whole-number weights from 0 to 100.';
      return;
    }
    const b = Number(slider.value),
      total = controls.reduce((n, c) => n + Number(c.input.value), 0);
    bonus.textContent = String(1000 - b);
    slider.setAttribute('aria-valuetext', `${b} base points and up to ${1000 - b} bonus points`);
    for (const c of controls)
      c.share.textContent = total
        ? `${Math.round((Number(c.input.value) * 100) / total)}% of bonus`
        : 'Disabled';
    validation.textContent = total
      ? 'Weights divide the available bonus points. Zero disables a criterion.'
      : 'All bonus criteria disabled; only configured base points can be earned.';
    effect.textContent = b
      ? `A full-bonus validator earns up to ${(1000 / b).toLocaleString('en-US', { maximumFractionDigits: 2 })}× the points of a base-only validator before caps.`
      : 'With no base, validators without verified bonus earn no points. If nobody earns points, the regular budget stays unallocated.';
  }
  function commit() {
    explain();
    if (valid())
      onChange({
        base: Number(base.value),
        weights: Object.fromEntries(controls.map((c) => [c.key, Number(c.input.value)]))
      });
    else onChange(null);
  }
  base.oninput = () => {
    if (base.value !== '' && base.checkValidity()) slider.value = base.value;
    commit();
  };
  slider.oninput = () => {
    base.value = slider.value;
    commit();
  };
  const render = () => {
    const rule = getRule(),
      config = rule?.points || defaultPoints();
    state.textContent = editable
      ? 'Proposed rules · unapproved'
      : rule?.points
        ? 'Approved points model'
        : rule
          ? 'Approved rule uses equal allocation'
          : 'Awaiting first rule approval';
    if (editable) base.value = String(config.base);
    else base.textContent = rule?.points ? String(config.base) : '—';
    slider.value = String(config.base);
    for (const c of controls) c.input.value = String(config.weights[c.key]);
    explain();
    if (!editable && !rule?.points) {
      bonus.textContent = '—';
      effect.textContent =
        'No approved points model. Proposed settings belong to the Distribution draft.';
    }
  };
  render();
  return { render, valid };
}
