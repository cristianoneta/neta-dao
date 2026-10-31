import {
  allocationBreakdown,
  budgetBreakdown,
  renderFixedMandates
} from './juno-fixed-allocation-view.mjs';
import { rowStatus } from './juno-delegation-view.mjs';
import { executionReview } from './juno-rebalance-execution.mjs';
import { checkRebalance } from './juno-rebalance-chain.mjs';
import { rebalanceProposal } from './planner-proposal-draft.mjs';
import { amount, units, capFraction, suggestedBudget } from './juno-delegation-core.mjs';
import { formatAmount } from './juno-delegation-view.mjs';
import {
  availableBudget,
  buildRebalanceReview,
  verifyRebalanceBaseline,
  requireFreshSnapshot
} from './juno-rebalance.mjs';

export function mountRebalance({ getContext, readApproval, download, openProposal }) {
  const $ = (id) => document.getElementById(id);
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  let revision = 0,
    frozen = null,
    execution = null,
    running = false,
    source = null,
    ruleKey = '',
    status = '';
  const feedback = (text, tone = 'info') => {
    $('rebalance-feedback').textContent = text;
    $('rebalance-feedback').dataset.tone = tone;
  };
  function invalidate(message = '') {
    revision++;
    frozen = null;
    execution = null;
    $('rebalance-proposal').disabled = true;
    $('rebalance-movements').textContent = '';
    running = false;
    $('rebalance-export').disabled = true;
    $('rebalance-result').hidden = true;
    $('rebalance-empty').hidden = false;
    feedback(message);
  }
  function refresh() {
    const context = getContext(),
      { approval, data } = context;
    const key = approval.current ? `${approval.current.proposalId}:${approval.current.hash}` : '';
    if (source !== data || ruleKey !== key || status !== approval.status) {
      invalidate('');
      source = data;
      ruleKey = key;
      status = approval.status;
    }
    const ready = approval.status === 'verified' && !!approval.current;
    let fresh = false;
    try {
      requireFreshSnapshot(data);
      fresh = true;
    } catch {
      /* Explained below. */
    }
    $('rebalance-state').textContent =
      approval.status === 'loading'
        ? 'Checking approval…'
        : !ready
          ? 'Approval required'
          : !fresh
            ? 'Fresh data required'
            : 'Approved rules';
    $('rebalance-rule-title').textContent = ready
      ? `Proposal #${approval.current.proposalId}`
      : 'No verified rulebook';
    $('rebalance-approval-note').textContent = ready
      ? 'These rules are fixed. Editing your rule draft does not change this simulation.'
      : approval.status === 'verified'
        ? 'First prepare a rule proposal and let the community approve it on-chain.'
        : 'Approval could not yet be verified. Refresh data to retry.';
    $('rebalance-empty-text').textContent = !ready
      ? 'A verified on-chain rule approval is required. Your local draft does not count as approval.'
      : !fresh
        ? 'Refresh the programme data before calculating a new allocation.'
        : 'Choose a budget and simulate current holdings against the approved policy.';
    $('rebalance-rule-facts').replaceChildren();
    if (ready) {
      const p = approval.current.rule,
        cap = data ? capFraction(p, data.activeCount) : null;
      for (const [label, value] of [
        [
          'Allocation',
          p.schema >= 9
            ? 'Fixed targets + points-weighted regular allocation'
            : 'Fixed targets + equal regular allocation'
        ],
        [
          'Voting-power cap',
          cap
            ? `${((Number(cap.numerator) * 100) / Number(cap.denominator)).toFixed(2)}%`
            : 'Awaiting data'
        ],
        ['Commission', p.commissionMaxBps === null ? 'No limit' : `≤ ${p.commissionMaxBps / 100}%`],
        [
          'Minimum uptime',
          p.schema >= 5 ? `${p.minParticipationBps / 100}%` : 'Not required by this version'
        ],
        ['Manual exclusions', String(p.exclusions.length)],
        ['Fixed allocations', String(p.fixedAllocations?.length || 0)]
      ]) {
        const row = node('div', '');
        row.append(node('dt', label), node('dd', value));
        $('rebalance-rule-facts').append(row);
      }
    }
    renderFixedMandates($('rebalance-fixed'), ready ? approval.current.rule : {}, data);
    $('rebalance-available').textContent = data
      ? `${formatAmount(availableBudget(data), true)} JUNO`
      : 'Unavailable';
    $('rebalance-max').disabled = !data || !ready || !fresh;
    $('rebalance-amount').disabled = !ready;
    if (data && !$('rebalance-amount').value)
      $('rebalance-amount').value = units(suggestedBudget(data));
    $('rebalance-simulate').disabled = !ready || !fresh || !context.evidence || running;
  }
  function render(value) {
    const { result } = value;
    $('rebalance-empty').hidden = true;
    $('rebalance-result').hidden = false;
    $('rebalance-eligible').textContent = result.eligibleCount;
    $('rebalance-allocated').textContent = formatAmount(result.allocatedRaw);
    $('rebalance-unallocated').textContent = formatAmount(result.unallocatedRaw);
    $('rebalance-observed').textContent =
      `Approved proposal #${value.value.approvedProposalId} · block ${value.value.calculation.snapshot.height.toLocaleString('en-US')} · ${new Date(value.value.calculation.snapshot.blockTime).toLocaleString()}. Targets use these observations. Movement checks are reported separately below.`;
    $('rebalance-budget-split').textContent = budgetBreakdown(result);
    $('rebalance-identifiers').textContent =
      `Approved policy SHA-256: ${value.value.approvedPolicyHash}. Allocation draft SHA-256: ${value.hash}. Existing redelegations: ${value.value.calculation.existingRedelegationCount}; see the current movement check before preparing a proposal.`;
    $('rebalance-rows').replaceChildren();
    const rows = result.rows
      .filter((v) => BigInt(v.currentRaw) > 0n || BigInt(v.targetRaw) > 0n)
      .sort((a, b) =>
        BigInt(b.targetRaw) > BigInt(a.targetRaw)
          ? 1
          : BigInt(b.targetRaw) < BigInt(a.targetRaw)
            ? -1
            : a.address.localeCompare(b.address)
      );
    for (const v of rows) {
      const tr = node('tr', ''),
        name = node('td', v.name);
      name.append(node('small', rowStatus(v)));
      if (v.reasons.length) name.append(node('small', v.reasons.join(' · ')));
      name.title = v.address;
      tr.append(name);
      for (const [label, raw] of [
        ['Current', v.currentRaw],
        ['Target', v.targetRaw],
        ['Change', v.deltaRaw]
      ]) {
        const delta = label === 'Change',
          n = BigInt(raw);
        const td = node(
          'td',
          (delta && n > 0n ? '+' : '') + formatAmount(raw),
          delta ? (n > 0n ? 'increase' : n < 0n ? 'decrease' : '') : ''
        );
        td.dataset.label = label + ' · JUNO';
        if (label === 'Target' && BigInt(v.fixedRaw || '0') > 0n)
          td.append(node('small', allocationBreakdown(v), 'fixed-breakdown'));
        td.title = units(n) + ' JUNO';
        tr.append(td);
      }
      $('rebalance-rows').append(tr);
    }
    $('rebalance-export').disabled = false;
  }
  $('rebalance-amount').addEventListener('input', () => {
    invalidate('Budget changed. Simulate again.');
    refresh();
  });
  $('rebalance-max').addEventListener('click', () => {
    const { data } = getContext();
    if (!data) return;
    $('rebalance-amount').value = units(availableBudget(data));
    invalidate('Maximum budget selected. Simulate again.');
    refresh();
  });
  $('rebalance-simulate').addEventListener('click', async () => {
    invalidate();
    running = true;
    refresh();
    const token = revision,
      context = getContext();
    feedback('Verifying the approved rulebook and calculating targets…');
    try {
      if (context.approval.status !== 'verified')
        throw Error('Verify the approved rulebook first.');
      const approved = await readApproval();
      if (token !== revision) return;
      if (
        !approved ||
        approved.hash !== context.approval.current?.hash ||
        approved.proposalId !== context.approval.current?.proposalId
      )
        throw Error('The approved rules changed. Refresh data before simulating.');
      const value = await buildRebalanceReview({
        approval: approved,
        snapshot: context.data,
        evidence: context.evidence,
        budgetRaw: amount($('rebalance-amount').value.trim()).toString()
      });
      if (token !== revision) return;
      frozen = value;
      render(value);
      feedback(
        'Targets calculated. Checking exact staking movements, programme authority and current chain limits…'
      );
      const candidate = await executionReview(value.value.calculation);
      await rebalanceProposal(candidate); // Check complete proposal size before enabling its action.
      const proofs = await checkRebalance(candidate);
      if (token !== revision) return;
      execution = candidate;
      const totals = candidate.value.plan.totals;
      $('rebalance-movements').textContent =
        `${candidate.value.plan.moves.length} movements · Delegate ${formatAmount(totals.delegate, true)} JUNO · Redelegate ${formatAmount(totals.redelegate, true)} JUNO · Begin unbonding ${formatAmount(totals.undelegate, true)} JUNO. Unbonding period: ${Number(proofs[0].state.unbondingTime.replace('s', '')) / 86400} days. Verified by ${proofs.length} independent sources.`;
      $('rebalance-proposal').disabled = false;
      feedback(
        'Movement checks passed. Open the proposal draft to review and publish it through Cosmoot.'
      );
    } catch (error) {
      if (token === revision) feedback(error.message, 'error');
    } finally {
      if (token === revision) {
        running = false;
        refresh();
      }
    }
  });
  $('rebalance-export').addEventListener('click', async () => {
    const selected = frozen,
      token = revision;
    if (!selected) return;
    $('rebalance-export').disabled = true;
    try {
      const approved = await readApproval();
      if (token !== revision || selected !== frozen) return;
      await verifyRebalanceBaseline(selected, approved, getContext().data);
      if (token !== revision || selected !== frozen) return;
      download(
        `juno-allocation-${selected.value.approvedProposalId}-${selected.hash.slice(0, 12)}.json`,
        JSON.stringify({ ...selected.value, hash: selected.hash }, null, 2),
        'application/json'
      );
      feedback('Frozen allocation draft downloaded. It contains no executable transactions.');
    } catch (error) {
      if (token === revision) {
        invalidate();
        feedback(error.message, 'error');
      }
    } finally {
      if (token === revision && frozen) $('rebalance-export').disabled = false;
    }
  });
  $('rebalance-proposal').addEventListener('click', async () => {
    const selected = frozen,
      candidate = execution,
      token = revision;
    if (!selected || !candidate || running) return;
    running = true;
    $('rebalance-proposal').disabled = true;
    refresh();
    feedback('Rechecking the approved rulebook and movement limits before preparing your draft…');
    try {
      await verifyRebalanceBaseline(selected, await readApproval(), getContext().data);
      await checkRebalance(candidate);
      const proposal = await rebalanceProposal(candidate);
      if (token !== revision || selected !== frozen || candidate !== execution) return;
      openProposal(proposal);
    } catch (error) {
      if (token === revision) {
        execution = null;
        feedback(error.message, 'error');
      }
    } finally {
      if (token === revision) {
        running = false;
        $('rebalance-proposal').disabled = !execution;
        refresh();
      }
    }
  });
  // Expiry is checked again at export; this also removes expired visible targets.
  setInterval(() => {
    if (!frozen) return;
    try {
      requireFreshSnapshot(getContext().data);
    } catch {
      invalidate('The snapshot expired. Refresh data and simulate again.');
      refresh();
    }
  }, 30000);
  refresh();
  return { refresh };
}
