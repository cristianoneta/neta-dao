import {
  accountingOptions,
  accountingType,
  categoriesFor,
  categoryRecords,
  isSpend
} from '../../proposal-accounting.mjs';
import { isCommunityPoolSpend } from '../../juno-community-pool-proposal.mjs';
import { payloadParts, validateProposalContent, DELIVERABLE_TYPE } from './proposal-content.mjs';
export function proposalEditor({
  $,
  node,
  isPlannerGovernance,
  isNativeReview,
  renderFrozenValues
}) {
  let deliverables = [],
    accountingRecords = [];
  function renderDeliverables() {
    const list = $('#deliverable-list');
    list.replaceChildren();
    deliverables.forEach((item, index) => {
      const row = node('div', 'deliverable-row'),
        field = (label, key, type = 'text') => {
          const wrap = node('label', key === 'evidence' ? 'deliverable-evidence' : null, label),
            input = node('input');
          input.type = type;
          input.value = item[key] || '';
          input.maxLength = key === 'evidence' ? 500 : 160;
          input.dataset.deliverableField = key;
          input.oninput = () => (item[key] = input.value);
          wrap.append(input);
          return wrap;
        },
        remove = node('button', null, 'REMOVE');
      remove.type = 'button';
      remove.dataset.removeDeliverable = String(index);
      remove.onclick = () => {
        deliverables.splice(index, 1);
        renderDeliverables();
      };
      row.append(
        field('MILESTONE / DELIVERABLE', 'title'),
        field('DEADLINE', 'due_date', 'date'),
        field('RESPONSIBLE', 'owner'),
        field('CONFIRMED BY', 'verifier'),
        remove,
        field('EXPECTED RESULT / EVIDENCE', 'evidence')
      );
      list.append(row);
    });
    if (!deliverables.length)
      list.append(node('div', 'deliverable-empty', 'NO DELIVERABLES DEFINED · OPTIONAL'));
  }
  function renderAccounting() {
    const list = $('#proposal-accounting');
    list.replaceChildren();
    if (isPlannerGovernance()) return;
    if (isNativeReview()) {
      try {
        if (isCommunityPoolSpend(JSON.parse($('#proposal-actions').value))) return;
      } catch {}
    }
    let actions;
    try {
      actions = payloadParts($('#proposal-actions').value).actions;
    } catch {
      list.append(node('p', null, 'Enter valid action JSON to choose spending categories.'));
      return;
    }
    if (!actions.length) {
      list.append(node('p', null, 'Add an action to assign its spending category.'));
      return;
    }
    const categories = categoriesFor(actions, accountingRecords);
    actions.forEach((action, index) => {
      const label = node('label'),
        title = node(
          'span',
          null,
          `Action ${index + 1} · ${isSpend(action) ? 'Spending category (required)' : 'Spending category (if applicable)'}`
        ),
        select = node('select');
      select.dataset.accountingAction = String(index);
      select.setAttribute('aria-label', `Action ${index + 1} spending category`);
      select.disabled = $('#proposal-actions').disabled;
      const empty = node('option', null, 'Select category…');
      empty.value = '';
      select.append(empty);
      accountingOptions.forEach((account) => {
        const option = node('option', null, account.label);
        option.value = account.id;
        select.append(option);
      });
      select.value = categories[index];
      select.onchange = () => {
        categories[index] = select.value;
        accountingRecords = categoryRecords(actions, categories);
      };
      label.append(title, select);
      list.append(label);
    });
  }
  function values() {
    const raw = $('#proposal-actions').value.trim() || '[]';
    let actions;
    try {
      actions = payloadParts(raw).actions;
    } catch {
      return {
        title: $('#proposal-title').value.trim(),
        summary: $('#proposal-summary').value.trim(),
        body: $('#proposal-body').value.trim(),
        actions_json: raw
      };
    }
    const deliverables = deliverables.map((item) => ({
      type: DELIVERABLE_TYPE,
      title: (item.title || '').trim(),
      due_date: (item.due_date || '').trim(),
      owner: (item.owner || '').trim(),
      verifier: (item.verifier || '').trim(),
      evidence: (item.evidence || '').trim()
    }));
    return {
      title: $('#proposal-title').value.trim(),
      summary: $('#proposal-summary').value.trim(),
      body: $('#proposal-body').value.trim(),
      actions_json: JSON.stringify(
        [
          ...actions,
          ...deliverables,
          ...(accountingRecords.length
            ? [
                {
                  type: accountingType,
                  allocations: categoryRecords(actions, categoriesFor(actions, accountingRecords))
                }
              ]
            : [])
        ],
        null,
        2
      )
    };
  }
  function setValues(v = {}) {
    void renderFrozenValues(v);
    $('#proposal-title').value = v.title || '';
    $('#proposal-summary').value = v.summary || '';
    $('#proposal-body').value = v.body || '';
    try {
      const parts = payloadParts(v.actions_json || '[]');
      $('#proposal-actions').value = JSON.stringify(parts.actions, null, 2);
      deliverables = parts.deliverables;
      accountingRecords = parts.accounting;
    } catch {
      $('#proposal-actions').value = v.actions_json || '[]';
      deliverables = [];
      accountingRecords = [];
    }
    renderDeliverables();
    renderAccounting();
  }

  return {
    values,
    setValues,
    renderAccounting,
    renderDeliverables,
    validate: (value) => validateProposalContent(value, { native: isNativeReview() }),
    addDeliverable(owner = '') {
      deliverables.push({ title: '', due_date: '', owner, verifier: '', evidence: '' });
      renderDeliverables();
    }
  };
}
