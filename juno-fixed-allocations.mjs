// Governance-owned fixed targets. Dates are UTC calendar days, both inclusive.
const day = (s) =>
  typeof s === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s + 'T00:00:00Z')) &&
  new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
export function fixedAllocations(input, operator) {
  if (!Array.isArray(input) || input.length > 100)
    throw Error('Use at most 100 fixed allocations.');
  const seen = new Set();
  return input
    .map((a) => {
      if (
        !a ||
        Object.keys(a).sort().join(',') !==
          'amountRaw,chainId,documentation,endDate,purpose,startDate,validator' ||
        a.chainId !== 'juno-1' ||
        !operator.test(a.validator) ||
        seen.has(a.validator) ||
        typeof a.amountRaw !== 'string' ||
        !/^[1-9]\d{0,29}$/.test(a.amountRaw) ||
        typeof a.purpose !== 'string' ||
        !a.purpose.trim() ||
        a.purpose.length > 1200 ||
        !day(a.startDate) ||
        !day(a.endDate) ||
        a.endDate < a.startDate ||
        typeof a.documentation !== 'string' ||
        a.documentation.length > 1000
      )
        throw Error(
          'Each fixed allocation needs a unique validator, positive JUNO amount, obligations and valid start/end dates.'
        );
      const documentation = a.documentation.trim();
      if (documentation) {
        let url;
        try {
          url = new URL(documentation);
        } catch {
          throw Error('Documentation must be an HTTPS link.');
        }
        if (url.protocol !== 'https:' || url.username || url.password)
          throw Error('Documentation must be an HTTPS link without credentials.');
      }
      seen.add(a.validator);
      return { ...a, purpose: a.purpose.trim(), documentation };
    })
    .sort((a, b) => (a.validator < b.validator ? -1 : 1));
}
export function fixedStatus(a, time) {
  if (!Number.isFinite(Date.parse(time)))
    throw Error('Fixed allocations require an observation date.');
  const date = new Date(time).toISOString().slice(0, 10);
  return date < a.startDate ? 'Scheduled' : date > a.endDate ? 'Ended' : 'Active';
}
export function activeFixed(policy, time) {
  return (policy.fixedAllocations || []).filter((a) => fixedStatus(a, time) === 'Active');
}
export function fixedByValidator(policy, time) {
  return new Map(activeFixed(policy, time).map((a) => [a.validator, BigInt(a.amountRaw)]));
}
export function sameFixedWindow(policy, before, after) {
  return (policy.fixedAllocations || []).every(
    (a) => (fixedStatus(a, before) === 'Active') === (fixedStatus(a, after) === 'Active')
  );
}
