import { policy } from './juno-delegation-core.mjs';
import { formatAmount } from './juno-delegation-view.mjs';
import { CRITERIA, criterionConfig } from './juno-criteria-policy.mjs';

const roles = ['unused', 'eligibility', 'bonus'];
const roleNames = {
  unused: 'Available criteria',
  eligibility: 'Eligibility',
  bonus: 'Bonus points'
};
const descriptions = {
  uptime: 'Signed blocks ÷ expected active-set slots. Uses our observed history, up to 90 days.',
  commission: 'The validator’s current commission rate. Lower rates can earn more points.',
  activeHistory: 'Continuous active-set membership over our available history, up to 90 days.',
  upgrade: 'Observed Juno v31 participation within five hours of the halt.',
  governance: 'Own accepted votes ÷ applicable completed proposals in our collected history.',
  rpc: 'Public RPC / API verification is not live.',
  testnet: 'Testnet participation verification is not live.',
  archive: 'Archive service verification is not live.'
};
const node = (tag, text, cls) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (cls) el.className = cls;
  return el;
};
const signature = (rule) => JSON.stringify([rule?.schema, rule?.criteria, rule?.points]);

export function criterionSummary(id, config) {
  if (!config || config.role === 'unused') return 'Unused';
  if (config.role === 'eligibility') {
    if (id === 'commission') return `Eligibility · at most ${config.maximumBps / 100}%`;
    if (id === 'activeHistory')
      return `Eligibility · observed history, up to ${config.windowDays} days`;
    if (id === 'upgrade') return 'Eligibility · v31 within 5 hours';
    return `Eligibility · at least ${config.minimumBps / 100}%`;
  }
  return config.zeroBps === undefined
    ? `Bonus · weight ${config.weight} · observed v31 participation`
    : `Bonus · weight ${config.weight} · 0 points at ${config.zeroBps / 100}%, full points at ${config.fullBps / 100}%`;
}

/** Keep controls that require schema 11 behind the actual-count conversion boundary. */
export function deferComposerControls({ getRule, mount, onPending }) {
  let controls = null;
  let resetRequested = false;
  function render() {
    const pending = getRule()?.schema !== 11;
    onPending(pending);
    if (pending) return;
    if (!controls) {
      controls = mount();
      resetRequested = false;
    } else if (resetRequested) {
      // A reset can be requested while legacy rules await a snapshot. Closing
      // the existing form must wait until its context supports that operation.
      resetRequested = false;
      controls.reset();
    } else controls.render();
  }
  return {
    render,
    isEditing: () => getRule()?.schema === 11 && !!controls?.isEditing(),
    reset: () => {
      resetRequested = true;
      render();
    }
  };
}

