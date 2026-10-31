import { ruleChanges } from './juno-delegation-review.mjs';

export function ruleProposalSummary(review) {
  if (!review.value.parent)
    return "Establish the initial rules for Juno's Delegation Programme: validator eligibility, scoring and allocation of programme funds. This vote approves rules only; existing delegations remain unchanged. Fund movements require a separate governance proposal.";
  const changes = ruleChanges(review.value.parent.rule, review.value.rule).filter((r) => r.changed);
  const grouped = new Map();
  for (const change of changes) {
    const key = change.address ? change.label : change.key;
    const item = grouped.get(key) || { change, count: 0 };
    item.count++;
    grouped.set(key, item);
  }
  const clauses = [...grouped.values()].map(({ change: r, count }) => {
    if (r.address)
      return `${r.key.startsWith('fixed:') ? 'Fixed allocations' : 'Manual exclusions'}: ${count} ${count === 1 ? 'entry' : 'entries'} changed`;
    if (r.key === 'points') {
      const old = review.value.parent.rule.points,
        next = review.value.rule.points;
      if (!old || !next) return 'Introduce points-weighted allocation';
      const parts = [];
      if (old.base !== next.base)
        parts.push(
          `base/bonus points ${old.base}/${1000 - old.base} → ${next.base}/${1000 - next.base}`
        );
      for (const key of Object.keys(next.weights))
        if (old.weights[key] !== next.weights[key])
          parts.push(`${key} weight ${old.weights[key]} → ${next.weights[key]}`);
      return parts.join(', ');
    }
    if (r.key === 'minParticipationBps') return `Minimum uptime: ${r.before} → ${r.after}`;
    if (r.key === 'factorTenths')
      return `Voting-power cap factor: ${review.value.parent.rule.factorTenths / 10} → ${review.value.rule.factorTenths / 10}`;
    const exact = `${r.label}: ${r.before} → ${r.after}`;
    return [...exact].length <= 130 ? exact : `${r.label} updated (see comparison)`;
  });
  const prefix = 'Update Juno Delegation Programme rules: ';
  const ending = ' Rules only; fund movements require a separate proposal.';
  if (!clauses.length) return prefix + 'reaffirm the existing rulebook.' + ending;
  for (let n = clauses.length; n >= 0; n--) {
    const remaining = clauses.length - n;
    const detail =
      clauses.slice(0, n).join('; ') +
      (remaining
        ? `${n ? '; ' : ''}${remaining} ${n ? 'other ' : ''}rule changes (see comparison)`
        : '');
    const text = prefix + detail + '.' + ending;
    if ([...text].length <= 300) return text;
  }
  throw Error('Rule summary exceeds the review limit.');
}
