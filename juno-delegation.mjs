import {
  defaultPolicy,
  policy,
  snapshot,
  upgradeEvidence,
  simulate,
  amount,
  units,
  fingerprint,
  capFraction
} from './juno-delegation-core.mjs';

import {
  formatAmount,
  formatChange,
  stakeShare,
  rowStatus,
  allocationReason,
  selectRows
} from './juno-delegation-view.mjs';

const $ = (id) => document.getElementById(id),
  key = 'cosmoot:juno:delegation:rule-draft:v1';
let rules = defaultPolicy(),
  data = null,
  evidence = null,
  archive = null,
  review = null,
  revision = 0,
  loading = false;
let page = 0;
const pageSize = 10,
  expanded = new Set();
const fmt = (value) => formatAmount(value, true);
const tell = (message, tone = 'info') => {
  $('feedback').textContent = message;
  $('feedback').dataset.tone = tone;
};
function setStep(step, focus = true) {
  if (!['rules', 'simulation', 'proposals'].includes(step)) step = 'rules';
  for (const panel of document.querySelectorAll('.planner-panel')) panel.hidden = panel.id !== step;
  for (const link of document.querySelectorAll('.planner-steps [data-step]')) {
    if (link.dataset.step === step) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  }
  if (location.hash !== '#' + step) history.replaceState(null, '', '#' + step);
  if (focus) {
    const heading = $(
      step === 'rules'
        ? 'rules-title'
        : step === 'simulation'
          ? 'simulation-title'
          : 'proposals-title'
    );
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start' });
  }
}
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
};
const sumCurrent = () => data.validators.reduce((a, v) => a + BigInt(v.currentRaw), 0n);
function freshness() {
  return data
    ? Math.max(Date.now() - Date.parse(data.blockTime), Date.now() - Date.parse(data.collectedAt))
    : Infinity;
}
function invalidate(
  message = 'Rules or amount changed. Simulate again to refresh this comparison.'
) {
  revision++;
  if (message.startsWith('Rules or amount changed'))
    $('draft-status').textContent = 'Draft changed · save rules to keep them locally';
  review = null;
  page = 0;
  expanded.clear();
  for (const id of [
    'export-json',
    'export-markdown',
    'review-proposal',
    'previous-page',
    'next-page'
  ])
    $(id).disabled = true;
  $('simulation-state').textContent = 'Not simulated';
  for (const id of ['eligible-total', 'recipient-total', 'allocated-total', 'unallocated-total'])
    $(id).textContent = '—';
  $('unallocated-total').parentElement.classList.remove('attention');
  $('rule-fingerprint').textContent = 'Simulate to identify this exact rule and data version.';
  $('allocation-explanation').textContent = message;
  $('simulation-note').textContent =
    'This is a target distribution, not an immediate redelegation transaction.';
  $('evidence-review').hidden = true;
  $('proposal-review').hidden = true;
  $('proposal-empty').hidden = false;
  $('table-count').textContent = 'No current simulation.';
  const row = node('tr', ''),
    cell = node('td', message);
  cell.colSpan = 5;
  row.append(cell);
  $('allocation-rows').replaceChildren(row);
  renderRuleSummary();
}
function renderRuleSummary() {
  const cap = data ? capFraction(rules, data.activeCount) : null;
  const capText = cap
    ? ((Number(cap.numerator) * 100) / Number(cap.denominator)).toFixed(2) + '%'
    : 'pending';
  $('rule-summary').textContent =
    `Equal allocation · voting power cap ${capText} · ${rules.commissionMaxBps === null ? 'no commission filter' : 'commission ≤' + rules.commissionMaxBps / 100 + '%'} · v31 participation ≤5h · ${rules.exclusions.length} manual exclusions`;
}
function renderRules() {
  $('factor').value = rules.factorTenths;
  $('factor').setAttribute('aria-valuetext', (rules.factorTenths / 10).toFixed(1) + ' times');
  $('factor-number').value = (rules.factorTenths / 10).toFixed(1);
  $('factor-value').value = (rules.factorTenths / 10).toFixed(1) + '×';
  const commission = rules.commissionMaxBps === null ? 'none' : String(rules.commissionMaxBps);
  if (![...$('commission').options].some((o) => o.value === commission)) {
    $('commission').append(new Option(`${Number(commission) / 100}%`, commission));
  }
  $('commission').value = commission;
  const cap = data ? capFraction(rules, data.activeCount) : null;
  $('cap-description').textContent = cap
    ? `Maximum projected voting power: ${((Number(cap.numerator) * 100) / Number(cap.denominator)).toFixed(2)}% with ${data.activeCount} active validators.`
    : 'The voting power limit will appear after data loads.';
  $('cap-formula').textContent = cap
    ? `Cap = min(30%, ${(rules.factorTenths / 10).toFixed(1)} × 100% / ${data.activeCount}) = ${((Number(cap.numerator) * 100) / Number(cap.denominator)).toFixed(2)}%. The full active consensus set is used.`
    : 'Cap = min(30%, factor × 100% / active validator count).';
  renderRuleSummary();
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
  $('refresh').disabled = true;
  $('simulate').disabled = true;
  invalidate('Loading a new snapshot…');
  $('snapshot-status').textContent = 'Loading programme snapshot…';
  tell('');
  try {
    const [source, history, readiness] = await Promise.all([
      fetchJSON('/data/daos/juno-delegation-planner.json'),
      fetchJSON('/data/validator-upgrades/juno-v31.json'),
      fetchJSON('/data/validator-upgrades/juno-v31-readiness.json')
    ]);
    const next = snapshot(source),
      nextEvidence = upgradeEvidence(history, readiness);
    if (
      Date.parse(next.blockTime) > Date.now() + 300000 ||
      Date.parse(next.collectedAt) > Date.now() + 300000
    )
      throw Error('Snapshot timestamp is in the future.');
    data = next;
    evidence = nextEvidence;
    archive = { history, readiness };
    const stale = freshness() > 3600000;
    $('snapshot-status').textContent = stale
      ? 'Snapshot older than one hour · historical simulation only'
      : 'Programme snapshot available · read-only';
    $('snapshot-detail').textContent =
      `${new Date(data.blockTime).toLocaleString()} · ${data.activeCount} active validators`;
    $('snapshot-source').textContent =
      `Block ${data.height.toLocaleString('en-US')} · ${new URL(data.source).hostname} · collected ${new Date(data.collectedAt).toLocaleString()}`;
    $('programme-amount').value = units(sumCurrent());
    $('current-total').textContent = formatAmount(sumCurrent());
    const held = data.validators.filter((v) => BigInt(v.currentRaw) > 0n),
      inactive = held.filter((v) => !v.active),
      outside = inactive.reduce((sum, v) => sum + BigInt(v.currentRaw), 0n),
      current = sumCurrent();
    const outsidePercent =
      current > 0n ? (Number((outside * 10000n) / current) / 100).toFixed(2) : '0.00';
    $('current-breakdown').textContent =
      `Current positions: ${fmt(current - outside)} JUNO across ${held.length - inactive.length} active validators; ${fmt(outside)} JUNO across ${inactive.length} validators outside the active set (${outsidePercent}%). These positions are not automatically unbonding funds.`;
    $('upgrade-window').textContent =
      `Halt: ${new Date(evidence.window.start).toISOString()} · inclusive deadline: ${new Date(evidence.window.end).toISOString()} · ${evidence.records.size} historical validators · window scan ${evidence.window.coverageComplete ? 'complete' : 'incomplete'}. Consensus captures provide additional partial evidence.`;
    $('active-total').textContent = `${data.activeCount} active validators`;
    $('available-funds').textContent =
      `Delegated ${formatAmount(sumCurrent())} + spendable ${formatAmount(data.liquidRaw)} JUNO. Rewards and unbonding funds are excluded. Up to six decimal places.`;
    $('validator-options').replaceChildren(
      ...data.validators.map((v) => {
        const option = node('option', v.name);
        option.value = v.address;
        return option;
      })
    );
    $('simulate').disabled = false;
    renderRules();
    tell(
      stale
        ? 'You can inspect this historical snapshot. Refresh current data before requesting approval.'
        : 'Programme data loaded. Review the rules, then simulate.'
    );
  } catch (error) {
    data = null;
    evidence = null;
    archive = null;
    $('snapshot-status').textContent = 'Programme snapshot unavailable';
    $('snapshot-detail').textContent =
      'The dedicated collector must publish a validated snapshot before allocations can be calculated.';
    $('snapshot-source').textContent = 'No usable programme snapshot.';
    $('current-total').textContent = '—';
    $('current-breakdown').textContent =
      'Current active / inactive delegation breakdown is unavailable.';
    $('upgrade-window').textContent =
      'Archive coverage could not be loaded with the programme snapshot.';
    $('active-total').textContent = 'Active set pending';
    $('available-funds').textContent = 'No usable programme snapshot.';
    renderRules();
    tell(error.message, 'error');
  } finally {
    loading = false;
    $('refresh').disabled = false;
  }
}
function renderTable() {
  if (!review) return;
  const result = review.simulation;
  const rows = selectRows(result, {
    query: $('validator-search').value,
    filter: $('validator-filter').value,
    sort: $('validator-sort').value
  });
  page = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
  const bonded = data.validators
    .filter((v) => v.active)
    .reduce((sum, v) => sum + BigInt(v.tokensRaw), 0n);
  const shown = rows.slice(page * pageSize, (page + 1) * pageSize);
  $('allocation-rows').replaceChildren();
  for (const v of shown) {
    const row = node('tr', '', 'allocation-row'),
      name = node('td', '', 'validator-cell');
    const isReview = v.active && v.upgrade.status !== 'observed';
    name.append(
      node('strong', v.name || 'Unnamed validator', 'validator-name'),
      node('span', rowStatus(v), 'row-status' + (isReview ? ' needs-review' : ''))
    );
    const toggle = node('button', 'Why this amount?', 'row-toggle'),
      detail = node('tr', '', 'row-detail'),
      content = node('td', '');
    toggle.type = 'button';
    detail.id = 'detail-' + v.address;
    detail.hidden = !expanded.has(v.address);
    toggle.setAttribute('aria-expanded', String(!detail.hidden));
    toggle.setAttribute('aria-controls', detail.id);
    toggle.setAttribute('aria-label', `Why this amount for ${v.name || v.address}?`);
    toggle.addEventListener('click', () => {
      detail.hidden = !detail.hidden;
      toggle.setAttribute('aria-expanded', String(!detail.hidden));
      if (detail.hidden) expanded.delete(v.address);
      else expanded.add(v.address);
    });
    name.append(toggle);
    const currentShare = v.active ? stakeShare(v.tokensRaw, bonded) : 'Outside active set';
    const projectedShare = v.active
      ? stakeShare(v.projectedRaw, result.projectedBondedRaw)
      : 'Outside projected set';
    row.append(
      name,
      node('td', formatAmount(v.currentRaw), 'numeric'),
      node('td', formatAmount(v.targetRaw), 'numeric target-amount'),
      node('td', formatChange(v.deltaRaw), 'numeric'),
      node('td', v.active ? `${currentShare} → ${projectedShare}` : 'Outside active set', 'numeric')
    );
    content.colSpan = 5;
    content.append(node('p', allocationReason(v)), node('p', v.address, 'detail-address'));
    const exact = node('div', '', 'exact-amounts');
    exact.append(
      node('span', `Current: ${fmt(v.currentRaw)} JUNO`),
      node('span', `Target: ${fmt(v.targetRaw)} JUNO`),
      node('span', `Change: ${formatChange(v.deltaRaw, true)} JUNO`)
    );
    const facts = node('p', '', 'detail-facts');
    facts.append(
      node('span', `Commission: ${(v.commissionBps / 100).toFixed(2)}%`),
      node('span', `Stake share: ${currentShare} → ${projectedShare}`)
    );
    if (v.eligible)
      facts.append(node('span', `Capacity under the cap: ${fmt(v.capacityRaw)} JUNO`));
    content.append(exact, facts);
    if (v.upgrade.timestamp)
      content.append(
        node(
          'p',
          `First recorded ${v.upgrade.evidence}: ${new Date(v.upgrade.timestamp).toISOString()}`,
          'field-help'
        )
      );
    if (v.upgrade.status !== 'observed')
      content.append(
        node(
          'p',
          'Participation within five hours is not established. A missing or later observation does not prove a late software installation.',
          'field-help'
        )
      );
    const link = node('a', 'Review the v31 evidence ↗');
    link.href = '/community-tools/validator-upgrades/juno-v31/';
    content.append(link);
    detail.append(content);
    $('allocation-rows').append(row, detail);
  }
  if (!rows.length) {
    const row = node('tr', ''),
      cell = node('td', 'No validators match these filters.');
    cell.colSpan = 5;
    row.append(cell);
    $('allocation-rows').append(row);
  }
  $('table-count').textContent = rows.length
    ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, rows.length)} of ${rows.length} validators · amounts rounded to two decimals`
    : 'No matching validators.';
  $('previous-page').disabled = page === 0;
  $('next-page').disabled = (page + 1) * pageSize >= rows.length;
}
function renderProposal(result) {
  $('proposal-empty').hidden = true;
  $('proposal-review').hidden = false;
  const p = result.policy,
    cap = capFraction(p, data.activeCount);
  const entries = [
    [
      'Distribution',
      'Equal amounts, with excess redistributed within the voting power limit. No separate minimum or maximum per validator.'
    ],
    ['Eligibility', 'Active, non-jailed Juno mainnet validators.'],
    [
      'Voting power',
      `min(30%, ${(p.factorTenths / 10).toFixed(1)} × 100% / active validator count). At this snapshot: ${((Number(cap.numerator) * 100) / Number(cap.denominator)).toFixed(2)}%. Exclusions do not reduce the count.`
    ],
    [
      'Commission',
      p.commissionMaxBps === null
        ? 'No commission filter.'
        : `${p.commissionMaxBps / 100}% maximum.`
    ],
    [
      'v31 participation',
      'Archived participation within five hours of the halt. Unresolved evidence receives no target and remains a review case.'
    ],
    [
      'Manual exclusions',
      p.exclusions.length
        ? p.exclusions
            .map(
              (e) =>
                `${data.validators.find((v) => v.address === e.validator)?.name || e.validator} (${e.validator}): ${e.reason}`
            )
            .join(' · ')
        : 'None.'
    ],
    [
      'Future changes',
      'Changes to criteria, cap, method or exclusions require a new rule approval.'
    ]
  ];
  $('proposal-rules').replaceChildren(
    ...entries.map(([label, value]) => {
      const row = node('div', '');
      row.append(node('dt', label), node('dd', value));
      return row;
    })
  );
  $('proposal-impact').textContent =
    `${formatAmount(result.allocatedRaw)} JUNO allocated to ${result.rows.filter((v) => BigInt(v.targetRaw) > 0n).length} validators. ${formatAmount(result.unallocatedRaw)} JUNO unallocated. This is an example, not an execution instruction.`;
  $('proposal-evidence').textContent =
    `${result.evidenceReviewCount} active validators need evidence review.${BigInt(result.releasedRaw) > 0n ? ` ${formatAmount(result.releasedRaw)} JUNO would leave the current allocation.` : ''} Review these cases before putting the rules to the community.`;
  $('proposal-snapshot').textContent =
    `Block ${data.height.toLocaleString('en-US')} · ${new Date(data.blockTime).toLocaleString()} · ${freshness() > 3600000 ? 'Historical snapshot: refresh before requesting approval.' : 'Refresh the data before voting and again before execution.'}`;
}
function renderResult(result) {
  const recipients = result.rows.filter((v) => BigInt(v.targetRaw) > 0n),
    capped = recipients.filter((v) => v.capReached),
    noCapacity = result.rows.filter((v) => v.eligible && v.capacityRaw === '0');
  $('eligible-total').textContent = result.eligibleCount;
  $('recipient-total').textContent = recipients.length;
  $('allocated-total').textContent = formatAmount(result.allocatedRaw);
  $('unallocated-total').textContent = formatAmount(result.unallocatedRaw);
  $('unallocated-total').parentElement.classList.toggle(
    'attention',
    BigInt(result.unallocatedRaw) > 0n
  );
  $('simulation-state').textContent =
    freshness() > 3600000 ? 'Historical simulation' : 'Draft simulation';
  const roundedToZero = result.rows.filter(
    (v) => v.eligible && v.capacityRaw !== '0' && v.targetRaw === '0'
  );
  $('allocation-explanation').textContent =
    `${recipients.length} validators receive an allocation: ${recipients.length - capped.length} receive the equal share and ${capped.length} are limited by voting power. ${noCapacity.length} otherwise eligible validators have no capacity under the limit.${roundedToZero.length ? ` ${roundedToZero.length} receive no allocation after micro-JUNO rounding.` : ''}`;
  $('evidence-review').hidden = result.evidenceReviewCount === 0;
  $('evidence-review-text').textContent =
    `${result.evidenceReviewCount} active validators need participation evidence review.`;
  const notes = [
    'Target is the total programme delegation after redistribution. Projected stake shares are estimates.'
  ];
  if (data.redelegations.length)
    notes.push(`${data.redelegations.length} existing redelegation records need execution review.`);
  if (BigInt(result.releasedRaw))
    notes.push(
      `${formatAmount(result.releasedRaw)} JUNO would leave the current programme allocation; no unstaking transaction is prepared.`
    );
  if (freshness() > 3600000) notes.push('Historical snapshot: refresh before approval.');
  $('simulation-note').textContent = notes.join(' ');
  renderRuleSummary();
  renderTable();
  renderProposal(result);
}
async function runSimulation() {
  try {
    if (!data || !evidence) throw Error('Load programme data first.');
    if (!$('factor-number').checkValidity() || !$('factor-number').value)
      throw Error('Enter a factor from 1.0 to 2.0 in steps of 0.1.');
    invalidate('Calculating the proposed allocation…');
    const token = revision;
    const result = simulate(rules, data, amount($('programme-amount').value.trim()), evidence);
    const [policyHash, snapshotHash, evidenceHash] = await Promise.all([
      fingerprint(result.policy),
      fingerprint(data),
      fingerprint(archive)
    ]);
    if (token !== revision) return;
    review = {
      schema: 1,
      proposalType: 'RULE_APPROVAL',
      status: 'DRAFT_NOT_SUBMITTED',
      createdAt: new Date().toISOString(),
      policyHash,
      snapshotHash,
      evidenceHash,
      rule: result.policy,
      snapshot: data,
      upgradeEvidence: archive,
      simulation: result,
      approval: null,
      execution: {
        enabled: false,
        messages: [],
        requirements: [
          'Verified on-chain rule approval',
          'Programme execution authority adapter',
          'Fresh data and redelegation/transaction-limit checks',
          'Separate approval of exact execution proposal'
        ]
      }
    };
    renderResult(result);
    $('rule-fingerprint').textContent =
      `Rule SHA-256: ${policyHash} · Snapshot SHA-256: ${snapshotHash}`;
    $('export-json').disabled = false;
    $('export-markdown').disabled = false;
    $('review-proposal').disabled = false;
    setStep('simulation');
    tell(
      'Simulation complete. Review eligibility, remaining funds and the changes before downloading the rule draft.'
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
function markdown(packageData) {
  const r = packageData.simulation,
    p = packageData.rule;
  return `# Juno Delegation Programme — RULE APPROVAL DRAFT\n\nStatus: NOT SUBMITTED. No on-chain approval or execution authorization.\n\nRule SHA-256: ${packageData.policyHash}\nSnapshot SHA-256: ${packageData.snapshotHash}\nUpgrade evidence SHA-256: ${packageData.evidenceHash}\n\n## Rules proposed for approval\n\n- Chain: juno-1; programme: ${p.programme}\n- Equal distribution, with excess redistributed within the cap. No separate per-validator minimum or maximum.\n- Active, non-jailed mainnet validators only.\n- Cap: min(30%, ${(p.factorTenths / 10).toFixed(1)} × 100% / actual active consensus validator count). Programme exclusions do not change the count.\n- Commission: ${p.commissionMaxBps === null ? 'no filter' : p.commissionMaxBps / 100 + '% maximum'}.\n- Juno v31: participation evidence within five hours after the archived halt. Missing or late observations are unresolved installation evidence, not proof of a late software upgrade.\n- Criteria, cap, algorithm and exclusion-list changes each require a new rule approval.\n\nExact policy:\n\n\`\`\`json\n${JSON.stringify(p, null, 2)}\n\`\`\`\n\n## Illustrative simulation (not an execution instruction)\n\nBlock: ${packageData.snapshot.height}; block time: ${packageData.snapshot.blockTime}.\nSource: ${packageData.snapshot.source}. Refresh before voting and again before execution.\nProgramme amount: ${units(r.budgetRaw)} JUNO.\nAllocated: ${units(r.allocatedRaw)} JUNO; unallocated: ${units(r.unallocatedRaw)} JUNO.\nReleased from prior allocation: ${units(r.releasedRaw)} JUNO.\nEligible: ${r.eligibleCount}; active validators requiring evidence review: ${r.evidenceReviewCount}.\n\nProjected shares remove old programme stake before adding targets and exclude unallocated cash from bonded stake. They estimate consensus voting power. The review JSON contains every validator, amount and source record.\n\n| Validator address | Current JUNO | Target JUNO | Change JUNO |\n| --- | ---: | ---: | ---: |\n${r.rows
    .filter((v) => v.active || BigInt(v.currentRaw))
    .map(
      (v) =>
        `| ${v.address} | ${units(v.currentRaw)} | ${units(v.targetRaw)} | ${BigInt(v.deltaRaw) < 0n ? '-' + units(-BigInt(v.deltaRaw)) : units(v.deltaRaw)} |`
    )
    .join(
      '\n'
    )}\n\n## Approval and execution\n\nThis download does not grant approval. On-chain approval verification and the programme authority adapter are not connected. Execution requires a separate proposal referencing the approved rule and exact data and transaction set, with redelegation constraints checked.\n\n## V2 — inactive\n\n30-day uptime, finer upgrade responsiveness, testnet and governance participation, and verified public RPC reliability. RPC scoring should use independent probes, sufficient coverage and an approved observation window, without counting duplicate endpoints, chain halts or monitoring gaps as validator merit or failure. Scoring thresholds and weights require a new rule approval.\n`;
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
$('commission').addEventListener('change', () => {
  rules.commissionMaxBps = $('commission').value === 'none' ? null : Number($('commission').value);
  invalidate();
});
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
      $('factor-number').focus();
      return;
    }
    localStorage.setItem(key, JSON.stringify(policy(rules)));
    $('draft-status').textContent = 'Saved locally · unapproved';
    tell(
      'Rule draft saved on this device. The amount and simulation are not saved. The rules have not been submitted or approved.'
    );
  } catch {
    tell('Draft could not be saved on this device.');
  }
});
$('reset-draft').addEventListener('click', () => {
  rules = defaultPolicy();
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
      `juno-rule-draft-${review.policyHash.slice(0, 12)}.json`,
      JSON.stringify(review, null, 2) + '\n',
      'application/json'
    );
});
$('export-markdown').addEventListener('click', () => {
  if (review)
    download(
      `juno-rule-proposal-${review.policyHash.slice(0, 12)}.md`,
      markdown(review),
      'text/markdown'
    );
});
document.querySelectorAll('[data-step]').forEach((link) =>
  link.addEventListener('click', (event) => {
    event.preventDefault();
    setStep(link.dataset.step);
  })
);
$('review-proposal').addEventListener('click', () => {
  if (review) setStep('proposals');
});
for (const id of ['validator-search', 'validator-filter', 'validator-sort'])
  $(id).addEventListener(id === 'validator-search' ? 'input' : 'change', () => {
    page = 0;
    renderTable();
  });
$('previous-page').addEventListener('click', () => {
  page--;
  renderTable();
});
$('next-page').addEventListener('click', () => {
  page++;
  renderTable();
});
$('show-evidence-review').addEventListener('click', () => {
  $('validator-search').value = '';
  $('validator-filter').value = 'review';
  page = 0;
  renderTable();
  $('validator-filter').focus();
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
if (initialStep === 'roadmap') $('roadmap').open = true;
try {
  const saved = localStorage.getItem(key);
  if (saved) {
    rules = policy(JSON.parse(saved));
    $('draft-status').textContent = 'Local draft restored · unapproved';
  }
} catch {
  tell('Saved draft is invalid or unavailable. Default rules loaded.');
}
renderRules();
load();
