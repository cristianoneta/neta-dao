// Five existing WYND XYK pairs, verified on Juno on 25 October 2026.
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const ASSETS = freeze({
  JUNO: {
    symbol: 'JUNO',
    name: 'Juno',
    decimals: 6,
    logo: '/assets/juno-chain.png',
    info: { native: 'ujuno' }
  },
  ATOM: {
    symbol: 'ATOM',
    name: 'Cosmos Hub · IBC on Juno',
    decimals: 6,
    info: { native: 'ibc/C4CFF46FD6DE35CA4CF4CE031E643C8FDC9BA4B99AE598E9B0ED98FE3A2319F9' }
  },
  USDC: {
    symbol: 'USDC',
    name: 'Axelar USDC · IBC on Juno',
    decimals: 6,
    info: { native: 'ibc/EAC38D55372F38F1AFD68DF7FE9EF762DCF69F26520643CF3F9D292A738D8034' }
  },
  OSMO: {
    symbol: 'OSMO',
    name: 'Osmosis · IBC on Juno',
    decimals: 6,
    info: { native: 'ibc/ED07A3391A112B175915CD8FAF43A2DA8E4790EDE12566649D0C2F97716B8518' }
  },
  WYND: {
    symbol: 'WYND',
    name: 'WYND DAO · CW20 on Juno',
    decimals: 6,
    info: { token: 'juno1mkw83sv6c7sjdvsaplrzc8yaes9l42p4mhy0ssuxjnyzl87c9eps7ce3m9' }
  },
  NETA: {
    symbol: 'NETA',
    name: 'NETA · CW20 on Juno',
    decimals: 6,
    logo: '/assets/neta-token.png',
    info: { token: 'juno168ctmpyppk90d34p3jjy658zf5a5l3w8wk35wht6ccqj4mr0yv8s4j5awr' }
  }
});
export const POOLS = freeze(
  [
    {
      id: 'juno-atom',
      assets: ['JUNO', 'ATOM'],
      address: 'juno17uv02azt545ag23xq7whw6z3r3chw7jwztnr9lypugy62drq3caqeyd2r3'
    },
    {
      id: 'juno-usdc',
      assets: ['JUNO', 'USDC'],
      address: 'juno1gqy6rzary8vwnslmdavqre6jdhakcd4n2z4r803ajjmdq08r66hq7zcwrj'
    },
    {
      id: 'juno-osmo',
      assets: ['JUNO', 'OSMO'],
      address: 'juno1u2pl8ql778655wakqmnhpln65q9pughd6jnrp93xwf4zakqjdh6qx3y9yt'
    },
    {
      id: 'wynd-usdc',
      assets: ['WYND', 'USDC'],
      address: 'juno18zk9xqj9xjm0ry39jjam8qsysj7qh49xwt4qdfp9lgtrk08sd58s2n54ve'
    },
    {
      id: 'juno-neta',
      assets: ['JUNO', 'NETA'],
      address: 'juno1h6x5jlvn6jhpnu63ufe4sgv4utyk8hsfl5rqnrpg2cvp6ccuq4lqwqnzra'
    }
  ].map((p) => ({ ...p, codeId: '2289', feeBps: 30 }))
);

