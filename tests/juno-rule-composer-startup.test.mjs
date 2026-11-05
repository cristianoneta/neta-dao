import test from 'node:test';
import assert from 'node:assert/strict';
import {
  legacyPolicy,
  strictHistoryPolicy,
  collectingPolicy,
  observedCommitPolicy,
  composerPolicy,
  editableComposerPolicy
} from '../juno-delegation-core.mjs';
import { deferComposerControls } from '../juno-rule-composer-view.mjs';

function controlsFixture(getRule) {
  const calls = [];
  let editing = false;
  const controls = deferComposerControls({
    getRule,
    onPending: (pending) => calls.push(['pending', pending]),
    mount: () => {
      // The real fixed-allocation editor requires this field during its mount.
      calls.push(['mount', getRule().fixedAllocations.length]);
      return {
        render: () => calls.push(['render', getRule().fixedAllocations.length]),
        reset: () => {
          calls.push(['reset', getRule().fixedAllocations.length]);
          editing = false;
        },
        isEditing: () => editing
      };
    }
  });
  return {
    controls,
    calls,
    startEditing: () => {
      editing = true;
    }
  };
}

test('historical drafts finish startup before snapshot-dependent controls mount', () => {
  for (const old of [
    legacyPolicy(),
    strictHistoryPolicy(),
    collectingPolicy(),
    observedCommitPolicy()
  ]) {
    old.factorTenths = 19;
    old.commissionMaxBps = null;
    const originalBytes = JSON.stringify(old);
    let rule = old;
    const { controls, calls } = controlsFixture(() => rule);
    assert.doesNotThrow(() => {
      controls.reset();
      controls.render();
    });
    assert.equal(
      calls.some(([event]) => event === 'mount'),
      false
    );
    assert.equal(controls.isEditing(), false);
    assert.equal(JSON.stringify(old), originalBytes);
    assert.throws(() => editableComposerPolicy(old), /consensus-set size/);

    // Only the actual snapshot count permits conversion. Neither defaults nor
    // a synthetic fixedAllocations field are written into the historical rule.
    rule = editableComposerPolicy(old, 25);
    controls.render();
    assert.equal(rule.votingPowerCapBps, 760);
    assert.equal(calls.filter(([event]) => event === 'mount').length, 1);
    assert.deepEqual(calls.at(-1), ['mount', 0]);
    controls.render();
    assert.deepEqual(calls.at(-1), ['render', 0]);
    assert.equal(JSON.stringify(old), originalBytes);
  }
});

test('approval arriving before its snapshot suspends existing schema-11 controls safely', () => {
  let rule = composerPolicy();
  const { controls, calls } = controlsFixture(() => rule);
  controls.render();
  rule = legacyPolicy();
  controls.render();
  assert.deepEqual(calls.at(-1), ['pending', true]);
  assert.equal(calls.filter(([event]) => ['render', 'reset'].includes(event)).length, 0);
  rule = editableComposerPolicy(rule, 25);
  controls.render();
  assert.deepEqual(calls.at(-1), ['render', 0]);
  assert.equal(calls.filter(([event]) => event === 'mount').length, 1);
});

test('an explicit reset during pending conversion closes the existing fixed-allocation form afterwards', () => {
  let rule = composerPolicy();
  const { controls, calls, startEditing } = controlsFixture(() => rule);
  controls.render();
  startEditing();
  assert.equal(controls.isEditing(), true);
  rule = legacyPolicy();
  controls.render();
  controls.reset();
  assert.equal(controls.isEditing(), false);
  assert.equal(calls.filter(([event]) => event === 'reset').length, 0);
  rule = editableComposerPolicy(rule, 25);
  controls.render();
  assert.deepEqual(calls.at(-1), ['reset', 0]);
  assert.equal(controls.isEditing(), false);
  assert.equal(calls.filter(([event]) => event === 'mount').length, 1);
  controls.render();
  assert.equal(calls.filter(([event]) => event === 'reset').length, 1);
  assert.deepEqual(calls.at(-1), ['render', 0]);
});
