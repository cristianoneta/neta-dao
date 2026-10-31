const node = (tag, text) => {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
};
const decimal = (q) =>
  (Number(q.numerator) / Number(q.denominator)).toLocaleString('en-US', {
    maximumFractionDigits: 2
  });
export function pointsText(points) {
  if (!points) return '';
  if (!points.total) return 'Governance evidence unavailable · no regular eligibility';
  const g = points.governance;
  return (
    `${decimal(points.total)} points · ` +
    (g.status === 'observed'
      ? `Governance ${g.voted}/${g.applicable} · ${((100 * g.voted) / g.applicable).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`
      : g.status === 'collecting'
        ? 'No completed proposals observed yet'
        : 'Governance bonus disabled')
  );
}
export function appendPointsDetails(host, points, source) {
  if (!points) return;
  const details = node('details', '');
  details.append(node('summary', pointsText(points)));
  if (points.total)
    details.append(
      node(
        'p',
        `${points.base} base + ${decimal(points.bonus)} earned bonus = ${decimal(points.total)} points. Exact points: ${points.total.numerator}/${points.total.denominator}.`
      )
    );
  const g = points.governance;
  if (g.programme !== undefined)
    details.append(
      node(
        'p',
        `${g.applicable} applicable proposals out of ${g.programme} in the programme window. Each accepted own vote counts once; delegator votes do not count.`
      )
    );
  for (const p of g.proposals || []) {
    const line = node('p', ''),
      link = node('a', `Proposal #${p.id}`);
    link.href = `https://atomscan.com/juno/proposals/${p.id}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    line.append(
      link,
      document.createTextNode(
        ` · closed ${new Date(p.endTime).toLocaleDateString()} · ${p.vote ? 'Own vote observed' : 'No own vote observed'}`
      )
    );
    if (p.vote) {
      line.append(
        node(
          'small',
          ` · ${p.vote.option} · block ${p.vote.height} · ${p.vote.scope} / event ${p.vote.index}`
        )
      );
      if (source?.startsWith('https://')) {
        const proof = node('a', ' · Observed block results');
        const url = new URL('/block_results', source);
        url.searchParams.set('height', String(p.vote.height));
        proof.href = url.href;
        proof.target = '_blank';
        proof.rel = 'noopener noreferrer';
        line.append(proof);
      }
    }
    details.append(line);
  }
  host.append(details);
}
export function governanceWindowText(result) {
  const g = result.governance;
  if (!g)
    return result.policy.schema >= 9
      ? 'Points are fixed by this proposed rule; no governance evidence is needed for disabled bonus or a fully reserved budget.'
      : 'The approved equal-allocation method remains in use.';
  return `${g.count} fully observed completed proposals · own coverage ${new Date(g.coverage.start.time).toLocaleDateString()}–${new Date(g.coverage.end.time).toLocaleDateString()}${g.collecting ? ' · still collecting' : ''}${g.excluded ? ` · ${g.excluded} incomplete or cancelled periods excluded` : ''}.`;
}
