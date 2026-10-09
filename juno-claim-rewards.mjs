import { PROGRAMME, snapshot } from './juno-delegation-core.mjs';

const raw = (v) => typeof v === 'string' && /^(0|[1-9]\d{0,29})$/.test(v);
function fresh(value, now) {
  const time = Date.parse(value);
  return Number.isFinite(time) && now - time <= 3600000 && time - now <= 300000;
}

// The existing holdings collector reads the complete distribution response at a
// confirmed height, reconciles totals and truncates each validator withdrawal
// separately. This is current claimable rewards, never daily accounting income.
export function claimRewardsOverview(treasury, input, now = Date.now()) {
  const planner = snapshot(input);
  if (![planner.blockTime, planner.collectedAt].every((v) => fresh(v, now)))
    throw Error('Programme data is older than one hour. Refresh data.');
  if (
    treasury?.schema_version !== 1 ||
    treasury.chain_id !== 'juno-1' ||
    treasury.dao_id !== 'juno-delegation' ||
    treasury.treasury_address !== PROGRAMME ||
    treasury.treasury_type !== 'dao-core-staking' ||
    !['LIVE', 'PARTIAL'].includes(treasury.status) ||
    treasury.balance_height_pinned !== true ||
    !Number.isSafeInteger(treasury.height) ||
    treasury.height <= 0 ||
    !Array.isArray(treasury.assets) ||
    treasury.staking?.withdraw_address !== PROGRAMME ||
    !Array.isArray(treasury.staking?.rewards) ||
    treasury.staking.validator_count !==
      planner.validators.filter((v) => BigInt(v.currentRaw) > 0n).length
  )
    throw Error('Complete programme rewards data is unavailable. Refresh data.');
  // PARTIAL describes USD valuation in this holdings format. Quantity coverage
  // is checked separately; unpriced assets must not hide known JUNO rewards.
  if (![treasury.generated_at, treasury.checked_at].every((v) => fresh(v, now)))
    throw Error('Rewards snapshot is older than one hour or has an invalid time. Refresh data.');
  if (!/^https:\/\//.test(treasury.balance_source || ''))
    throw Error('Rewards snapshot source is unavailable.');
  const coins = treasury.staking.rewards;
  if (
    new Set(coins.map((c) => c?.denom)).size !== coins.length ||
    coins.some((c) => typeof c?.denom !== 'string' || !c.denom || !raw(c.amount))
  )
    throw Error('Invalid programme rewards amounts. Refresh data.');
  const amountRaw = coins.find((c) => c.denom === 'ujuno')?.amount || '0';
  const assets = treasury.assets.filter((a) => a.key === 'juno:native:ujuno:rewards');
  const asset = assets[0];
  if (
    assets.length > 1 ||
    (BigInt(amountRaw) > 0n && !asset) ||
    (asset &&
      (asset.raw_amount !== amountRaw ||
        asset.base_denom !== 'ujuno' ||
        asset.decimals !== 6 ||
        asset.custody_address !== PROGRAMME ||
        asset.source_chain !== 'juno' ||
        asset.position !== 'Claimable rewards'))
  )
    throw Error('Programme rewards amounts do not reconcile. Refresh data.');
  const priceAssets = treasury.assets.filter(
    (a) =>
      a.base_denom === 'ujuno' &&
      a.source_chain === 'juno' &&
      a.custody_address === PROGRAMME &&
      a.decimals === 6
  );
  const prices = priceAssets.map((a) => a.usd_price);
  const price =
    prices.length &&
    prices.every(
      (v) =>
        typeof v === 'string' &&
        /^\d+(\.\d+)?$/.test(v) &&
        Number(v) > 0 &&
        Number.isFinite(Number(v)) &&
        v === prices[0]
    ) &&
    typeof treasury.price_source === 'string' &&
    treasury.price_source &&
    treasury.price_source !== 'Unavailable'
      ? Number(prices[0])
      : null;
  const usd = price === null ? null : (Number(amountRaw) / 1000000) * price;
  return {
    amountRaw,
    height: treasury.height,
    observedAt: treasury.generated_at,
    checkedAt: treasury.checked_at,
    source: treasury.balance_source,
    validatorCount: treasury.staking.validator_count,
    usd: Number.isFinite(usd) ? usd : null,
    priceObservedAt: price === null ? null : treasury.generated_at
  };
}
