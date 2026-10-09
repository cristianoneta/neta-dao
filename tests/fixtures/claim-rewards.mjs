import { PROGRAMME } from '../../juno-delegation-core.mjs';

export function rewardsFixture(planner, amount = '3837025339927') {
  const now = new Date().toISOString();
  return {
    schema_version: 1,
    chain_id: 'juno-1',
    dao_id: 'juno-delegation',
    treasury_address: PROGRAMME,
    treasury_type: 'dao-core-staking',
    status: 'LIVE',
    balance_height_pinned: true,
    height: planner.height,
    generated_at: now,
    checked_at: now,
    balance_source: 'https://example.org',
    price_source: 'Fixture USD price',
    staking: {
      validator_count: planner.validators.filter((v) => BigInt(v.currentRaw) > 0n).length,
      withdraw_address: PROGRAMME,
      rewards: [{ denom: 'ujuno', amount }]
    },
    assets: [
      {
        key: 'juno:native:ujuno:rewards',
        base_denom: 'ujuno',
        decimals: 6,
        source_chain: 'juno',
        custody_address: PROGRAMME,
        position: 'Claimable rewards',
        raw_amount: amount,
        usd_price: '0.00883401'
      }
    ]
  };
}
