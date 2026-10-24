import test from 'node:test';
import assert from 'node:assert/strict';
import { proposalEditor } from '../src/governance/proposal-editor.mjs';
import { payloadParts, DELIVERABLE_TYPE } from '../src/governance/proposal-content.mjs';

test('editor round-trips proposal actions and edited deliverables without leaking across drafts', () => {
  const element = () => ({
    value: '',
    dataset: {},
    children: [],
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this.children = children;
    },
    setAttribute() {}
  });
  const fields = new Map();
  const $ = (id) => {
    if (!fields.has(id)) fields.set(id, element());
    return fields.get(id);
  };
  const editor = proposalEditor({
    $,
    node: element,
    isPlannerGovernance: () => true,
    isNativeReview: () => true,
    renderFrozenValues() {}
  });
  const action = { type: 'wasm_execute', contract: 'reviewed-contract', msg: { run: {} } };
  const deliverable = {
    type: DELIVERABLE_TYPE,
    title: 'Milestone',
    due_date: '2026-11-01',
    owner: 'author',
    verifier: 'reviewer',
    evidence: 'Report'
  };
  editor.setValues({
    title: ' Proposal ',
    summary: ' Summary ',
    body: ' Body ',
    actions_json: JSON.stringify([action, deliverable])
  });
  assert.deepEqual(JSON.parse(editor.values().actions_json), [action, deliverable]);
  assert.equal(editor.values().title, 'Proposal');
  const titleInput = $('#deliverable-list').children[0].children[0].children[0];
  titleInput.value = ' Edited milestone ';
  titleInput.oninput();
  assert.equal(
    payloadParts(editor.values().actions_json).deliverables[0].title,
    'Edited milestone'
  );
  assert.deepEqual(payloadParts(editor.values().actions_json).actions, [action]);
  editor.setValues({ title: 'Fresh draft', actions_json: '[]' });
  assert.deepEqual(JSON.parse(editor.values().actions_json), []);
  editor.addDeliverable('new author');
  assert.equal(payloadParts(editor.values().actions_json).deliverables[0].owner, 'new author');
  editor.setValues({ actions_json: '{unfinished' });
  assert.equal(editor.values().actions_json, '{unfinished');
});
