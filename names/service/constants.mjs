export const CHAIN = 'juno-1';
export const NETA = 'juno168ctmpyppk90d34p3jjy658zf5a5l3w8wk35wht6ccqj4mr0yv8s4j5awr';
export const DAO = 'juno1c5v6jkmre5xa9vf9aas6yxewc7aqmjy0rlkkyk4d88pnwuhclyhsrhhns6';
export const POOL = 'juno1h6x5jlvn6jhpnu63ufe4sgv4utyk8hsfl5rqnrpg2cvp6ccuq4lqwqnzra';
export const LP = 'juno1uu3cewmpynvgsdu3lfqv2rh2n5nwtrguahkw64wjk99eg8r6fsss0e757x';
export const RESTS = Object.freeze(['https://juno.api.m.stavr.tech', 'https://api.juno.validatus.com']);
export const USD_SOURCE = 'coingecko:juno-network:usd';
export const ORIGIN = 'https://dao.netareborn.com';
export const ARTIFACTS = Object.freeze({
  registry: '76a8ce6ce72d8ea73116bafad83a770438aa0e3e8f1f87957177d855ddee8b65',
  profiles: '9d47676d8dd0040b1cea4a39a3e8c95a75ea4841cd5b2eb5feb83c7f4516ceed',
});
export const TARIFF = Object.freeze({three_cents: 9900, four_cents: 1900, standard_cents: 500});
export const POLICY = Object.freeze({
  pool: POOL, neta_token: NETA, usd_source: USD_SOURCE,
  max_pool_age: 90, max_usd_age: 300, max_jump_bps: 1000, max_baseline_age: 7200,
  min_juno_reserve: '80000000000', min_neta_reserve: '700000000',
  twap_seconds: 1800, max_sample_gap: 120, max_spot_deviation_bps: 1000,
});
