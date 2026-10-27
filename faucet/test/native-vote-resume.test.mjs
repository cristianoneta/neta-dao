import test from 'node:test';
import assert from 'node:assert/strict';
import { DirectSecp256k1Wallet, Registry } from '@cosmjs/proto-signing';
import { SigningStargateClient } from '@cosmjs/stargate';
import { sha256 } from '@cosmjs/crypto';
import { toHex, toBase64 } from '@cosmjs/encoding';
import { TxRaw, TxBody, AuthInfo } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { MsgVote } from 'cosmjs-types/cosmos/gov/v1/tx';
import { inspectSavedVote, resumeVote, replaceVoteGas } from '../src/native-vote-resume.mjs';
import { voteFee } from '../src/native-vote-fee.mjs';
import { VOTE } from '../../native-voting-core.mjs';

const wallet = await DirectSecp256k1Wallet.fromKey(new Uint8Array(32).fill(1), 'juno');
const [{ address: sender }] = await wallet.getAccounts();
const signer = await SigningStargateClient.offline(wallet, {
  registry: new Registry([[VOTE, MsgVote]])
});
const fee = { gas: '140000', amount: [{ denom: 'ujuno', amount: '10500' }] };
const txHash = (bytes) => toHex(sha256(bytes)).toUpperCase();
test('native vote fee covers a small simulation with a floor, increases replacements and caps final gas', () => {
  assert.deepEqual(voteFee(72630), {
    amount: [{ denom: 'ujuno', amount: '18750' }],
    gas: '250000'
  });
  assert.equal(voteFee(72630, 250000).gas, '375000');
  assert.equal(voteFee(200000).gas, '360000');
  for (const n of [NaN, Infinity, 0, -1, 1.5, 2000000]) assert.throws(() => voteFee(n));
  assert.throws(() => voteFee(100000, 2000000));
});
async function harness(mutate = () => {}, signing = {}) {
  const tx = await signer.sign(
    sender,
    [{ typeUrl: VOTE, value: MsgVote.fromPartial({ proposalId: 900n, voter: sender, option: 3 }) }],
    fee,
    '',
    { chainId: 'juno-1', accountNumber: 7, sequence: 2, ...signing }
  );
  const body = TxBody.decode(tx.bodyBytes),
    auth = AuthInfo.decode(tx.authInfoBytes);
  mutate({ tx, body, auth });
  tx.bodyBytes = TxBody.encode(body).finish();
  tx.authInfoBytes = AuthInfo.encode(auth).finish();
  const bytes = TxRaw.encode(tx).finish(),
    hash = txHash(bytes),
    key = 'neta-pending-tx-v1:juno-1:' + sender;
  const row = {
    version: 1,
    status: 'pending',
    chain: 'juno-1',
    sender,
    hash,
    sequence: '2',
    bytes: toBase64(bytes)
  };
  const rows = new Map([[key, JSON.stringify(row)]]);
  const storage = {
    getItem: (k) => rows.get(k) ?? null,
    setItem: (k, v) => rows.set(k, v),
    removeItem: (k) => rows.delete(k)
  };
  let held = false;
  const locks = {
    request: async (k, options, run) => {
      assert.equal(k, key);
      assert.deepEqual(options, { mode: 'exclusive', ifAvailable: true });
      if (held) return run(null);
      held = true;
      try {
        return await run({});
      } finally {
        held = false;
      }
    }
  };
  let broadcasts = 0;
  const client = {
    getChainId: async () => 'juno-1',
    getTx: async () => null,
    getAccount: async () => ({ address: sender, accountNumber: 7, sequence: 2 }),
    sign: async () => assert.fail('A saved vote must never request another signature'),
    broadcastTx: async (sent) => {
      broadcasts++;
      assert.deepEqual(sent, bytes);
      return { transactionHash: hash, height: 123, code: 0 };
    }
  };
  const options = {
    assertWallet: async () => {},
    beforeBroadcast: async () => {},
    journalOptions: { storage, locks }
  };
  return {
    client,
    storage,
    options,
    key,
    row,
    bytes,
    hash,
    broadcasts: () => broadcasts,
    inspect: () => inspectSavedVote(client, 900, sender, hash, { storage })
  };
}

