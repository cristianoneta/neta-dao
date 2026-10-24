import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewActionState, nativeSubmissionVisible } from '../src/governance/review-state.mjs';
import { captureReviewContext } from '../src/governance/review-context.mjs';
import { reviewSession } from '../src/governance/review-session.mjs';
import { validateProposalContent } from '../src/governance/proposal-content.mjs';

const state = {
  selected: null,
  native: true,
  readOnly: false,
  address: 'author',
  walletChain: 'juno-1',
  reviewChain: 'juno-1',
  canPublish: true,
  contract: 'review',
  setupAdmin: 'admin',
  configOwner: 'admin',
  busy: false,
  pending: false,
  hasSubmissionReceipt: false
};
const discussion = { source: 'workshop', status: 'discussion', author: 'author' };

test('review publication, finalization and native submission have distinct eligibility', () => {
  assert.equal(reviewActionState(state).publish, true);
  assert.equal(reviewActionState(state).finalize, false);
  assert.equal(
    nativeSubmissionVisible({
      finalized: false,
      legacyReceipt: false,
      invalid: false,
      visible: true
    }),
    false
  );
  const reviewing = reviewActionState({ ...state, selected: discussion });
  assert.equal(reviewing.publish, false);
  assert.equal(reviewing.finalize, true);
  assert.equal(reviewing.revise, true);
  const finalized = reviewActionState({ ...state, selected: { ...discussion, status: 'ready' } });
  assert.equal(finalized.finalize, false);
  assert.equal(finalized.revise, false);
  assert.equal(finalized.withdraw, true);
  assert.equal(
    nativeSubmissionVisible({
      finalized: true,
      legacyReceipt: false,
      invalid: false,
      visible: true
    }),
    true
  );
  assert.equal(
    nativeSubmissionVisible({
      finalized: true,
      legacyReceipt: false,
      invalid: true,
      visible: true
    }),
    false
  );
  assert.equal(
    nativeSubmissionVisible({
      finalized: false,
      legacyReceipt: true,
      invalid: false,
      visible: true
    }),
    true,
    'old submission receipts remain accessible without authorizing another submission'
  );
});

test('wrong chain, pending receipt and busy state block review writes; only the author can withdraw', () => {
  for (const changes of [
    { walletChain: 'uni-7' },
    { address: null },
    { pending: true },
    { busy: true }
  ]) {
    const draft = reviewActionState({ ...state, ...changes });
    const review = reviewActionState({ ...state, selected: discussion, ...changes });
    assert.equal(draft.publish, false);
    for (const action of ['revise', 'finalize', 'withdraw']) assert.equal(review[action], false);
  }
  assert.equal(
    reviewActionState({ ...state, selected: discussion, address: 'another' }).withdraw,
    false
  );
  assert.equal(
    reviewActionState({ ...state, selected: discussion, hasSubmissionReceipt: true }).withdraw,
    false
  );
  assert.equal(reviewActionState({ ...state, native: false, readOnly: true }).publish, false);
  for (const status of ['withdrawn', 'declined', 'unexpected']) {
    const result = reviewActionState({ ...state, selected: { ...discussion, status } });
    for (const action of ['publish', 'revise', 'finalize', 'withdraw'])
      assert.equal(result[action], false);
  }
  const submitted = reviewActionState({ ...state, selected: { ...discussion, nativeId: '900' } });
  assert.equal(submitted.phase, 'submitted');
  assert.equal(submitted.finalize, false);
  assert.equal(submitted.withdraw, false);
});

test('captured review work is invalidated by account, chain, contract, request or selection changes', () => {
  const original = {
    address: 'author',
    contract: 'review',
    chainId: 'juno-1',
    walletChain: 'juno-1',
    walletEpoch: 1,
    requestEpoch: 1,
    selectedKey: 'workshop:77',
    selectedId: 77
  };
  for (const key of Object.keys(original)) {
    const current = { ...original },
      captured = captureReviewContext(() => current);
    captured.assert();
    current[key] = typeof current[key] === 'number' ? 2 : 'changed';
    assert.throws(() => captured.assert(), /context changed/);
  }
});

test('review receipt keys remain compatible and unreadable or unpersisted storage never permits retry', () => {
  const rows = new Map();
  const current = {
    address: 'author',
    contract: 'review',
    chainId: 'juno-1',
    walletChain: 'juno-1',
    walletEpoch: 1,
    requestEpoch: 1,
    selectedId: 77
  };
  const storage = {
    getItem: (key) => rows.get(key) ?? null,
    setItem: (key, value) => rows.set(key, value)
  };
  const config = {
    context: () => current,
    label: () => 'Juno',
    lookup: async () => null,
    feedback() {},
    storage
  };
  const session = reviewSession(config);
  assert.equal(session.pendingReview(), false);
  session.saveReviewReceipt(null, current, { author: 'author', after: 76 });
  assert.equal(session.receiptKey(), 'cosmoot:review-receipt:juno-1:author');
  assert.equal(session.pendingReview(), true);
  assert.equal(JSON.parse(rows.get(session.receiptKey())).intent.after, 76);
  rows.clear();
  rows.set('neta-pending-tx-v1:juno-1:author', '{"status":"signing"}');
  assert.equal(session.pendingReview(), true);
  const failed = reviewSession({
    ...config,
    storage: {
      getItem() {
        throw Error('unavailable');
      }
    }
  });
  assert.equal(failed.pendingReview(), true);
  const lost = reviewSession({ ...config, storage: { getItem: () => null, setItem() {} } });
  assert.throws(() => lost.saveReviewReceipt(null, current), /Do not repeat/);
});

test('proposal validation preserves exact content limits and rejects invalid metadata', () => {
  const proposal = { title: 'A review', summary: 'Summary', body: 'Body', actions_json: '[]' };
  validateProposalContent(proposal, { native: true });
  assert.throws(
    () => validateProposalContent({ ...proposal, body: 'ä'.repeat(6000) }, { native: true }),
    /10,000 bytes/
  );
  assert.throws(() => validateProposalContent({ ...proposal, actions_json: '{}' }), /JSON ARRAY/);
  assert.throws(
    () => validateProposalContent({ ...proposal, actions_json: '[{"type":"dao_deliverable_v1"}]' }),
    /REQUIRES/
  );
});