/** A local editor. Only a fully validated rule is passed to the calculation engine. */
export function mountRuleComposer(host, { getRule, onChange }) {
  let draft,
    source,
    valid = false,
    moving = null;
  const inputs = new Map();
  const notice = node('p', '', 'composer-notice');
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  const errors = node('p', '', 'composer-error');
  errors.id = 'composer-errors';
  errors.setAttribute('role', 'status');
  const board = node('div', undefined, 'composer-board');
  const impact = node('aside', undefined, 'composer-quick-impact');
  impact.setAttribute('aria-label', 'Current allocation estimate');
  function setImpact(model) {
    const result = model.result;
    impact.replaceChildren();
    for (const [label, value] of [
      ['Regular eligibility', result ? `${result.eligibleCount} / ${result.rows.length}` : '—'],
      ['Largest allocation', model.largest || '—'],
      ['Top-three share', model.topThree || '—'],
      [
        'Regular budget · JUNO',
        result ? formatAmount(result.regularBudgetRaw ?? result.budgetRaw) : '—'
      ]
    ]) {
      const item = node('div');
      item.append(node('span', label), node('strong', value));
      impact.append(item);
    }
    const note = node(
      'p',
      result
        ? model.historical
          ? 'Historical snapshot · refresh before publication.'
          : 'Current programme evidence · estimate updates as you edit.'
        : model.error || 'Loading programme evidence…'
    );
    impact.append(note);
  }
  const points = node('section', undefined, 'composer-points');
  const pointsHeading = node('div');
  pointsHeading.append(
    node('h3', 'Base & bonus points'),
    node('p', 'Every eligible validator earns base points. Bonus criteria can add the rest.')
  );
  const controls = node('div', undefined, 'composer-balance');
  const baseLabel = node('label', 'Base points');
  const base = node('input');
  base.id = 'rules-base-points';
  base.type = 'number';
  base.min = '0';
  base.max = '1000';
  base.step = '1';
  baseLabel.append(base);
  const sliderLabel = node('label', 'Base / bonus balance', 'composer-slider');
  const slider = node('input');
  slider.id = 'rules-points-balance';
  slider.type = 'range';
  slider.min = '0';
  slider.max = '1000';
  slider.step = '10';
  slider.setAttribute('aria-label', 'Base points out of 1000 total points');
  sliderLabel.append(slider);
  const bonusLabel = node('label', 'Maximum bonus');
  const bonus = node('input');
  bonus.id = 'rules-bonus-points';
  bonus.type = 'number';
  bonus.min = '0';
  bonus.max = '1000';
  bonus.step = '1';
  bonusLabel.append(bonus);
  controls.append(baseLabel, sliderLabel, bonusLabel);
  points.append(
    pointsHeading,
    controls,
    node(
      'p',
      'This divides points, not the JUNO budget. Fixed allocations are reserved first; the remaining budget follows each eligible validator’s total points.',
      'composer-points-note'
    )
  );
  const zones = new Map();
  for (const role of roles) {
    const column = node('section', undefined, `composer-column composer-${role}`);
    const heading = node('header');
    const count = node('span', '', 'composer-count');
    count.dataset.count = role;
    const title = node('h3', roleNames[role]);
    title.append(count);
    heading.append(
      title,
      node(
        'p',
        role === 'unused'
          ? 'Drag a criterion into a role, or use Move to.'
          : role === 'eligibility'
            ? 'All selected requirements must pass.'
            : 'Below a threshold earns zero points, without excluding.'
      )
    );
    const zone = node('div', undefined, 'composer-dropzone');
    zone.dataset.role = role;
    zone.setAttribute('aria-label', roleNames[role]);
    zone.addEventListener('dragover', (event) => {
      if (canMove(moving, role)) {
        event.preventDefault();
        zone.classList.add('drag-over');
      }
    });
    zone.addEventListener('dragleave', (event) => {
      if (!zone.contains(event.relatedTarget)) zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      move(moving, role);
    });
    column.append(heading, zone);
    if (role === 'eligibility')
      column.append(
        node(
          'p',
          'Always required: not jailed. Manual exclusions also apply to regular allocations.',
          'composer-locked'
        )
      );
    if (role === 'bonus')
      column.append(
        node(
          'p',
          'No applicable governance proposals earns 0 governance bonus; its weight stays assigned. Missing selected observations block the estimate. Move a criterion to Available criteria to stop requiring its evidence.',
          'composer-footnote'
        )
      );
    zones.set(role, zone);
    board.append(column);
  }
  host.replaceChildren(points, impact, errors, board, notice);
  setImpact({});
  function canMove(id, role) {
    return !!draft && CRITERIA.find((c) => c.id === id)?.roles.includes(role);
  }
  function clearDrag() {
    moving = null;
    board
      .querySelectorAll('.drag-over, .is-dragging')
      .forEach((n) => n.classList.remove('drag-over', 'is-dragging'));
  }
  function restoreRoleSelection(id) {
    const selected = host.querySelector(`[data-move="${id}"]`);
    if (selected && draft?.criteria[id]) selected.value = draft.criteria[id].role;
  }
  function move(id, role) {
    if (!canMove(id, role) || draft.criteria[id].role === role) {
      clearDrag();
      restoreRoleSelection(id);
      return;
    }
    if (!readInputs()) {
      clearDrag();
      // A native select changes before its event runs. Restore only its role;
      // rebuilding the card would discard the invalid text the user is editing.
      restoreRoleSelection(id);
      notice.textContent = 'Correct the highlighted values before moving a criterion.';
      return;
    }
    const old = draft.criteria[id];
    const next = criterionConfig(id, role);
    if (
      role === 'bonus' &&
      Object.entries(draft.criteria).some(
        ([key, value]) => key !== id && value.role === 'bonus' && value.weight > 0
      )
    )
      next.weight = 0;
    draft.criteria[id] = next;
    clearDrag();
    renderCards();
    commit();
    notice.textContent = `${CRITERIA.find((c) => c.id === id).label} moved from ${roleNames[old.role]} to ${roleNames[role]}. ${role === 'bonus' ? 'Set its weight and scoring threshold.' : ''}`;
    host.querySelector(`[data-move="${id}"]`)?.focus({ preventScroll: true });
  }
  function numeric(card, id, config, field, label, percent = true) {
    const line = node('label', label);
    const input = node('input');
    input.type = 'number';
    input.min = '0';
    input.max = '100';
    input.step = percent ? '0.01' : '1';
    input.value = String(config[field] / (percent ? 100 : 1));
    input.id = `criterion-${id}-${field}`;
    input.setAttribute('aria-label', `${CRITERIA.find((c) => c.id === id).label}: ${label}`);
    input.setAttribute('aria-describedby', errors.id);
    inputs.set(`${id}:${field}`, { input, id, field, percent });
    input.addEventListener('input', commit);
    line.append(input, node('span', percent ? '%' : '', 'composer-unit'));
    card.append(line);
  }
  function renderCards() {
    inputs.clear();
    for (const zone of zones.values()) zone.replaceChildren();
    for (const criterion of CRITERIA) {
      const { id, label, available } = criterion;
      const config = draft.criteria[id];
      const card = node('article', undefined, 'composer-criterion');
      card.dataset.criterion = id;
      const header = node('div', undefined, 'composer-card-heading');
      const handle = node('button', '⠿', 'composer-handle');
      handle.type = 'button';
      handle.draggable = available;
      handle.disabled = !available;
      handle.setAttribute(
        'aria-label',
        `Move ${label}. Use arrow keys to change role, or use Move to.`
      );
      handle.addEventListener('dragstart', (event) => {
        moving = id;
        event.dataTransfer.setData('text/plain', id);
        event.dataTransfer.effectAllowed = 'move';
        card.classList.add('is-dragging');
      });
      handle.addEventListener('dragend', clearDrag);
      handle.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const allowed = roles.filter((r) => criterion.roles.includes(r));
        const index = allowed.indexOf(config.role);
        move(
          id,
          allowed[(index + (event.key === 'ArrowRight' ? 1 : allowed.length - 1)) % allowed.length]
        );
      });
      handle.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse') return;
        moving = id;
        handle.setPointerCapture(event.pointerId);
        card.classList.add('is-dragging');
      });
      handle.addEventListener('pointermove', (event) => {
        if (moving !== id || event.pointerType === 'mouse') return;
        for (const zone of zones.values()) zone.classList.remove('drag-over');
        const zone = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest('[data-role]');
        if (zone && canMove(id, zone.dataset.role)) zone.classList.add('drag-over');
      });
      handle.addEventListener('pointerup', (event) => {
        if (moving !== id || event.pointerType === 'mouse') return;
        const zone = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest('[data-role]');
        if (zone) move(id, zone.dataset.role);
        else clearDrag();
      });
      handle.addEventListener('pointercancel', clearDrag);
      const name = node('div');
      name.append(
        node('h4', label),
        node('small', available ? 'Collected programme evidence' : 'Not live')
      );
      header.append(handle, name);
      card.append(header, node('p', descriptions[id], 'composer-description'));
      const fields = node('div', undefined, 'composer-fields');
      if (config.role === 'eligibility') {
        if (id === 'commission') numeric(fields, id, config, 'maximumBps', 'Maximum commission');
        else if (['uptime', 'governance'].includes(id))
          numeric(fields, id, config, 'minimumBps', 'Minimum participation');
        else
          fields.append(
            node(
              'p',
              id === 'upgrade' ? 'v31 · within 5 hours' : 'Available history · up to 90 days',
              'composer-scale'
            )
          );
      }
      if (config.role === 'bonus') {
        numeric(fields, id, config, 'weight', 'Bonus weight', false);
        const share = node('p', '', 'composer-weight-share');
        share.dataset.weightShare = id;
        fields.append(share);
        if (config.zeroBps !== undefined) {
          numeric(fields, id, config, 'zeroBps', 'Zero points at');
          numeric(fields, id, config, 'fullBps', 'Full points at');
          fields.append(
            node(
              'p',
              id === 'commission'
                ? 'Linear reward for lower commission, up to the full-points threshold.'
                : 'Linear reward above the starting threshold, up to full points.',
              'composer-scale'
            )
          );
        } else
          fields.append(
            node(
              'p',
              'Full criterion points for an observed participation; otherwise zero.',
              'composer-scale'
            )
          );
      }
      card.append(fields);
      const moveLabel = node('label', 'Move to', 'composer-move');
      const select = node('select');
      select.dataset.move = id;
      select.disabled = !available;
      select.setAttribute('aria-label', `Role for ${label}`);
      for (const role of roles.filter((r) => criterion.roles.includes(r))) {
        const option = node('option', roleNames[role]);
        option.value = role;
        select.append(option);
      }
      select.value = config.role;
      select.addEventListener('change', () => move(id, select.value));
      moveLabel.append(select);
      card.append(moveLabel);
      zones.get(config.role).append(card);
    }
    for (const [role, zone] of zones) {
      host.querySelector(`[data-count="${role}"]`).textContent = ` ${zone.children.length}`;
      if (!zone.children.length)
        zone.append(
          node(
            'p',
            role === 'unused' ? 'All available criteria are assigned.' : 'Drop a criterion here',
            'composer-empty'
          )
        );
    }
  }
  function readInputs() {
    let okay = true;
    for (const { input, id, field, percent } of inputs.values()) {
      const good = input.value !== '' && input.checkValidity();
      input.setAttribute('aria-invalid', String(!good));
      if (good) draft.criteria[id][field] = Math.round(Number(input.value) * (percent ? 100 : 1));
      else okay = false;
    }
    const goodBase = base.value !== '' && base.checkValidity();
    base.setAttribute('aria-invalid', String(!goodBase));
    if (goodBase) draft.points.base = Number(base.value);
    else okay = false;
    const goodBonus = bonus.value !== '' && bonus.checkValidity();
    bonus.setAttribute('aria-invalid', String(!goodBonus));
    return okay && goodBonus;
  }
  function commit() {
    if (!draft) return;
    valid = false;
    let next;
    try {
      if (!readInputs() || !bonus.checkValidity() || bonus.value === '')
        throw Error('Enter valid point and percentage values in the highlighted fields.');
      for (const criterion of CRITERIA) {
        const config = draft.criteria[criterion.id];
        if (config.role !== 'bonus' || config.zeroBps === undefined) continue;
        const decreasing = criterion.direction === 'decreasing';
        if (decreasing ? config.fullBps >= config.zeroBps : config.fullBps <= config.zeroBps) {
          inputs.get(`${criterion.id}:fullBps`).input.setAttribute('aria-invalid', 'true');
          throw Error(
            `${criterion.label}: the full-points threshold must be ${decreasing ? 'below' : 'above'} the zero-points threshold.`
          );
        }
      }
      next = policy({ ...getRule(), criteria: draft.criteria, points: draft.points });
      valid = true;
      source = signature(next);
      errors.textContent = '';
      errors.hidden = true;
    } catch (error) {
      errors.textContent = error.message;
      errors.hidden = false;
    }
    const totalWeight = Object.values(draft.criteria).reduce(
      (sum, c) => sum + (c.role === 'bonus' ? c.weight : 0),
      0
    );
    host.querySelectorAll('[data-weight-share]').forEach((el) => {
      const weight = draft.criteria[el.dataset.weightShare].weight;
      el.textContent = `${totalWeight ? ((weight * 100) / totalWeight).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0'}% of the maximum bonus · weights are relative`;
    });
    onChange(next || null);
  }
  function updateBalance(from) {
    if (from === slider) base.value = slider.value;
    else if (from === bonus && bonus.value !== '' && bonus.checkValidity())
      base.value = String(1000 - Number(bonus.value));
    if (base.value !== '' && base.checkValidity()) {
      slider.value = base.value;
      if (from !== bonus) bonus.value = String(1000 - Number(base.value));
    }
    bonus.setAttribute('aria-invalid', String(bonus.value === '' || !bonus.checkValidity()));
    commit();
  }
  for (const control of [base, bonus, slider])
    control.addEventListener('input', () => updateBalance(control));
  function render(force = false) {
    const rule = getRule();
    if (rule?.schema !== 11) {
      valid = false;
      source = undefined;
      draft = null;
      board.hidden = true;
      points.hidden = true;
      errors.hidden = true;
      errors.textContent = '';
      notice.textContent =
        'Loading the validator count to preserve the saved relative cap before opening this draft.';
      return;
    }
    if (!force && source === signature(rule)) return;
    source = signature(rule);
    draft = structuredClone(rule);
    valid = true;
    board.hidden = false;
    points.hidden = false;
    base.value = String(draft.points.base);
    slider.value = base.value;
    bonus.value = String(1000 - draft.points.base);
    errors.hidden = true;
    errors.textContent = '';
    notice.textContent = 'Each criterion has one role. Changing a role needs a new rule approval.';
    renderCards();
    const totalWeight = Object.values(draft.criteria).reduce(
      (sum, c) => sum + (c.role === 'bonus' ? c.weight : 0),
      0
    );
    host.querySelectorAll('[data-weight-share]').forEach((el) => {
      el.textContent = `${totalWeight ? ((draft.criteria[el.dataset.weightShare].weight * 100) / totalWeight).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0'}% of the maximum bonus · weights are relative`;
    });
  }
  render();
  return {
    render,
    setImpact,
    reset: () => render(true),
    valid: () => valid,
    focusInvalid: () => (host.querySelector('[aria-invalid="true"]') || base).focus()
  };
}
