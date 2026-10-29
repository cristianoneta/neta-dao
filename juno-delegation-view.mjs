// Presentation helpers only. Allocation amounts stay in integer micro-JUNO.
export function formatAmount(raw, exact = false) {
  let value = BigInt(raw);
  const negative = value < 0n;
  if (negative) value = -value;
  const rounded = exact ? value : (value + 5000n) / 10000n;
  if (!exact && value > 0n && rounded === 0n) return negative ? '−<0.01' : '<0.01';
  const scale = exact ? 1000000n : 100n;
  const decimals = (rounded % scale).toString().padStart(exact ? 6 : 2, '0');
  return (
    (negative && rounded > 0n ? '−' : '') +
    (rounded / scale).toLocaleString('en-US') +
    '.' +
    decimals
  );
}
export function formatChange(raw, exact = false) {
  const value = BigInt(raw);
  if (!exact && value !== 0n && (value < 0n ? -value : value) < 5000n)
    return value > 0n ? '+<0.01' : '−<0.01';
  return (value > 0n ? '+' : '') + formatAmount(value, exact);
}
export function stakeShare(raw, total) {
  const n = BigInt(total);
  if (n <= 0n) return 'Unavailable';
  const basisPoints = (BigInt(raw) * 10000n + n / 2n) / n;
  return `${basisPoints / 100n}.${(basisPoints % 100n).toString().padStart(2, '0')}%`;
}
export function rowStatus(v) {
  if (BigInt(v.fixedRaw || '0') > 0n) {
    if (v.capException) return 'Fixed allocation · above regular cap';
    return v.regularRaw === '0'
      ? 'Fixed only · no regular allocation'
      : 'Regular + fixed allocation';
  }
  if (v.reasons.some((r) => r.startsWith('Manual exclusion:'))) return 'Manually excluded';
  if (v.jailed) return 'Jailed';
  if (v.reasons.includes('Commission above limit')) return 'Commission above limit';
  if (v.reasons.includes('Outside the active set')) return 'Outside the active set';
  if (v.reasons.includes('Not continuously in the active set for 90 days'))
    return '90-day membership not met';
  if (v.reasons.includes('Not continuously in the active set during the observed period'))
    return 'Observed-period membership not met';
  if (!v.eligible) return 'Evidence review required';
  if (v.capacityRaw === '0') return 'No capacity under the limit';
  if (v.capReached) return 'Limited by voting power';
  if (v.targetRaw === '0') return 'No allocation after rounding';
  return 'Equal allocation';
}
export function allocationReason(v) {
  if (BigInt(v.fixedRaw || '0') > 0n) {
    const regular = BigInt(v.regularRaw);
    return (
      `${formatAmount(v.fixedRaw, true)} JUNO is the fixed target component in this rulebook, not a repeated top-up. ` +
      `${formatAmount(v.regularRaw, true)} JUNO comes from the remaining regular budget. ` +
      (v.reasons.length ? 'Regular eligibility: ' + v.reasons.join(' · ') + '. ' : '') +
      (v.capException ? 'The fixed allocation exceeds the regular voting-power cap. ' : '') +
      (regular === 0n && v.eligible
        ? 'No regular allocation fits the remaining cap capacity or budget. '
        : '') +
      'The fixed portion is exempt from regular criteria; it still counts toward actual stake.'
    );
  }
  return regularAllocationReason(v);
}
function regularAllocationReason(v) {
  if (!v.eligible) return v.reasons.join(' · ') + '. No target allocation under these draft rules.';
  if (v.capacityRaw === '0')
    return 'Otherwise eligible, but stake excluding this programme is already at or above the projected voting power limit. The programme cannot reduce other delegators’ stake.';
  if (v.capReached)
    return 'The target is limited to the capacity below the projected voting power cap. Remaining funds are redistributed among other eligible validators.';
  if (v.targetRaw === '0')
    return 'The budget is too small to allocate even one micro-JUNO to every eligible validator. Remainders are assigned deterministically by validator address.';
  return 'This validator meets the draft criteria and has capacity for the equal share. Rounding can differ by one micro-JUNO. The target is the total programme delegation after redistribution.';
}
export function selectRows(result, { query = '', filter = 'all', sort = 'change' } = {}) {
  const q = query.trim().toLowerCase();
  const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const abs = (n) => (n < 0n ? -n : n);
  return result.rows
    .filter((v) => {
      if (!`${v.name} ${v.address}`.toLowerCase().includes(q)) return false;
      if (filter === 'fixed') return BigInt(v.fixedRaw || '0') > 0n;
      if (filter === 'receiving') return BigInt(v.targetRaw) > 0n;
      if (filter === 'cap') return v.eligible && v.capReached;
      if (filter === 'review') return !v.jailed && v.upgrade.status !== 'observed';
      if (filter === 'excluded') return !v.eligible;
      if (filter === 'inactive') return v.jailed;
      if (filter === 'standby') return !v.active && !v.jailed;
      return true;
    })
    .sort((a, b) => {
      let order = 0;
      if (sort === 'change') order = compare(abs(BigInt(b.deltaRaw)), abs(BigInt(a.deltaRaw)));
      if (sort === 'target') order = compare(BigInt(b.targetRaw), BigInt(a.targetRaw));
      if (sort === 'total' || sort === 'total-asc')
        order =
          compare(BigInt(b.projectedRaw), BigInt(a.projectedRaw)) * (sort === 'total-asc' ? -1 : 1);
      if (sort === 'projected' || sort === 'projected-asc')
        // All projected members share the same denominator. Compare exact
        // micro-JUNO, keeping validators without a projected share last.
        order =
          Number(b.projectedActive) - Number(a.projectedActive) ||
          (a.projectedActive && b.projectedActive
            ? compare(BigInt(b.projectedRaw), BigInt(a.projectedRaw)) *
              (sort === 'projected-asc' ? -1 : 1)
            : 0);
      if (sort === 'power')
        order =
          Number(b.active) - Number(a.active) ||
          (a.active && b.active ? compare(BigInt(b.tokensRaw), BigInt(a.tokensRaw)) : 0);
      return order || a.name.localeCompare(b.name) || a.address.localeCompare(b.address);
    });
}
