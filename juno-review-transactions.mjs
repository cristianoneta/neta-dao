import { REVIEW_MAINNET_RELEASE as PIN } from './juno-review-mainnet-config.mjs';
import { verifyMainnetReview } from './juno-review-mainnet-read.mjs';
import { lookupTransaction } from './juno-faucet-transactions.mjs';
export async function executeMainnetReview({
  client,
  sender,
  contract,
  msg,
  memo,
  assertWallet,
  bundle = globalThis.NetaNamesSigning,
  storage = globalThis.localStorage,
  locks = globalThis.navigator?.locks,
  verify = verifyMainnetReview,
  lookup = (hash) => lookupTransaction(hash, fetch, 'juno-1')
}) {
  if (
    contract !== PIN.contract ||
    !msg ||
    Object.keys(msg).length !== 1 ||
    ![
      'publish_proposal',
      'add_revision',
      'add_comment',
      'set_thread_decision',
      'finalize',
      'withdraw'
    ].includes(Object.keys(msg)[0])
  )
    throw Error('Unsupported mainnet review action.');
  const guard = async () => {
    await assertWallet(sender);
    await verify({ requireActive: !msg.withdraw });
    await assertWallet(sender);
  };
  const bridge = bundle.createBridge({
    chainId: 'juno-1',
    client,
    storage,
    locks,
    assertWallet,
    lookup,
    verifyDeployment: guard
  });
  const request = {
    kind: 'execute',
    owner: sender,
    contract,
    msg: structuredClone(msg),
    memo,
    intentId: [...crypto.getRandomValues(new Uint8Array(16))]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
  };
  return bridge.execute(request, { beforeSign: guard });
}

let loadingSigning;
export async function loadReviewSigning() {
  if (globalThis.NetaNamesSigning) return globalThis.NetaNamesSigning;
  if (!loadingSigning)
    loadingSigning = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/names-signing.js?v=20261007-gzip';
      script.onload = () =>
        globalThis.NetaNamesSigning
          ? resolve(globalThis.NetaNamesSigning)
          : reject(Error('Review signing tools unavailable.'));
      script.onerror = () => {
        script.remove();
        reject(Error('Review signing tools could not be loaded. Retry.'));
      };
      document.head.append(script);
    }).catch((error) => {
      loadingSigning = null;
      throw error;
    });
  return loadingSigning;
}
