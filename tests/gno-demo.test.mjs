import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  quoteName,
  availableName,
  budgetFor,
  payProposal,
  connectSocial,
  loadState
} from '../demo/model.mjs';

test('illustrative annual GNS tiers use the stated GNOT price and reject invalid terms', () => {
  for (const [name, amount] of [
    ['a', 3153.6],
    ['ab', 788.4],
    ['abc', 157.68],
    ['abcd', 63.072],
    ['abcde', 31.536]
  ]) {
    const q = quoteName(name);
    assert.ok(q.valid);
    assert.ok(Math.abs(q.amount - amount) < 1e-9);
    assert.equal(q.usd, q.amount * 0.05);
  }
  assert.equal(quoteName(' Cristiano.GNO ', 2).name, 'cristiano');
  assert.equal(quoteName('name', 99).valid, false);
  assert.equal(quoteName('<script>').valid, false);
  assert.equal(availableName('anika'), false);
  assert.equal(availableName('anika', 'anika'), true);
});
test('proposals are not commitments; approved proposals are never counted twice', () => {
  const s = initialState();
  assert.deepEqual(budgetFor(s, s.proposals[0]), {
    balance: 60000,
    committed: 15000,
    proposed: 12000,
    reserve: 1000,
    available: 44000,
    remaining: 32000
  });
  const approved = s.proposals.find((p) => p.id === 9);
  assert.equal(budgetFor(s, approved).proposed, 0);
  assert.equal(budgetFor(s, approved).remaining, 44000);
});
test('a demo payment debits balance, releases its commitment and cannot repeat', () => {
  const s = initialState();
  assert.equal(payProposal(s, 12), false);
  assert.equal(payProposal(s, 9), true);
  assert.equal(payProposal(s, 9), false);
  assert.equal(budgetFor(s).balance, 51000);
  assert.equal(budgetFor(s).committed, 6000);
  assert.equal(budgetFor(s).available, 44000);
  assert.equal(payProposal(s, 8), true);
  assert.equal(budgetFor(s).balance, 45000);
  assert.equal(budgetFor(s).committed, 0);
});
test('changing a handle clears its old simulated confirmation', () => {
  const p = initialState().profile;
  p.telegramProof = true;
  assert.equal(connectSocial(p, 'telegram', '@new_handle'), true);
  assert.equal(p.telegram, 'new_handle');
  assert.equal(p.telegramProof, false);
  assert.equal(connectSocial(p, 'discord', 'javascript:bad'), false);
  assert.equal(connectSocial(p, 'unknown', 'valid_name'), false);
});
test('local persistence retains pending registration and drafts and recovers invalid storage', () => {
  const s = initialState();
  s.registration = { quote: quoteName('myname'), committed: true };
  s.drafts['comment-12'] = 'Unposted draft';
  assert.deepEqual(loadState({ getItem: () => JSON.stringify(s) }), s);
  assert.deepEqual(loadState({ getItem: () => '{' }), initialState());
  assert.deepEqual(
    loadState({
      getItem: () => {
        throw Error('disabled');
      }
    }),
    initialState()
  );
});
