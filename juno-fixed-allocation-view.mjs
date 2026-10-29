import { amount, units, policy } from './juno-delegation-core.mjs';
import { formatAmount } from './juno-delegation-view.mjs';
import { fixedStatus } from './juno-fixed-allocations.mjs';
const el = (tag, text = '', cls = '') => {
  const node = document.createElement(tag);
  node.textContent = text;
  if (cls) node.className = cls;
  return node;
};
export function allocationBreakdown(row) {
  return `${formatAmount(row.regularRaw || '0')} regular + ${formatAmount(row.fixedRaw || '0')} fixed`;
}
export function budgetBreakdown(result) {
  return `${formatAmount(result.budgetRaw)} total · ${formatAmount(result.fixedRaw || '0')} fixed · ${formatAmount(result.regularBudgetRaw || result.budgetRaw)} regular budget · ${formatAmount(result.unallocatedRaw)} unallocated · JUNO`;
}
export function appendFixedDetails(host, entry) {
  host.append(
    el('p', `Exact fixed target: ${formatAmount(entry.amountRaw, true)} JUNO`),
    el('p', `${entry.startDate} – ${entry.endDate} · UTC dates, inclusive`),
    el('p', entry.purpose)
  );
  if (entry.documentation) {
    const link = el('a', 'Supporting documentation ↗');
    link.href = entry.documentation;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    host.append(link);
  }
}
export function renderFixedMandates(host, rule, snapshot) {
  host.replaceChildren();
  const entries = rule.fixedAllocations || [];
  if (!entries.length) return;
  host.append(
    el('h3', 'Fixed allocations'),
    el(
      'p',
      'Only the fixed portion bypasses regular eligibility and the voting-power cap. It counts toward actual stake. Periods affect new calculations; expiry does not move existing delegations.',
      'field-help'
    )
  );
  for (const entry of entries) {
    const details = el('details', '', 'fixed-mandate');
    const name =
      snapshot?.validators.find((v) => v.address === entry.validator)?.name || entry.validator;
    details.append(
      el(
        'summary',
        `${name} · ${formatAmount(entry.amountRaw)} JUNO · ${snapshot ? fixedStatus(entry, snapshot.blockTime) : 'Period specified'}`
      )
    );
    details.append(el('small', entry.validator, 'fixed-address'));
    appendFixedDetails(details, entry);
    host.append(details);
  }
}
export function mountFixedAllocations(host, { getContext, onChange, onEditing }) {
  const heading = el('div', '', 'fixed-heading'),
    list = el('div'),
    editor = el('form', '', 'fixed-editor');
  const add = el('button', 'Add allocation'),
    feedback = el('p', '', 'field-help');
  add.type = 'button';
  heading.append(el('h3', 'Fixed allocations'), add);
  feedback.setAttribute('role', 'status');
  host.append(
    heading,
    el(
      'p',
      'Reserve fixed JUNO amounts first. These amounts bypass regular eligibility and the voting-power cap. Regular rules apply to the remaining budget.',
      'field-help'
    ),
    list,
    editor,
    feedback
  );
  editor.hidden = true;
  editor.noValidate = true;
  const inputs = {};
  for (const [key, title, tag, type, limit] of [
    ['validator', 'Validator', 'input', 'text', 200],
    ['amount', 'Fixed amount · JUNO', 'input', 'text', 30],
    ['purpose', 'Obligations, acceptance criteria & reviewer', 'textarea', '', 1200],
    ['startDate', 'Starts · UTC date', 'input', 'date'],
    ['endDate', 'Ends · UTC date, inclusive', 'input', 'date'],
    ['documentation', 'Supporting documentation · HTTPS link (optional)', 'input', 'url', 1000]
  ]) {
    const label = el('label', title),
      input = el(tag);
    input.id = 'fixed-' + key;
    input.name = key;
    label.htmlFor = input.id;
    if (type) input.type = type;
    if (limit) input.maxLength = limit;
    input.required = key !== 'documentation';
    if (key === 'validator') input.setAttribute('list', 'validator-options');
    if (key === 'amount') input.inputMode = 'decimal';
    if (key === 'purpose') input.rows = 4;
    inputs[key] = input;
    label.append(input);
    editor.append(label);
  }
  editor.append(
    el(
      'p',
      'Include the essential obligations here: this text is frozen in the proposal. A link can change later. No funds move when you save a draft.',
      'field-help'
    )
  );
  const actions = el('div', '', 'fixed-actions'),
    save = el('button', 'Apply allocation'),
    cancel = el('button', 'Cancel');
  save.type = 'submit';
  cancel.type = 'button';
  actions.append(save, cancel);
  editor.append(actions);
  let editing = null,
    pending = false,
    undo = null;
  const message = (text, error = false) => {
    feedback.textContent = text;
    feedback.dataset.tone = error ? 'error' : 'info';
  };
  function close() {
    pending = false;
    editing = null;
    editor.hidden = true;
    add.hidden = false;
    editor.reset();
    onEditing(false);
  }
  function open(entry = null) {
    pending = true;
    editing = entry?.validator || null;
    editor.hidden = false;
    add.hidden = true;
    editor.reset();
    for (const key of Object.keys(inputs))
      inputs[key].value =
        key === 'amount' ? (entry ? units(BigInt(entry.amountRaw)) : '') : entry?.[key] || '';
    save.textContent = entry ? 'Apply changes' : 'Apply allocation';
    message('Editing · apply or cancel before reviewing or saving the rule draft.');
    onEditing(true);
    render();
    inputs.validator.focus();
  }
  function render() {
    const { rule, snapshot } = getContext();
    list.replaceChildren();
    if (!rule.fixedAllocations.length)
      list.append(
        el('p', 'No fixed allocations. The whole budget follows the regular rules.', 'field-help')
      );
    for (const entry of rule.fixedAllocations) {
      const row = el('div', '', 'fixed-mandate');
      const name =
        snapshot?.validators.find((v) => v.address === entry.validator)?.name || entry.validator;
      row.append(el('strong', name), el('span', `${formatAmount(entry.amountRaw)} JUNO`));
      row.append(
        el(
          'small',
          `${entry.startDate} – ${entry.endDate}${snapshot ? ' · ' + fixedStatus(entry, snapshot.blockTime) : ''}`
        )
      );
      const details = el('details');
      details.append(
        el('summary', 'Obligations & documentation'),
        el('small', entry.validator, 'fixed-address')
      );
      appendFixedDetails(details, entry);
      row.append(details);
      const buttons = el('div', '', 'fixed-actions'),
        edit = el('button', 'Edit'),
        remove = el('button', 'Remove');
      edit.type = remove.type = 'button';
      edit.disabled = remove.disabled = pending;
      edit.onclick = () => open(entry);
      remove.onclick = () => {
        undo = entry;
        onChange(
          policy({
            ...rule,
            fixedAllocations: rule.fixedAllocations.filter((a) => a.validator !== entry.validator)
          })
        );
        message('Allocation removed from this draft. Existing delegations are unchanged.');
        const restore = el('button', 'Undo');
        restore.type = 'button';
        restore.onclick = () => {
          try {
            const { rule: current } = getContext();
            onChange(policy({ ...current, fixedAllocations: [...current.fixedAllocations, undo] }));
            undo = null;
            message('Allocation restored.');
          } catch (error) {
            message(error.message, true);
          }
        };
        feedback.append(' ', restore);
      };
      buttons.append(edit, remove);
      row.append(buttons);
      list.append(row);
    }
  }
  editor.onsubmit = (event) => {
    event.preventDefault();
    try {
      if (!editor.reportValidity()) return;
      const { rule, snapshot } = getContext();
      if (!snapshot) throw Error('Load the validator snapshot before adding an allocation.');
      const query = inputs.validator.value.trim();
      const matches = snapshot.validators.filter(
        (v) => v.address === query || v.name.toLowerCase() === query.toLowerCase()
      );
      if (matches.length !== 1)
        throw Error('Choose one known validator by its exact operator address.');
      const entry = {
        chainId: 'juno-1',
        validator: matches[0].address,
        amountRaw: amount(inputs.amount.value.trim()).toString(),
        purpose: inputs.purpose.value,
        startDate: inputs.startDate.value,
        endDate: inputs.endDate.value,
        documentation: inputs.documentation.value
      };
      const next = policy({
        ...rule,
        fixedAllocations: [...rule.fixedAllocations.filter((a) => a.validator !== editing), entry]
      });
      close();
      onChange(next);
      message(
        'Added to the rule draft. Save rules to keep it on this device; governance approval is still required.'
      );
      add.focus();
    } catch (error) {
      message(error.message, true);
    }
  };
  add.onclick = () => open();
  cancel.onclick = () => {
    close();
    render();
    message('Edit cancelled.');
    add.focus();
  };
  render();
  return {
    render,
    isEditing: () => pending,
    reset: () => {
      close();
      render();
      message('');
    }
  };
}
