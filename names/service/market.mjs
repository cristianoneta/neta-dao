import {POOL, NETA, LP, CHAIN, USD_SOURCE} from './constants.mjs';

const U128 = 1n << 128n;
export function uint(value, positive = false) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,38})$/.test(value)) throw Error('Noncanonical market integer.');
  const n = BigInt(value);
  if (n >= U128 || (positive && n === 0n)) throw Error('Market integer out of range.');
  return n;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const native = {native: 'ujuno'}, token = {token: NETA};
export function poolObservation({pair, cumulative, tokenInfo, height, time, hash}) {
  if (pair?.contract_addr !== POOL || pair.liquidity_token !== LP || !same(pair.pair_type, {xyk: {}})
    || !Array.isArray(pair.asset_infos) || pair.asset_infos.length !== 2
    || !pair.asset_infos.some(x => same(x, native)) || !pair.asset_infos.some(x => same(x, token))
    || tokenInfo?.decimals !== 6 || tokenInfo.symbol !== 'NETA') throw Error('WYND pair/token identity mismatch.');
  const assets = cumulative?.assets;
  if (!Array.isArray(assets) || assets.length !== 2) throw Error('Invalid WYND reserves.');
  const juno = assets.find(a => same(a.info, native)), neta = assets.find(a => same(a.info, token));
  uint(juno?.amount, true); uint(neta?.amount, true);
  const entries = cumulative.cumulative_prices;
  if (!Array.isArray(entries) || entries.length !== 2) throw Error('Invalid WYND accumulators.');
  // WYND xyk accumulates ask/offer * 10^6 per second: NETA -> JUNO, not its reciprocal.
  const entry = entries.find(x => x.length === 3 && same(x[0], token) && same(x[1], native));
  uint(entry?.[2]);
  if (!Number.isSafeInteger(height) || height < 1 || !Number.isSafeInteger(time) || time < 1 || !hash) throw Error('Missing block anchor.');
  return {chain_id: CHAIN, address: POOL, token: NETA, native_denom: 'ujuno',
    token_decimals: 6, native_decimals: 6, height, observed_at: time, hash,
    juno_reserve: juno.amount, neta_reserve: neta.amount, cumulative: entry[2]};
}

export function addObservation(samples, current, policy) {
  const last = samples.at(-1);
  if (last && (current.height < last.height || current.observed_at < last.observed_at)) throw Error('Pool observation regressed.');
  if (last?.height === current.height) {
    if (!same(last, current)) throw Error('Conflicting observation at the same height.');
    return samples;
  }
  // Bound storage, but retain the sample immediately preceding the required window.
  const cutoff = current.observed_at - policy.twap_seconds - policy.max_sample_gap;
  return [...samples.filter(s => s.observed_at >= cutoff), current].slice(-200);
}

export function averagedPool(samples, policy, now) {
  const end = samples.at(-1);
  if (!end || end.observed_at > now || now - end.observed_at > policy.max_pool_age) throw Error('Pool observation stale.');
  const startIndex = samples.findLastIndex(s => end.observed_at - s.observed_at >= policy.twap_seconds);
  if (startIndex < 0) throw Error('WYND average warming up (30 minutes).');
  const window = samples.slice(startIndex), start = window[0];
  if (end.observed_at - start.observed_at > policy.twap_seconds + policy.max_sample_gap) throw Error('Average window too old.');
  for (let i = 0; i < window.length; i++) {
    const s = window[i];
    if (uint(s.juno_reserve, true) < uint(policy.min_juno_reserve, true) || uint(s.neta_reserve, true) < uint(policy.min_neta_reserve, true)) throw Error('Insufficient liquidity in average window.');
    if (i && (s.height <= window[i - 1].height || s.observed_at <= window[i - 1].observed_at || s.observed_at - window[i - 1].observed_at > policy.max_sample_gap)) throw Error('Gap in price observations.');
  }
  // Uint128 cumulative prices wrap in the WYND contract.
  const delta = (uint(end.cumulative) - uint(start.cumulative) + U128) % U128;
  const average = delta / BigInt(end.observed_at - start.observed_at);
  if (average < 1n) throw Error('Invalid WYND average.');
  const spot = uint(end.juno_reserve, true) * 1_000_000n / uint(end.neta_reserve, true);
  const diff = spot > average ? spot - average : average - spot;
  if (diff * 10000n > average * BigInt(policy.max_spot_deviation_bps)) throw Error('WYND spot price deviates from average.');
  return {...end, twap_price_6: average.toString(), twap_start: start.observed_at};
}

// Parse the JSON number token as decimal text: never round USD through a float.
export function usdObservation(body, now) {
  const parsed = JSON.parse(body), data = parsed['juno-network'];
  if (!data || Object.keys(parsed).length !== 1) throw Error('Unexpected USD feed asset.');
  const prices = [...body.matchAll(/"usd"\s*:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g)];
  if (prices.length !== 1) throw Error('Ambiguous USD price.');
  const match = prices[0][1].match(/^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  if (!match) throw Error('Invalid USD reference.');
  const fraction = match[2] || '', exponent = Number(match[3] || 0) + 12 - fraction.length;
  if (Math.abs(exponent) > 80) throw Error('USD exponent out of range.');
  const digits = BigInt(match[1] + fraction);
  const value = exponent >= 0 ? digits * 10n ** BigInt(exponent) : digits / 10n ** BigInt(-exponent);
  uint(value.toString(), true);
  const observed_at = data.last_updated_at;
  if (!Number.isSafeInteger(observed_at) || observed_at <= 0 || observed_at > now) throw Error('Invalid USD feed timestamp.');
  return {source: USD_SOURCE, asset: 'JUNO', usd_per_juno_12: value.toString(), observed_at};
}
