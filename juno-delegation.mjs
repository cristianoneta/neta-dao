import { buildRuleReview, ruleChanges, parentMatches } from './juno-delegation-review.mjs';
import { renderRuleReview } from './juno-rule-review-view.mjs';
import { activeSetEvidence, historyCoverageText } from './juno-active-set-history.mjs';
import { currentApprovedRules } from './juno-approved-rules.mjs';
import { renderFuturePolicy } from './juno-delegation-roadmap.mjs?v=2';
import {
  frozenRuleProposal,
  claimProposal,
  savePlannerProposal
} from './planner-proposal-draft.mjs';
import { claimRewardsOverview } from './juno-claim-rewards.mjs';
import {
  defaultPolicy,
  eligibilityDescription,
  policy,
  snapshot,
  upgradeEvidence,
  amount,
  capFraction,
  suggestedBudget,
  LIQUID_RESERVE
} from './juno-delegation-core.mjs';

import { formatAmount } from './juno-delegation-view.mjs';

const $ = (id) => document.getElementById(id),
  key = 'cosmoot:juno:delegation:rule-draft:v3';
let rules = defaultPolicy(),
  data = null,
  evidence = null,
  review = null,
  revision = 0,
  loading = false;
let approval = { status: 'loading', current: null },
  parent = null,
  draftStarted = false;
