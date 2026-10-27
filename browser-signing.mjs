// No wallet access or signing at module initialization. Each loader is shared by
// all callers and retains the existing signing bundle and journal implementation.
export function signingLoader({
  name,
  source,
  scope = globalThis,
  document: doc = globalThis.document,
  timeoutMs = 30000
}) {
  let loading;
  return async () => {
    if (scope[name]) return scope[name];
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const script = doc.createElement('script');
        let timer;
        const finish = (error) => {
          clearTimeout(timer);
          script.onload = script.onerror = null;
          if (error) {
            script.remove();
            reject(error);
          } else resolve(scope[name]);
        };
        script.src = source;
        script.onload = () =>
          finish(scope[name] ? null : Error('Signing tools unavailable. Retry.'));
        script.onerror = () => finish(Error('Signing tools could not be loaded. Retry.'));
        timer = setTimeout(() => finish(Error('Signing tools timed out. Retry.')), timeoutMs);
        doc.head.append(script);
      }).catch((error) => {
        loading = null;
        throw error;
      });
    }
    return loading;
  };
}

export const loadGovernanceSigning = signingLoader({
  name: 'NetaJunoGovernance',
  source: '/assets/juno-governance-signing.js?v=20261027-proposal-gas-1'
});
export const loadSocialsSigning = signingLoader({
  name: 'NetaSocialsTestnet',
  source: '/assets/socials-testnet-client.js?v=6'
});
