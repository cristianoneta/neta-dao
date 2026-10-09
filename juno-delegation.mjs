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

const $ = (id) => document.getElementById(id),
  key = 'cosmoot:juno:delegation:rule-draft:v1';
let rules = defaultPolicy(),
  data = null,
  evidence = null,
  archive = null,
  review = null,
  revision = 0,
  loading = false;
const fmt = (value) => {
  let n = BigInt(value),
    sign = n < 0n ? '−' : '';
  if (n < 0n) n = -n;
  const [whole, fraction] = units(n).split('.');
  return (
    sign +
    BigInt(whole).toLocaleString('en-US') +
    (fraction.replace(/0+$/, '') ? '.' + fraction.replace(/0+$/, '') : '')
  );
};
const tell = (message) => {
  $('feedback').textContent = message;
};
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
  message = 'Rules or amount changed. Simulate again to refresh the comparison.'
) {
  revision++;
  review = null;
  $('export-json').disabled = true;
  $('export-markdown').disabled = true;
  $('simulation-state').textContent = 'Not simulated';
  $('eligible-total').textContent = '—';
  $('allocated-total').textContent = '—';
  $('unallocated-total').textContent = '—';
  $('rule-fingerprint').textContent = 'Simulate to identify this exact rule and data version.';
  const row = node('tr', ''),
    cell = node('td', message);
  cell.colSpan = 7;
  row.append(cell);
  $('allocation-rows').replaceChildren(row);
}
function renderRules() {
  $('factor').value = rules.factorTenths;
  $('factor-value').value = (rules.factorTenths / 10).toFixed(1) + '×';
  const commission = rules.commissionMaxBps === null ? 'none' : String(rules.commissionMaxBps);
  if (![...$('commission').options].some((o) => o.value === commission)) {
    $('commission').append(new Option(`${Number(commission) / 100}%`, commission));
  }
  $('commission').value = commission;
  const cap = data ? capFraction(rules, data.activeCount) : null;
  $('cap-description').textContent = cap
    ? `Cap = min(30%, ${(rules.factorTenths / 10).toFixed(1)} × 100% / ${data.activeCount}) = ${((Number(cap.numerator) * 100) / Number(cap.denominator)).toFixed(2)}%. The full active consensus set is used.`
    : 'Cap = min(30%, factor × 100% / active validator count).';
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
      `Block ${data.height.toLocaleString('en-US')} · ${new Date(data.blockTime).toLocaleString()} · ${data.activeCount} active validators · ${new URL(data.source).hostname}`;
    $('programme-amount').value = units(sumCurrent());
    $('current-total').textContent = fmt(sumCurrent());
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
      `Delegated ${fmt(sumCurrent())} + spendable ${fmt(data.liquidRaw)} JUNO. Rewards and unbonding funds are excluded.`;
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
    $('current-total').textContent = '—';
    $('current-breakdown').textContent =
      'Current active / inactive delegation breakdown is unavailable.';
    $('upgrade-window').textContent =
      'Archive coverage could not be loaded with the programme snapshot.';
    $('active-total').textContent = 'Active set pending';
    $('available-funds').textContent = 'No usable programme snapshot.';
    renderRules();
    tell(error.message);
  } finally {
    loading = false;
    $('refresh').disabled = false;
  }
}
function renderResult(result) {
  const currentBonded = data.validators
    .filter((v) => v.active)
    .reduce((sum, v) => sum + BigInt(v.tokensRaw), 0n);
  $('eligible-total').textContent = result.eligibleCount;
  $('allocated-total').textContent = fmt(result.allocatedRaw);
  $('unallocated-total').textContent = fmt(result.unallocatedRaw);
  $('simulation-state').textContent = 'Draft simulation';
  const notes = [
    `${result.evidenceReviewCount} active validators need evidence review.`,
    `${data.redelegations.length} existing redelegation records need execution review.`,
    'Projected shares use a fixed validator set and are estimates.'
  ];
  if (BigInt(result.releasedRaw))
    notes.push(
      `${fmt(result.releasedRaw)} JUNO would leave the current programme allocation; no unstaking transaction is prepared.`
    );
  if (freshness() > 3600000) notes.push('Historical snapshot: refresh before approval.');
  $('simulation-note').textContent = notes.join(' ');
  const rows = [...result.rows]
    .filter(
      (v) =>
        v.active ||
        BigInt(v.currentRaw) > 0n ||
        rules.exclusions.some((e) => e.validator === v.address)
    )
    .sort(
      (a, b) =>
        Number(b.eligible) - Number(a.eligible) ||
        a.name.localeCompare(b.name) ||
        a.address.localeCompare(b.address)
    );
  $('allocation-rows').replaceChildren(
    ...rows.map((v) => {
      const row = node('tr', ''),
        name = node('td', ''),
        status = node('td', '');
      name.append(
        node('strong', v.name || 'Unnamed validator'),
        node('small', v.address),
        node('small', `${(v.commissionBps / 100).toFixed(2)}% commission`)
      );
      status.append(
        node(
          'span',
          v.eligible
            ? v.capReached
              ? v.capacityRaw === '0'
                ? 'Eligible · no capacity under cap'
                : 'Eligible · cap reached'
              : 'Eligible'
            : v.reasons.join(' · '),
          v.eligible ? 'eligible-label' : 'review-label'
        )
      );
      if (v.upgrade.timestamp)
        status.append(
          node(
            'small',
            `First recorded ${v.upgrade.evidence}: ${new Date(v.upgrade.timestamp).toISOString()}`
          )
        );
      const denominator = BigInt(result.projectedBondedRaw),
        share =
          v.active && denominator > 0n
            ? Number((BigInt(v.projectedRaw) * 10000n) / denominator) / 100
            : null;
      row.append(
        name,
        status,
        node('td', fmt(v.currentRaw)),
        node('td', fmt(v.targetRaw)),
        node('td', (BigInt(v.deltaRaw) > 0n ? '+' : '') + fmt(v.deltaRaw)),
        node(
          'td',
          v.active && currentBonded > 0n
            ? (Number((BigInt(v.tokensRaw) * 10000n) / currentBonded) / 100).toFixed(2) + '%'
            : 'Outside active set'
        ),
        node('td', share === null ? 'Outside projected active set' : share.toFixed(2) + '%')
      );
      return row;
    })
  );
}
async function runSimulation() {
  try {
    if (!data || !evidence) throw Error('Load programme data first.');
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
    tell(
      'Simulation complete. Review eligibility, remaining funds and the changes before downloading the rule draft.'
    );
  } catch (error) {
    tell(error.message);
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
  rules.factorTenths = Number($('factor').value);
  invalidate();
  renderRules();
});
$('commission').addEventListener('change', () => {
  rules.commissionMaxBps = $('commission').value === 'none' ? null : Number($('commission').value);
  invalidate();
});
$('programme-amount').addEventListener('input', () => invalidate());
$('add-exclusion').addEventListener('click', () => {
  try {
    rules = policy({
      ...rules,
      exclusions: [
        ...rules.exclusions,
        {
          chainId: 'juno-1',
          validator: $('excluded-validator').value.trim(),
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
    tell(error.message);
  }
});
$('save-draft').addEventListener('click', () => {
  try {
    localStorage.setItem(key, JSON.stringify(policy(rules)));
    $('draft-status').textContent = 'Saved locally · unapproved';
    tell('Draft saved on this device. It has not been submitted or approved.');
  } catch {
    tell('Draft could not be saved on this device.');
  }
});
$('reset-draft').addEventListener('click', () => {
  rules = defaultPolicy();
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
