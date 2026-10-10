// Verified mainnet deployment. The live contract pause controls community writes.
export const REVIEW_MAINNET_OWNER = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
export const REVIEW_MAINNET_WASM =
  '2974c3de6c5cd2ad71de0ce2af45a50535fc55a79c5e85556923790c6274decf';
export const REVIEW_MAINNET_MSG = Object.freeze({
  owner: REVIEW_MAINNET_OWNER,
  dao_voting_contract: 'juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl',
  stake_contract: 'juno1a7x8aj7k38vnj9edrlymkerhrl5d4ud3makmqhx6vt3dhu0d824qh038zh',
  minimum_comment_stake: '0',
  community_gate: Object.freeze({
    native_denom: 'ujuno',
    minimum_native_stake: '1000000',
    minimum_neta_stake: '0'
  })
});
export const REVIEW_MAINNET_POLICY = Object.freeze({
  ...REVIEW_MAINNET_MSG,
  pending_owner: null,
  paused: true,
  comment_cooldown_seconds: 30
});
// Both deployment transactions and the paused instance were independently verified.
export const REVIEW_MAINNET_RELEASE = Object.freeze({
  chainId: 'juno-1',
  contract: 'juno15wwr9dezyfp86p4px5p664gguargukml3wa9pctw9nutfn2rzk9qwf45gq',
  creator: 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57',
  admin: 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57',
  codeId: 5171,
  codeHash: '2974c3de6c5cd2ad71de0ce2af45a50535fc55a79c5e85556923790c6274decf',
  label: 'Juno community review v0.3.1 \u00b7 Juno mainnet'
});
