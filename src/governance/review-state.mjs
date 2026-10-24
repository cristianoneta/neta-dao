// @ts-check
/** @typedef {{source: string, status: string, author?: string, nativeId?: string|number}} Review */
/** @typedef {{selected: Review|null, native: boolean, readOnly: boolean, address: string|null,
 * walletChain: string|null, reviewChain: string, canPublish: boolean, contract: string|null,
 * setupAdmin: string, configOwner: string|null, busy: boolean, pending: boolean,
 * hasSubmissionReceipt: boolean}} ReviewState */

/** UI permissions describe review actions only. Native submission re-verifies frozen
 * content, authority, chain state and transaction receipts in its own controller.
 * @param {ReviewState} state */
export function reviewActionState(state) {
  const { selected, native, address } = state;
  const phase = !selected
    ? 'draft'
    : selected.source === 'chain' || selected.nativeId
      ? 'submitted'
      : selected.status === 'discussion'
        ? 'discussion'
        : selected.status === 'ready'
          ? 'ready'
          : 'closed';
  const discussion = phase === 'discussion';
  const member = state.canPublish;
  const needsSetup = native && !state.contract;
  const canSetup = needsSetup && address === state.setupAdmin;
  const withdrawable = discussion || (native && phase === 'ready');
  const canWithdraw = !!(
    withdrawable &&
    selected?.source === 'workshop' &&
    selected.author === address &&
    (native || address === state.configOwner)
  );
  const writable =
    !!address &&
    state.walletChain === state.reviewChain &&
    !state.busy &&
    !state.pending &&
    !(state.readOnly && !native) &&
    phase !== 'submitted';
  return {
    phase,
    discussion,
    member,
    needsSetup,
    canSetup,
    withdrawable,
    canWithdraw,
    publish: writable && phase === 'draft' && (needsSetup ? canSetup : member),
    revise: writable && discussion && member,
    finalize: writable && discussion && member,
    withdraw: writable && canWithdraw && !state.hasSubmissionReceipt,
    edit: !state.busy && (phase === 'draft' || (discussion && member))
  };
}

/** @param {{finalized: boolean, legacyReceipt: boolean, invalid: boolean, visible: boolean}} state */
export function nativeSubmissionVisible(state) {
  return (state.finalized || state.legacyReceipt) && !state.invalid && state.visible;
}
