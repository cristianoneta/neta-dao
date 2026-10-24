import { MsgCommunityPoolSpend } from 'cosmjs-types/cosmos/distribution/v1beta1/tx';
import {
  communityPoolMessages,
  COMMUNITY_POOL_SPEND,
  DAI_AMOUNT,
  DAI_DENOM,
  DAI_RECIPIENT
} from '../../juno-community-pool-proposal.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { TxRaw, TxBody, AuthInfo } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { MsgSubmitProposal, MsgDeposit } from 'cosmjs-types/cosmos/gov/v1/tx';
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { MsgWithdrawDelegatorReward } from 'cosmjs-types/cosmos/distribution/v1beta1/tx';
import { readFileSync } from 'node:fs';
import { PROGRAMME } from '../../juno-delegation-core.mjs';
import { claimValidators, WITHDRAW_REWARD } from '../../juno-governance-core.mjs';
import { sha256 } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';
import { message, submit, depositMessage, contribute } from '../src/juno-governance-signing.mjs';
import {
  GOVERNANCE,
  SUBMIT,
  rewardMessages,
  legacyRewardMessages
} from '../../juno-governance-core.mjs';
const sender = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
const content = {
  title: 'Rule approval',
  summary: 'Reviewed full proposal',
  messages: []
};
const fee = { gas: '100000', amount: [{ denom: 'ujuno', amount: '7500' }] };
test('independent SDK codecs decode all 37 corrected withdrawals inside native governance', () => {
  const original = JSON.parse(
    readFileSync(new URL('../../tests/fixtures/juno-proposal-381.json', import.meta.url))
  ).proposal;
  const validators = original.messages[0].msg.execute_admin_msgs.msgs
    .map((m) => m.distribution.withdraw_delegator_reward.validator)
    .sort();
  const messages = rewardMessages(validators);
  const outer = message({ ...content, messages }, sender, '100000000');
  const submit = MsgSubmitProposal.decode(MsgSubmitProposal.encode(outer.value).finish());
  const execute = MsgExecuteContract.decode(submit.messages[0].value);
  assert.equal(execute.sender, GOVERNANCE);
  assert.equal(execute.contract, PROGRAMME);
  assert.deepEqual(execute.funds, []);
  const inner = JSON.parse(new TextDecoder().decode(execute.msg)).execute_admin_msgs.msgs;
  assert.equal(inner.length, 37);
  for (const [i, m] of inner.entries()) {
    assert.equal(m.stargate.type_url, WITHDRAW_REWARD);
    const bytes = Buffer.from(m.stargate.value, 'base64');
    const withdrawal = MsgWithdrawDelegatorReward.decode(bytes);
    assert.equal(withdrawal.delegatorAddress, PROGRAMME);
    assert.equal(withdrawal.validatorAddress, validators[i]);
    assert.deepEqual(Buffer.from(MsgWithdrawDelegatorReward.encode(withdrawal).finish()), bytes);
  }
  for (const mutate of [
    (m) =>
      (m.value = Buffer.from(
        MsgWithdrawDelegatorReward.encode({
          delegatorAddress: GOVERNANCE,
          validatorAddress: validators[0]
        }).finish()
      ).toString('base64')),
    (m) => (m.value += '\n'),
    (m) =>
      (m.value = Buffer.concat([Buffer.from(m.value, 'base64'), Buffer.from([24, 1])]).toString(
        'base64'
      )),
    (m) => (m.type_url = '/cosmos.bank.v1beta1.MsgSend'),
    (m) => (m.extra = true)
  ]) {
    const bad = structuredClone(messages);
    mutate(bad[0].msg.execute_admin_msgs.msgs[0].stargate);
    assert.throws(() => claimValidators(bad, { allowLegacy: false }));
    assert.throws(() => message({ ...content, messages: bad }, sender, '100000000'));
  }
});
function harness(mode = '') {
  const rows = new Map(),
    storage = {
      getItem: (k) => rows.get(k) ?? null,
      setItem: (k, v) => rows.set(k, v),
      removeItem: (k) => rows.delete(k)
    };
  let signs = 0,
    broadcasts = 0,
    recorded = false,
    guards = 0;
  const client = {
    getChainId: async () => (mode === 'chain' ? 'uni-7' : 'juno-1'),
    getTx: async () => null,
    sign: async (_sender, [msg], exactFee, memo) => {
      signs++;
      if (mode === 'reject') throw Error('Rejected by wallet');
      assert.equal(_sender, sender);
      assert.equal(msg.value.proposer, sender);
      assert.equal(msg.value.initialDeposit[0].amount, '100000000');
      if (mode === 'content') msg.value.title = 'Changed by wallet';
      const body = TxBody.fromPartial({
        messages: [{ typeUrl: SUBMIT, value: MsgSubmitProposal.encode(msg.value).finish() }],
        memo: mode === 'memo' ? 'changed' : memo
      });
      const auth = AuthInfo.fromPartial({
        signerInfos: [{ sequence: 1n }],
        fee: {
          gasLimit: BigInt(exactFee.gas),
          amount: mode === 'fee' ? [{ denom: 'ujuno', amount: '999999' }] : exactFee.amount
        }
      });
      return TxRaw.fromPartial({
        bodyBytes: TxBody.encode(body).finish(),
        authInfoBytes: AuthInfo.encode(auth).finish(),
        signatures: [new Uint8Array(64)]
      });
    },
    broadcastTx: async (bytes) => {
      assert.equal(recorded, true);
      broadcasts++;
      if (mode === 'lost') throw Error('connection lost');
      return { transactionHash: toHex(sha256(bytes)).toUpperCase(), height: 123, code: 0 };
    }
  };
  const options = {
    assertWallet: async () => {
      if (mode === 'wallet' && signs) throw Error('wallet changed');
    },
    beforeSign: async () => {
      guards++;
      if (mode === 'expired' && signs) throw Error('review expired');
    },
    beforeBroadcast: async (hash) => {
      assert.match(hash, /^[A-F0-9]{64}$/);
      if (mode === 'storage') throw Error('Draft receipt storage failed');
      recorded = true;
    },
    journalOptions: { storage, locks: { request: async (_key, _options, run) => run({}) } }
  };
  return {
    run: () => submit(client, structuredClone(content), sender, '100000000', fee, options),
    rows,
    signs: () => signs,
    broadcasts: () => broadcasts,
    guards: () => guards
  };
}
test('signer refuses the incompatible programme claim before simulation or signing', () => {
  const blocked = { ...content, messages: legacyRewardMessages(['junovaloper1' + 'q'.repeat(38)]) };
  assert.throws(
    () => message(blocked, sender, '100000000'),
    /incompatible format from proposal #381/
  );
  const msg = message(content, sender, '100000000');
  const decoded = MsgSubmitProposal.decode(MsgSubmitProposal.encode(msg.value).finish());
  assert.equal(decoded.proposer, sender);
  assert.equal(decoded.messages.length, 0);
});
test('reviewed native proposal signs once, checkpoints the attempt and uses the origin journal', async () => {
  const h = harness();
  await h.run();
  assert.equal(h.signs(), 1);
  assert.equal(h.broadcasts(), 1);
  assert.equal(h.guards(), 2);
  assert.equal(h.rows.size, 0);
});
test('changed bytes, fee, memo, wallet, expired review and wrong chain never broadcast', async () => {
  for (const mode of ['content', 'fee', 'memo', 'wallet', 'expired', 'chain', 'reject']) {
    const h = harness(mode);
    await assert.rejects(h.run());
    assert.equal(h.broadcasts(), 0, mode);
  }
});
test('unknown native submission stays locked and cannot be sent again', async () => {
  const h = harness('lost');
  await assert.rejects(h.run(), /UNKNOWN/);
  const key = 'neta-pending-tx-v1:juno-1:' + sender,
    saved = h.rows.get(key);
  assert.ok(saved);
  await assert.rejects(h.run(), /UNKNOWN/);
  assert.equal(h.rows.get(key), saved);
  assert.equal(h.signs(), 1);
  assert.equal(h.broadcasts(), 1);
});
test('failure to persist the draft association prevents broadcast and keeps the journal', async () => {
  const h = harness('storage');
  await assert.rejects(h.run(), /UNKNOWN/);
  assert.equal(h.broadcasts(), 0);
  assert.equal(h.signs(), 1);
  assert.equal(h.rows.size, 1);
  await assert.rejects(h.run(), /UNKNOWN/);
  assert.equal(h.signs(), 1);
});
test('a sponsor signs their own proposer/deposit while the shared review identity stays intact', () => {
  const metadata = 'cosmoot:review:uni-7:contract:17:' + 'a'.repeat(64);
  const p = message({ ...content, metadata }, sender, '5000000000');
  assert.equal(p.value.metadata, metadata);
  assert.equal(p.value.proposer, sender);
  assert.equal(p.value.initialDeposit[0].amount, '5000000000');
});
test('contribution serialization and signing bind depositor, proposal ID, amount, fee and pending receipt', async () => {
  for (const mode of ['ok', 'id', 'amount', 'sender', 'lost', 'fee']) {
    const rows = new Map();
    let broadcasts = 0,
      signs = 0,
      saved = false;
    const storage = {
      getItem: (k) => rows.get(k) ?? null,
      setItem: (k, v) => rows.set(k, v),
      removeItem: (k) => rows.delete(k)
    };
    const client = {
      getChainId: async () => 'juno-1',
      getTx: async () => null,
      sign: async (_sender, [m], exactFee, memo) => {
        signs++;
        assert.equal(m.value.proposalId, 901n);
        assert.equal(m.value.depositor, sender);
        if (mode === 'id') m.value.proposalId = 902n;
        if (mode === 'amount') m.value.amount[0].amount = '5000000000';
        if (mode === 'sender') m.value.depositor = 'different';
        return TxRaw.fromPartial({
          bodyBytes: TxBody.encode(
            TxBody.fromPartial({
              messages: [{ typeUrl: m.typeUrl, value: MsgDeposit.encode(m.value).finish() }],
              memo
            })
          ).finish(),
          authInfoBytes: AuthInfo.encode(
            AuthInfo.fromPartial({
              signerInfos: [{ sequence: 1n }],
              fee: { gasLimit: BigInt(exactFee.gas), amount: mode === 'fee' ? [] : exactFee.amount }
            })
          ).finish(),
          signatures: [new Uint8Array(64)]
        });
      },
      broadcastTx: async (bytes) => {
        assert.equal(saved, true);
        broadcasts++;
        if (mode === 'lost') throw Error('Lost response');
        return { transactionHash: toHex(sha256(bytes)).toUpperCase(), height: 42, code: 0 };
      }
    };
    const run = () =>
      contribute(client, '901', sender, '50000000', fee, {
        assertWallet: async () => {},
        beforeSign: async () => {},
        beforeBroadcast: async () => {
          saved = true;
        },
        journalOptions: { storage, locks: { request: async (_key, _opts, fn) => fn({}) } }
      });
    if (mode === 'ok') {
      await run();
      assert.equal(broadcasts, 1);
    } else {
      await assert.rejects(run());
      assert.equal(broadcasts, mode === 'lost' ? 1 : 0);
    }
    if (mode === 'lost') {
      await assert.rejects(run(), /UNKNOWN/);
      assert.equal(signs, 1);
    }
  }
  assert.throws(() => depositMessage('0', sender, '1'));
});

