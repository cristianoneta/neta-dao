import { activeSetEvidence, ACTIVE_WINDOW_MS } from './juno-active-set-history.mjs';

// Provider-observed canonical commit inclusion, not server uptime or SDK slashing.
export function participationEvidence(history, snapshot) {
  const coverage = activeSetEvidence(history, snapshot, { allowCollecting: true });
  if (!coverage.complete) return coverage;
  const unavailable = (reason) => ({ ...coverage, complete: false, reason });
  const p = history.participation;
  if (p == null)
    return unavailable(
      'Commit-signature counts are unavailable for this snapshot. Proposed amounts remain unavailable.'
    );
  const first = history.spans[0],
    last = history.spans.at(-1),
    start = Date.parse(p.startTime),
    end = Date.parse(p.endTime),
    cutoff = Date.parse(snapshot.blockTime) - ACTIVE_WINDOW_MS;
  if (
    p.schema !== 1 ||
    p.firstHeight !== first.firstHeight + (coverage.collecting ? 0 : 1) ||
    p.lastHeight !== snapshot.height ||
    p.firstHeight > p.lastHeight ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start > end ||
    p.endTime !== last.endTime ||
    p.endTime !== snapshot.blockTime ||
    (coverage.collecting ? p.startTime !== first.startTime : start < cutoff) ||
    !Array.isArray(p.validators) ||
    p.validators.length > 1000
  )
    throw Error('Commit-signature counts do not match the complete history window.');
  const expected = new Map();
  for (const span of history.spans) {
    const from = Math.max(p.firstHeight, span.firstHeight),
      through = Math.min(p.lastHeight, span.lastHeight);
    if (from > through) continue;
    if (
      from === p.firstHeight &&
      (start < Date.parse(span.startTime) ||
        start > Date.parse(span.endTime) ||
        (from === span.firstHeight && p.startTime !== span.startTime) ||
        (from === span.lastHeight && p.startTime !== span.endTime))
    )
      throw Error('Invalid first counted commit timestamp.');
    for (const address of span.addresses)
      expected.set(address, (expected.get(address) || 0) + through - from + 1);
  }
  const records = new Map();
  for (const v of p.validators) {
    if (
      !v ||
      records.has(v.address) ||
      !expected.has(v.address) ||
      !['expected', 'signed', 'absent', 'nil'].every(
        (k) => Number.isSafeInteger(v[k]) && v[k] >= 0
      ) ||
      v.expected !== expected.get(v.address) ||
      BigInt(v.signed) + BigInt(v.absent) + BigInt(v.nil) !== BigInt(v.expected)
    )
      throw Error('Invalid, duplicate or unreconciled commit-signature counts.');
    records.set(v.address, {
      expected: v.expected,
      signed: v.signed,
      absent: v.absent,
      nil: v.nil
    });
  }
  if (records.size !== expected.size)
    return unavailable(
      'Commit-signature counts do not cover every observed validator. Proposed amounts remain unavailable.'
    );
  return { ...coverage, records };
}

export function meetsParticipation(counts, minimumBps = 9750) {
  return (
    !!counts &&
    counts.expected > 0 &&
    BigInt(counts.signed) * 10000n >= BigInt(counts.expected) * BigInt(minimumBps)
  );
}

export function participationText(counts) {
  if (!counts || !counts.expected) return 'No observed commit slots';
  // Truncate display only; eligibility compares the exact integer ratio above.
  const scaled = (BigInt(counts.signed) * 1000000n) / BigInt(counts.expected);
  const percent = `${scaled / 10000n}.${(scaled % 10000n).toString().padStart(4, '0')}`;
  return `${percent}% commit signatures · ${counts.signed.toLocaleString('en-US')}/${counts.expected.toLocaleString('en-US')} signed · ${counts.absent.toLocaleString('en-US')} absent · ${counts.nil.toLocaleString('en-US')} nil`;
}