let rewardsSource = null;
const fmt = (value) => formatAmount(value, true);
const tell = (message, tone = 'info') => {
  $('feedback').textContent = message;
  $('feedback').dataset.tone = tone;
};
function claimFeedback(message, tone = 'info') {
  const target = $('claim-rewards-feedback');
  target.textContent = message;
  target.dataset.tone = tone;
  if (tone === 'error') {
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest' });
  }
}
function renderClaimRewards() {
  $('claim-rewards-observed').textContent = '';
  if (!data || !rewardsSource) {
    $('claim-rewards-amount').textContent =
      'Claimable staking rewards unavailable. Refresh data to retry.';
    return;
  }
  try {
    const value = claimRewardsOverview(rewardsSource, data);
    const amountLine = node('span', '', 'reward-value');
    amountLine.append(
      document.createTextNode(formatAmount(value.amountRaw) + ' '),
      node('small', 'JUNO')
    );
    $('claim-rewards-amount').replaceChildren(
      amountLine,
      node(
        'span',
        value.usd === null
          ? 'USD estimate unavailable'
          : `≈ ${value.usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
        'reward-usd'
      )
    );
    $('claim-rewards-observed').textContent =
      `Exact amount: ${fmt(value.amountRaw)} JUNO. Rewards snapshot: ${new Date(value.observedAt).toLocaleString()} · block ${value.height.toLocaleString('en-US')} · ${new URL(value.source).hostname} · ${value.validatorCount} programme delegations, including jailed and standby positions. ` +
      (value.priceObservedAt
        ? `Indicative USD price snapshot: ${new Date(value.priceObservedAt).toLocaleString()}. `
        : 'USD price unavailable. ') +
      'Rewards stay outside the available allocation budget until claimed.';
  } catch (error) {
    $('claim-rewards-amount').textContent =
      `Claimable staking rewards unavailable. ${error.message}`;
  }
}
function setStep(step, focus = true) {
  if (!['overview', 'rules', 'simulation', 'proposals'].includes(step)) step = 'overview';
  if (focus && $('feedback').dataset.tone !== 'warning') tell('');
  for (const panel of document.querySelectorAll('.planner-panel')) panel.hidden = panel.id !== step;
  for (const link of document.querySelectorAll('.planner-steps [data-step]')) {
    if (link.dataset.step === step) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  }
  if (location.hash !== '#' + step) history.replaceState(null, '', '#' + step);
  if (focus) {
    const heading = $(
      step === 'overview'
        ? 'overview-title'
        : step === 'rules'
          ? 'rules-title'
          : step === 'simulation'
            ? 'simulation-title'
            : 'proposals-title'
    );
    heading.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
};
let approvalRead = 0;
async function loadApprovedRules() {
  const read = ++approvalRead;
  approval = { ...approval, status: 'loading' };
  renderDraftBaseline();
  const host = $('current-rules-content'),
    state = $('current-rules-state');
  state.textContent = 'Checking approval…';
  state.className = 'state-pill neutral';
  host.replaceChildren(node('p', 'Checking Juno governance for approved programme rules…'));
  try {
    const result = await currentApprovedRules();
    if (read !== approvalRead) return;
    approval = { status: 'verified', current: result.current };
    if (!draftStarted) {
      parent = structuredClone(result.current);
      rules = parent ? structuredClone(parent.rule) : defaultPolicy();
      draftStarted = true;
      restoreCommissionInput();
    }
    renderRules();
    renderDraftBaseline();
    host.replaceChildren();
    if (!result.current) {
      state.textContent = 'Awaiting first approval';
      host.append(
        node(
          'p',
          'No approved Cosmoot rule proposal found. You can prepare a draft; the community must approve its rules first.'
        )
      );
      return;
    }
    const { rule, proposalId, votingEndedAt, hash } = result.current;
    state.textContent = 'Rules approved · allocation unchanged by vote';
    state.className = 'state-pill live';
    const source = node('p'),
      link = node('a', `Proposal #${proposalId} ↗`);
    link.href = 'https://atomscan.com/juno/proposals/' + proposalId;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    source.append(
      link,
      document.createTextNode(` · Voting ended ${new Date(votingEndedAt).toLocaleString()}`)
    );
    const settings = node('dl', '', 'approved-settings');
    for (const [label, value] of [
      ['Allocation', 'Equal distribution within the voting power cap'],
      [
        'Voting power cap',
        `min(30%, ${rule.factorTenths / 10} × 100% / consensus validator count)`
      ],
      [
        'Maximum commission',
        rule.commissionMaxBps === null ? 'No limit' : `${rule.commissionMaxBps / 100}%`
      ],
      ['Validator status', eligibilityDescription(rule)],
      ['Upgrade participation', 'Juno v31 · within 5 hours of the halt'],
      ['Liquid reserve', `${formatAmount(rule.liquidReserveRaw)} JUNO`],
      ['Manual exclusions', String(rule.exclusions.length)],
      ['Scoring', 'V1 · no objective or subjective points']
    ]) {
      const entry = node('div');
      entry.append(node('dt', label), node('dd', value));
      settings.append(entry);
    }
    const details = node('details', '', 'policy-details');
    details.append(node('summary', 'Approval evidence & exclusions'));
    for (const entry of rule.exclusions)
      details.append(node('p', `${entry.validator}: ${entry.reason}`));
    details.append(node('p', `Rule SHA-256: ${hash}`, 'rule-fingerprint'));
    details.append(
      node(
        'p',
        'Verified ' +
          new Date(result.checkedAt).toLocaleString() +
          ' · ' +
          result.sources
            .map((s) => `${new URL(s.endpoint).hostname} · block ${s.height}`)
            .join(' / '),
        'field-help'
      )
    );
    details.querySelector('summary').textContent = 'Approved settings & evidence';
    details.insertBefore(settings, details.children[1] || null);
    host.append(
      source,
      node(
        'p',
        `Equal allocation · ${rule.commissionMaxBps === null ? 'no commission limit' : rule.commissionMaxBps / 100 + '% maximum commission'} · ${rule.exclusions.length} manual exclusions.`
      ),
      details
    );
  } catch (error) {
    if (read !== approvalRead) return;
    approval = { status: 'unavailable', current: null };
    renderDraftBaseline();
    state.textContent = 'Approval unavailable';
    host.replaceChildren(
      node('p', 'Current rules could not be verified. Use Refresh data to retry.'),
      node('p', error.message, 'field-help')
    );
  }
}
const sumCurrent = () => data.validators.reduce((a, v) => a + BigInt(v.currentRaw), 0n);
let showAllCurrentPositions = false;
function renderCurrentPositions() {
  const host = $('current-position-rows'),
    toggle = $('current-positions-toggle');
  host.replaceChildren();
  toggle.hidden = true;
  $('position-health').hidden = true;
  for (const id of ['current-total', 'current-liquid', 'current-validator-count'])
    $(id).textContent = '—';
  if (!data) {
    const row = node('tr'),
      cell = node(
        'td',
        loading ? 'Loading current positions…' : 'Current programme positions unavailable.'
      );
    cell.colSpan = 4;
    row.append(cell);
    host.append(row);
    return;
  }
  const total = sumCurrent();
  const held = data.validators
    .filter((v) => BigInt(v.currentRaw) > 0n)
    .sort((a, b) => {
      const delta = BigInt(b.currentRaw) - BigInt(a.currentRaw);
      return delta > 0n ? 1 : delta < 0n ? -1 : a.address.localeCompare(b.address);
    });
  $('current-total').textContent = formatAmount(total);
  $('current-liquid').textContent = formatAmount(data.liquidRaw);
  $('current-validator-count').textContent = String(held.length);
  if (!held.length) {
    const row = node('tr'),
      cell = node('td', 'No current programme delegations.');
    cell.colSpan = 4;
    row.append(cell);
    host.append(row);
  }
  for (const v of showAllCurrentPositions ? held : held.slice(0, 5)) {
    const row = node('tr'),
      identity = node('td');
    const link = node('a', v.name || v.address);
    link.href = 'https://atomscan.com/juno/validators/' + encodeURIComponent(v.address);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    identity.append(link);
    const share = total ? Number((BigInt(v.currentRaw) * 10000n) / total) / 100 : 0;
    const status = node('td');
    const badge = node(
      'span',
      v.jailed ? 'Jailed' : v.active ? 'Active set' : 'Outside set',
      'position-state'
    );
    badge.dataset.state = v.jailed ? 'jailed' : v.active ? 'active' : 'outside';
    status.append(badge);
    row.append(
      identity,
      node('td', formatAmount(v.currentRaw), 'numeric'),
      node('td', share === 0 && total > 0n ? '<0.01%' : share.toFixed(2) + '%', 'numeric'),
      status
    );
    host.append(row);
  }
  toggle.hidden = held.length <= 5;
  toggle.textContent = showAllCurrentPositions
    ? 'Show largest 5 positions'
    : `Show all ${held.length} positions`;
  toggle.setAttribute('aria-expanded', String(showAllCurrentPositions));
}
function freshness() {
  return data
    ? Math.max(Date.now() - Date.parse(data.blockTime), Date.now() - Date.parse(data.collectedAt))
    : Infinity;
}
function renderDraftBaseline() {
  const valid = approval.status === 'verified',
    matches = valid && parentMatches(parent, approval.current);
  $('draft-parent-note').textContent = !valid
    ? approval.status === 'loading'
      ? 'Checking the approved baseline…'
      : 'Approval unavailable. The saved baseline and edits are preserved; publication is blocked until verification succeeds.'
    : !matches
      ? 'The approved policy has changed. Your draft still uses its original baseline. Start from the current approved rules before preparing a new proposal.'
      : parent
        ? `Based on approved proposal #${parent.proposalId}. Your edits need a new rule approval before they can be used for an allocation.`
        : 'Initial adoption · no approved Cosmoot-format policy found. Actual holdings already exist and remain the comparison baseline.';
  $('adopt-current-rules').hidden = !valid || matches;
  $('use-current-model').hidden = rules.schema === 4;
  if (review) $('publish-proposal').disabled = !matches || freshness() > 3600000;
  $('approved-allocation-next').hidden = !valid || !approval.current;
  $('approved-allocation-reference').textContent = approval.current
    ? `Uses the exact rules from proposal #${approval.current.proposalId}. Changing rules starts a new rule proposal first.`
    : '';
  const link = document.querySelector('.overview-heading [data-step="rules"]');
  if (link)
    link.textContent = valid
      ? approval.current
        ? 'Propose rule changes →'
        : 'Propose initial rules →'
      : 'Review rules →';
}
function invalidate(message = 'Rules or amount changed. Review again to refresh the comparison.') {
  revision++;
  if (message.startsWith('Rules or amount changed')) {
    draftStarted = true;
    $('draft-status').textContent = 'Draft changed · save rules to keep them locally';
  }
  review = null;
  for (const id of ['export-json', 'publish-proposal', 'review-proposal']) $(id).disabled = true;
  $('simulation-state').textContent = 'Not reviewed';
  $('rule-fingerprint').textContent =
    'Review the draft to identify its exact rules and observations.';
  $('simulation-comparison').replaceChildren(node('p', message));
  $('proposal-review').hidden = true;
  $('proposal-empty').hidden = false;
  renderRuleSummary();
}
function renderRuleSummary() {
  const cap = data ? capFraction(rules, data.activeCount) : null;
  const capText = cap
    ? ((Number(cap.numerator) * 100) / Number(cap.denominator)).toFixed(2) + '%'
    : 'pending';
  $('rule-summary').textContent =
    `Equal allocation · voting power cap ${capText} · ${rules.commissionMaxBps === null ? 'no commission filter' : 'commission ≤' + rules.commissionMaxBps / 100 + '%'} · v31 participation ≤5h · ${rules.exclusions.length} manual exclusions`;
  $('draft-cap').textContent =
    $('factor-number').checkValidity() && $('factor-number').value ? capText : 'Check value';
  $('draft-commission').textContent = commissionValid()
    ? rules.commissionMaxBps === null
      ? 'No limit'
      : `${rules.commissionMaxBps / 100}%`
    : 'Check value';
  const changes = ruleChanges(parent?.rule, rules).filter((r) => r.changed);
  $('draft-change-count').textContent = parent
    ? `${changes.length} changes from proposal #${parent.proposalId}`
    : 'Initial criteria · no previous policy values';
  $('draft-exclusions').textContent = rules.exclusions.length
    ? String(rules.exclusions.length)
    : 'None';
  try {
    $('draft-budget').textContent = $('programme-amount').value.trim()
      ? `${formatAmount(amount($('programme-amount').value.trim()))} JUNO`
      : '—';
  } catch {
    $('draft-budget').textContent = 'Check amount';
  }
}
function commissionValid() {
  const input = $('commission');
  return (
    $('no-commission-limit').checked ||
    (input.value !== '' && input.checkValidity() && Number.isInteger(Number(input.value)))
  );
}
function showCommissionError() {
  const valid = commissionValid();
  $('commission-error').hidden = valid;
  $('commission').setAttribute('aria-invalid', String(!valid));
}
function restoreCommissionInput() {
  const unlimited = rules.commissionMaxBps === null;
  $('no-commission-limit').checked = unlimited;
  $('commission').disabled = unlimited;
  $('commission').value = unlimited ? '10' : String(rules.commissionMaxBps / 100);
  showCommissionError();
}
function renderRules() {
  $('factor').value = rules.factorTenths;
  $('factor').setAttribute('aria-valuetext', (rules.factorTenths / 10).toFixed(1) + ' times');
  $('factor-number').value = (rules.factorTenths / 10).toFixed(1);
  $('factor-value').value = (rules.factorTenths / 10).toFixed(1) + '×';
  const cap = data ? capFraction(rules, data.activeCount) : null;
  $('cap-description').textContent = cap
    ? `Maximum projected voting power: ${((Number(cap.numerator) * 100) / Number(cap.denominator)).toFixed(2)}% with ${data.activeCount} consensus validators.`
    : 'The voting power limit will appear after data loads.';
  $('cap-formula').textContent = cap
    ? `Cap = min(30%, ${(rules.factorTenths / 10).toFixed(1)} × 100% / ${data.activeCount}) = ${((Number(cap.numerator) * 100) / Number(cap.denominator)).toFixed(2)}%. The full active consensus set is used.`
    : 'Cap = min(30%, factor × 100% / active validator count).';
  renderRuleSummary();
  renderDraftBaseline();
  $('draft-eligibility-description').textContent = eligibilityDescription(rules) + '.';
  const coverage = $('draft-history-coverage');
  try {
    coverage.textContent =
      rules.schema === 2
        ? 'This saved policy retains its original eligibility.'
        : data
          ? historyCoverageText(
              activeSetEvidence(data.activeSetHistory ?? null, data, {
                allowCollecting: rules.schema === 4
              })
            )
          : 'Loading the observed history period…';
  } catch (error) {
    coverage.textContent = error.message;
  }
  for (const [input, field] of [
    ['factor-number', 'factorTenths'],
    ['commission', 'commissionMaxBps']
  ]) {
    const id = input + '-previous';
    let target = $(id);
    if (!target) {
      target = node('p', '', 'rule-previous');
      target.id = id;
      ($(input).closest('.factor-control') || $(input)).after(target);
    }
    const diff = ruleChanges(parent?.rule, rules).find((r) => r.key === field);
    target.replaceChildren(document.createTextNode(`Previously approved: ${diff.before}`));
    if (parent && diff.changed) {
      const reset = node('button', 'Reset');
      reset.type = 'button';
      reset.onclick = () => {
        rules[field] = parent.rule[field];
        restoreCommissionInput();
        invalidate();
        renderRules();
      };
      target.append(' ', reset);
    }
  }
  $('exclusion-count').textContent = rules.exclusions.length
    ? `· ${rules.exclusions.length}`
    : '· none';
  $('exclusions').replaceChildren();
  $('empty-exclusions').hidden = rules.exclusions.length > 0;
  for (const exclusion of rules.exclusions) {
    const item = node('li', ''),
      name = data?.validators.find((v) => v.address === exclusion.validator)?.name;
    item.append(
      node('strong', name || exclusion.validator),
      node('small', exclusion.validator),
      node('p', exclusion.reason)
    );
    const remove = node('button', 'Remove exclusion');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      rules.exclusions = rules.exclusions.filter((e) => e.validator !== exclusion.validator);
      invalidate();
      renderRules();
      tell('Exclusion removed. This is a rule change and needs a new rule approval.');
    });
    item.append(remove);
    $('exclusions').append(item);
  }
}
async function fetchJSON(url) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error(`Snapshot request failed (${response.status}).`);
  const text = await response.text();
  if (text.length > 4 * 1024 * 1024) throw Error('Snapshot exceeds the review limit.');
  return JSON.parse(text);
}
async function load() {
  if (loading) return;
  loading = true;
  void loadApprovedRules();
  $('refresh').disabled = true;
  $('claim-rewards').disabled = true;
  rewardsSource = null;
  data = null;
  renderCurrentPositions();
  $('current-breakdown').textContent = 'Loading current programme positions.';
  $('claim-rewards-amount').textContent = 'Loading claimable staking rewards…';
  $('claim-rewards-observed').textContent = '';
  claimFeedback('');
  $('simulate').disabled = true;
  invalidate('Loading a new snapshot…');
  $('snapshot-status').textContent = 'Loading programme snapshot…';
  tell('');
  try {
    const [source, history, readiness, rewards] = await Promise.all([
      fetchJSON('/data/daos/juno-delegation-planner.json'),
      fetchJSON('/data/validator-upgrades/juno-v31.json'),
      fetchJSON('/data/validator-upgrades/juno-v31-readiness.json'),
      fetchJSON('/data/treasury/juno-delegation.json').catch(() => null)
    ]);
    const next = snapshot(source),
      nextEvidence = upgradeEvidence(history, readiness);
    if (
      Date.parse(next.blockTime) > Date.now() + 300000 ||
      Date.parse(next.collectedAt) > Date.now() + 300000
    )
      throw Error('Snapshot timestamp is in the future.');
    data = next;
    renderCurrentPositions();
    rewardsSource = rewards;
    renderClaimRewards();
    evidence = nextEvidence;
    const stale = freshness() > 3600000;
    $('snapshot-status').textContent = stale
      ? 'Snapshot older than one hour · historical simulation only'
      : 'Programme snapshot available · read-only';
    $('snapshot-detail').textContent =
      `${new Date(data.blockTime).toLocaleString()} · ${data.activeCount} consensus validators`;
    $('snapshot-source').textContent =
      `Block ${data.height.toLocaleString('en-US')} · ${new URL(data.source).hostname} · collected ${new Date(data.collectedAt).toLocaleString()}`;
    $('programme-amount').value = String(suggestedBudget(data) / 1000000n);
    $('current-total').textContent = formatAmount(sumCurrent());
    const held = data.validators.filter((v) => BigInt(v.currentRaw) > 0n),
      inactive = held.filter((v) => !v.active),
      outside = inactive.reduce((sum, v) => sum + BigInt(v.currentRaw), 0n),
      current = sumCurrent();
    const outsidePercent =
      current > 0n ? (Number((outside * 10000n) / current) / 100).toFixed(2) : '0.00';
    const activePercent = current > 0n ? Number(((current - outside) * 10000n) / current) / 100 : 0;
    $('position-health').hidden = current <= 0n;
    $('active-position-meter').value = activePercent;
    $('active-position-share').textContent = `${activePercent.toFixed(2)}%`;
    $('active-position-count').textContent = `${held.length - inactive.length} in the active set`;
    $('outside-position-count').textContent = `${inactive.length} outside · ${outsidePercent}%`;
    $('current-breakdown').textContent =
      `Current positions: ${fmt(current - outside)} JUNO across ${held.length - inactive.length} consensus validators; ${fmt(outside)} JUNO across ${inactive.length} validators outside the active set (${outsidePercent}%). These positions are not automatically unbonding funds.`;
    $('upgrade-window').textContent =
      `Halt: ${new Date(evidence.window.start).toISOString()} · inclusive deadline: ${new Date(evidence.window.end).toISOString()} · ${evidence.records.size} historical validators · window scan ${evidence.window.coverageComplete ? 'complete' : 'incomplete'}. Consensus captures provide additional partial evidence.`;

    $('available-funds').textContent =
      `Delegated ${formatAmount(sumCurrent())} + spendable ${formatAmount(data.liquidRaw)} JUNO. Suggested total includes both, keeps 50 JUNO in reserve and rounds down to 100 JUNO. Unclaimed rewards and unbonding funds are excluded. You can edit the amount.`;
    $('validator-options').replaceChildren(
      ...data.validators.map((v) => {
        const option = node('option', v.name);
        option.value = v.address;
        return option;
      })
    );
    $('reserve-note').textContent =
      BigInt(data.liquidRaw) < LIQUID_RESERVE
        ? 'Less than 50 JUNO is currently spendable. A lower target does not create immediate liquidity; any unstaking must complete before the reserve is available.'
        : 'At least 50 JUNO remains available outside the allocation; rounding can leave more.';
    $('claim-rewards').disabled = stale || !held.length;
    $('claim-rewards-help').textContent = stale
      ? 'Refresh current programme data before preparing a rewards proposal.'
      : !held.length
        ? 'No current programme delegations to claim from.'
        : 'Opens a draft for community review. Claiming follows on-chain approval and execution.';
    $('simulate').disabled = false;
    renderRules();
    tell(
      stale
        ? 'You can inspect this historical snapshot. Refresh current data before requesting approval.'
        : '',
      stale ? 'warning' : 'info'
    );
  } catch (error) {
    data = null;
    rewardsSource = null;
    renderClaimRewards();
    evidence = null;
    $('snapshot-status').textContent = 'Programme snapshot unavailable';
    $('snapshot-detail').textContent =
      'The dedicated collector must publish a validated snapshot before allocations can be calculated.';
    $('snapshot-source').textContent = 'No usable programme snapshot.';
    renderCurrentPositions();
    $('programme-amount').value = '';
    $('reserve-note').textContent = '';
    $('claim-rewards-help').textContent = 'Load a valid current programme snapshot first.';
    $('current-breakdown').textContent =
      'Current consensus-set delegation breakdown is unavailable.';
    $('upgrade-window').textContent =
      'Archive coverage could not be loaded with the programme snapshot.';

    $('available-funds').textContent = 'No usable programme snapshot.';
    renderRules();
    tell(error.message, 'error');
  } finally {
    loading = false;
    $('refresh').disabled = false;
  }
}
function renderResult() {
  renderRuleReview($('simulation-comparison'), review);
  renderRuleReview($('proposal-review'), review);
  $('proposal-empty').hidden = true;
  $('proposal-review').hidden = false;
  $('simulation-state').textContent = review.model.proposed.result
    ? 'Draft comparison'
    : 'Evidence incomplete';
  renderRuleSummary();
}
function focusRuleInput(id) {
  $('rules-eligibility-details').open = true;
  $(id).focus();
}
async function runSimulation() {
  try {
    if (!data || !evidence) throw Error('Load programme data first.');
    if (!$('factor-number').checkValidity() || !$('factor-number').value) {
      focusRuleInput('factor-number');
      throw Error('Enter a factor from 1.0 to 2.0 in steps of 0.1.');
    }
    if (!commissionValid()) {
      focusRuleInput('commission');
      throw Error(
        'Enter a whole-number commission limit from 0 to 100, or select no commission limit.'
      );
    }
    invalidate('Calculating the proposed allocation…');
    const token = revision;
    if (approval.status !== 'verified')
      throw Error(
        'Verify the current approval status before freezing a comparison. Refresh data to retry.'
      );
    if (!parentMatches(parent, approval.current))
      throw Error(
        'The parent policy has changed. Start from current approved rules before reviewing.'
      );
    const result = await buildRuleReview({
      rule: rules,
      parent,
      snapshot: data,
      evidence,
      activeHistory: data.activeSetHistory ?? null,
      budgetRaw: amount($('programme-amount').value.trim()).toString(),
      rationale: $('rule-rationale').value
    });
    if (token !== revision) return;
    review = result;
    renderResult();
    $('rule-fingerprint').textContent =
      `Rule SHA-256: ${review.value.policyHash} · Review SHA-256: ${review.hash}`;
    $('export-json').disabled = false;
    $('review-proposal').disabled = false;
    renderDraftBaseline();
    setStep('simulation');
    tell(
      review.model.proposed.result
        ? 'Comparison ready. Review the rule changes and allocation impact before opening the proposal.'
        : 'Rules are ready to review. The allocation estimate remains unavailable until the required history is complete.'
    );
  } catch (error) {
    tell(error.message, 'error');
  }
}
function download(name, body, type) {
  const url = URL.createObjectURL(new Blob([body], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('factor').addEventListener('input', () => {
  $('factor-error').hidden = true;
  $('factor-number').removeAttribute('aria-invalid');
  rules.factorTenths = Number($('factor').value);
  invalidate();
  renderRules();
});
$('factor-number').addEventListener('input', () => {
  invalidate();
  const valid = $('factor-number').value !== '' && $('factor-number').checkValidity();
  $('factor-error').hidden = valid;
  $('factor-number').setAttribute('aria-invalid', String(!valid));
  if (!valid) return;
  rules.factorTenths = Math.round(Number($('factor-number').value) * 10);
  $('factor').value = rules.factorTenths;
  $('factor-value').value = (rules.factorTenths / 10).toFixed(1) + '×';
  const currentInput = $('factor-number').value;
  renderRules();
  $('factor-number').value = currentInput;
});
function updateCommission() {
  $('commission').disabled = $('no-commission-limit').checked;
  showCommissionError();
  if (commissionValid())
    rules.commissionMaxBps = $('no-commission-limit').checked
      ? null
      : Number($('commission').value) * 100;
  invalidate();
  renderRules();
}
$('commission').addEventListener('input', updateCommission);
$('no-commission-limit').addEventListener('change', updateCommission);
$('programme-amount').addEventListener('input', () => invalidate());
$('add-exclusion').addEventListener('click', () => {
  try {
    let validator = $('excluded-validator').value.trim();
    if (!validator.startsWith('junovaloper1')) {
      const matches =
        data?.validators.filter((v) => v.name.toLowerCase() === validator.toLowerCase()) || [];
      if (matches.length !== 1)
        throw Error('Select one validator by its address; the name is missing or ambiguous.');
      validator = matches[0].address;
    }
    rules = policy({
      ...rules,
      exclusions: [
        ...rules.exclusions,
        {
          chainId: 'juno-1',
          validator,
          reason: $('excluded-reason').value.trim()
        }
      ]
    });
    $('excluded-validator').value = '';
    $('excluded-reason').value = '';
    invalidate();
    renderRules();
    tell('Exclusion added to the rule draft. A new rule approval is required.');
  } catch (error) {
    tell(error.message, 'error');
  }
});
$('save-draft').addEventListener('click', () => {
  try {
    if (!$('factor-number').checkValidity() || !$('factor-number').value) {
      tell('Enter a factor from 1.0 to 2.0 before saving the rules.', 'error');
      focusRuleInput('factor-number');
      return;
    }
    if (!commissionValid()) {
      tell('Enter a whole-number commission limit from 0 to 100 before saving the rules.', 'error');
      focusRuleInput('commission');
      return;
    }
    localStorage.setItem(
      key,
      JSON.stringify({
        schema: 1,
        rule: policy(rules),
        parent,
        rationale: $('rule-rationale').value
      })
    );
    $('draft-status').textContent = 'Saved locally · unapproved';
    tell(
      'Rule draft saved on this device. The amount and simulation are not saved. The rules have not been submitted or approved.'
    );
  } catch {
    tell('Draft could not be saved on this device.');
  }
});
$('reset-draft').addEventListener('click', () => {
  rules = parent ? structuredClone(parent.rule) : defaultPolicy();
  $('rule-rationale').value = '';
  restoreCommissionInput();
  $('factor-error').hidden = true;
  $('factor-number').removeAttribute('aria-invalid');
  try {
    localStorage.removeItem(key);
  } catch {}
  invalidate();
  renderRules();
  $('draft-status').textContent = 'Defaults restored · unapproved';
  tell('Rule draft reset.');
});
$('refresh').addEventListener('click', load);
$('simulate').addEventListener('click', runSimulation);
$('export-json').addEventListener('click', () => {
  if (review)
    download(
      `juno-rule-draft-${review.value.policyHash.slice(0, 12)}.json`,
      JSON.stringify(review.value, null, 2) + '\n',
      'application/json'
    );
});
function openProposal(value) {
  const url = savePlannerProposal(localStorage, value);
  location.assign(url);
}
$('publish-proposal').addEventListener('click', async () => {
  const selected = review,
    token = revision;
  try {
    if (!selected) return;
    $('publish-proposal').disabled = true;
    tell('Verifying the parent approval and preparing the frozen comparison…');
    const current = await currentApprovedRules();
    if (token !== revision || selected !== review) return;
    approval = { status: 'verified', current: current.current };
    if (!parentMatches(selected.value.parent, current.current))
      throw Error(
        'The approved policy changed. Keep this export and start a new draft from current rules.'
      );
    if (freshness() > 3600000) throw Error('Refresh the snapshot before opening a rule proposal.');
    const proposal = await frozenRuleProposal(selected);
    if (token !== revision || selected !== review) return;
    openProposal(proposal);
  } catch (error) {
    tell(error.message, 'error');
  } finally {
    renderDraftBaseline();
  }
});
$('rule-rationale').addEventListener('input', () => invalidate());
$('adopt-current-rules').onclick = () => {
  if (approval.status !== 'verified') return;
  parent = structuredClone(approval.current);
  rules = parent ? structuredClone(parent.rule) : defaultPolicy();
  restoreCommissionInput();
  invalidate();
  renderRules();
};
$('use-current-model').onclick = () => {
  rules = { ...rules, schema: defaultPolicy().schema, eligibility: defaultPolicy().eligibility };
  invalidate();
  renderRules();
};
$('claim-rewards').addEventListener('click', () => {
  const button = $('claim-rewards');
  try {
    if (!data || loading) throw Error('Load current programme data first.');
    button.disabled = true;
    button.textContent = 'Preparing claim draft…';
    claimFeedback('Preparing a local draft. No wallet signature is required.');
    renderClaimRewards();
    openProposal(claimProposal(data, Date.now(), rewardsSource));
  } catch (error) {
    claimFeedback(`Could not open the claim draft. ${error.message}`, 'error');
  } finally {
    button.textContent = 'Create claim rewards proposal';
    button.disabled =
      loading ||
      !data ||
      freshness() > 3600000 ||
      !data.validators.some((v) => BigInt(v.currentRaw) > 0n);
  }
});
// Expire observations on long-open tabs without changing edited allocation inputs.
setInterval(() => {
  if (!loading && !document.hidden) renderClaimRewards();
}, 60000);
document.addEventListener('visibilitychange', () => {
  if (!loading && !document.hidden) renderClaimRewards();
});
renderFuturePolicy($('overview-future-policy'), 'overview');
renderFuturePolicy($('rules-future-policy'), 'rules');
$('current-positions-toggle').onclick = () => {
  showAllCurrentPositions = !showAllCurrentPositions;
  renderCurrentPositions();
};
document.querySelectorAll('[data-step]').forEach((link) =>
  link.addEventListener('click', (event) => {
    event.preventDefault();
    setStep(link.dataset.step);
  })
);
$('review-proposal').addEventListener('click', () => {
  if (review) setStep('proposals');
});
window.addEventListener('hashchange', () => {
  if (location.hash === '#roadmap') {
    setStep('rules');
    $('roadmap').open = true;
    $('roadmap').scrollIntoView({ block: 'start' });
  } else setStep(location.hash.slice(1));
});
const initialStep = location.hash.slice(1);
setStep(initialStep === 'roadmap' ? 'rules' : initialStep, false);
if (initialStep === 'roadmap') {
  $('roadmap').open = true;
  $('roadmap').scrollIntoView({ block: 'start' });
} else {
  // A deep link selects the view; keep its title and navigation in sight.
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
}
try {
  const saved = localStorage.getItem(key);
  if (saved) {
    const value = JSON.parse(saved);
    rules = policy(value.rule);
    parent = value.parent ?? null;
    draftStarted = true;
    $('rule-rationale').value = value.rationale || '';
    $('draft-status').textContent = 'Local draft restored · original baseline preserved';
  } else if (localStorage.getItem('cosmoot:juno:delegation:rule-draft:v2')) {
    rules = policy(JSON.parse(localStorage.getItem('cosmoot:juno:delegation:rule-draft:v2')));
    draftStarted = true;
    $('draft-status').textContent =
      'Legacy draft preserved · review the new 90-day model before proposing';
  }
} catch {
  tell('Saved draft is invalid or unavailable. Default rules loaded.');
}
restoreCommissionInput();
renderRules();
load();
