// @ts-check
/** @typedef {{address: string|null, contract: string|null, chainId: string,
 * walletChain: string|null, walletEpoch: number, requestEpoch: number,
 * selectedKey?: string, selectedId: number|string|null}} ReviewContext */

/** A changed selection, chain or account invalidates an in-flight review operation.
 * @param {() => ReviewContext} read */
export function captureReviewContext(read) {
  const captured = { ...read() };
  return {
    ...captured,
    assert() {
      const current = read();
      if (
        !captured.address ||
        current.walletChain !== captured.chainId ||
        Object.keys(captured).some(
          (key) =>
            captured[/** @type {keyof ReviewContext} */ (key)] !==
            current[/** @type {keyof ReviewContext} */ (key)]
        )
      )
        throw Error(
          'Governance context changed. Reconnect the original wallet and check transaction status.'
        );
    }
  };
}
