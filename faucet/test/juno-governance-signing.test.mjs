import { MsgCommunityPoolSpend } from 'cosmjs-types/cosmos/distribution/v1beta1/tx';
import {
  communityPoolMessages,
  COMMUNITY_POOL_SPEND,
  DAI_AMOUNT,
  DAI_DENOM,
  DAI_RECIPIENT
} from '../../juno-community-pool-proposal.mjs';
import test from 'node:test';
import {
  MsgDelegate,
  MsgBeginRedelegate,
  MsgUndelegate
} from 'cosmjs-types/cosmos/staking/v1beta1/tx';
import { stakingMessages } from '../../juno-programme-staking.mjs';
import assert from 'node:assert/strict';
import { TxRaw, TxBody, AuthInfo, SignDoc } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';
import { DirectSecp256k1Wallet, Registry } from '@cosmjs/proto-signing';
import { SigningStargateClient } from '@cosmjs/stargate';
import { MsgSubmitProposal, MsgDeposit, MsgVote } from 'cosmjs-types/cosmos/gov/v1/tx';
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { MsgWithdrawDelegatorReward } from 'cosmjs-types/cosmos/distribution/v1beta1/tx';
import { readFileSync } from 'node:fs';
import { PROGRAMME } from '../../juno-delegation-core.mjs';
import { claimValidators, WITHDRAW_REWARD } from '../../juno-governance-core.mjs';
import { sha256 } from '@cosmjs/crypto';
import { fromBase64, toBase64, toHex } from '@cosmjs/encoding';
import {
  message,
  submit,
  depositMessage,
  contribute,
  vote
} from '../src/juno-governance-signing.mjs';
import {
  GOVERNANCE,
  SUBMIT,
  rewardMessages,
  legacyRewardMessages
} from '../../juno-governance-core.mjs';
const fixtureWallet = await DirectSecp256k1Wallet.fromKey(new Uint8Array(32).fill(1), 'juno');
const [{ address: sender, pubkey }] = await fixtureWallet.getAccounts();
const signerData = { chainId: 'juno-1', accountNumber: 7, sequence: 1 };
const signerInfo = {
  sequence: 1n,
  modeInfo: { single: { mode: 1 } },
  publicKey: {
    typeUrl: '/cosmos.crypto.secp256k1.PubKey',
    value: PubKey.encode({ key: pubkey }).finish()
  }
};
async function signFixture(tx) {
  const { signature } = await fixtureWallet.signDirect(
    sender,
    SignDoc.fromPartial({
      ...tx,
      chainId: signerData.chainId,
      accountNumber: BigInt(signerData.accountNumber)
    })
  );
  return TxRaw.fromPartial({ ...tx, signatures: [fromBase64(signature.signature)] });
}
const content = {
  title: 'Rule approval',
  summary: 'Reviewed full proposal',
  messages: []
};
const fee = { gas: '100000', amount: [{ denom: 'ujuno', amount: '7500' }] };
test('independent SDK codecs verify every staking type inside the native programme envelope', () => {
  const validators = JSON.parse(
    readFileSync(new URL('../../tests/fixtures/juno-proposal-381.json', import.meta.url))
  ).proposal.messages[0].msg.execute_admin_msgs.msgs.map(
    (m) => m.distribution.withdraw_delegator_reward.validator
  );
  const moves = [
    { kind: 'delegate', destination: validators[0], amountRaw: '9007199254740993' },
    { kind: 'redelegate', source: validators[1], destination: validators[2], amountRaw: '1234567' },
    { kind: 'undelegate', source: validators[3], amountRaw: '7654321' }
  ];
  const outer = message({ ...content, messages: stakingMessages(moves) }, sender, '100000000');
  const native = MsgSubmitProposal.decode(MsgSubmitProposal.encode(outer.value).finish());
  const execute = MsgExecuteContract.decode(native.messages[0].value);
  assert.equal(execute.sender, GOVERNANCE);
  assert.equal(execute.contract, PROGRAMME);
  assert.deepEqual(execute.funds, []);
  const inner = JSON.parse(new TextDecoder().decode(execute.msg)).execute_admin_msgs.msgs;
  for (const [i, codec] of [MsgDelegate, MsgBeginRedelegate, MsgUndelegate].entries()) {
    const bytes = Buffer.from(inner[i].stargate.value, 'base64'),
      decoded = codec.decode(bytes);
    assert.equal(decoded.delegatorAddress, PROGRAMME);
    assert.deepEqual(decoded.amount, { denom: 'ujuno', amount: moves[i].amountRaw });
    if (i === 1) {
      assert.equal(decoded.validatorSrcAddress, moves[i].source);
      assert.equal(decoded.validatorDstAddress, moves[i].destination);
    } else assert.equal(decoded.validatorAddress, moves[i].source || moves[i].destination);
    assert.deepEqual(Buffer.from(codec.encode(decoded).finish()), bytes);
  }
});
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
    getSequence: async () => ({ accountNumber: 7, sequence: 1 }),
    getTx: async () => null,
    sign: async (_sender, [msg], exactFee, memo) => {
      signs++;
      if (mode === 'reject') throw Error('Rejected by wallet');
      assert.equal(_sender, sender);
      assert.equal(msg.value.proposer, sender);
      assert.equal(msg.value.initialDeposit[0].amount, '100000000');
      if (mode === 'content') msg.value.title = 'Changed by wallet';
      if (mode === 'fee-inplace') exactFee.amount[0].amount = '999999';
      if (mode === 'type-inplace') msg.typeUrl = '/cosmos.gov.v1.MsgDeposit';
      const body = TxBody.fromPartial({
        messages: [{ typeUrl: msg.typeUrl, value: MsgSubmitProposal.encode(msg.value).finish() }],
        memo: mode === 'memo' ? 'changed' : memo,
        unordered: mode === 'unordered',
        timeoutTimestamp: mode === 'expiry' ? { seconds: 2000000000n, nanos: 0 } : undefined
      });
      const auth = AuthInfo.fromPartial({
        signerInfos: [signerInfo],
        fee: {
          gasLimit: BigInt(exactFee.gas),
          amount: mode === 'fee' ? [{ denom: 'ujuno', amount: '999999' }] : exactFee.amount
        }
      });
      const bodyBytes = TxBody.encode(body).finish(),
        authBytes = AuthInfo.encode(auth).finish();
      const alter = (bytes, target) => {
        if (mode === 'unknown-' + target) return Uint8Array.from([...bytes, 122, 0]);
        if (mode === 'truncated-' + target) return Uint8Array.from([...bytes, 128]);
        if (mode === 'noncanonical-' + target) {
          // The first field key still decodes to 10, but uses a redundant varint byte.
          assert.equal(bytes[0], 10);
          return Uint8Array.from([138, 0, ...bytes.slice(1)]);
        }
        return bytes;
      };
      return signFixture({
        bodyBytes: alter(bodyBytes, 'body'),
        authInfoBytes: alter(authBytes, 'auth')
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
    run: () =>
      submit(client, structuredClone(content), sender, '100000000', structuredClone(fee), options),
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
test('wallet-added ordering, expiry or altered protobuf encoding never broadcast', async (t) => {
  for (const mode of [
    'unordered',
    'expiry',
    'unknown-body',
    'unknown-auth',
    'truncated-body',
    'truncated-auth',
    'noncanonical-body',
    'noncanonical-auth'
  ])
    await t.test(mode, async () => {
      const h = harness(mode);
      await assert.rejects(
        h.run(),
        mode.startsWith('truncated-') ? RangeError : /Wallet changed the reviewed/
      );
      assert.equal(h.signs(), 1);
      assert.equal(h.broadcasts(), 0);
      assert.equal(
        h.rows.size,
        0,
        'a rejected pre-broadcast signature leaves no pending transaction'
      );
    });
});
test('in-place fee and message-type mutation cannot change the reviewed expectation', async (t) => {
  for (const mode of ['fee-inplace', 'type-inplace'])
    await t.test(mode, async () => {
      const h = harness(mode);
      await assert.rejects(h.run(), /Wallet changed the reviewed/);
      assert.equal(h.broadcasts(), 0);
      assert.equal(h.rows.size, 0);
    });
});
test('actual CosmJS signatures bind the wallet key, Juno account and current sequence before broadcast', async (t) => {
  const otherWallet = await DirectSecp256k1Wallet.fromKey(new Uint8Array(32).fill(2), 'juno');
  const [{ pubkey: otherKey }] = await otherWallet.getAccounts();
  for (const mode of [
    'submit',
    'deposit',
    'vote',
    'retained-response',
    'signer-data-inplace',
    'signature',
    'short-signature',
    'signed-chain',
    'signed-account',
    'signed-sequence',
    'public-key',
    'public-key-encoding',
    'sign-mode',
    'current-account',
    'current-sequence',
    'current-chain',
    'account-unavailable'
  ]) {
    await t.test(mode, async () => {
      let signs = 0,
        broadcasts = 0,
        retained,
        signedBytes;
      const signer = {
        getAccounts: () => fixtureWallet.getAccounts(),
        signDirect: async (address, doc) => {
          signs++;
          assert.equal(address, sender);
          assert.equal(doc.chainId, 'juno-1');
          assert.equal(doc.accountNumber, 7n);
          if (mode === 'signed-chain') doc.chainId = 'uni-7';
          if (mode === 'signed-account') doc.accountNumber = 8n;
          const auth = AuthInfo.decode(doc.authInfoBytes);
          if (mode === 'signed-sequence') auth.signerInfos[0].sequence = 99n;
          if (mode === 'sign-mode') auth.signerInfos[0].modeInfo.single.mode = 127;
          if (mode === 'public-key')
            auth.signerInfos[0].publicKey.value = PubKey.encode({ key: otherKey }).finish();
          if (mode === 'public-key-encoding')
            auth.signerInfos[0].publicKey.value = Uint8Array.from([
              ...auth.signerInfos[0].publicKey.value,
              24,
              1
            ]);
          doc.authInfoBytes = AuthInfo.encode(auth).finish();
          const result = await fixtureWallet.signDirect(address, doc);
          if (mode === 'signature') result.signature.signature = toBase64(new Uint8Array(64));
          if (mode === 'short-signature') result.signature.signature = toBase64(new Uint8Array(63));
          return result;
        }
      };
      const client = await SigningStargateClient.offline(signer, {
        registry: new Registry([
          [SUBMIT, MsgSubmitProposal],
          ['/cosmos.gov.v1.MsgDeposit', MsgDeposit],
          ['/cosmos.gov.v1.MsgVote', MsgVote]
        ])
      });
      const sign = client.sign.bind(client);
      client.sign = async (...args) => {
        assert.deepEqual(args[4], signerData);
        if (mode === 'signer-data-inplace') args[4].sequence = 99;
        retained = await sign(...args);
        signedBytes = TxRaw.encode(retained).finish();
        return retained;
      };
      client.getChainId = async () => (signs && mode === 'current-chain' ? 'uni-7' : 'juno-1');
      client.getSequence = async () => {
        if (mode === 'account-unavailable') throw Error('Account unavailable');
        if (retained && mode === 'retained-response') retained.signatures[0][0] ^= 1;
        return {
          accountNumber: signs && mode === 'current-account' ? 8 : 7,
          sequence: signs && mode === 'current-sequence' ? 2 : 1
        };
      };
      client.getTx = async () => null;
      client.broadcastTx = async (bytes) => {
        broadcasts++;
        assert.deepEqual(bytes, signedBytes, 'broadcast must preserve the verified signed bytes');
        return { transactionHash: toHex(sha256(bytes)).toUpperCase(), height: 123, code: 0 };
      };
      const rows = new Map();
      const storage = {
        getItem: (k) => rows.get(k) ?? null,
        setItem: (k, v) => rows.set(k, v),
        removeItem: (k) => rows.delete(k)
      };
      const options = {
        assertWallet: async () => {},
        beforeSign: async () => {},
        beforeBroadcast: async () => {},
        journalOptions: { storage, locks: { request: async (_key, _options, run) => run({}) } }
      };
      const run = () =>
        mode === 'deposit'
          ? contribute(client, '901', sender, '50000000', fee, options)
          : mode === 'vote'
            ? vote(client, '901', sender, 'yes', fee, options)
            : submit(client, structuredClone(content), sender, '100000000', fee, options);
      if (['submit', 'deposit', 'vote', 'retained-response'].includes(mode)) {
        await run();
        assert.equal(broadcasts, 1);
      } else {
        await assert.rejects(run());
        assert.equal(broadcasts, 0);
      }
      assert.equal(signs, mode === 'account-unavailable' ? 0 : 1);
      assert.equal(
        rows.size,
        0,
        'pre-broadcast failures never leave an unrecoverable pending journal'
      );
    });
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
      getSequence: async () => ({ accountNumber: 7, sequence: 1 }),
      getTx: async () => null,
      sign: async (_sender, [m], exactFee, memo) => {
        signs++;
        assert.equal(m.value.proposalId, 901n);
        assert.equal(m.value.depositor, sender);
        if (mode === 'id') m.value.proposalId = 902n;
        if (mode === 'amount') m.value.amount[0].amount = '5000000000';
        if (mode === 'sender') m.value.depositor = 'different';
        return signFixture({
          bodyBytes: TxBody.encode(
            TxBody.fromPartial({
              messages: [{ typeUrl: m.typeUrl, value: MsgDeposit.encode(m.value).finish() }],
              memo
            })
          ).finish(),
          authInfoBytes: AuthInfo.encode(
            AuthInfo.fromPartial({
              signerInfos: [signerInfo],
              fee: { gasLimit: BigInt(exactFee.gas), amount: mode === 'fee' ? [] : exactFee.amount }
            })
          ).finish()
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
      getSequence: async () => ({ accountNumber: 7, sequence: 1 }),
      getTx: async () => null,
      sign: async (_sender, [msg], fee, memo) => {
        signedCount++;
        const value = { ...msg.value };
        if (mode === 'choice') value.option = 4;
        if (mode === 'proposal') value.proposalId = 382n;
        return signFixture({
          bodyBytes: TxBody.encode(
            TxBody.fromPartial({
              messages: [{ typeUrl: msg.typeUrl, value: MsgVote.encode(value).finish() }],
              memo: mode === 'memo' ? 'changed' : memo
            })
          ).finish(),
          authInfoBytes: AuthInfo.encode(
            AuthInfo.fromPartial({
              signerInfos: [signerInfo],
              fee: {
                gasLimit: BigInt(fee.gas),
                amount: mode === 'fee' ? [{ denom: 'ujuno', amount: '9999' }] : fee.amount
              }
            })
          ).finish()
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
