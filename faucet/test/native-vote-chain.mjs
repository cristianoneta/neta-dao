import assert from 'node:assert/strict';
import { DirectSecp256k1HdWallet, Registry } from '@cosmjs/proto-signing';
import { SigningStargateClient, BroadcastTxError } from '@cosmjs/stargate';
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { MsgVote } from 'cosmjs-types/cosmos/gov/v1/tx';
import { voteMessage, voteFee } from '../src/juno-governance-signing.mjs';

// Used only by the pinned, ephemeral Juno execution fixture. Never accepts a
// public RPC or mainnet chain ID; generated fixture credentials remain in memory.
export async function checkNativeVoteGas({ rpc, chainId, mnemonic, sender, proposalId }) {
  assert.equal(rpc, 'http://127.0.0.1:27657');
  assert.equal(chainId, 'cosmoot-claim-local');
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'juno' });
  assert.equal((await wallet.getAccounts())[0].address, sender);
  const msg = voteMessage(proposalId, sender, 'yes');
  const client = await SigningStargateClient.connectWithSigner(rpc, wallet, {
    registry: new Registry([[msg.typeUrl, MsgVote]])
  });
  try {
    assert.equal(await client.getChainId(), chainId);
    const before = await client.getSequence(sender),
      balance = await client.getBalance(sender, 'ujuno');
    const data = { ...before, chainId };
    const estimate = await client.simulate(sender, [msg], '');
    const lowFee = { gas: '50000', amount: [{ denom: 'ujuno', amount: '3750' }] };
    const low = await client.sign(sender, [msg], lowFee, '', data);
    await assert.rejects(
      client.broadcastTx(TxRaw.encode(low).finish()),
      (e) => e instanceof BroadcastTxError && e.code === 11
    );
    assert.deepEqual(
      await client.getSequence(sender),
      before,
      'CheckTx gas rejection must not consume sequence'
    );
    assert.deepEqual(
      await client.getBalance(sender, 'ujuno'),
      balance,
      'Rejected admission must not charge the chain balance'
    );
    const fee = voteFee(estimate, Number(lowFee.gas));
    const high = await client.sign(sender, [msg], fee, '', data);
    assert.deepEqual(high.bodyBytes, low.bodyBytes);
    const included = await client.broadcastTx(TxRaw.encode(high).finish());
    assert.equal(included.code, 0, included.rawLog);
    assert.equal((await client.getSequence(sender)).sequence, before.sequence + 1);
    assert.equal(
      BigInt((await client.getBalance(sender, 'ujuno')).amount),
      BigInt(balance.amount) - BigInt(fee.amount[0].amount)
    );
    // Even another adequately funded signature for the same sequence cannot
    // produce a second execution after one variant has been included.
    const sibling = await client.sign(sender, [msg], voteFee(estimate, Number(fee.gas)), '', data);
    await assert.rejects(
      client.broadcastTx(TxRaw.encode(sibling).finish()),
      (e) => e instanceof BroadcastTxError && e.code === 32
    );
    assert.equal((await client.getSequence(sender)).sequence, before.sequence + 1);
    console.log(
      'Native vote gas: low limit rejected, reviewed fee included, same-sequence duplicate rejected.'
    );
    return { code: included.code, raw_log: included.rawLog };
  } finally {
    client.disconnect();
  }
}
