import { activeSetEvidence } from './juno-active-set-history.mjs';
import { participationEvidence } from './juno-participation-history.mjs';
import { governanceEvidence, validatorPoints, scorePoints } from './juno-governance-points.mjs';
import { criteriaEvidenceNeeds } from './juno-criteria-policy.mjs';

const zero = () => ({ numerator: '0', denominator: '1' });
const ratio = (numerator, denominator = 1n) => {
  let a = numerator,
    b = denominator;
  while (b) [a, b] = [b, a % b];
  return { numerator: String(numerator / a), denominator: String(denominator / a) };
};
const requireComplete = (value) => {
  if (value && !value.complete) throw Error(value.reason);
  return value;
};
const coverage = (value) =>
  value
    ? {
        complete: value.complete,
        source: value.source,
        from: value.from,
        through: value.through,
        collecting: value.collecting,
        observedDays: value.observedDays
      }
    : null;
export function prepareCriteriaEvidence(policy, snapshot, upgrade, history, required = true) {
  const needs = criteriaEvidenceNeeds(policy);
  if (!required) return { continuity: null, participation: null, governance: null, upgrade: null };
  if (needs.upgrade && (!(upgrade?.records instanceof Map) || !upgrade.window?.coverageComplete))
    throw Error('The upgrade observation window is incomplete.');
  if (needs.upgrade)
    for (const [address, record] of upgrade.records) {
      if (
        !/^[A-F0-9]{40}$/.test(address) ||
        !record ||
        !['observed', 'late-observation', 'unknown'].includes(record.status) ||
        (record.status !== 'unknown' && !Number.isFinite(Date.parse(record.timestamp)))
      )
        throw Error('Invalid upgrade participation evidence.');
    }
  return {
    continuity: needs.activeHistory
      ? requireComplete(activeSetEvidence(history, snapshot, { allowCollecting: true }))
      : null,
    participation: needs.uptime ? requireComplete(participationEvidence(history, snapshot)) : null,
    governance: needs.governance ? governanceEvidence(snapshot) : null,
    upgrade: needs.upgrade ? upgrade : null
  };
}
export function criteriaEvidenceSummary(evidence) {
  const g = evidence.governance;
  return {
    activeHistory: coverage(evidence.continuity),
    uptime: coverage(evidence.participation),
    governance: g
      ? { coverage: g.coverage, count: g.count, collecting: g.collecting, excluded: g.excluded }
      : null,
    upgrade: evidence.upgrade ? { coverageComplete: true } : null
  };
}
// Interpolate the integer observation itself, without rounding its percentage
// before the threshold comparison. Lower commission earns more; all other
// percentage criteria increase from zero to full contribution.
export function criterionContribution(config, observation) {
  if (!observation || BigInt(observation.denominator) === 0n) return zero();
  const n = BigInt(observation.numerator),
    d = BigInt(observation.denominator);
  if (d < 0n || n < 0n || n > d) throw Error('Invalid criterion observation.');
  if (!Object.hasOwn(config, 'zeroBps')) return ratio(n, d);
  const start = BigInt(config.zeroBps) * d,
    end = BigInt(config.fullBps) * d;
  const offset = end > start ? n * 10000n - start : start - n * 10000n;
  const span = end > start ? end - start : start - end;
  return offset <= 0n ? zero() : offset >= span ? ratio(1n) : ratio(offset, span);
}
const observation = (n, d, status = 'observed') => ({
  status,
  numerator: String(n),
  denominator: String(d)
});
const absent = (status = 'collecting') => ({ status, numerator: null, denominator: null });
function gate(config, value, id) {
  if (value.numerator === null || BigInt(value.denominator) === 0n) return false;
  const n = BigInt(value.numerator),
    d = BigInt(value.denominator);
  if (id === 'commission') return n * 10000n <= d * BigInt(config.maximumBps);
  if (['uptime', 'governance'].includes(id)) return n * 10000n >= d * BigInt(config.minimumBps);
  return n === d;
}
function failedGate(id, config, value, validator, evidence) {
  if (id === 'uptime')
    return value.numerator === null
      ? 'No observed commit slots'
      : `Observed commit signatures below ${config.minimumBps / 100}%`;
  if (id === 'commission') return 'Commission above limit';
  if (id === 'governance')
    return value.status === 'collecting'
      ? 'No observed governance opportunities'
      : `Governance participation below ${config.minimumBps / 100}%`;
  if (id === 'upgrade') return 'No observed upgrade participation within 5h';
  return !validator.active
    ? 'Outside the active set'
    : evidence.continuity?.collecting
      ? 'Not continuously in the active set during the observed period'
      : 'Not continuously in the active set for 90 days';
}
export function criterionValidator(
  policy,
  validator,
  evidence,
  initialReasons = [],
  required = true
) {
  const reasons = [...initialReasons],
    details = {},
    contributions = {},
    weights = {};
  const counts = evidence.participation?.records.get(validator.consensusAddress) ?? null;
  const upgrade = evidence.upgrade?.records.get(validator.consensusAddress) ?? {
    status: 'unknown',
    timestamp: null,
    evidence: null
  };
  const values = {
    uptime: counts?.expected ? observation(counts.signed, counts.expected) : absent(),
    commission: observation(validator.commissionBps, 10000),
    activeHistory: evidence.continuity
      ? observation(evidence.continuity.members.has(validator.consensusAddress) ? 1 : 0, 1)
      : absent('unverified'),
    upgrade: evidence.upgrade
      ? observation(
          upgrade.status === 'observed' ? 1 : 0,
          1,
          upgrade.status === 'observed' ? 'observed' : 'not-observed'
        )
      : absent('unverified')
  };
  const record = (id, value) => {
    const config = policy.criteria[id];
    if (config.role === 'unused') return;
    const passed = config.role === 'eligibility' ? gate(config, value, id) : null;
    details[id] = { role: config.role, ...value, passed };
    if (passed === false && required)
      reasons.push(failedGate(id, config, value, validator, evidence));
    if (config.role === 'bonus') {
      weights[id] = config.weight;
      contributions[id] = value.numerator === null ? zero() : criterionContribution(config, value);
    }
  };
  for (const [id, value] of Object.entries(values)) record(id, value);
  let governance = { status: 'disabled' };
  if (policy.criteria.governance.role !== 'unused') {
    governance = validatorPoints(
      { base: 900, weights: { governance: 100 } },
      validator.address,
      evidence.governance,
      required && !reasons.length
    ).governance;
    record(
      'governance',
      governance.status === 'unverified'
        ? absent('unverified')
        : governance.applicable
          ? observation(governance.voted, governance.applicable)
          : absent()
    );
  }
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  for (const [id, weight] of Object.entries(weights)) {
    const q = contributions[id];
    details[id] = {
      ...details[id],
      weight,
      contribution: q,
      earned: totalWeight
        ? ratio(
            BigInt(1000 - policy.points.base) * BigInt(weight) * BigInt(q.numerator),
            BigInt(totalWeight) * BigInt(q.denominator)
          )
        : zero()
    };
  }
  const points = scorePoints(policy.points.base, weights, contributions);
  if (governance.status === 'unverified') {
    points.bonus = null;
    points.total = null;
  }
  return {
    reasons,
    participation: counts,
    upgrade,
    points: { ...points, governance, criteria: details }
  };
}
