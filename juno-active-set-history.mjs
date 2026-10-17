// Read-only, provider-observed consensus continuity. Never an execution proof.
export const ACTIVE_WINDOW_MS = 90 * 86400000;
const address = /^[A-F0-9]{40}$/;
const positive = (v) => Number.isSafeInteger(v) && v > 0;
export function activeSetEvidence(value, snapshot) {
  const unavailable = (reason) => ({ complete: false, members: new Set(), reason });
  if (value == null)
    return unavailable(
      '90-day active-set history is unavailable. Proposed amounts cannot be calculated.'
    );
  if (
    value.schema !== 1 ||
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
  if (Date.parse(first.startTime) > cutoff)
    return unavailable(
      'The immediately preceding 90 days are not fully covered. Proposed amounts remain unavailable.'
    );
  return {
    complete: true,
    members,
    reason: null,
    source: value.source,
    from: new Date(cutoff).toISOString(),
    through: snapshot.blockTime
  };
}
