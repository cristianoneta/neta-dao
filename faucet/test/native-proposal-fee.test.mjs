import test from 'node:test';
import assert from 'node:assert/strict';
import { proposalFee } from '../src/native-proposal-fee.mjs';
import { voteFee } from '../src/native-vote-fee.mjs';

test('partial and full funding estimates use their exact reviewed gas and rounded fee', () => {
  assert.deepEqual(proposalFee(1882616), {
    gas: '2635663',
    amount: [{ denom: 'ujuno', amount: '197675' }]
  });
  assert.deepEqual(proposalFee(2208967), {
    gas: '3092554',
    amount: [{ denom: 'ujuno', amount: '231942' }]
  });
  assert.deepEqual(proposalFee(100000), {
    gas: '250000',
    amount: [{ denom: 'ujuno', amount: '18750' }]
  });
});
test('the submission ceiling bounds final gas including reserve and the payable fee', () => {
  const largest = proposalFee(3571428);
  assert.equal(largest.gas, '5000000');
  assert.equal(largest.amount[0].amount, '375000');
  assert.throws(() => proposalFee(3571429), /5000001 gas.*5000000 submission limit/);
  assert.throws(() => proposalFee(4000000), /5600000 gas.*Nothing was signed or sent/);
});
test('invalid RPC estimates cannot produce a submission fee', () => {
  for (const estimate of [undefined, null, '2208967', 0, -1, 1.5, NaN, Infinity])
    assert.throws(() => proposalFee(estimate), /Invalid proposal gas estimate/);
  assert.throws(() => proposalFee(Number.MAX_SAFE_INTEGER), /submission limit/);
});
test('proposal envelopes above the old guard do not relax the separate vote policy', () => {
  assert.equal(proposalFee(2208967).gas, '3092554');
  assert.deepEqual(voteFee(72630), {
    gas: '250000',
    amount: [{ denom: 'ujuno', amount: '18750' }]
  });
  assert.throws(() => voteFee(1200000), /EXCESSIVE/);
});
