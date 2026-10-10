import {
  verifyReview,
  findReviewSubmission,
  submissionTerms,
  canonical
} from './juno-community-governance.mjs';
import {
  preflight,
  proposalContent,
  displayJuno,
  submissionReceipt
} from './juno-governance-core.mjs';

export function nativePlanner({
  active,
  draft,
  values,
  address,
  chain,
  connectWallet,
  rests,
  rpcs,
  reviewRests,
  blocked = () => false,
  onSubmitted,
  status: globalStatus,
  busy,
  rerender
}) {
  const reviewEndpoints = () => (typeof reviewRests === 'function' ? reviewRests() : reviewRests);
  const $ = (selector) => document.querySelector(selector);
  let reviewed = null,
    client = null,
    generation = 0,
    working = false,
    termsState = null;
  const status = (text, error = false) => {
    globalStatus(text, error);
    const node = $('#planner-native-status');
    node.textContent = text;
    node.hidden = !text;
    node.dataset.state = error ? 'error' : 'ready';
    if (error) {
      node.focus({ preventScroll: true });
      node.scrollIntoView({ block: 'nearest' });
    }
  };
  const receiptKey = (id = draft().id) => `cosmoot:juno:planner-proposal:${id}:submission`;
  const saveReceipt = (id, value) => {
    const key = receiptKey(id),
      record = JSON.stringify(value);
    localStorage.setItem(key, record);
    if (localStorage.getItem(key) !== record) throw Error('Submission record could not be saved.');
  };
  const receipt = () => {
    try {
      const record = JSON.parse(localStorage.getItem(receiptKey()) || 'null');
      if (
        record &&
        (!['broadcast', 'included', 'failed'].includes(record.state) ||
          !/^[A-F0-9]{64}$/.test(record.hash))
      )
        throw Error('Invalid receipt');
      return record;
    } catch {
      return { state: 'unreadable' };
    }
  };
  function invalidate() {
    generation++;
    reviewed = null;
    $('#planner-native-review').hidden = true;
    render();
  }
  async function loadTerms(force = false) {
    if (!active() || receipt()) return;
    const id = draft().id;
    if (!force && termsState?.id === id) return;
    const request = { id, loading: true };
    termsState = request;
    render();
    try {
      const proof = await submissionTerms(rests);
      if (termsState === request) Object.assign(request, proof);
    } catch (error) {
      if (termsState === request) request.error = error.message;
    } finally {
      request.loading = false;
      if (active() && draft().id === id && termsState === request) render();
    }
  }
  function render() {
    $('#planner-native-panel').hidden = !active();
    $('#action-hint').hidden = active();
    if (!active()) return;
    const previous = receipt(),
      button = $('#primary-action');
    button.hidden = !previous;
    button.textContent = working
      ? 'CHECKING JUNO…'
      : previous?.state === 'broadcast'
        ? 'CHECK SUBMISSION STATUS'
        : previous?.state === 'included'
          ? 'SUBMISSION CONFIRMED'
          : 'SUBMISSION RECORDED';
    button.disabled = working || (!!previous && previous.state !== 'broadcast');
    $('#planner-native-inputs').hidden = !!previous;
    $('#planner-native-refresh').hidden = !!previous;
    $('#planner-native-refresh').disabled = working || !!termsState?.loading;
    $('#planner-native-heading').textContent = 'Submit finalized proposal';
    if (previous) {
      $('#planner-native-terms').textContent = `${
        previous.state === 'included'
          ? 'Proposal submission confirmed. This does not mean the proposal passed or rewards were claimed.'
          : previous.state === 'failed'
            ? `Transaction failed (code ${previous.code}). Review the failure before preparing a new draft.`
            : 'A submission is already recorded. Check its status without signing again.'
      }${previous.hash ? ' · TX ' + previous.hash : ''}`;
      return;
    }
    if (termsState?.id !== draft().id) {
      void loadTerms();
      return;
    }
    const terms = termsState.terms;
    $('#planner-native-refresh').hidden = !termsState.error;
    $('#planner-native-terms').textContent =
      termsState.error ||
      (terms
        ? `${displayJuno(terms.initial)} JUNO submits the proposal to the chain; others can fund the remainder. ${displayJuno(terms.total)} JUNO covers the full voting deposit. A network fee is added. Deposits follow Juno’s refund and burn rules.`
        : 'Loading current deposit requirements…');
    $('#planner-native-terms').dataset.state = termsState.error ? 'error' : 'ready';
    for (const [selector, key] of [
      ['#planner-native-minimum', 'initial'],
      ['#planner-native-full', 'total']
    ]) {
      const action = $(selector);
      action.textContent = terms
        ? `Submit with ${displayJuno(terms[key])} JUNO`
        : 'Loading deposit…';
      action.disabled = working || blocked() || !terms || !!termsState.loading;
      action.classList.toggle('review-action-busy', working);
    }
    $('#planner-native-minimum').hidden = !!terms && terms.initial === terms.total;
  }
  const current = (epoch, fingerprint, sender, id) => {
    if (
      generation !== epoch ||
      !active() ||
      draft()?.id !== id ||
      sender !== address() ||
      chain() !== 'juno-1' ||
      JSON.stringify(values()) !== fingerprint
    )
      throw Error('Proposal or wallet changed. Review the proposal again.');
  };
  async function wallet(sender) {
    if (
      !window.keplr ||
      chain() !== 'juno-1' ||
      address() !== sender ||
      (await window.keplr.getOfflineSigner('juno-1').getAccounts())[0]?.address !== sender
    )
      throw Error('Keplr account changed. Reconnect and review again.');
  }
  async function run(choice = 'total') {
    if (!active() || working || blocked()) return;
    const previous = receipt(),
      id = draft().id;
    if (previous) {
      if (previous.state !== 'broadcast') return;
      working = true;
      busy(true);
      render();
      try {
        const result = await submissionReceipt(rests, previous.hash);
        saveReceipt(id, { ...previous, ...result });
        if (active() && draft()?.id === id)
          status(
            result.code === 0
              ? `JUNO PROPOSAL SUBMISSION CONFIRMED · TX ${result.hash}`
              : `TRANSACTION FAILED · CODE ${result.code} · TX ${result.hash}`,
            result.code !== 0
          );
      } catch (error) {
        if (active() && draft()?.id === id) status(error.message, true);
      } finally {
        working = false;
        busy(false);
        rerender();
      }
      return;
    }
    if (!address() || chain() !== 'juno-1') {
      await connectWallet();
      return;
    }
    const displayed = termsState;
    if (!displayed?.terms || displayed.id !== id || !['initial', 'total'].includes(choice)) return;
    working = true;
    busy(true);
    render();
    try {
      if (!draft().review)
        throw Error('Publish and finalize the community review before mainnet submission.');
      const epoch = generation,
        sender = address(),
        fingerprint = JSON.stringify(values()),
        expectedReview = draft().review,
        content = {
          ...proposalContent(draft().kind, values()),
          metadata: expectedReview.content.metadata
        };
      if (canonical(content) !== canonical(expectedReview.content))
        throw Error('The proposal differs from the finalized review.');
      await wallet(sender);
      {
        localStorage.setItem(`cosmoot:juno:planner-proposal:${draft().id}:revision`, fingerprint);
        status('CHECKING JUNO GOVERNANCE, DEPOSIT AND PROGRAMME AUTHORITY…');
        await verifyReview(reviewEndpoints(), expectedReview);
        const existing = await findReviewSubmission(rests, content);
        current(epoch, fingerprint, sender, id);
        if (existing.length) {
          await onSubmitted(existing[0]);
          return;
        }
        const proof = await preflight(rests, content, sender);
        current(epoch, fingerprint, sender, id);
        if (canonical(proof.terms) !== canonical(displayed.terms)) {
          termsState = { id, terms: proof.terms, checkedAt: proof.checkedAt };
          throw Error('Deposit requirements changed. Review the updated amounts and choose again.');
        }
        const deposit = proof.terms[choice];
        // Require direct signing for native gov v1; never silently fall back to legacy Amino.
        const base = window.keplr.getOfflineSigner('juno-1');
        if (typeof base.signDirect !== 'function')
          throw Error('A Keplr account with direct signing support is required.');
        client?.disconnect();
        client = await NetaJunoGovernance.connect(rpcs, {
          getAccounts: () => base.getAccounts(),
          signDirect: (a, d) =>
            window.keplr.signDirect('juno-1', a, d, { preferNoSetFee: true, preferNoSetMemo: true })
        });
        const gas = await NetaJunoGovernance.simulate(client, content, sender, deposit),
          fee = NetaJunoGovernance.fixedFee(gas, 1.4, '0.075ujuno', 2000000);
        current(epoch, fingerprint, sender, id);
        await wallet(sender);
        if (BigInt(proof.balance) < BigInt(deposit) + BigInt(fee.amount[0].amount))
          throw Error('Insufficient spendable JUNO for the reviewed deposit and fee.');
        reviewed = { epoch, fingerprint, sender, id, content, deposit, fee, proof, expectedReview };
        $('#planner-native-review-text').textContent =
          `Juno mainnet · ${sender}\nInitial deposit: ${displayJuno(deposit)} JUNO · Estimated fee: ${displayJuno(fee.amount[0].amount)} JUNO\n` +
          `Total deposit needed for voting: ${displayJuno(proof.terms.total)} JUNO · Verified at block ${proof.height}.\n` +
          (content.messages.length
            ? 'Juno governance instructs the programme treasury to claim its staking rewards after approval.'
            : 'Text-only rule approval. No delegation or treasury execution is authorized.') +
          '\nThe deposit is subject to Juno’s refund and burn rules. If the total deposit is not reached in time, the proposal will not enter voting. The fee is paid when submitting.';
        $('#planner-native-review').hidden = false;
        status('PROPOSAL CHECKED · CONFIRM THE DEPOSIT AND FEE IN KEPLR');
      }
      {
        const review = reviewed;
        current(review.epoch, review.fingerprint, review.sender, review.id);
        const guard = async () => {
          current(review.epoch, review.fingerprint, review.sender, review.id);
          if (receipt()) throw Error('A submission is already recorded for this draft.');
          await verifyReview(reviewEndpoints(), review.expectedReview);
          if ((await findReviewSubmission(rests, review.content)).length)
            throw Error(
              'This review already has an on-chain proposal. Refresh to open its funding.'
            );
          current(review.epoch, review.fingerprint, review.sender, review.id);
          if (Date.now() - review.proof.checkedAt > 120000)
            throw Error('Proposal review expired. Review fresh chain data again.');
        };
        // Repeat the whole preflight immediately before signing; parameters must
        // still match the review, and the current balance must cover the exact fee.
        const fresh = await preflight(rests, review.content, review.sender);
        if (
          JSON.stringify(fresh.params) !== JSON.stringify(review.proof.params) ||
          BigInt(fresh.balance) < BigInt(review.deposit) + BigInt(review.fee.amount[0].amount)
        )
          throw Error('Governance parameters or balance changed. Review again.');
        if (!navigator.locks?.request) throw Error('A device lock is required to submit safely.');
        const result = await navigator.locks.request(
          receiptKey(review.id),
          { mode: 'exclusive', ifAvailable: true },
          async (lock) => {
            if (!lock) throw Error('Another tab is submitting this draft.');
            await guard();
            return NetaJunoGovernance.submit(
              client,
              review.content,
              review.sender,
              review.deposit,
              review.fee,
              {
                assertWallet: () => wallet(review.sender),
                beforeSign: guard,
                beforeBroadcast: async (hash) => {
                  await guard();
                  current(review.epoch, review.fingerprint, review.sender, review.id);
                  saveReceipt(review.id, { state: 'broadcast', hash, proposer: review.sender });
                }
              }
            );
          }
        );
        const record = {
          state: 'included',
          hash: result.transactionHash,
          height: result.height,
          proposer: review.sender
        };
        saveReceipt(review.id, record);
        if (active() && draft()?.id === review.id) {
          status(`JUNO PROPOSAL SUBMITTED · TX ${result.transactionHash}`);
          const existing = await findReviewSubmission(rests, review.content);
          if (existing.length) await onSubmitted(existing[0]);
        }
      }
    } catch (error) {
      invalidate();
      status(error.message || String(error), true);
    } finally {
      working = false;
      busy(false);
      rerender();
    }
  }
  $('#planner-native-minimum').onclick = () => run('initial');
  $('#planner-native-full').onclick = () => run('total');
  $('#planner-native-refresh').onclick = () => loadTerms(true);
  for (const id of ['proposal-title', 'proposal-summary', 'proposal-body', 'proposal-actions'])
    $('#' + id).addEventListener('input', invalidate);
  window.addEventListener('neta:relay-panel', invalidate);
  window.addEventListener('hashchange', invalidate);
  window.addEventListener('neta:dao-change', invalidate);
  window.addEventListener('pagehide', invalidate);
  window.addEventListener('storage', (event) => {
    if (active() && event.key === receiptKey()) invalidate();
  });
  window.addEventListener('neta:wallet-change', () => {
    client?.disconnect();
    client = null;
    invalidate();
  });
  async function withdraw(task) {
    const expected = draft()?.review,
      id = draft()?.id,
      sender = address(),
      epoch = generation;
    if (!expected || !navigator.locks?.request)
      throw Error('Reopen the finalized review before withdrawing it.');
    return navigator.locks.request(
      receiptKey(id),
      { mode: 'exclusive', ifAvailable: true },
      async (lock) => {
        if (!lock) throw Error('Another tab is processing this proposal.');
        if (receipt())
          throw Error('A submission is already recorded. Check its status before withdrawing.');
        await verifyReview(reviewEndpoints(), expected);
        if ((await findReviewSubmission(rests, expected.content)).length)
          throw Error(
            'This review was already submitted to Juno. Its on-chain proposal cannot be withdrawn here.'
          );
        if (
          !active() ||
          draft()?.id !== id ||
          address() !== sender ||
          generation !== epoch ||
          chain() !== (expected.chainId || 'uni-7')
        )
          throw Error('Review or wallet changed. Reopen the review before withdrawing.');
        return task();
      }
    );
  }
  return { render, run, invalidate, withdraw, hasReceipt: () => !!receipt() };
}
