// Reviewed endpoints and transaction settings, never supplied by a price file.
export const NAMES_NETWORKS = Object.freeze({
  'uni-7': Object.freeze({label:'UNI-7', denom:'ujunox', gasPrice:'0.2ujunox',
    rests:Object.freeze(['https://juno.test.api.nodeshub.online','https://juno.api.t.stavr.tech']),
    rpcs:Object.freeze(['https://juno.test.rpc.nodeshub.online','https://juno.rpc.t.stavr.tech'])}),
  'juno-1': Object.freeze({label:'Juno mainnet', denom:'ujuno', gasPrice:'0.075ujuno',
    rests:Object.freeze(['https://juno-api.polkachu.com','https://juno.api.m.stavr.tech']),
    rpcs:Object.freeze(['https://juno-rpc.polkachu.com','https://rpc-juno.whispernode.com'])}),
});
export function namesNetwork(chainId) {
  if(!Object.hasOwn(NAMES_NETWORKS,chainId)) throw Error('Unsupported Names network.');
  return NAMES_NETWORKS[chainId];
}
