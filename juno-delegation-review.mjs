import {
  policy,
  snapshot,
  simulate,
  canonical,
  fingerprint,
  eligibilityDescription,
  units,
  LIQUID_RESERVE
} from './juno-delegation-core.mjs';
import { activeSetEvidence } from './juno-active-set-history.mjs';
import { participationEvidence } from './juno-participation-history.mjs';
import { packReview, unpackReview } from './juno-review-transport.mjs';
export const REVIEW_ENGINE = 'equal-capped-review-1';
export const REVIEW_MARKER = '## Frozen allocation review';
const hashPattern = /^[a-f0-9]{64}$/;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const total = (values) => values.reduce((a, b) => a + BigInt(b), 0n);
const exactPolicy = (input) => {
  const p = policy(input);
  if (canonical(p) !== canonical(input)) throw Error('Unsupported policy fields in review.');
  return p;
};
export function ruleChanges(before, after) {
  const p = exactPolicy(after),
    old = before ? exactPolicy(before) : null;
  const fields = [
    ['eligibility', 'Validator eligibility', eligibilityDescription],
    [
      'factorTenths',
      'Voting power cap',
      (v) => `min(30%, ${v.factorTenths / 10} × 100% / consensus set size)`
    ],
    [
      'commissionMaxBps',
      'Maximum commission',
      (v) => (v.commissionMaxBps === null ? 'No limit' : `${v.commissionMaxBps / 100}%`)
    ],
    ['method', 'Allocation method', () => 'Equal allocation within the cap'],
    ['liquidReserveRaw', 'Liquid reserve', () => '50 JUNO'],
    ['upgrade', 'Upgrade participation', () => 'Juno v31 · within 5 hours of the halt']
  ];
  if (p.schema >= 6 || old?.schema >= 6)
    fields.push([
      'minParticipationBps',
      'Minimum uptime · observed commit signatures',
      (v) => (v.schema >= 5 ? `${v.minParticipationBps / 100}%` : 'No signature minimum')
    ]);
  const rows = fields.map(([key, label, format]) => ({
    key,
    label,
    before: old ? format(old) : 'Not established',
    after: format(p),
    changed: !old || canonical(old[key]) !== canonical(p[key]),
    numerical: true
  }));
  const previous = new Map((old?.exclusions || []).map((e) => [e.validator, e.reason])),
    next = new Map(p.exclusions.map((e) => [e.validator, e.reason]));
  for (const address of [...new Set([...previous.keys(), ...next.keys()])].sort()) {
    const a = previous.get(address),
      b = next.get(address);
    rows.push({
      key: 'exclusion:' + address,
      label: 'Manual exclusion',
      address,
      before: old ? (a === undefined ? 'Not excluded' : `Excluded: ${a}`) : 'Not established',
      after: b === undefined ? 'Not excluded' : `Excluded: ${b}`,
      changed: a !== b,
      numerical: a === undefined || b === undefined
    });
  }
  const previousFixed = new Map((old?.fixedAllocations || []).map((a) => [a.validator, a]));
  const nextFixed = new Map((p.fixedAllocations || []).map((a) => [a.validator, a]));
  const describe = (a) =>
    a
      ? `${units(a.amountRaw)} JUNO · ${a.startDate} to ${a.endDate} (UTC, inclusive) · ${a.purpose}${a.documentation ? ' · ' + a.documentation : ''}`
      : 'No fixed allocation';
  for (const address of [...new Set([...previousFixed.keys(), ...nextFixed.keys()])].sort()) {
    const a = previousFixed.get(address),
      b = nextFixed.get(address);
    rows.push({
      key: 'fixed:' + address,
      label: 'Fixed allocation · exempt from regular criteria and cap',
      address,
      before: old ? describe(a) : 'Not established',
      after: describe(b),
      changed: canonical(a) !== canonical(b),
      numerical: true
    });
  }
  return rows;
}
function readEvidence(value, s) {
  if (
    !value ||
    !value.window ||
    typeof value.window.coverageComplete !== 'boolean' ||
    !Array.isArray(value.records) ||
    value.records.length > 1000
  )
    throw Error('Invalid frozen upgrade observations.');
  const records = new Map();
  for (const [address, observation] of value.records) {
    if (
      !/^[A-F0-9]{40}$/.test(address) ||
      records.has(address) ||
      !['observed', 'late-observation', 'unknown'].includes(observation?.status) ||
      (observation.timestamp != null && !Number.isFinite(Date.parse(observation.timestamp)))
    )
      throw Error('Invalid or duplicate upgrade observation.');
    records.set(address, structuredClone(observation));
  }
  return { window: structuredClone(value.window), records };
}
function calculate(p, s, budget, evidence, history, previous = false) {
  if (previous) {
    try {
      return calculate(p, s, budget, evidence, history);
    } catch (error) {
      return { status: 'unavailable', reason: error.message, result: null };
    }
  }
  if (!evidence.window.coverageComplete)
    return {
      status: 'unavailable',
      reason: 'The upgrade observation window is incomplete.',
      result: null
    };
  let coverage = null;
  if (p.schema >= 3) {
    coverage =
      p.schema >= 5
        ? participationEvidence(history, s)
        : activeSetEvidence(history, s, { allowCollecting: p.schema >= 4 });
    if (!coverage.complete) return { status: 'unavailable', reason: coverage.reason, result: null };
  }
  return {
    status: 'calculated',
    reason: null,
    coverage,
    result: simulate(p, s, budget, evidence, history)
  };
}
const output = (calculation) =>
  calculation.result
    ? {
        status: calculation.status,
        reason: null,
        targets: calculation.result.rows.map((v) => v.targetRaw),
        allocatedRaw: calculation.result.allocatedRaw,
        unallocatedRaw: calculation.result.unallocatedRaw,
        projectedBondedRaw: calculation.result.projectedBondedRaw
      }
    : { status: calculation.status, reason: calculation.reason, targets: null };