test('actual CosmJS signature is verified and only explicitly resends identical saved bytes', async () => {
  const h = await harness(),
    original = h.storage.getItem(h.key),
    reviewed = await h.inspect();
  assert.deepEqual(reviewed, {
    hash: h.hash,
    proposalId: '900',
    sender,
    option: 'no',
    sequence: '2',
    fee
  });
  assert.equal(h.broadcasts(), 0);
  const result = await resumeVote(h.client, reviewed, h.options);
  assert.equal(result.code, 0);
  assert.equal(h.broadcasts(), 1);
  assert.equal(
    h.storage.getItem(h.key),
    original,
    'Independent receipt confirmation owns journal removal'
  );
});

async function replacementHarness(mode = '') {
  const h = await harness(),
    reviewed = await h.inspect(),
    original = h.storage.getItem(h.key);
  let signs = 0,
    sends = 0,
    guards = 0;
  h.options.beforeSign = async () => {
    guards++;
    if (mode === 'guard' && signs) throw Error('review expired');
  };
  h.client.sign = async (a, m, f, memo, data) => {
    signs++;
    assert.deepEqual(data, { chainId: 'juno-1', accountNumber: 7, sequence: 2 });
    if (mode === 'reject') throw Error('wallet rejected');
    if (mode === 'choice') m[0].value.option = 1;
    if (mode === 'id') m[0].value.proposalId = 901n;
    if (mode === 'sequence') data.sequence++;
    if (mode === 'chain') data.chainId = 'uni-7';
    const tx = await signer.sign(
      a,
      m,
      mode === 'fee' ? fee : f,
      mode === 'memo' ? 'changed' : memo,
      data
    );
    if (mode === 'signature') tx.signatures[0][0] ^= 1;
    if (mode === 'consumed')
      h.client.getAccount = async () => ({ address: sender, accountNumber: 7, sequence: 3 });
    return tx;
  };
  h.options.beforeBroadcast = async (hash) => {
    assert.notEqual(hash, h.hash);
    assert.equal(JSON.parse(h.storage.getItem(h.key)).hash, hash);
    assert.equal(
      h.storage.getItem('neta-vote-attempt-v1:juno-1:' + sender + ':' + h.hash),
      original
    );
    if (mode === 'receipt') throw Error('receipt storage unavailable');
  };
  h.client.broadcastTx = async (bytes) => {
    sends++;
    const tx = TxRaw.decode(bytes),
      auth = AuthInfo.decode(tx.authInfoBytes);
    assert.deepEqual(tx.bodyBytes, TxRaw.decode(h.bytes).bodyBytes);
    assert.equal(auth.signerInfos[0].sequence, 2n);
    assert.equal(auth.fee.gasLimit, 250000n);
    if (mode === 'lost') throw Error('connection lost');
    return { transactionHash: txHash(bytes), height: 123, code: 0 };
  };
  return {
    ...h,
    reviewed,
    original,
    signs: () => signs,
    sends: () => sends,
    guards: () => guards,
    run: () => replaceVoteGas(h.client, reviewed, voteFee(72630), h.options)
  };
}

test('higher gas signs the exact same vote and sequence, preserving the predecessor before broadcast', async () => {
  const h = await replacementHarness();
  const result = await h.run();
  assert.equal(h.signs(), 1);
  assert.equal(h.sends(), 1);
  assert.equal(h.guards(), 2);
  const next = JSON.parse(h.storage.getItem(h.key));
  assert.equal(next.hash, result.transactionHash);
  assert.equal(next.sequence, '2');
  assert.deepEqual(next.voteReplacement, { previousHash: h.hash, proposalId: '900', option: 'no' });
  const saved = await inspectSavedVote(h.client, 900, sender, next.hash, { storage: h.storage });
  assert.equal(saved.option, 'no');
  assert.equal(saved.fee.gas, '250000');
  await assert.rejects(h.run());
  assert.equal(h.signs(), 1, 'Old review cannot sign a second replacement');
});

