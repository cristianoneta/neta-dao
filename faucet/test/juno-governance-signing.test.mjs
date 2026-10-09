import test from 'node:test';
import assert from 'node:assert/strict';
import { TxRaw, TxBody, AuthInfo } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { MsgSubmitProposal, MsgDeposit } from 'cosmjs-types/cosmos/gov/v1/tx';
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { sha256 } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';
import { message, submit, depositMessage, contribute } from '../src/juno-governance-signing.mjs';
import { GOVERNANCE, SUBMIT, rewardMessages } from '../../juno-governance-core.mjs';
const sender = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
const content = {
  title: 'Claim rewards',
  summary: 'Reviewed full proposal',
  messages: rewardMessages(['junovaloper1' + 'q'.repeat(38)])
};
const fee = { gas: '100000', amount: [{ denom: 'ujuno', amount: '7500' }] };
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
test('native submit proposer differs from governance execution authority and preserves the nested claim', () => {
  const msg = message(content, sender, '100000000');
  const proposal = MsgSubmitProposal.decode(MsgSubmitProposal.encode(msg.value).finish());
  assert.equal(proposal.proposer, sender);
  assert.equal(proposal.expedited, false);
  const execution = MsgExecuteContract.decode(proposal.messages[0].value);
  assert.equal(execution.sender, GOVERNANCE);
  assert.equal(execution.funds.length, 0);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(execution.msg)), content.messages[0].msg);
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