// Keep all holdings, active validators, possible recipients and the top N
// non-programme stakes. Omitted validators cannot enter any projected top-N set:
// N retained bases already precede them and targets can only increase those bases.
function calculationSnapshot(s, policies, evidence) {
  const baseOrder = s.validators
    .filter((v) => !v.jailed)
    .sort(
      (a, b) =>
        cmp(
          BigInt(b.tokensRaw) - BigInt(b.currentRaw),
          BigInt(a.tokensRaw) - BigInt(a.currentRaw)
        ) ||
        Number(b.active) - Number(a.active) ||
        cmp(a.address, b.address)
    );
  const keep = new Set(baseOrder.slice(0, s.activeCount).map((v) => v.address));
  for (const v of s.validators) {
    if (
      v.active ||
      BigInt(v.currentRaw) > 0n ||
      policies.some(
        (p) =>
          (p.fixedAllocations || []).some((a) => a.validator === v.address) ||
          p.exclusions.some((e) => e.validator === v.address) ||
          (p.schema === 2 &&
            !v.jailed &&
            evidence.records.get(v.consensusAddress)?.status === 'observed' &&
            (p.commissionMaxBps === null || v.commissionBps <= p.commissionMaxBps))
      )
    )
      keep.add(v.address);
  }
  return {
    schema: 1,
    chainId: s.chainId,
    programme: s.programme,
    height: s.height,
    blockTime: s.blockTime,
    collectedAt: s.collectedAt,
    source: s.source,
    activeCount: s.activeCount,
    liquidRaw: s.liquidRaw,
    redelegations: [],
    validators: s.validators
      .filter((v) => keep.has(v.address))
      .map((v) => ({
        address: v.address,
        consensusAddress: v.consensusAddress,
        name: v.name,
        tokensRaw: v.tokensRaw,
        currentRaw: v.currentRaw,
        active: v.active,
        jailed: v.jailed,
        commissionBps: v.commissionBps
      }))
      .sort((a, b) => cmp(a.address, b.address))
  };
}
export async function buildRuleReview({
  rule,
  parent = null,
  snapshot: input,
  evidence,
  activeHistory = null,
  budgetRaw,
  rationale = '',
  createdAt = new Date().toISOString()
}) {
  const p = exactPolicy(rule),
    s = snapshot(input),
    budget = BigInt(budgetRaw);
  const available = total(s.validators.map((v) => v.currentRaw)) + BigInt(s.liquidRaw);
  if (budget <= 0n || budget > available - LIQUID_RESERVE)
    throw Error('The positive allocation budget must keep at least 50 JUNO in reserve.');
  if (typeof rationale !== 'string' || rationale.trim().length > 1000)
    throw Error('Keep the change rationale within 1,000 characters.');
  if (!Number.isFinite(Date.parse(createdAt))) throw Error('Invalid review date.');
  if (
    parent &&
    (!/^[1-9]\d{0,19}$/.test(parent.proposalId) ||
      !Number.isFinite(Date.parse(parent.votingEndedAt)) ||
      parent.hash !== (await fingerprint(exactPolicy(parent.rule))))
  )
    throw Error('Invalid parent policy reference.');
  const projected = calculationSnapshot(s, [p, ...(parent ? [parent.rule] : [])], evidence),
    identities = new Set(projected.validators.map((v) => v.consensusAddress)),
    frozenEvidence = {
      window: structuredClone(evidence.window),
      records: [...evidence.records]
        .filter(([id]) => identities.has(id))
        .sort(([a], [b]) => cmp(a, b))
    },
    frozen = readEvidence(frozenEvidence, projected),
    proposed = calculate(p, projected, budget, frozen, activeHistory),
    previous = parent
      ? calculate(parent.rule, projected, budget, frozen, activeHistory, true)
      : null;
  // Guard the reduction with an independent calculation over the full snapshot.
  for (const [pol, reduced] of [[p, proposed], ...(parent ? [[parent.rule, previous]] : [])]) {
    const full = calculate(pol, s, budget, evidence, activeHistory, reduced === previous);
    if (full.result) {
      const byAddress = new Map(full.result.rows.map((v) => [v.address, v.targetRaw]));
      if (
        full.result.allocatedRaw !== reduced.result.allocatedRaw ||
        full.result.projectedBondedRaw !== reduced.result.projectedBondedRaw ||
        reduced.result.rows.some((v) => byAddress.get(v.address) !== v.targetRaw)
      )
        throw Error('The frozen comparison does not reproduce the complete snapshot.');
    }
  }
  const value = {
    schema: 1,
    engine: REVIEW_ENGINE,
    kind: 'RULE_APPROVAL',
    createdAt,
    parent: parent
      ? {
          proposalId: parent.proposalId,
          votingEndedAt: parent.votingEndedAt,
          hash: parent.hash,
          rule: exactPolicy(parent.rule)
        }
      : null,
    rule: p,
    policyHash: await fingerprint(p),
    rationale: rationale.trim(),
    budgetRaw: budget.toString(),
    snapshot: projected,
    sourceSnapshotHash: await fingerprint(s),
    sourceValidatorCount: s.validators.length,
    existingRedelegationCount: s.redelegations.length,
    evidence: frozenEvidence,
    activeHistory: structuredClone(activeHistory),
    previous: previous ? output(previous) : null,
    proposed: output(proposed),
    messages: []
  };
  return {
    value,
    model: reviewModel(value, { previous, proposed }),
    hash: await fingerprint(value)
  };
}
export async function verifyRuleReview(value) {
  if (
    value?.schema !== 1 ||
    value.engine !== REVIEW_ENGINE ||
    value.kind !== 'RULE_APPROVAL' ||
    !Array.isArray(value.messages) ||
    value.messages.length ||
    !hashPattern.test(value.sourceSnapshotHash) ||
    !Number.isInteger(value.sourceValidatorCount) ||
    value.sourceValidatorCount < value.snapshot?.validators?.length ||
    value.sourceValidatorCount > 1000 ||
    !Number.isInteger(value.existingRedelegationCount) ||
    value.existingRedelegationCount < 0
  )
    throw Error('Unsupported frozen review format.');
  const rebuilt = await buildRuleReview({
    ...value,
    evidence: readEvidence(value.evidence, value.snapshot)
  });
  // Provenance describes the complete source, not just its sufficient subset.
  rebuilt.value.sourceSnapshotHash = value.sourceSnapshotHash;
  rebuilt.value.sourceValidatorCount = value.sourceValidatorCount;
  rebuilt.value.existingRedelegationCount = value.existingRedelegationCount;
  if (canonical(rebuilt.value) !== canonical(value))
    throw Error('Frozen review does not reproduce its rules, observations or target amounts.');
  return { value: structuredClone(value), model: rebuilt.model, hash: await fingerprint(value) };
}
function reviewModel(value, { previous, proposed }) {
  const old = new Map((previous?.result?.rows || []).map((v) => [v.address, v])),
    next = new Map((proposed.result?.rows || []).map((v) => [v.address, v]));
  return {
    value,
    changes: ruleChanges(value.parent?.rule, value.rule),
    previous,
    proposed,
    rows: value.snapshot.validators.map((v) => ({
      ...v,
      old: old.get(v.address) || null,
      next: next.get(v.address) || null
    }))
  };
}
export function comparison(model, mode = 'actual') {
  if (!['actual', 'policy'].includes(mode)) throw Error('Invalid comparison baseline.');
  const baselineAvailable = mode === 'actual' || !!model.previous?.result,
    targetAvailable = !!model.proposed.result,
    rows = model.rows.map((v) => {
      const before = mode === 'actual' ? v.currentRaw : (v.old?.targetRaw ?? null),
        after = v.next?.targetRaw ?? null;
      return {
        ...v,
        before,
        after,
        delta:
          before !== null && after !== null ? (BigInt(after) - BigInt(before)).toString() : null
      };
    });
  const increases = total(
      rows.filter((v) => v.delta !== null && BigInt(v.delta) > 0n).map((v) => v.delta)
    ),
    decreases = -total(
      rows.filter((v) => v.delta !== null && BigInt(v.delta) < 0n).map((v) => v.delta)
    );
  return {
    rows,
    available: baselineAvailable && targetAvailable,
    mode,
    increases: baselineAvailable && targetAvailable ? increases.toString() : null,
    decreases: baselineAvailable && targetAvailable ? decreases.toString() : null,
    net: baselineAvailable && targetAvailable ? (increases - decreases).toString() : null,
    beforeCount: baselineAvailable ? rows.filter((v) => BigInt(v.before) > 0n).length : null,
    afterCount: targetAvailable ? rows.filter((v) => BigInt(v.after) > 0n).length : null,
    outsideRaw: total(rows.filter((v) => !v.active).map((v) => v.currentRaw)).toString()
  };
}
export function parentMatches(parent, current) {
  return parent === null
    ? current === null
    : !!current && parent.proposalId === current.proposalId && parent.hash === current.hash;
}