test('native votes preserve exact proposal, voter, option and fee; uncertain writes stay locked', async () => {
  const { vote, voteMessage } = await import('../src/juno-governance-signing.mjs');
  const { MsgVote } = await import('cosmjs-types/cosmos/gov/v1/tx');
  for (const mode of ['ok', 'choice', 'proposal', 'memo', 'fee', 'lost', 'wallet', 'deadline']) {
    const rows = new Map();
    let broadcasts = 0,
      signedCount = 0;
    const storage = {
      getItem: (k) => rows.get(k) ?? null,
      setItem: (k, v) => rows.set(k, v),
      removeItem: (k) => rows.delete(k)
    };
    const client = {
      getChainId: async () => 'juno-1',
      getTx: async () => null,
      sign: async (_sender, [msg], fee, memo) => {
        signedCount++;
        const value = { ...msg.value };
        if (mode === 'choice') value.option = 4;
        if (mode === 'proposal') value.proposalId = 382n;
        return TxRaw.fromPartial({
          bodyBytes: TxBody.encode(
            TxBody.fromPartial({
              messages: [{ typeUrl: msg.typeUrl, value: MsgVote.encode(value).finish() }],
              memo: mode === 'memo' ? 'changed' : memo
            })
          ).finish(),
          authInfoBytes: AuthInfo.encode(
            AuthInfo.fromPartial({
              signerInfos: [{ sequence: 1n }],
              fee: {
                gasLimit: BigInt(fee.gas),
                amount: mode === 'fee' ? [{ denom: 'ujuno', amount: '9999' }] : fee.amount
              }
            })
          ).finish(),
          signatures: [new Uint8Array(64)]
        });
      },
      broadcastTx: async (bytes) => {
        broadcasts++;
        if (mode === 'lost') throw Error('Lost');
        return { transactionHash: toHex(sha256(bytes)).toUpperCase(), height: 100, code: 0 };
      }
    };
    const options = {
      journalOptions: { storage, locks: { request: async (_k, _o, fn) => fn({}) } },
      assertWallet: async () => {
        if (mode === 'wallet' && signedCount) throw Error('wallet changed');
      },
      beforeSign: async () => {
        if (mode === 'deadline' && signedCount) throw Error('Voting ended');
      },
      beforeBroadcast: async () => {}
    };
    const run = () => vote(client, '381', sender, 'yes', fee, options);
    if (mode === 'ok') await run();
    else await assert.rejects(run());
    assert.equal(broadcasts, ['ok', 'lost'].includes(mode) ? 1 : 0, mode);
    if (mode === 'lost') {
      await assert.rejects(run(), /UNKNOWN/);
      assert.equal(signedCount, 1);
    }
  }
  for (const choice of ['yes', 'no', 'abstain', 'veto'])
    assert.equal(voteMessage('381', sender, choice).typeUrl, '/cosmos.gov.v1.MsgVote');
  for (const choice of ['__proto__', 'unknown', null])
    assert.throws(() => voteMessage('381', sender, choice));
  assert.throws(() => voteMessage('18446744073709551616', sender, 'yes'));
});

