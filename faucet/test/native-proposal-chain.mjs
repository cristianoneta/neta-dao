import assert from 'node:assert/strict';
import { DirectSecp256k1HdWallet, Registry } from '@cosmjs/proto-signing';
import { SigningStargateClient } from '@cosmjs/stargate';
import { MsgSubmitProposal } from 'cosmjs-types/cosmos/gov/v1/tx';
import { QueryProposalRequest, QueryProposalResponse } from 'cosmjs-types/cosmos/gov/v1/query';
import { message, proposalFee, fixedFee } from '../src/juno-governance-signing.mjs';

// Only the ephemeral Juno fixture can use this signer. Mainnet diagnostics use
// simulation with a public key; they never enter this submission regression.
export async function checkNativeProposalGas({ rpc, chainId, mnemonic, sender, content }) {
  assert.equal(rpc, 'http://127.0.0.1:27657');
  assert.equal(chainId, 'cosmoot-claim-local');
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'juno' });
  assert.equal((await wallet.getAccounts())[0].address, sender);
  const client = await SigningStargateClient.connectWithSigner(rpc, wallet, {
    registry: new Registry([['/cosmos.gov.v1.MsgSubmitProposal', MsgSubmitProposal]])
  });
  try {
    assert.equal(await client.getChainId(), chainId);
    const before = await client.getSequence(sender);
    const balance = BigInt((await client.getBalance(sender, 'ujuno')).amount);
    const prepared = [];
    for (const deposit of ['2', '10']) {
      const msg = message(content, sender, deposit);
      const estimate = await client.simulate(sender, [msg], '');
      prepared.push({ deposit, msg, estimate, fee: proposalFee(estimate) });
    }
    assert.deepEqual(await client.getSequence(sender), before);
    assert.equal(BigInt((await client.getBalance(sender, 'ujuno')).amount), balance);
    assert.ok(prepared[1].estimate > prepared[0].estimate, 'Starting voting adds submission work');
    assert.throws(() => fixedFee(prepared[1].estimate, 1.4, '0.075ujuno', 2000000), /EXCESSIVE/);
    let paid = 0n,
      latest;
    for (const [index, attempt] of prepared.entries()) {
      latest = await client.signAndBroadcast(sender, [attempt.msg], attempt.fee, '');
      assert.equal(latest.code, 0, latest.rawLog);
      assert.ok(BigInt(latest.gasUsed) <= BigInt(attempt.fee.gas));
      const id = latest.events
        .find((e) => e.type === 'submit_proposal')
        .attributes.find((a) => a.key === 'proposal_id').value;
      const response = await client
        .getQueryClient()
        .queryAbci(
          '/cosmos.gov.v1.Query/Proposal',
          QueryProposalRequest.encode({ proposalId: BigInt(id) }).finish()
        );
      const proposal = QueryProposalResponse.decode(response.value).proposal;
      assert.equal(
        proposal.status,
        index === 0 ? 1 : 2,
        'Partial deposit waits; full deposit starts voting'
      );
      assert.deepEqual(proposal.totalDeposit, [{ denom: 'ujuno', amount: attempt.deposit }]);
      assert.equal(proposal.title, content.title);
      assert.deepEqual(proposal.messages, attempt.msg.value.messages);
      assert.equal((await client.getSequence(sender)).sequence, before.sequence + index + 1);
      paid += BigInt(attempt.deposit) + BigInt(attempt.fee.amount[0].amount);
    }
    assert.equal(BigInt((await client.getBalance(sender, 'ujuno')).amount), balance - paid);
    console.log(
      `Native proposal gas: partial ${prepared[0].estimate}, full ${prepared[1].estimate}; both reviewed fees included, deposit/voting states verified.`
    );
    return { ...latest, raw_log: latest.rawLog };
  } finally {
    client.disconnect();
  }
}
