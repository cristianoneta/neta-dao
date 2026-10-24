import { captureReviewContext } from './review-context.mjs';
import { reconcileReviewTransaction } from '../../review-publication.mjs';

export function reviewSession({
  context,
  label,
  lookup,
  feedback,
  storage = globalThis.localStorage,
  locks = globalThis.navigator?.locks
}) {
  const reviewContext = () => captureReviewContext(context);
  const receiptKey = (address = context().address, chainId = context().chainId) =>
    `cosmoot:review-receipt:${chainId}:${address}`;
  function saveReviewReceipt(result, current, intent = null) {
    if (result && result.code !== undefined && result.code !== 0) return;
    const key = receiptKey(current.address, current.chainId);
    const value = JSON.stringify({
      result,
      contract: current.contract,
      chainId: current.chainId,
      selectedId: current.selectedId,
      intent
    });
    storage.setItem(key, value);
    if (storage.getItem(key) !== value)
      throw Error('Confirmed transaction could not be saved. Do not repeat this action.');
  }
  function pendingReview() {
    const current = context();
    if (!current.address || current.walletChain !== current.chainId) return false;
    try {
      return (
        !!storage.getItem(`neta-pending-tx-v1:${current.chainId}:${current.address}`) ||
        !!storage.getItem(receiptKey())
      );
    } catch {
      return true;
    }
  }
  async function reconcileReview(current = reviewContext(), intent = null) {
    current.assert();
    feedback(`Checking the previous ${label()} transaction. No new signature is requested.`);
    return reconcileReviewTransaction({
      storage,
      locks,
      sender: current.address,
      chainId: current.chainId,
      assertCurrent: current.assert,
      onConfirmed: (result) => saveReviewReceipt(result, current, intent),
      fetchTx: lookup
    });
  }
  return { reviewContext, receiptKey, saveReviewReceipt, pendingReview, reconcileReview };
}