test('wallet rejection, altered vote/fee/sequence/signature and consumed sequence preserve the original', async () => {
  for (const mode of [
    'reject',
    'choice',
    'id',
    'sequence',
    'chain',
    'fee',
    'memo',
    'signature',
    'consumed',
    'guard'
  ]) {
    const h = await replacementHarness(mode);
    await assert.rejects(h.run());
    assert.equal(h.sends(), 0, mode);
    assert.equal(h.storage.getItem(h.key), h.original, mode);
  }
  for (const mode of ['archive', 'checkpoint']) {
    const h = await replacementHarness();
    const write = h.storage.setItem;
    h.storage.setItem = (k, v) => {
      if (mode === 'archive' ? k.startsWith('neta-vote-attempt-v1:') : k === h.key)
        throw Error('disk full');
      return write(k, v);
    };
    await assert.rejects(h.run(), /disk full/);
    assert.equal(h.sends(), 0);
    assert.equal(h.storage.getItem(h.key), h.original);
  }
});

test('interrupted receipt and lost response retain both signed variants and resume without another signature', async () => {
  for (const mode of ['receipt', 'lost']) {
    const h = await replacementHarness(mode);
    await assert.rejects(h.run());
    assert.equal(h.signs(), 1);
    assert.equal(h.sends(), mode === 'lost' ? 1 : 0);
    const next = JSON.parse(h.storage.getItem(h.key));
    assert.notEqual(next.hash, h.hash);
    assert.equal(
      h.storage.getItem('neta-vote-attempt-v1:juno-1:' + sender + ':' + h.hash),
      h.original
    );
    const reviewed = await inspectSavedVote(h.client, 900, sender, next.hash, {
      storage: h.storage
    });
    h.client.broadcastTx = async (bytes) => ({
      transactionHash: txHash(bytes),
      height: 123,
      code: 0
    });
    await resumeVote(h.client, reviewed, { ...h.options, beforeBroadcast: async () => {} });
    assert.equal(h.signs(), 1);
  }
});

test('fee replacement shares the account lock with ordinary saved-vote continuation', async () => {
  const h = await replacementHarness();
  let release, entered;
  const waiting = new Promise((r) => {
    entered = r;
  });
  let waits = 0;
  h.options.beforeSign = async () => {
    if (waits++ === 0) {
      entered();
      await new Promise((r) => {
        release = r;
      });
    }
  };
  const attempt = h.run();
  await waiting;
  await assert.rejects(resumeVote(h.client, h.reviewed, h.options), /ANOTHER TAB/);
  h.options.beforeSign = async () => {};
  release();
  await attempt;
  assert.equal(h.signs(), 1);
  assert.equal(h.sends(), 1);
});

test('invalid vote identity, extra messages, unordered bytes, fee, signer and signature never send', async () => {
  for (const mutate of [
    ({ body }) => {
      const v = MsgVote.decode(body.messages[0].value);
      v.proposalId = 901n;
      body.messages[0].value = MsgVote.encode(v).finish();
    },
    ({ body }) => {
      const v = MsgVote.decode(body.messages[0].value);
      v.voter = 'other';
      body.messages[0].value = MsgVote.encode(v).finish();
    },
    ({ body }) => {
      const v = MsgVote.decode(body.messages[0].value);
      v.option = 0;
      body.messages[0].value = MsgVote.encode(v).finish();
    },
    ({ body }) => body.messages.push(body.messages[0]),
    ({ body }) => {
      body.memo = 'changed';
    },
    ({ body }) => {
      body.unordered = true;
    },
    ({ body }) => {
      body.timeoutHeight = 123n;
    },
    ({ auth }) => {
      auth.signerInfos[0].modeInfo.single.mode = 127;
    },
    ({ auth }) => {
      auth.signerInfos[0].sequence = 3n;
    },
    ({ auth }) => {
      auth.fee.amount[0].denom = 'other';
    },
    ({ auth }) => {
      auth.fee.amount[0].amount = '150001';
    },
    ({ auth }) => {
      auth.fee.payer = sender;
    },
    ({ auth }) => {
      auth.fee.gasLimit = 2000001n;
    },
    ({ tx }) => {
      tx.signatures[0][0] ^= 1;
    },
    ({ tx }) => {
      tx.signatures.push(tx.signatures[0]);
    }
  ]) {
    const h = await harness(mutate),
      original = h.storage.getItem(h.key);
    await assert.rejects(h.inspect());
    assert.equal(h.broadcasts(), 0);
    assert.equal(h.storage.getItem(h.key), original);
  }
  for (const signing of [{ chainId: 'uni-7' }, { accountNumber: 8 }]) {
    const h = await harness(undefined, signing);
    await assert.rejects(h.inspect());
    assert.equal(h.broadcasts(), 0);
  }
});