// The existing review contract binds its complete text. Embed the sufficient
// input data AND outputs there; no mutable URL or local-storage attachment.
export async function encodeRuleReview(review) {
  const bytes = new TextEncoder().encode(canonical(review.value));
  if (bytes.length > 750000) throw Error('Review data exceeds the supported size.');
  const compress = async (data) =>
    new Uint8Array(
      await new Response(
        new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))
      ).arrayBuffer()
    );
  let compressed = await compress(bytes),
    format = 1;
  const packed = packReview(review.value);
  // Do not omit unknown or optional fields to make a proposal fit.
  if (canonical(unpackReview(packed)) === canonical(review.value)) {
    const packedBytes = new TextEncoder().encode(canonical(packed));
    if (packedBytes.length <= 750000) {
      const compact = await compress(packedBytes);
      if (compact.length < compressed.length) {
        compressed = compact;
        format = 2;
      }
    }
  }
  const encoded = btoa(Array.from(compressed, (b) => String.fromCharCode(b)).join(''));
  return `${REVIEW_MARKER}\n\nFormat: cosmoot-allocation-review-${format}+gzip\nReview SHA-256: ${review.hash}\n\n\`\`\`cosmoot-review\n${encoded}\n\`\`\``;
}
export async function decodeRuleReview(body) {
  if (typeof body !== 'string' || !body.includes(REVIEW_MARKER)) return null;
  if (body.length > 30000) throw Error('Proposal review exceeds the supported size.');
  const parts = [
    ...body.matchAll(
      /^## Frozen allocation review\n\nFormat: cosmoot-allocation-review-([12])\+gzip\nReview SHA-256: ([a-f0-9]{64})\n\n```cosmoot-review\n([A-Za-z0-9+/=]+)\n```/gm
    )
  ];
  if (parts.length !== 1 || body.split(REVIEW_MARKER).length !== 2)
    throw Error('Frozen comparison is missing, duplicated or malformed.');
  const bytes = Uint8Array.from(atob(parts[0][3]), (c) => c.charCodeAt(0));
  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
    .getReader();
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 750000) throw Error('Expanded review exceeds the supported size.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const text = await new Blob(chunks).text(),
    packet = JSON.parse(text),
    value = parts[0][1] === '2' ? unpackReview(packet) : packet;
  if (new TextEncoder().encode(canonical(value)).length > 750000)
    throw Error('Expanded review exceeds the supported size.');
  if ((await fingerprint(value)) !== parts[0][2])
    throw Error('Frozen comparison fingerprint mismatch.');
  const review = await verifyRuleReview(value);
  const policies = [...body.matchAll(/^## Exact policy\n\n```json\n([\s\S]*?)\n```/gm)],
    hashes = [...body.matchAll(/^Rule SHA-256: ([a-f0-9]{64})$/gm)];
  if (
    policies.length !== 1 ||
    hashes.length !== 1 ||
    hashes[0][1] !== value.policyHash ||
    canonical(JSON.parse(policies[0][1])) !== canonical(value.rule)
  )
    throw Error('Proposal policy differs from the frozen comparison.');
  return review;
}
export async function readProposalReview(values) {
  const { readExecutionReview } = await import('./juno-rebalance-execution.mjs');
  if (await readExecutionReview(values)) return null;
  const review = await decodeRuleReview(values.body);
  if (review) {
    if (
      !values.title?.startsWith('Juno Delegation Programme — allocation rules') ||
      !Array.isArray(JSON.parse(values.actions_json)) ||
      JSON.parse(values.actions_json).length
    )
      throw Error(
        'A rule review must contain no execution messages and retain its rule-proposal identity.'
      );
  } else {
    const section = values.body?.match(/^## Exact policy\n\n```json\n([\s\S]*?)\n```/m);
    if (section && [3, 4, 5, 6, 7, 8].includes(JSON.parse(section[1])?.schema))
      throw Error(
        'This policy version requires its complete frozen comparison. Return to the planner to prepare it.'
      );
  }
  return review;
}
