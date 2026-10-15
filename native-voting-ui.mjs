import {
  readParticipation,
  voteProof,
  assertVotingOpen,
  ballotLabel,
  labels,
  percent
} from './native-voting-core.mjs';
import { canonical, proposalIdentity } from './juno-community-governance.mjs';
import { displayJuno, submissionReceipt } from './juno-governance-core.mjs';
import { formatVoteAmount, formatWholeVoteAmount } from './native-governance-display.mjs';

export function nativeVoting({
  selected,
  address,
  chain,
  connectWallet,
  rests,
  rpcs,
  busy,
  blocked,
  onVoted
}) {
  const $ = (id) => document.getElementById(id),
    root = $('native-voting-workspace');
  let epoch = 0,
    snapshot = null,
    review = null,
    client = null,
    working = false,
    loading = false,
    loadedAt = 0,
    page = 0;
  const current = () => (selected()?.proposal?.native ? selected() : null);
  const key = () => `cosmoot:juno:vote:${current()?.id}:${address()}`;
  const journalKey = () => `neta-pending-tx-v1:juno-1:${address()}`;
  function receipt() {
    try {
      const r = JSON.parse(localStorage.getItem(key()) || 'null');
      if (
        r &&
        (!['broadcast', 'included', 'failed'].includes(r.state) ||
          !/^[A-F0-9]{64}$/.test(r.hash) ||
          r.sender !== address() ||
          String(r.proposalId) !== String(current()?.id))
      )
        throw Error();
      return r;
    } catch {
      return { state: 'unreadable' };
    }
  }
  function save(k, value) {
    const raw = JSON.stringify(value);
    localStorage.setItem(k, raw);
    if (localStorage.getItem(k) !== raw) throw Error('Vote receipt could not be saved.');
  }
  function message(text, error = false) {
    $('native-vote-status').textContent = text;
    $('native-vote-status').classList.toggle('is-error', error);
  }
  function open() {
    try {
      assertVotingOpen(current()?.proposal.raw);
      return true;
    } catch {
      return false;
    }
  }
  function render() {
    root.hidden = !current();
    if (!current()) return;
    const r = receipt(),
      pending = r?.state === 'broadcast';
    $('native-vote-choice').disabled = working || !open() || pending;
    $('native-vote-review').hidden = !review;
    $('native-vote-action').textContent = working
      ? 'Checking Juno…'
      : pending
        ? 'Check vote status'
        : !address() || chain() !== 'juno-1'
          ? 'Connect Keplr · Juno'
          : review
            ? 'Confirm vote in Keplr'
            : snapshot?.own?.ballot.length
              ? 'Change vote'
              : 'Review vote';
    $('native-vote-action').disabled =
      working ||
      blocked() ||
      r?.state === 'unreadable' ||
      (!open() && !pending) ||
      (!pending && address() && chain() === 'juno-1' && !$('native-vote-choice').value);
    $('native-vote-cancel').hidden = !review;
    $('native-vote-cancel').disabled = working;
    $('native-participation-refresh').disabled = loading || working;
    $('native-vote-receipt').textContent = r
      ? `${r.state === 'broadcast' ? 'Vote confirmation pending' : r.state === 'included' ? 'Vote transaction confirmed' : r.state === 'failed' ? 'Vote transaction failed' : 'Saved vote record unreadable; voting is locked.'}${r.hash ? ' · TX ' + r.hash : ''}`
      : '';
    const own = snapshot?.own;
    $('native-own-vote').textContent = !address()
      ? 'Connect your wallet to see your vote and delegated voting weight.'
      : own
        ? `${ballotLabel(own.ballot)} · Own delegated weight: ${formatVoteAmount(own.weight)}${own.validator ? ' · Validator account' : ''}`
        : 'Your ballot and voting weight are unavailable until participation data loads.';
    $('native-inherited-vote').textContent =
      own && !own.ballot.length
        ? own.inherited
            .map((v) => `${v.name}: ${ballotLabel(v.ballot)} (${formatVoteAmount(v.weight)})`)
            .join(' · ') || 'No current delegation to bonded validators.'
        : '';
    $('native-vote-explanation').textContent = !open()
      ? 'Voting is closed. Saved transaction status can still be checked.'
      : 'Your own vote replaces your validators’ choices for your delegated stake. Changing a vote replaces the entire ballot, including any weighted vote. Only the network fee is charged.';
    renderRows();
  }
  function renderRows() {
    const tbody = $('native-participation-rows');
    tbody.replaceChildren();
    if (!snapshot || snapshot.historical) return;
    const kind = $('native-participation-kind').value,
      filter = $('native-participation-filter').value,
      query = $('native-participation-search').value.trim().toLowerCase(),
      sort = $('native-participation-sort').value;
    const rows = snapshot[kind].filter(
      (r) =>
        (!query ||
          `${r.name || ''} ${r.address} ${r.validator || ''}`.toLowerCase().includes(query)) &&
        (filter === 'all' ||
          (filter === 'none' ? !r.ballot.length : r.ballot.some((o) => o.key === filter)))
    );
    rows.sort((a, b) =>
      sort === 'name'
        ? (a.name || a.address).localeCompare(b.name || b.address)
        : BigInt(a.weight) === BigInt(b.weight)
          ? a.address.localeCompare(b.address)
          : (BigInt(a.weight) > BigInt(b.weight) ? -1 : 1) * (sort === 'asc' ? -1 : 1)
    );
    const last = Math.max(0, Math.ceil(rows.length / 25) - 1);
    page = Math.min(page, last);
    $('native-participation-page').textContent =
      `${rows.length} ${kind === 'direct' ? 'addresses' : 'validators'} · Page ${page + 1} / ${last + 1}`;
    $('native-participation-prev').disabled = page === 0;
    $('native-participation-next').disabled = page === last;
    $('native-weight-heading').textContent =
      kind === 'direct' ? 'Own voting weight' : 'Represented vote weight';
    for (const r of rows.slice(page * 25, page * 25 + 25)) {
      const tr = document.createElement('tr'),
        identity = document.createElement('td'),
        a = document.createElement('a');
      a.href = `https://www.mintscan.io/juno/${kind === 'direct' ? 'address' : 'validators'}/${r.address}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = r.name || r.address;
      identity.append(a);
      if (r.validator) {
        const small = document.createElement('small');
        small.textContent = `Validator account · ${r.validator}`;
        identity.append(small);
      }
      if (kind === 'validators') {
        const stake = document.createElement('small');
        stake.textContent = `${formatVoteAmount(r.tokens)} bonded · ${formatVoteAmount(r.remaining)} after direct votes`;
        identity.append(stake);
      }
      tr.append(identity);
      for (const text of [
        ballotLabel(r.ballot),
        formatVoteAmount(r.weight),
        percent(r.weight, snapshot.metrics.total) + '%'
      ]) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.append(td);
      }
      if (kind === 'validators')
        tr.children[2].title = `Bonded: ${displayJuno(r.tokens)} JUNO · After direct-voter deductions: ${displayJuno(r.remaining)} JUNO`;
      tbody.append(tr);
    }
    $('native-participation-empty').hidden = rows.length > 0;
  }
  function clearData() {
    snapshot = null;
    loadedAt = 0;
    $('native-participation-data').hidden = true;
    $('native-participation-metrics').textContent = '';
  }
  function invalidate() {
    epoch++;
    message('');
    review = null;
    client?.disconnect();
    client = null;
    loading = false;
    clearData();
    render();
  }
  async function refresh(force = false) {
    const item = current();
    if (
      !item ||
      working ||
      document.hidden ||
      document.body.dataset.workspaceView !== 'governance' ||
      loading ||
      (!force && Date.now() - loadedAt < 30000)
    )
      return;
    const generation = epoch,
      sender = address();
    loading = true;
    $('native-participation-status').textContent = snapshot
      ? 'Refreshing participation…'
      : 'Loading complete participation data…';
    render();
    try {
      const result = await readParticipation(rests, item.id, sender);
      if (generation !== epoch || current() !== item || address() !== sender) return;
      if (
        canonical(proposalIdentity(item.proposal.raw)) !==
        canonical(proposalIdentity(result.proposal))
      )
        throw Error('Proposal content changed. Reload this proposal.');
      loadedAt = Date.now();
      snapshot = result;
      if (result.historical) {
        clearData();
        $('native-participation-status').textContent =
          'Historical participation breakdown unavailable. Today’s stake is not the final voting distribution.';
        return;
      }
      const m = result.metrics;
      const metrics = $('native-participation-metrics');
      metrics.replaceChildren();
      for (const [heading, value, detail] of [
        [
          'Turnout',
          m.turnout + '%',
          `Quorum ${percent(m.thresholds.quorum, 10n ** 18n)}% · ${m.quorumReached ? 'reached' : 'not reached'}`
        ],
        [
          'Yes excluding Abstain',
          m.yesShare + '%',
          `Must exceed ${percent(m.thresholds.threshold, 10n ** 18n)}%`
        ],
        [
          'Veto',
          m.vetoShare + '%',
          `Fails above ${percent(m.thresholds.veto_threshold, 10n ** 18n)}%`
        ]
      ]) {
        const card = document.createElement('div'),
          title = document.createElement('span'),
          amount = document.createElement('strong'),
          note = document.createElement('small');
        title.textContent = heading + ' ';
        amount.textContent = value + ' ';
        note.textContent = detail;
        card.append(title, amount, note);
        metrics.append(card);
      }
      $('native-participation-summary').textContent =
        `${result.direct.length} voting addresses · Directly represented: ${formatVoteAmount(result.directWeight)} · Through validator votes: ${formatVoteAmount(result.inheritedWeight)}`;
      $('native-participation-status').textContent =
        `Reconciled with the chain tally · Block ${result.height} · ${new Date(result.checkedAt).toLocaleTimeString()} · ${new URL(result.endpoint).hostname}`;
      $('native-participation-data').hidden = false;

    } catch (error) {
      if (generation === epoch) {
        clearData();
        $('native-participation-status').textContent =
          'Participation unavailable. ' + error.message;
      }
    } finally {
      if (generation === epoch) {
        loading = false;
        render();
      }
    }
  }
  // The tally is independent of the more expensive participation reconstruction.
  // Keep it available for closed proposals and when detailed evidence fails.
  function renderTally(tally) {
    const bars = $('native-participation-bars');
    bars.replaceChildren();
    const total = tally ? Object.values(tally).reduce((n, v) => n + BigInt(v), 0n) : 0n;
    for (const k of ['yes', 'no', 'abstain', 'veto']) {
      const row = document.createElement('div'),
        label = document.createElement('span');
      const p = tally ? percent(BigInt(tally[k]), total) : null;
      label.textContent = tally
        ? `${labels[k]} · ${p}% (${formatWholeVoteAmount(tally[k])})`
        : `${labels[k]} · —`;
      row.append(label);
      if (tally) {
        const meter = document.createElement('meter');
        meter.min = 0;
        meter.max = 100;
        meter.value = Number(p);
        meter.setAttribute('aria-label', label.textContent);
        row.append(meter);
      }
      bars.append(row);
    }
  }
  async function wallet(sender) {
    if (
      address() !== sender ||
      chain() !== 'juno-1' ||
      (await window.keplr?.getOfflineSigner('juno-1').getAccounts())?.[0]?.address !== sender
    )
      throw Error('Wallet changed. Reconnect and review your vote.');
  }
  async function run() {
    if (!current() || working || blocked()) return;
    if (!address() || chain() !== 'juno-1') {
      try {
        await connectWallet();
      } catch (e) {
        message(e.message, true);
      }
      return;
    }
    const item = current(),
      sender = address(),
      generation = epoch,
      storageKey = key(),
      r = receipt();
    if (r?.state === 'unreadable') return;
    const active = () => {
      if (
        current() !== item ||
        generation !== epoch ||
        address() !== sender ||
        chain() !== 'juno-1' ||
        document.body.dataset.workspaceView !== 'governance'
      )
        throw Error('Vote context changed. Review again.');
    };
    working = true;
    busy(true);
    render();
    try {
      if (r?.state === 'broadcast') {
        const result = await submissionReceipt(rests, r.hash);
        active();
        save(storageKey, { ...r, ...result });
        const pending = JSON.parse(localStorage.getItem(journalKey()) || 'null');
        if (pending?.status === 'pending' && pending.hash === r.hash)
          localStorage.removeItem(journalKey());
        message(
          result.code === 0 ? 'Vote confirmed on Juno.' : `Vote failed · code ${result.code}`,
          result.code !== 0
        );
        review = null;
        onVoted();
        return;
      }
      await wallet(sender);
      if (!review) {
        const proof = await voteProof(rests, item.proposal.raw, sender);
        active();
        const option = $('native-vote-choice').value;
        const base = window.keplr.getOfflineSigner('juno-1');
        if (typeof base.signDirect !== 'function')
          throw Error('Direct signing support is required.');
        client?.disconnect();
        client = await NetaJunoGovernance.connect(rpcs, {
          getAccounts: () => base.getAccounts(),
          signDirect: (a, d) =>
            window.keplr.signDirect('juno-1', a, d, { preferNoSetFee: true, preferNoSetMemo: true })
        });
        const gas = await NetaJunoGovernance.simulateVote(client, item.id, sender, option),
          fee = NetaJunoGovernance.fixedFee(gas, 1.4, '0.075ujuno', 2000000);
        active();
        await wallet(sender);
        if (BigInt(proof.balance) < BigInt(fee.amount[0].amount))
          throw Error('Insufficient JUNO for the network fee.');
        review = { proof, option, fee };
        $('native-vote-review-text').textContent =
          `Juno mainnet · Proposal #${item.id}: ${proof.proposal.title}\nVote: ${labels[option]} · Fee: ${displayJuno(fee.amount[0].amount)} JUNO\nWallet: ${sender}\nVoting ends: ${new Date(proof.proposal.voting_end_time).toLocaleString()}`;
        message('Review your choice and fee, then confirm in Keplr.');
      } else {
        const reviewed = review;
        const guard = async () => {
          active();
          await wallet(sender);
          if (
            Date.now() - reviewed.proof.checkedAt > 120000 ||
            $('native-vote-choice').value !== reviewed.option
          )
            throw Error('Vote review expired or changed. Review again.');
          const fresh = await voteProof(rests, reviewed.proof.proposal, sender);
          active();
          if (
            fresh.proposal.voting_end_time !== reviewed.proof.proposal.voting_end_time ||
            BigInt(fresh.balance) < BigInt(reviewed.fee.amount[0].amount)
          )
            throw Error('Voting deadline or fee balance changed. Review again.');
        };
        await NetaJunoGovernance.vote(client, item.id, sender, reviewed.option, reviewed.fee, {
          assertWallet: () => wallet(sender),
          beforeSign: guard,
          beforeBroadcast: async (hash) => {
            await guard();
            save(storageKey, {
              state: 'broadcast',
              hash,
              proposalId: String(item.id),
              sender,
              option: reviewed.option
            });
          }
        });
        // A successful broadcast is still reconciled through independent REST sources.
        const saved = JSON.parse(localStorage.getItem(storageKey)),
          confirmed = await submissionReceipt(rests, saved.hash);
        save(storageKey, { ...saved, ...confirmed });
        active();
        message(
          confirmed.code === 0 ? 'Vote confirmed on Juno.' : `Vote failed · code ${confirmed.code}`,
          confirmed.code !== 0
        );
        review = null;
        onVoted();
      }
    } catch (error) {
      review = null;
      message(error.message || String(error), true);
    } finally {
      working = false;
      busy(false);
      render();
      void refresh(true);
    }
  }
  $('native-vote-action').onclick = run;
  $('native-vote-choice').onchange = () => {
    review = null;
    render();
  };
  $('native-vote-cancel').onclick = () => {
    review = null;
    message('');
    render();
  };
  $('native-participation-refresh').onclick = () => refresh(true);
  for (const id of [
    'native-participation-kind',
    'native-participation-filter',
    'native-participation-sort',
    'native-participation-search'
  ])
    $(id).addEventListener(id.endsWith('search') ? 'input' : 'change', () => {
      page = 0;
      renderRows();
    });
  $('native-participation-prev').onclick = () => {
    page--;
    renderRows();
  };
  $('native-participation-next').onclick = () => {
    page++;
    renderRows();
  };
  window.addEventListener('neta:wallet-change', () => {
    invalidate();
    void refresh(true);
  });
  for (const event of ['neta:dao-change', 'hashchange', 'pagehide'])
    window.addEventListener(event, invalidate);
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('cosmoot:juno:vote:')) {
      review = null;
      render();
    }
  });
  return { render, renderTally, refresh, invalidate };
}
