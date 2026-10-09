import {
  fundingProof,
  validateContribution,
  proposalIdentity,
  canonical
} from './juno-community-governance.mjs';
import { parseDeposit, displayJuno, submissionReceipt } from './juno-governance-core.mjs';

export function proposalFunding({
  selected,
  address,
  chain,
  connectWallet,
  rests,
  rpcs,
  status,
  busy
}) {
  const $ = (s) => document.querySelector(s);
  let proof = null,
    reviewed = null,
    epoch = 0,
    working = false,
    client = null;
  const currentId = () =>
    selected()?.source === 'chain' && selected()?.proposal?.native ? String(selected().id) : null;
  const key = (id = currentId(), sender = address()) => `cosmoot:juno:deposit:${id}:${sender}`;
  const receipt = () => {
    if (!address() || !currentId()) return null;
    try {
      const r = JSON.parse(localStorage.getItem(key()) || 'null');
      if (
        r &&
        (!['broadcast', 'included', 'failed'].includes(r.state) || !/^[A-F0-9]{64}$/.test(r.hash))
      )
        throw Error('Invalid contribution receipt.');
      return r;
    } catch {
      return { state: 'unreadable' };
    }
  };
  const save = (storageKey, value) => {
    const text = JSON.stringify(value);
    localStorage.setItem(storageKey, text);
    if (localStorage.getItem(storageKey) !== text)
      throw Error('Contribution receipt could not be saved.');
  };
  function invalidate() {
    epoch++;
    reviewed = null;
    $('#proposal-funding-confirm').checked = false;
    $('#proposal-funding-review').hidden = true;
    render();
  }
  function render() {
    const id = currentId(),
      panel = $('#proposal-funding-panel');
    panel.hidden = !id;
    if (!id) return;
    const r = receipt(),
      known = proof && String(proof.proposal.id) === id,
      t = known && proof.terms;
    $('#proposal-funding-total').textContent = known
      ? `${displayJuno(t.funded)} / ${displayJuno(t.total)} JUNO`
      : 'Refresh funding data';
    $('#proposal-funding-deadline').textContent = known
      ? t.open
        ? `Remaining: ${displayJuno(t.remaining)} JUNO · Ends ${new Date(t.deadline).toLocaleString()}`
        : 'Funding is closed. No further deposit is needed here.'
      : 'Live proposal data is required before contributing.';
    $('#proposal-funding-minimum').textContent = known
      ? `Minimum contribution: ${displayJuno(t.minimum)} JUNO${BigInt(t.remaining) > 0n && BigInt(t.remaining) < BigInt(t.minimum) ? ' · The chain minimum exceeds the remaining amount.' : ''}`
      : '';
    $('#proposal-funding-risk').textContent = known
      ? `Deposits go directly to Juno governance. Refunds return to each depositor. ${t.burnVeto ? 'A veto can burn your deposit. ' : ''}${t.burnQuorum ? 'Failure to reach quorum can burn it. ' : ''}${t.burnUnfunded ? 'Missing the funding target can burn it. ' : ''}Transaction fees are not refunded.`
      : '';
    $('#proposal-funding-receipt').textContent = r
      ? `${r.state === 'broadcast' ? 'Contribution outcome not yet confirmed' : r.state === 'included' ? 'Previous contribution confirmed' : r.state === 'failed' ? 'Previous contribution failed' : 'Saved contribution record unreadable — submission locked'}${r.hash ? ' · TX ' + r.hash : ''}`
      : '';
    $('#proposal-funding-form').hidden = !t?.open && !r;
    const button = $('#proposal-funding-action');
    button.textContent = working
      ? 'CHECKING JUNO…'
      : r?.state === 'broadcast'
        ? 'CHECK CONTRIBUTION STATUS'
        : !address() || chain() !== 'juno-1'
          ? 'CONNECT KEPLR · JUNO'
          : reviewed
            ? 'CONFIRM CONTRIBUTION'
            : 'REVIEW CONTRIBUTION';
    button.disabled =
      working ||
      r?.state === 'unreadable' ||
      (!t?.open && r?.state !== 'broadcast') ||
      (!!reviewed && !$('#proposal-funding-confirm').checked);
    for (const id of [
      'proposal-funding-amount',
      'proposal-funding-remaining',
      'proposal-funding-refresh'
    ])
      $('#' + id).disabled = working;
  }
  async function refresh() {
    const id = currentId(),
      generation = ++epoch;
    reviewed = null;
    proof = null;
    $('#proposal-funding-review').hidden = true;
    $('#proposal-funding-confirm').checked = false;
    render();
    if (!id) return;
    try {
      const next = await fundingProof(rests, id);
      if (generation !== epoch || currentId() !== id) return;
      proof = next;
      render();
    } catch (error) {
      if (generation === epoch) {
        status(error.message, true);
        render();
      }
    }
  }
  async function wallet(sender) {
    if (
      chain() !== 'juno-1' ||
      address() !== sender ||
      (await window.keplr?.getOfflineSigner('juno-1').getAccounts())?.[0]?.address !== sender
    )
      throw Error('Wallet changed. Reconnect and review the contribution.');
  }
  async function run() {
    const id = currentId();
    if (!id || working) return;
    if (!address() || chain() !== 'juno-1') {
      await connectWallet();
      return;
    }
    const sender = address(),
      generation = epoch,
      storageKey = key(id, sender),
      previous = receipt();
    if (previous?.state === 'unreadable') return;
    const active = () => {
      if (
        currentId() !== id ||
        epoch !== generation ||
        address() !== sender ||
        chain() !== 'juno-1'
      )
        throw Error('Contribution context changed. Review again.');
    };
    working = true;
    busy(true);
    render();
    try {
      if (previous?.state === 'broadcast') {
        const result = await submissionReceipt(rests, previous.hash);
        save(storageKey, { ...previous, ...result });
        status(
          result.code === 0
            ? 'CONTRIBUTION CONFIRMED'
            : `CONTRIBUTION FAILED · CODE ${result.code}`,
          result.code !== 0
        );
        proof = null;
        reviewed = null;
        return;
      }
      await wallet(sender);
      if (!reviewed) {
        const next = await fundingProof(rests, id, sender);
        active();
        const raw = validateContribution(
          parseDeposit($('#proposal-funding-amount').value),
          next.terms
        );
        const base = window.keplr.getOfflineSigner('juno-1');
        if (typeof base.signDirect !== 'function')
          throw Error('Direct signing support is required.');
        client?.disconnect();
        client = await NetaJunoGovernance.connect(rpcs, {
          getAccounts: () => base.getAccounts(),
          signDirect: (a, d) =>
            window.keplr.signDirect('juno-1', a, d, { preferNoSetFee: true, preferNoSetMemo: true })
        });
        const gas = await NetaJunoGovernance.simulateDeposit(client, id, sender, raw);
        const fee = NetaJunoGovernance.fixedFee(gas, 1.4, '0.075ujuno', 2000000);
        active();
        await wallet(sender);
        if (BigInt(next.balance) < BigInt(raw) + BigInt(fee.amount[0].amount))
          throw Error('Insufficient JUNO for contribution and fee.');
        proof = next;
        reviewed = { id, sender, raw, fee, proof: next, generation };
        $('#proposal-funding-review-text').textContent =
          `Juno mainnet · Proposal #${id}: ${next.proposal.title}\nYour contribution: ${displayJuno(raw)} JUNO · Fee: ${displayJuno(fee.amount[0].amount)} JUNO\nWallet: ${sender}\n${BigInt(raw) >= BigInt(next.terms.remaining) ? 'This contribution would reach the funding target and start voting.' : 'This is a partial contribution.'}`;
        $('#proposal-funding-review').hidden = false;
        $('#proposal-funding-confirm').checked = false;
      } else {
        const review = reviewed;
        if (!$('#proposal-funding-confirm').checked)
          throw Error('Confirm the contribution and fee.');
        const guard = async () => {
          active();
          await wallet(sender);
          if (
            Date.now() - review.proof.checkedAt > 120000 ||
            parseDeposit($('#proposal-funding-amount').value) !== review.raw
          )
            throw Error('Contribution review expired or changed. Review again.');
          const fresh = await fundingProof(rests, id, sender);
          active();
          validateContribution(review.raw, fresh.terms);
          if (
            canonical(proposalIdentity(fresh.proposal)) !==
              canonical(proposalIdentity(review.proof.proposal)) ||
            canonical(fresh.params) !== canonical(review.proof.params) ||
            fresh.terms.funded !== review.proof.terms.funded ||
            BigInt(fresh.balance) < BigInt(review.raw) + BigInt(review.fee.amount[0].amount)
          )
            throw Error('Proposal funding or parameters changed. Refresh and review again.');
        };
        const result = await NetaJunoGovernance.contribute(
          client,
          id,
          sender,
          review.raw,
          review.fee,
          {
            assertWallet: () => wallet(sender),
            beforeSign: guard,
            beforeBroadcast: async (hash) => {
              await guard();
              save(storageKey, {
                state: 'broadcast',
                hash,
                amount: review.raw,
                proposalId: id,
                sender
              });
            }
          }
        );
        save(storageKey, {
          state: 'included',
          hash: result.transactionHash,
          amount: review.raw,
          proposalId: id,
          sender,
          height: result.height
        });
        status(`CONTRIBUTION CONFIRMED · TX ${result.transactionHash}`);
        reviewed = null;
        proof = null;
        $('#proposal-funding-review').hidden = true;
      }
    } catch (error) {
      invalidate();
      status(error.message || String(error), true);
    } finally {
      working = false;
      busy(false);
      render();
    }
  }
  $('#proposal-funding-amount').addEventListener('input', invalidate);
  $('#proposal-funding-confirm').addEventListener('change', render);
  $('#proposal-funding-refresh').onclick = refresh;
  $('#proposal-funding-action').onclick = run;
  $('#proposal-funding-remaining').onclick = () => {
    if (!proof?.terms.open) return;
    const t = proof.terms;
    $('#proposal-funding-amount').value = displayJuno(
      BigInt(t.remaining) > BigInt(t.minimum) ? t.remaining : t.minimum
    );
    invalidate();
  };
  for (const event of ['neta:wallet-change', 'neta:dao-change', 'hashchange', 'pagehide'])
    window.addEventListener(event, invalidate);
  window.addEventListener('storage', (event) => {
    if (event.key?.startsWith('cosmoot:juno:deposit:')) invalidate();
  });
  return { render, refresh, invalidate };
}
