// Browser-local illustrative AMM. No chain addresses, wallet or network calls.
// All assets use six demo decimals. This is not deployable contract code.
export const UNIT = 1_000_000n;
export const ASSETS = Object.freeze(['JUNO', 'USDC', 'DAO', 'ATOM', 'OSMO']);
export const DEMO_NETA_USD = 4;
export const INCENTIVE_DAYS = 84;
export function incentivePlan({ token, reward, total, start }, now = new Date()) {
  if (!ASSETS.includes(token) || !['NETA', ...ASSETS].includes(reward))
    throw Error('Select a demo pool and reward asset.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw Error('Choose a valid UTC start date.');
  const date = new Date(`${start}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== start)
    throw Error('Choose a valid UTC start date.');
  if (date.getTime() < now.getTime()) throw Error('Choose a future UTC start date.');
  const end = new Date(date.getTime() + INCENTIVE_DAYS * 86400000).toISOString().slice(0, 10);
  return { token, reward, total: amount(total), start, end };
}
const LOCKED_SHARES = 1000n;
export function amount(value) {
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(String(value)))
    throw Error('Enter a positive amount with up to 6 decimals.');
  const [whole, decimals = ''] = String(value).split('.');
  const result = BigInt(whole) * UNIT + BigInt(decimals.padEnd(6, '0'));
  if (result <= 0n) throw Error('Enter an amount greater than zero.');
  return result;
}
export function decimal(value) {
  return `${value / UNIT}.${String(value % UNIT).padStart(6, '0')}`.replace(/\.?0+$/, '') || '0';
}
export function display(value) {
  return Number(value) / Number(UNIT);
}
function sqrt(n) {
  let x = n,
    y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}
export function initialState() {
  const pools = [
    ['JUNO', '100000', '2500'],
    ['USDC', '10000', '2500'],
    ['DAO', '50000', '2500'],
    ['ATOM', '300', '150']
  ].map(([token, a, b]) => ({
    token,
    reserve: amount(a),
    neta: amount(b),
    shares: sqrt(amount(a) * amount(b)),
    owned: 0n
  }));
  return {
    pools,
    balances: Object.fromEntries(
      [
        ['NETA', '1000'],
        ['JUNO', '10000'],
        ['USDC', '1000'],
        ['DAO', '1000'],
        ['ATOM', '100'],
        ['OSMO', '1000']
      ].map(([a, b]) => [a, amount(b)])
    ),
    fees: {},
    burned: 0n,
    swaps: 0
  };
}
export function poolFor(state, token) {
  const pool = state.pools.find((p) => p.token === token);
  if (!pool) throw Error('No NETA pool exists for this demo asset.');
  return pool;
}
export function featured(pool) {
  return pool.neta >= 250n * UNIT;
}
export function quote(pool, input, netaIn = false) {
  if (typeof input !== 'bigint' || input <= 0n) throw Error('Enter an amount greater than zero.');
  const reserveIn = netaIn ? pool.neta : pool.reserve;
  const reserveOut = netaIn ? pool.reserve : pool.neta;
  const gross = (reserveOut * input) / (reserveIn + input);
  const fee = (gross * 30n) / 10000n;
  const protocol = fee / 3n;
  const received = gross - fee;
  if (!received) throw Error('Amount is too small for this pool.');
  return {
    input,
    gross,
    fee,
    protocol,
    lp: fee - protocol,
    received,
    impact: Number((input * 1_000_000n) / (reserveIn + input)) / 10000,
    out: netaIn ? pool.token : 'NETA',
    in: netaIn ? 'NETA' : pool.token
  };
}
function movePool(state, pool, q, netaIn) {
  if (netaIn) {
    pool.neta += q.input;
    pool.reserve -= q.received + q.protocol;
  } else {
    pool.reserve += q.input;
    pool.neta -= q.received + q.protocol;
  }
  state.fees[q.out] = (state.fees[q.out] || 0n) + q.protocol;
}
export function swap(state, token, input, netaIn) {
  const pool = poolFor(state, token),
    q = quote(pool, input, netaIn);
  if (state.balances[q.in] < input) throw Error(`Not enough demo ${q.in}.`);
  movePool(state, pool, q, netaIn);
  state.balances[q.in] -= input;
  state.balances[q.out] += q.received;
  state.swaps++;
  return q;
}
export function depositQuote(pool, input) {
  if (input <= 0n) throw Error('Enter an amount greater than zero.');
  const neta = (input * pool.neta + pool.reserve - 1n) / pool.reserve;
  const shares = (input * pool.shares) / pool.reserve;
  if (!shares) throw Error('Deposit is too small.');
  return { neta, shares };
}
export function addLiquidity(state, token, input) {
  const pool = poolFor(state, token),
    q = depositQuote(pool, input);
  if (state.balances[token] < input || state.balances.NETA < q.neta)
    throw Error('Not enough demo tokens for both sides of this deposit.');
  pool.reserve += input;
  pool.neta += q.neta;
  pool.shares += q.shares;
  pool.owned += q.shares;
  state.balances[token] -= input;
  state.balances.NETA -= q.neta;
  return q;
}
export function withdraw(state, token) {
  const pool = poolFor(state, token);
  if (!pool.owned) throw Error('No demo liquidity to remove.');
  const input = (pool.reserve * pool.owned) / pool.shares,
    neta = (pool.neta * pool.owned) / pool.shares;
  pool.reserve -= input;
  pool.neta -= neta;
  pool.shares -= pool.owned;
  pool.owned = 0n;
  state.balances[token] += input;
  state.balances.NETA += neta;
  return { input, neta };
}
export function createPool(state, token, input, neta) {
  if (!ASSETS.includes(token)) throw Error('Select a supported demo asset.');
  if (state.pools.some((p) => p.token === token)) throw Error('This NETA pair already has a pool.');
  if (input <= 0n || neta <= 0n) throw Error('Both initial deposits must be positive.');
  if (state.balances[token] < input || state.balances.NETA < neta)
    throw Error('Not enough demo tokens.');
  const shares = sqrt(input * neta);
  if (shares <= LOCKED_SHARES) throw Error('Initial liquidity is too small.');
  state.pools.push({ token, reserve: input, neta, shares, owned: shares - LOCKED_SHARES });
  state.balances[token] -= input;
  state.balances.NETA -= neta;
}
// Preview on a clone: failures never partially spend fees or mutate the session.
// A fixed 1% per-hop impact ceiling demonstrates bounded execution, not an oracle.
export function buybackPreview(state) {
  const next = structuredClone(state),
    routes = [];
  let burned = 0n;
  for (const [asset, input] of Object.entries(state.fees)) {
    if (!input) continue;
    const attempt = structuredClone(next);
    try {
      attempt.fees[asset] -= input;
      let receipt = input;
      if (asset !== 'DAO') {
        if (asset !== 'NETA') {
          const pool = poolFor(attempt, asset),
            q = quote(pool, receipt, false);
          if (q.impact > 1) throw Error('Impact exceeds the demo 1% limit.');
          movePool(attempt, pool, q, false);
          receipt = q.received;
        }
        const pool = poolFor(attempt, 'DAO'),
          q = quote(pool, receipt, true);
        if (q.impact > 1) throw Error('Impact exceeds the demo 1% limit.');
        movePool(attempt, pool, q, true);
        receipt = q.received;
      }
      next.pools = attempt.pools;
      next.fees = attempt.fees;
      burned += receipt;
      routes.push({
        asset,
        input,
        received: receipt,
        path:
          asset === 'DAO'
            ? 'DAO → burn'
            : asset === 'NETA'
              ? 'NETA → DAO → burn'
              : `${asset} → NETA → DAO → burn`
      });
    } catch (error) {
      routes.push({ asset, input, skipped: error.message });
    }
  }
  next.burned += burned;
  return { next, burned, routes };
}