test('native Community Pool proposal protobuf preserves authority, recipient and 18-decimal amount', () => {
  const raw = message({ ...content, messages: communityPoolMessages() }, sender, '1000000000');
  const encoded = MsgSubmitProposal.decode(MsgSubmitProposal.encode(raw.value).finish());
  assert.equal(encoded.proposer, sender);
  assert.equal(encoded.initialDeposit[0].amount, '1000000000');
  assert.equal(encoded.messages.length, 1);
  assert.equal(encoded.messages[0].typeUrl, COMMUNITY_POOL_SPEND);
  const transfer = MsgCommunityPoolSpend.decode(encoded.messages[0].value);
  assert.equal(transfer.authority, GOVERNANCE);
  assert.equal(transfer.recipient, DAI_RECIPIENT);
  assert.deepEqual(transfer.amount, [{ denom: DAI_DENOM, amount: DAI_AMOUNT }]);
  for (const mutate of [
    (m) => (m[0].recipient = sender),
    (m) => (m[0].authority = sender),
    (m) => (m[0].amount[0].amount = '460900000'),
    (m) => (m[0].amount[0].denom = 'ujuno'),
    (m) => m.push(m[0]),
    (m) => (m[0].extra = true)
  ]) {
    const messages = communityPoolMessages();
    mutate(messages);
    assert.throws(() => message({ ...content, messages }, sender, '1000000000'));
  }
});
