import { preflight, proposalContent, parseDeposit, displayJuno } from './juno-governance-core.mjs';

export function nativePlanner({
  active,
  draft,
  values,
  address,
  chain,
  connectWallet,
  rests,
  rpcs,
  status,
  busy,
  rerender
}) {
  const $ = (selector) => document.querySelector(selector);
  let reviewed = null,
    client = null,
    generation = 0,
    working = false;
  const receiptKey = () => `cosmoot:juno:planner-proposal:${draft().id}:submission`;
  const receipt = () => {
    try {
      return JSON.parse(localStorage.getItem(receiptKey()) || 'null');
    } catch {
      return { state: 'unreadable' };
    }
  };
  function invalidate() {
    generation++;
    reviewed = null;
    $('#planner-native-confirm').checked = false;
    $('#planner-native-review').hidden = true;
    render();
  }
  function render() {
    $('#planner-native-panel').hidden = !active();
    if (!active()) return;
    const previous = receipt(),
      button = $('#primary-action');
    button.hidden = false;
    button.textContent = previous
      ? 'SUBMISSION RECORDED'
      : working
        ? 'CHECKING JUNO…'
        : !address() || chain() !== 'juno-1'
          ? 'CONNECT KEPLR · JUNO'
          : reviewed
            ? 'SUBMIT TO JUNO GOVERNANCE'
            : 'REVIEW JUNO PROPOSAL';
    button.disabled =
      working || !!previous || (!!reviewed && !$('#planner-native-confirm').checked);
    $('#planner-native-deposit').disabled = working || !!previous;
    $('#planner-native-confirm').disabled = working;
    $('#action-hint').textContent = previous
      ? `This draft already has a submission attempt${previous.hash ? ' · TX ' + previous.hash : ''}. Check its outcome before creating another proposal.`
      : 'Submit to Juno native governance from your wallet. Juno stakers vote; Delegation DAO membership is not required.';
  }
  const current = (epoch, fingerprint, sender) => {
    if (
      generation !== epoch ||
      !active() ||
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
  async function run() {
    if (!active() || working || receipt()) return;
    if (!address() || chain() !== 'juno-1') {
      await connectWallet();
      return;
    }
    working = true;
    busy(true);
    render();
    try {
      const epoch = generation,
        sender = address(),
        fingerprint = JSON.stringify(values()),
        content = proposalContent(draft().kind, values());
      await wallet(sender);
      if (!reviewed) {
        localStorage.setItem(`cosmoot:juno:planner-proposal:${draft().id}:revision`, fingerprint);
        status('CHECKING JUNO GOVERNANCE, DEPOSIT AND PROGRAMME AUTHORITY…');
        const proof = await preflight(rests, content, sender);
        current(epoch, fingerprint, sender);
        const field = $('#planner-native-deposit');
        if (!field.value) field.value = displayJuno(proof.terms.initial);
        const deposit = parseDeposit(field.value);
        if (BigInt(deposit) < BigInt(proof.terms.initial))
          throw Error(`Initial deposit must be at least ${displayJuno(proof.terms.initial)} JUNO.`);
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
        current(epoch, fingerprint, sender);
        await wallet(sender);
        if (BigInt(proof.balance) < BigInt(deposit) + BigInt(fee.amount[0].amount))
          throw Error('Insufficient spendable JUNO for the reviewed deposit and fee.');
        reviewed = { epoch, fingerprint, sender, content, deposit, fee, proof };
        $('#planner-native-review-text').textContent =
          `Juno mainnet · ${sender}\nInitial deposit: ${displayJuno(deposit)} JUNO · Estimated fee: ${displayJuno(fee.amount[0].amount)} JUNO\n` +
          `Total deposit needed for voting: ${displayJuno(proof.terms.total)} JUNO · Verified at block ${proof.height}.\n` +
          (content.messages.length
            ? 'Juno governance instructs the programme treasury to claim its staking rewards after approval.'
            : 'Text-only rule approval. No delegation or treasury execution is authorized.') +
          '\nThe deposit is subject to Juno’s refund and burn rules. If the total deposit is not reached in time, the proposal will not enter voting. The fee is paid when submitting.';
        $('#planner-native-review').hidden = false;
        $('#planner-native-confirm').checked = false;
        status('PROPOSAL READY · REVIEW THE DEPOSIT AND FEE, THEN CONFIRM');
      } else {
        const review = reviewed;
        if (!$('#planner-native-confirm').checked)
          throw Error('Confirm the proposal, deposit and fee first.');
        current(review.epoch, review.fingerprint, review.sender);
        const guard = async () => {
          current(review.epoch, review.fingerprint, review.sender);
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
        const result = await NetaJunoGovernance.submit(
          client,
          review.content,
          review.sender,
          review.deposit,
          review.fee,
          {
            assertWallet: () => wallet(review.sender),
            beforeSign: guard,
            beforeBroadcast: (hash) => {
              const key = receiptKey(),
                record = JSON.stringify({ state: 'broadcast', hash, proposer: review.sender });
              localStorage.setItem(key, record);
              if (localStorage.getItem(key) !== record)
                throw Error('Submission record could not be saved.');
            }
          }
        );
        const record = {
          state: 'included',
          hash: result.transactionHash,
          height: result.height,
          proposer: review.sender
        };
        localStorage.setItem(receiptKey(), JSON.stringify(record));
        status(`JUNO PROPOSAL SUBMITTED · TX ${result.transactionHash}`);
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
  $('#planner-native-deposit').addEventListener('input', invalidate);
  $('#planner-native-confirm').addEventListener('change', render);
  for (const id of ['proposal-title', 'proposal-summary', 'proposal-body', 'proposal-actions'])
    $('#' + id).addEventListener('input', invalidate);
  window.addEventListener('neta:relay-panel', invalidate);
  window.addEventListener('hashchange', invalidate);
  window.addEventListener('neta:wallet-change', () => {
    client?.disconnect();
    client = null;
    invalidate();
  });
  return { render, run, invalidate };
}
