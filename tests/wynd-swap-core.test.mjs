import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ASSETS,
  POOLS,
  findPool,
  selectAssets,
  verifyPool,
  poolValuation,
  parseSwapQuote,
  buildSwapTransaction,
  receivedFromEvents
} from '../wynd-swap-core.mjs';
const observations = JSON.parse(
  readFileSync(new URL('./fixtures/wynd-five-pools.json', import.meta.url))
).pools;
const wallet = 'juno1d0g7f97v87xwe6r4vr4jj3jfhzcv4vvfhamy8w';

test('all five allowlisted pools match observed contract identities, assets, fee and reserves', () => {
  assert.equal(POOLS.length, 5);
  assert.equal(new Set(POOLS.map((p) => p.address)).size, 5);
  for (const p of POOLS) {
    const o = observations.find((v) => v.address === p.address);
    assert.equal(verifyPool(p, o.info.contract_info, o.pair, o.pool), o.pool);
    for (const mutate of [
      (x) => (x.info.contract_info.code_id = '999'),
      (x) => (x.pair.contract_addr = POOLS.find((v) => v !== p).address),
      (x) => (x.pair.fee_config.total_fee_bps = 50),
      (x) => (x.pair.pair_type = { stable: {} }),
      (x) => (x.pair.asset_infos[1] = x.pair.asset_infos[0]),
      (x) => (x.pool.assets[1].info = { native: 'uusdc' }),
      (x) => (x.pool.assets[0].amount = '0'),
      (x) => (x.pool.assets[0].amount = '-100'),
      (x) => (x.pool.assets[0].info.extra = 'hidden')
    ]) {
      const changed = structuredClone(o);
      mutate(changed);
      assert.throws(() => verifyPool(p, changed.info.contract_info, changed.pair, changed.pool));
    }
  }
});

test('pay selection chooses a direct pair; receive selection never changes the pay asset', () => {
  assert.equal(findPool('ATOM', 'NETA'), undefined);
  assert.equal(findPool('JUNO', 'JUNO'), false);
  assert.equal(selectAssets('offer', 'WYND', 'JUNO', 'NETA').receive, 'USDC');
  assert.throws(() => selectAssets('receive', 'ATOM', 'WYND', 'USDC'), /No direct pool/);
  assert.throws(() => selectAssets('receive', 'NETA', 'USDC', 'JUNO'), /No direct pool/);
  assert.equal(selectAssets('receive', 'WYND', 'USDC', 'JUNO').offer, 'USDC');
  assert.equal(selectAssets('offer', 'USDC', 'JUNO', 'WYND').receive, 'WYND');
  for (const p of POOLS)
    for (const side of ['offer', 'receive'])
      for (const symbol of Object.keys(ASSETS)) {
        if (side === 'receive' && !findPool(p.assets[0], symbol)) {
          assert.throws(() => selectAssets(side, symbol, ...p.assets), /No direct pool/);
          continue;
        }
        const selected = selectAssets(side, symbol, ...p.assets);
        assert.equal(selected[side], symbol);
        if (side === 'receive') assert.equal(selected.offer, p.assets[0]);
        assert.ok(POOLS.includes(selected.pool));
        assert.notEqual(selected.offer, selected.receive);
      }
  assert.throws(() => selectAssets('offer', 'USDT', 'JUNO', 'NETA'));
});

test('USD liquidity sums both independently priced reserves and labels ratio-derived values', () => {
  const p = findPool('WYND', 'USDC'),
    o = observations.find((v) => v.address === p.address);
  const result = poolValuation(p, o.pool, { USDC: 0.998 });
  const usdc = Number(o.pool.assets[1].amount) / 1e6;
  assert.equal(result.liquidity, usdc * 0.998 * 2);
  assert.deepEqual(result.derived, ['WYND']);
  assert.equal(poolValuation(p, o.pool, { JUNO: 0.01 }), null);
  assert.equal(poolValuation(p, o.pool, { USDC: NaN }), null);
  const independent = poolValuation(p, o.pool, { USDC: 0.998, WYND: 0.0001 });
  assert.deepEqual(independent.derived, []);
  assert.equal(
    independent.liquidity,
    (Number(o.pool.assets[0].amount) / 1e6) * 0.0001 + usdc * 0.998
  );
});

test('both directions of all five pools bind exact native funds or CW20 sends to the receiving asset', () => {
  for (const p of POOLS)
    for (const direction of [p.assets, [...p.assets].reverse()]) {
      const [offer, receive] = direction;
      const quote = { offer, receive, poolId: p.id, raw: 1234567n, returned: 1234n, fee: 3n };
      const tx = buildSwapTransaction(quote, wallet, 5);
      let swap;
      if (ASSETS[offer].info.native) {
        assert.equal(tx.contract, p.address);
        assert.deepEqual(tx.funds, [{ denom: ASSETS[offer].info.native, amount: '1234567' }]);
        swap = tx.message.swap;
        assert.deepEqual(swap.offer_asset, { info: ASSETS[offer].info, amount: '1234567' });
      } else {
        assert.equal(tx.contract, ASSETS[offer].info.token);
        assert.deepEqual(tx.funds, []);
        assert.equal(tx.message.send.contract, p.address);
        assert.equal(tx.message.send.amount, '1234567');
        swap = JSON.parse(atob(tx.message.send.msg)).swap;
      }
      assert.deepEqual(swap.ask_asset_info, ASSETS[receive].info);
      assert.equal(swap.to, wallet);
      assert.equal(swap.max_spread, '0.05');
      assert.throws(() => buildSwapTransaction({ ...quote, poolId: 'other' }, wallet, 5));
    }
  assert.throws(() => buildSwapTransaction({ offer: 'ATOM', receive: 'NETA' }, wallet, 5));
});

test('received tokens must match the exact contract or IBC denomination and recipient', () => {
  for (const asset of Object.values(ASSETS)) {
    const attributes = asset.info.native
      ? { recipient: wallet, amount: '4567' + asset.info.native }
      : { _contract_address: asset.info.token, action: 'transfer', to: wallet, amount: '4567' };
    const event = {
      type: asset.info.native ? 'transfer' : 'wasm',
      attributes: Object.entries(attributes).map(([key, value]) => ({ key, value }))
    };
    assert.equal(receivedFromEvents([event], asset.symbol, wallet), 4567n);
    assert.equal(receivedFromEvents([event], asset.symbol, 'another-wallet'), 0n);
    for (const other of Object.keys(ASSETS).filter((s) => s !== asset.symbol))
      assert.equal(receivedFromEvents([event], other, wallet), 0n);
  }
});

test('malformed and empty simulation outputs cannot become a swap quote', () => {
  assert.deepEqual(
    parseSwapQuote({ return_amount: '100', commission_amount: '1', spread_amount: '0' }),
    { returned: 100n, fee: 1n, spread: 0n }
  );
  for (const field of ['return_amount', 'commission_amount', 'spread_amount'])
    for (const bad of ['-1', '1.5', 'NaN', '1e6', 1, '1'.repeat(31), null]) {
      assert.throws(() =>
        parseSwapQuote({
          return_amount: '100',
          commission_amount: '1',
          spread_amount: '0',
          [field]: bad
        })
      );
    }
  assert.throws(() =>
    parseSwapQuote({ return_amount: '0', commission_amount: '1', spread_amount: '0' })
  );
});