export function assetKey(info) {
  if (!info || Object.keys(info).length !== 1) throw Error('Invalid asset identity');
  if (typeof info.native === 'string') return 'native:' + info.native;
  if (typeof info.token === 'string') return 'token:' + info.token;
  throw Error('Invalid asset identity');
}
export function findPool(offer, receive) {
  return (
    offer !== receive && POOLS.find((p) => p.assets.includes(offer) && p.assets.includes(receive))
  );
}
export function selectAssets(side, symbol, offer, receive) {
  if (!ASSETS[symbol] || !['offer', 'receive'].includes(side)) throw Error('Unsupported asset');
  if (side === 'offer') offer = symbol;
  else receive = symbol;
  if (!findPool(offer, receive)) {
    const pair = POOLS.find((p) => p.assets.includes(symbol));
    const counterpart = pair.assets.find((s) => s !== symbol);
    if (side === 'offer') receive = counterpart;
    else offer = counterpart;
  }
  return { offer, receive, pool: findPool(offer, receive) };
}
export function verifyPool(selected, info, pair, reserves) {
  if (!POOLS.includes(selected)) throw Error('Pool is not allowlisted');
  if (String(info?.code_id) !== selected.codeId)
    throw Error('Pair code ID does not match the allowlist');
  if (pair?.contract_addr !== selected.address) throw Error('Pair identity does not match');
  if (JSON.stringify(pair.pair_type) !== '{"xyk":{}}') throw Error('Unsupported pool type');
  const expected = new Set(selected.assets.map((s) => assetKey(ASSETS[s].info)));
  const exact = (items) =>
    Array.isArray(items) &&
    items.length === 2 &&
    new Set(items.map(assetKey)).size === 2 &&
    items.every((i) => expected.has(assetKey(i)));
  if (!exact(pair.asset_infos))
    throw Error('Pair assets do not match ' + selected.assets.join(' / '));
  if (String(pair.fee_config?.total_fee_bps) !== String(selected.feeBps))
    throw Error('Pair fee does not match 0.30%');
  if (
    !exact(reserves?.assets?.map((a) => a.info)) ||
    reserves.assets.some((a) => !/^\d{1,30}$/.test(a.amount) || BigInt(a.amount) <= 0n)
  )
    throw Error('Pool reserves are invalid or empty');
  return reserves;
}
export function reserve(pool, symbol) {
  return BigInt(pool.assets.find((a) => assetKey(a.info) === assetKey(ASSETS[symbol].info)).amount);
}
export function poolValuation(selected, pool, prices) {
  if (!pool) return null;
  const [a, b] = selected.assets;
  const amounts = { [a]: Number(reserve(pool, a)) / 1e6, [b]: Number(reserve(pool, b)) / 1e6 };
  const usd = Object.fromEntries(
    selected.assets.map((s) => [
      s,
      Number(prices[s]) > 0 && Number.isFinite(Number(prices[s])) ? Number(prices[s]) : null
    ])
  );
  const derived = [];
  if (!usd[a] && usd[b]) {
    usd[a] = (amounts[b] / amounts[a]) * usd[b];
    derived.push(a);
  }
  if (!usd[b] && usd[a]) {
    usd[b] = (amounts[a] / amounts[b]) * usd[a];
    derived.push(b);
  }
  const liquidity = amounts[a] * usd[a] + amounts[b] * usd[b];
  return usd[a] > 0 && usd[b] > 0 && Number.isFinite(liquidity)
    ? { prices: usd, liquidity, derived }
    : null;
}
export function parseSwapQuote(response) {
  for (const field of ['return_amount', 'commission_amount', 'spread_amount'])
    if (typeof response?.[field] !== 'string' || !/^\d{1,30}$/.test(response[field]))
      throw Error('Invalid swap quote');
  const returned = BigInt(response.return_amount),
    fee = BigInt(response.commission_amount),
    spread = BigInt(response.spread_amount);
  if (returned <= 0n) throw Error('Contract returned an empty quote');
  return { returned, fee, spread };
}
export function buildSwapTransaction(quote, address, slippage) {
  const selected = findPool(quote.offer, quote.receive);
  if (!selected || selected.id !== quote.poolId) throw Error('Swap pool changed. Review again.');
  if (
    quote.raw <= 0n ||
    quote.returned <= 0n ||
    quote.fee < 0n ||
    !Number.isFinite(slippage) ||
    slippage < 0.1 ||
    slippage > 10
  )
    throw Error('Invalid swap amounts or tolerance');
  const scale = 10n ** 18n,
    value = (quote.raw * scale) / (quote.returned + quote.fee);
  if (value <= 0n) throw Error('Swap price is outside the supported range');
  const belief = `${value / scale}.${String(value % scale).padStart(18, '0')}`.replace(
    /\.?0+$/,
    ''
  );
  const swap = {
    ask_asset_info: ASSETS[quote.receive].info,
    belief_price: belief,
    max_spread: (slippage / 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, ''),
    to: address,
    referral_address: null,
    referral_commission: null
  };
  const info = ASSETS[quote.offer].info;
  if (info.native)
    return {
      contract: selected.address,
      message: { swap: { offer_asset: { info, amount: String(quote.raw) }, ...swap } },
      funds: [{ denom: info.native, amount: String(quote.raw) }]
    };
  return {
    contract: info.token,
    message: {
      send: {
        contract: selected.address,
        amount: String(quote.raw),
        msg: btoa(JSON.stringify({ swap }))
      }
    },
    funds: []
  };
}
export function receivedFromEvents(events, symbol, address) {
  const info = ASSETS[symbol]?.info;
  if (!info) return 0n;
  for (const event of events || []) {
    const attrs = Object.fromEntries((event.attributes || []).map((a) => [a.key, a.value]));
    if (
      info.token &&
      event.type === 'wasm' &&
      attrs._contract_address === info.token &&
      attrs.action === 'transfer' &&
      attrs.to === address &&
      /^\d+$/.test(attrs.amount || '')
    )
      return BigInt(attrs.amount);
    if (info.native && event.type === 'transfer' && attrs.recipient === address) {
      for (const part of String(attrs.amount || '').split(',')) {
        const match = part.match(/^(\d+)(.+)$/);
        if (match?.[2] === info.native) return BigInt(match[1]);
      }
    }
  }
  return 0n;
}
