// Test-only exclusive access to a local CoreCrypto device. Hold the lock
// throughout the client's lifetime, including export and import operations.
// Web Locks are scoped to this origin; this does not coordinate other browsers.
export async function acquireDeviceLock({ chain, wallet, path }) {
  if (typeof chain !== 'string' || !chain || typeof wallet !== 'string' || !wallet ||
      typeof path !== 'string' || !path) throw Error('Device identity required');
  if (!globalThis.navigator?.locks?.request) throw Error('Web Locks unavailable: device remains locked');

  // Lock the physical database path, not the claimed wallet. Two wallets must
  // never open the same CoreCrypto database simultaneously.
  const name = `relay-corecrypto:${path}`;
  let resolveEntered;
  let rejectEntered;
  const entered = new Promise((resolve, reject) => { resolveEntered = resolve; rejectEntered = reject; });
  let releaseHold;
  const hold = new Promise(resolve => { releaseHold = resolve; });
  const request = navigator.locks.request(name, { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock) { rejectEntered(Error('Device is already open in another tab')); return; }
    resolveEntered();
    await hold;
  });
  request.catch(rejectEntered);
  await entered;
  let released = false;
  return {
    identity: Object.freeze({ chain, wallet, path }),
    async release() {
      if (released) return;
      released = true;
      releaseHold();
      await request;
    },
  };
}
