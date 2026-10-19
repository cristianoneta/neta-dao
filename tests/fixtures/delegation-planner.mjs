import { PROGRAMME } from '../../juno-delegation-core.mjs';
export function fixture(n = 25) {
  return {
    schema: 1,
    chainId: 'juno-1',
    programme: PROGRAMME,
    height: 42500000,
    blockTime: new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    source: 'https://example.org',
    activeCount: n,
    liquidRaw: '1000000000',
    redelegations: [],
    validators: Array.from({ length: n }, (_, i) => ({
      address: 'junovaloper1' + 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'[i] + 'q'.repeat(37),
      consensusAddress: i.toString(16).toUpperCase().padStart(40, '0'),
      name: `Validator ${i + 1}`,
      tokensRaw: '1100000000',
      currentRaw: '100000000',
      active: true,
      jailed: false,
      commissionBps: 500
    }))
  };
}
export function observed(s) {
  return {
    window: { coverageComplete: true },
    records: new Map(
      s.validators.map((v) => [
        v.consensusAddress,
        { status: 'observed', timestamp: '2026-10-07T08:00:00Z', evidence: 'commit' }
      ])
    )
  };
}
// Synthetic, complete evidence for tests only. Not a production history claim.
export function activeHistory(s, days = 90) {
  return {
    schema: 1,
    chainId: 'juno-1',
    source: 'https://history.example.org',
    spans: [
      {
        firstHeight: s.height - 3200000,
        lastHeight: s.height,
        startTime: new Date(Date.parse(s.blockTime) - days * 86400000).toISOString(),
        endTime: s.blockTime,
        addresses: s.validators.filter((v) => v.active).map((v) => v.consensusAddress)
      }
    ]
  };
}
// Complete synthetic commit counts, including roster changes, for schema-5 tests.
export function withParticipation(h) {
  h.schema = 2;
  h.collectionStart ??= { height: h.spans[0].firstHeight, time: h.spans[0].startTime };
  const first = h.spans[0],
    last = h.spans.at(-1),
    cutoff = Date.parse(last.endTime) - 90 * 86400000,
    collecting = Date.parse(first.startTime) > cutoff,
    firstHeight = first.firstHeight + (collecting ? 0 : 1),
    startTime = collecting ? first.startTime : new Date(cutoff + 1000).toISOString(),
    counts = new Map();
  for (const span of h.spans) {
    const slots = span.lastHeight - Math.max(firstHeight, span.firstHeight) + 1;
    if (slots > 0) for (const a of span.addresses) counts.set(a, (counts.get(a) || 0) + slots);
  }
  h.participation = {
    schema: 1,
    firstHeight,
    lastHeight: last.lastHeight,
    startTime,
    endTime: last.endTime,
    validators: [...counts].map(([address, expected]) => ({
      address,
      expected,
      signed: expected,
      absent: 0,
      nil: 0
    }))
  };
  return h;
}
