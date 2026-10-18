// Read-only, provider-observed consensus continuity. Never an execution proof.
export const ACTIVE_WINDOW_MS = 90 * 86400000;
const address = /^[A-F0-9]{40}$/;
const positive = (v) => Number.isSafeInteger(v) && v > 0;
export function activeSetEvidence(value, snapshot, { allowCollecting = false } = {}) {
  const unavailable = (reason) => ({ complete: false, members: new Set(), reason });
  if (value == null)
    return unavailable(
      '90-day active-set history is unavailable. Proposed amounts cannot be calculated.'
    );
  if (
    ![1, 2].includes(value.schema) ||
    value.chainId !== 'juno-1' ||
    typeof value.source !== 'string' ||
    !value.source.startsWith('https://') ||
    !Array.isArray(value.spans) ||
    !value.spans.length ||
    value.spans.length > 10000
  )
    throw Error('Invalid active-set history.');
  let previous = null,
    members = null;
  const cutoff = Date.parse(snapshot.blockTime) - ACTIVE_WINDOW_MS;
  for (const span of value.spans) {
    const start = Date.parse(span.startTime),
      end = Date.parse(span.endTime);
    if (
      !positive(span.firstHeight) ||
      !positive(span.lastHeight) ||
      span.lastHeight < span.firstHeight ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start > end ||
      !Array.isArray(span.addresses) ||
      !span.addresses.length ||
      span.addresses.length > 200 ||
      span.addresses.some((a) => !address.test(a)) ||
      new Set(span.addresses).size !== span.addresses.length ||
      (previous &&
        (span.firstHeight !== previous.lastHeight + 1 || start < Date.parse(previous.endTime)))
    )
      throw Error('Active-set history has invalid bounds, identities or a coverage gap.');
    // Include the roster covering the cutoff, including a span whose next block
    // follows a chain halt. No blocks during a halt means no absent signatures.
    if (start <= cutoff) members = new Set(span.addresses);
    else
      members =
        members === null
          ? new Set(span.addresses)
          : new Set([...members].filter((a) => span.addresses.includes(a)));
    previous = span;
  }
  const first = value.spans[0],
    last = value.spans.at(-1);
  const anchor = value.collectionStart;
  if (
    value.schema === 2 &&
    (!positive(anchor?.height) ||
      !Number.isFinite(Date.parse(anchor.time)) ||
      anchor.height > first.firstHeight ||
      Date.parse(anchor.time) > Date.parse(first.startTime))
  )
    throw Error('Invalid active-set collection origin.');
  if (
    last.lastHeight !== snapshot.height ||
    Date.parse(last.endTime) !== Date.parse(snapshot.blockTime)
  )
    return unavailable(
      'Active-set history does not reach this snapshot. Proposed amounts remain unavailable.'
    );
  const active = snapshot.validators
    .filter((v) => v.active)
    .map((v) => v.consensusAddress)
    .sort();
  if (JSON.stringify([...last.addresses].sort()) !== JSON.stringify(active))
    throw Error('Active-set history and the snapshot disagree on the current consensus set.');
  const collecting = Date.parse(first.startTime) > cutoff;
  if (collecting && !allowCollecting)
    return unavailable(
      'The immediately preceding 90 days are not fully covered. Proposed amounts remain unavailable.'
    );
  if (
    collecting &&
    (value.schema !== 2 ||
      anchor.height !== first.firstHeight ||
      Date.parse(anchor.time) !== Date.parse(first.startTime))
  )
    return unavailable(
      'The available history must cover every block from the recorded collection start. Proposed amounts remain unavailable.'
    );
  if (
    collecting &&
    (last.lastHeight <= first.firstHeight ||
      Date.parse(last.endTime) <= Date.parse(first.startTime))
  )
    return unavailable('More than one observed block is needed to evaluate active-set continuity.');
  const from = collecting ? Date.parse(first.startTime) : cutoff;
  return {
    complete: true,
    members,
    reason: null,
    source: value.source,
    from: new Date(from).toISOString(),
    through: snapshot.blockTime,
    collecting,
    observedDays: (Date.parse(snapshot.blockTime) - from) / 86400000
  };
}
export function historyCoverageText(coverage) {
  if (!coverage?.complete) return coverage?.reason || 'Active-set history is unavailable.';
  const days =
    coverage.observedDays < 0.1
      ? '<0.1'
      : (Math.floor(coverage.observedDays * 10) / 10).toLocaleString('en-US', {
          maximumFractionDigits: 1
        });
  return (
    `${coverage.collecting ? 'Collecting history' : 'Full history'} · ${days} / 90 days checked. ` +
    (coverage.collecting
      ? 'Continuous membership is required throughout the available period. '
      : '') +
    `Observed ${coverage.from} → ${coverage.through}.`
  );
}
