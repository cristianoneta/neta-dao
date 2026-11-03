import test from 'node:test';
import assert from 'node:assert/strict';
import { MsgSubmitProposal } from 'cosmjs-types/cosmos/gov/v1/tx';
import { TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import {
  message,
  proposalSize,
  PROPOSAL_TX_BUDGET,
  simulate
} from '../src/juno-governance-signing.mjs';
import { compactReviewActions, readReviewActions } from '../../juno-review-actions.mjs';
import { stakingMessages } from '../../juno-programme-staking.mjs';
import { fixture } from '../../tests/fixtures/delegation-planner.mjs';
const sender = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
const addresses = fixture().validators.map((v) => v.address);
const messages = stakingMessages([
  { kind: 'redelegate', source: addresses[0], destination: addresses[1], amountRaw: '123456789' }
]);
const content = {
  title: 'Rebalance',
  summary: 'Execute the reviewed staking movements.',
  messages
};
test('transaction size counts full decoded execution protobuf, not compact review storage', () => {
  const restored = readReviewActions(JSON.stringify(compactReviewActions(messages)));
  const full = { ...content, messages: restored };
  const encoded = message(full, sender, '1000000');
  const value = MsgSubmitProposal.encode(encoded.value).finish();
  const size = proposalSize(full, sender, '1000000');
  assert.equal(size.messageBytes, value.length);
  assert.equal(
    size.bodyBytes,
    TxBody.encode(TxBody.fromPartial({ messages: [{ typeUrl: encoded.typeUrl, value }] })).finish()
      .length
  );
  assert.equal(size.transactionBudgetBytes, size.bodyBytes + 2048);
  assert.equal(size.limit, PROPOSAL_TX_BUDGET);
  assert.deepEqual(message(full, sender, '1000000'), message(content, sender, '1000000'));
  assert.throws(() =>
    message({ ...content, messages: compactReviewActions(messages) }, sender, '1000000')
  );
});
test('oversized proposals stop before simulation or any signing call', async () => {
  let calls = 0;
  const client = {
    simulate() {
      calls++;
      throw Error('must not be called');
    }
  };
  assert.throws(
    () =>
      simulate(
        client,
        { ...content, summary: '🪐'.repeat(PROPOSAL_TX_BUDGET / 4) },
        sender,
        '1000000'
      ),
    /application budget/
  );
  assert.equal(calls, 0);
  assert.ok(
    proposalSize({ ...content, summary: 'x'.repeat(200000) }, sender, '1000000')
      .transactionBudgetBytes < PROPOSAL_TX_BUDGET
  );
});