test('reload verifies the hash, original account record and consumed sequence without discarding anything', async () => {
  for (const mutate of [
    (h) => {
      h.row.hash = 'A'.repeat(64);
    },
    (h) => {
      h.row.chain = 'uni-7';
    },
    (h) => {
      h.row.sender = 'other';
    },
    (h) => {
      h.row.status = 'signing';
    },
    (h) => {
      h.row.bytes = h.row.bytes.slice(0, -4);
    },
    (h) => {
      h.client.getAccount = async () => ({ address: sender, accountNumber: 7, sequence: 3 });
    },
    (h) => {
      h.client.getTx = async () => ({ hash: h.hash, height: 123, code: 0 });
    },
    (h) => {
      h.client.getTx = async () => {
        throw Error('RPC unavailable');
      };
    },
    (h) => {
      h.client.getChainId = async () => 'uni-7';
    }
  ]) {
    const h = await harness();
    mutate(h);
    h.storage.setItem(h.key, JSON.stringify(h.row));
    const original = h.storage.getItem(h.key);
    await assert.rejects(h.inspect());
    assert.equal(h.broadcasts(), 0);
    assert.equal(h.storage.getItem(h.key), original);
  }
});

test('context, account, record and review changes block resending; concurrent tabs share the signing lock', async () => {
  for (const mode of ['wallet', 'review', 'record', 'sequence', 'choice']) {
    const h = await harness(),
      reviewed = await h.inspect();
    if (mode === 'wallet')
      h.options.assertWallet = async () => {
        throw Error('wallet changed');
      };
    if (mode === 'review')
      h.options.beforeBroadcast = async () => {
        throw Error('review expired');
      };
    if (mode === 'record')
      h.options.beforeBroadcast = async () => h.storage.setItem(h.key, 'changed');
    if (mode === 'sequence')
      h.client.getAccount = async () => ({ address: sender, accountNumber: 7, sequence: 3 });
    if (mode === 'choice') reviewed.option = 'yes';
    await assert.rejects(resumeVote(h.client, reviewed, h.options));
    assert.equal(h.broadcasts(), 0);
    assert.notEqual(h.storage.getItem(h.key), null);
  }
  const h = await harness(),
    reviewed = await h.inspect();
  let release, entered;
  const gate = new Promise((r) => {
    entered = r;
  });
  h.options.beforeBroadcast = async () => {
    entered();
    await new Promise((r) => {
      release = r;
    });
  };
  const first = resumeVote(h.client, reviewed, h.options);
  await gate;
  await assert.rejects(resumeVote(h.client, reviewed, h.options), /ANOTHER TAB/);
  release();
  await first;
  assert.equal(h.broadcasts(), 1);
});

test('lost response, RPC rejection, failed delivery and malformed response all preserve the saved bytes', async () => {
  for (const mode of ['lost', 'rejected', 'failed', 'malformed']) {
    const h = await harness(),
      reviewed = await h.inspect(),
      original = h.storage.getItem(h.key);
    const error = Error(mode === 'rejected' ? 'insufficient fees' : 'network timeout');
    h.client.broadcastTx = async (bytes) => {
      assert.deepEqual(bytes, h.bytes);
      if (mode === 'failed') return { transactionHash: h.hash, height: 123, code: 11 };
      if (mode === 'malformed') return { transactionHash: 'A'.repeat(64), height: 0, code: 0 };
      throw error;
    };
    if (mode === 'failed') assert.equal((await resumeVote(h.client, reviewed, h.options)).code, 11);
    else
      await assert.rejects(
        resumeVote(h.client, reviewed, h.options),
        mode === 'malformed' ? /unconfirmed/ : (e) => e === error
      );
    assert.equal(h.storage.getItem(h.key), original);
  }
});
