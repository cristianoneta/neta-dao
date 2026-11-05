// Schema 11 assigns each measured criterion one role. Historical policies are
// deliberately normalized by the legacy engine, never through these defaults.
const definition = (id, label, roles, kind, direction = null) =>
  Object.freeze({
    id,
    label,
    roles: Object.freeze(roles),
    kind,
    direction,
    available: roles.length > 1
  });
export const CRITERIA = Object.freeze([
  definition(
    'uptime',
    'Observed commit participation',
    ['eligibility', 'bonus', 'unused'],
    'percentage',
    'increasing'
  ),
  definition(
    'commission',
    'Commission',
    ['eligibility', 'bonus', 'unused'],
    'percentage',
    'decreasing'
  ),
  definition(
    'governance',
    'Governance participation',
    ['eligibility', 'bonus', 'unused'],
    'percentage',
    'increasing'
  ),
  definition('upgrade', 'Upgrade participation', ['eligibility', 'bonus', 'unused'], 'binary'),
  definition('activeHistory', 'Active-set history', ['eligibility', 'unused'], 'history'),
  definition('rpc', 'Public RPC / API', ['unused'], 'unavailable'),
  definition('testnet', 'Testnet participation', ['unused'], 'unavailable'),
  definition('archive', 'Archive services', ['unused'], 'unavailable')
]);
const keys = (value, expected) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join() === [...expected].sort().join();
const bps = (value) => Number.isInteger(value) && value >= 0 && value <= 10000;
const failure = (id) => {
  throw Error(`Invalid ${id} criterion: choose one available role and its exact settings.`);
};
export function criterionConfig(id, role) {
  const meta = CRITERIA.find((entry) => entry.id === id);
  if (!meta?.roles.includes(role)) return failure(id);
  if (role === 'unused') return { role };
  if (role === 'eligibility') {
    if (id === 'activeHistory') return { role, windowDays: 90 };
    if (id === 'upgrade') return { role };
    return id === 'commission'
      ? { role, maximumBps: 1000 }
      : { role, minimumBps: id === 'uptime' ? 9750 : 5000 };
  }
  if (id === 'upgrade') return { role, weight: 100 };
  return {
    role,
    weight: 100,
    zeroBps: id === 'uptime' ? 9500 : id === 'commission' ? 1000 : 0,
    fullBps: id === 'uptime' ? 9950 : id === 'commission' ? 500 : 10000
  };
}
export function criteriaConfig(input) {
  if (
    !keys(
      input,
      CRITERIA.map((entry) => entry.id)
    )
  )
    return failure('policy');
  return Object.fromEntries(
    CRITERIA.map(({ id, direction }) => {
      const value = input[id],
        template = criterionConfig(id, value?.role);
      if (!keys(value, Object.keys(template))) return failure(id);
      if (value.role === 'eligibility') {
        if (id === 'activeHistory' && value.windowDays !== 90) return failure(id);
        if (id === 'commission' && !bps(value.maximumBps)) return failure(id);
        if (['uptime', 'governance'].includes(id) && !bps(value.minimumBps)) return failure(id);
      } else if (value.role === 'bonus') {
        if (!Number.isInteger(value.weight) || value.weight < 0 || value.weight > 100)
          return failure(id);
        if (
          id !== 'upgrade' &&
          (!bps(value.zeroBps) ||
            !bps(value.fullBps) ||
            (direction === 'decreasing'
              ? value.fullBps >= value.zeroBps
              : value.fullBps <= value.zeroBps))
        )
          return failure(id);
      }
      return [id, structuredClone(value)];
    })
  );
}
export function createComposerPolicy(legacy) {
  const { minParticipationBps, commissionMaxBps, points, ...common } = legacy;
  return {
    ...common,
    schema: 11,
    method: 'criteria-points-capped-v1',
    eligibility: 'exclusive-criteria-v1',
    points: { base: points.base },
    criteria: Object.fromEntries(
      CRITERIA.map(({ id, available }) => [
        id,
        criterionConfig(id, !available ? 'unused' : id === 'governance' ? 'bonus' : 'eligibility')
      ])
    )
  };
}
// `common` has already passed the legacy identity, cap, mandate and exclusion
// validators. Reject stale legacy fields rather than silently ignoring a gate.
export function criteriaPolicy(input, common) {
  const template = createComposerPolicy(common);
  if (
    !keys(input, Object.keys(template)) ||
    input.method !== template.method ||
    input.eligibility !== template.eligibility ||
    !keys(input.points, ['base']) ||
    !Number.isInteger(input.points.base) ||
    input.points.base < 0 ||
    input.points.base > 1000 ||
    !keys(input.upgrade, Object.keys(template.upgrade))
  )
    throw Error('Invalid exclusive-criteria rule draft.');
  return {
    ...template,
    points: { base: input.points.base },
    criteria: criteriaConfig(input.criteria)
  };
}
export function criteriaEvidenceNeeds(policy) {
  return Object.fromEntries(
    ['activeHistory', 'uptime', 'governance', 'upgrade'].map((id) => [
      id,
      policy.criteria[id].role !== 'unused'
    ])
  );
}
export function criteriaRequiresActive(policy) {
  return policy.criteria.activeHistory.role === 'eligibility';
}
