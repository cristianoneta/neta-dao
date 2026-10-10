import test from 'node:test';
import assert from 'node:assert/strict';
import { ReviewMainnetActivation } from '../juno-review-mainnet-activate-core.mjs';
import {
  REVIEW_MAINNET_RELEASE as PIN,
  REVIEW_MAINNET_POLICY as POLICY
} from '../juno-review-mainnet-config.mjs';
import { verifyMainnetReview } from '../juno-review-mainnet-read.mjs';
import { selectedReviewNetwork } from '../juno-review-network.mjs';
import { executeMainnetReview } from '../juno-review-transactions.mjs';
function fixture() {
  const map = new Map(),
    storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) },
    locks = { request: async (k, o, fn) => fn({}) };
  let paused = true,
    bad = '',
    writes = 0,
    lost = false;
  const fetcher = async (url) => {
    let data;
    if (url.endsWith('blocks/latest'))
      data = {
        block: {
          header: {
            chain_id: bad === 'chain' ? 'uni-7' : 'juno-1',
            height: '123',
            time: bad === 'stale' ? '2020-01-01T00:00:00Z' : new Date().toISOString()
          }
        }
      };
    else if (url.includes('/code/'))
      data = {
        code_info: {
          creator: PIN.creator,
          data_hash: bad === 'hash' ? '0'.repeat(64) : PIN.codeHash
        }
      };
    else if (url.includes('/smart/'))
      data = {
        data: {
          ...POLICY,
          paused: bad === 'disagree' && url.includes('stavr') ? !paused : paused,
          ...(bad === 'neta' ? { minimum_comment_stake: '1' } : {})
        }
      };
    else
      data = {
        contract_info: {
          code_id: PIN.codeId,
          creator: PIN.creator,
          admin: bad === 'admin' ? '' : PIN.admin,
          label: PIN.label
        }
      };
    return {
      ok: !(bad === 'provider' && url.includes('stavr')),
      status: 503,
      json: async () => data
    };
  };
  const receipt = {
    chainId: 'juno-1',
    transactionHash: 'A'.repeat(64),
    height: 123,
    code: 0,
    intentMatched: true
  };
  const bundle = {
    validAddress: (a) => a === PIN.contract,
    createBridge: (opts) => ({
      execute: async (r) => {
        await opts.verifyDeployment();
        assert.deepEqual(r.msg, { set_paused: { paused: false } });
        writes++;
        paused = false;
        if (lost) throw Error('UNKNOWN');
        return receipt;
      },
      recover: async () => {
        await opts.verifyDeployment();
        return receipt;
      }
    })
  };
  const setup = new ReviewMainnetActivation({
    owner: PIN.creator,
    client: {},
    bundle,
    storage,
    locks,
    fetcher,
    assertWallet: async () => {
      if (bad === 'wallet') throw Error('wallet changed');
    }
  });
  return {
    setup,
    fetcher,
    storage,
    receipt,
    get writes() {
      return writes;
    },
    set bad(v) {
      bad = v;
    },
    set lost(v) {
      lost = v;
    },
    set paused(v) {
      paused = v;
    }
  };
}
test('mainnet is default; historical unqualified review links and Operations remain UNI-7', () => {
  assert.equal(selectedReviewNetwork(new URLSearchParams()).chainId, 'juno-1');
  assert.equal(selectedReviewNetwork(new URLSearchParams('review=3')).chainId, 'uni-7');
  assert.equal(
    selectedReviewNetwork(new URLSearchParams('review=3&reviewChain=juno-1')).contract,
    PIN.contract
  );
  assert.equal(selectedReviewNetwork(new URLSearchParams(), false).chainId, 'uni-7');
  assert.throws(
    () =>
      selectedReviewNetwork(
        new URLSearchParams('review=3&reviewChain=juno-1&reviewContract=other')
      ),
    /contract/
  );
  assert.throws(() => selectedReviewNetwork(new URLSearchParams('reviewChain=other')), /network/);
});
test('activation verifies both sources and exact owner intent; export confirms active state', async () => {
  const f = fixture(),
    review = await f.setup.prepare('activate');
  assert.equal(f.writes, 0);
  await f.setup.execute(review);
  assert.equal(f.writes, 1);
  assert.equal((await f.setup.exportBundle()).activated, true);
  await assert.rejects(f.setup.prepare('activate'), /already enabled/);
});
test('activation lost response recovers after unpause without another signature', async () => {
  const f = fixture();
  f.lost = true;
  await assert.rejects(f.setup.execute(await f.setup.prepare('activate')), /UNKNOWN/);
  const journal = f.storage.getItem(f.setup.key);
  assert.ok(f.setup.state().pending);
  await assert.rejects(f.setup.prepare('activate'), /pending/);
  assert.equal(f.storage.getItem(f.setup.key), journal);
  await f.setup.recover();
  assert.equal(f.writes, 1);
  assert.equal(f.setup.state().pending, null);
});
test('wrong authority, code, chain, stale state, policy and provider disagreement block activation', async () => {
  for (const bad of ['wallet', 'hash', 'admin', 'chain', 'stale', 'neta', 'provider', 'disagree']) {
    const f = fixture();
    f.bad = bad;
    await assert.rejects(f.setup.prepare('activate'));
    assert.equal(f.writes, 0);
  }
  const f = fixture(),
    r = await f.setup.prepare('activate');
  r.request.msg.set_paused.paused = true;
  await assert.rejects(f.setup.execute(r), /review changed/);
  assert.equal(f.writes, 0);
});
test('paused review blocks publication but can be inspected publicly', async () => {
  const f = fixture();
  assert.equal((await verifyMainnetReview({ fetcher: f.fetcher })).config.paused, true);
  await assert.rejects(verifyMainnetReview({ fetcher: f.fetcher, requireActive: true }), /paused/);
});
test('mainnet review bridge binds chain, contract and wallet and checks active state before signing', async () => {
  let options,
    request,
    checks = 0;
  const args = {
    client: {},
    sender: PIN.creator,
    contract: PIN.contract,
    msg: { publish_proposal: {} },
    memo: 'review',
    assertWallet: async (a) => assert.equal(a, PIN.creator),
    verify: async (o) => {
      assert.equal(o.requireActive, true);
      checks++;
    },
    bundle: {
      createBridge: (o) => {
        options = o;
        return {
          execute: async (r, guards) => {
            request = r;
            await o.verifyDeployment();
            await guards.beforeSign();
            return 'synthetic';
          }
        };
      }
    }
  };
  assert.equal(await executeMainnetReview(args), 'synthetic');
  assert.equal(options.chainId, 'juno-1');
  assert.equal(request.contract, PIN.contract);
  assert.equal(checks, 2);
  await assert.rejects(executeMainnetReview({ ...args, contract: 'other' }), /Unsupported/);
  await assert.rejects(
    executeMainnetReview({ ...args, msg: { set_paused: { paused: false } } }),
    /Unsupported/
  );
});
