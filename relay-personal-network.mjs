// Personal-mainnet candidate only. No deployed mailbox address is invented.
export const PERSONAL_MAINNET_DEPLOYMENT = null;
export const PERSONAL_MAINNET_POLICY = Object.freeze({
  chain_id: 'juno-1',
  nns_registry: 'juno1pc8wrq89ljuhu2qt6rtk5lkkrptxajtf3un5llu8prg7r4z50vlszfhhza',
  dao_enabled: false
});
export const PERSONAL_MAINNET_OWNER = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
export const PERSONAL_MAINNET_WASM = '835323a60b0d418d0ef88e1fe12c02f8d65cc5c84fcf593135fdb18977f86708';
export function personalMainnetProfile(deployment = PERSONAL_MAINNET_DEPLOYMENT) {
  if (!deployment || deployment.chainId !== 'juno-1' || !/^juno1[0-9a-z]{58}$/.test(deployment.contract || '') ||
      deployment.creator !== PERSONAL_MAINNET_OWNER || deployment.admin !== PERSONAL_MAINNET_OWNER ||
      deployment.codeHash !== PERSONAL_MAINNET_WASM || !/^[1-9][0-9]*$/.test(String(deployment.codeId)) ||
      deployment.label !== 'NETA RELAY personal v0.4 · Juno mainnet') throw Error('Personal mainnet deployment is not verified');
  return Object.freeze({ chain: 'juno-1', contract: deployment.contract, creator: deployment.creator,
    admin: deployment.admin, codeId: String(deployment.codeId), codeHash: deployment.codeHash, label: deployment.label,
    rests: Object.freeze(['https://juno.api.m.stavr.tech','https://juno-api.polkachu.com']),
    rpcs: Object.freeze(['https://juno-rpc.polkachu.com','https://rpc-juno.whispernode.com']),
    chainConfig: null, fee: '0.075ujuno', policy: PERSONAL_MAINNET_POLICY });
}
export function personalMainnetPlan() {
  return { kind: 'unsigned-personal-mainnet-preparation', ready_to_sign: false, chain_id: 'juno-1',
    signing_wallet: PERSONAL_MAINNET_OWNER, upgrade_admin: PERSONAL_MAINNET_OWNER,
    wasm_sha256: PERSONAL_MAINNET_WASM, label: 'NETA RELAY personal v0.4 · Juno mainnet',
    instantiate: { mainnet: true }, funds: [], policy: { ...PERSONAL_MAINNET_POLICY },
    remaining: ['coherent off-device encrypted backup and restore', 'consent/refill/rotation client integration',
      'production runtime review', 'owner-reviewed deployment and two-wallet mainnet evidence'],
    note: 'Preparation only. Existing UNI-7 device state and deployment remain unchanged.' };
}
