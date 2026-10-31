// Pure frozen-evidence scoring. No network or historical backfill.
const fail = () => {
  throw Error(
    'Own governance observations are missing or incomplete. Refresh data before preparing a points-based review.'
  );
};
const date = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const int = (v) => Number.isSafeInteger(v) && v >= 1;
const hash = (v) => typeof v === 'string' && /^[A-F0-9]{64}$/.test(v);
const address = (v) =>
  typeof v === 'string' && /^junovaloper1[023456789acdefghjklmnpqrstuvwxyz]{38,58}$/.test(v);
const gcd = (a, b) => {
  while (b) [a, b] = [b, a % b];
  return a;
};
const ratio = (n, d = 1n) => {
  const g = gcd(n, d);
  return { numerator: String(n / g), denominator: String(d / g) };
};
export const defaultPoints = () => ({
  base: 900,
  weights: { governance: 100, rpc: 0, testnet: 0, archive: 0 }
});
export function pointsConfig(value) {
  if (
    !value ||
    !Number.isInteger(value.base) ||
    value.base < 0 ||
    value.base > 1000 ||
    !value.weights ||
    Object.keys(value).sort().join() !== 'base,weights' ||
    Object.keys(value.weights).sort().join() !== 'archive,governance,rpc,testnet' ||
    Object.values(value.weights).some((w) => !Number.isInteger(w) || w < 0 || w > 100) ||
    ['rpc', 'testnet', 'archive'].some((k) => value.weights[k] !== 0)
  )
    throw Error('Invalid points settings; unavailable bonus criteria must have zero weight.');
  return structuredClone(value);
}
export function governanceEvidence(s) {
  const g = s.governanceHistory;
  const validAnchor = (a) => a && int(a.height) && date(a.time) && hash(a.hash);
  if (
    !g ||
    g.schema !== 1 ||
    g.chainId !== 'juno-1' ||
    typeof g.source !== 'string' ||
    !g.source.startsWith('https://') ||
    !validAnchor(g.coverage?.start) ||
    !validAnchor(g.coverage?.end) ||
    g.coverage.end.height !== s.height ||
    g.coverage.end.time !== s.blockTime ||
    !int(g.collectionStart?.height) ||
    !date(g.collectionStart.time) ||
    g.collectionStart.height > g.coverage.start.height ||
    Date.parse(g.collectionStart.time) > Date.parse(g.coverage.start.time) ||
    g.coverage.start.height > g.coverage.end.height ||
    Date.parse(g.coverage.start.time) > Date.parse(g.coverage.end.time) ||
    !Array.isArray(g.validators) ||
    g.validators.length > 1000 ||
    !Array.isArray(g.proposals) ||
    g.proposals.length > 1000 ||
    !Array.isArray(g.excluded) ||
    g.excluded.length > 1000
  )
    fail();
  const entries = new Map();
  for (const v of g.validators) {
    if (
      !address(v.address) ||
      entries.has(v.address) ||
      !int(v.firstHeight) ||
      !date(v.firstTime) ||
      v.firstHeight < g.collectionStart.height ||
      v.firstHeight > s.height ||
      Date.parse(v.firstTime) < Date.parse(g.collectionStart.time) ||
      Date.parse(v.firstTime) > Date.parse(s.blockTime)
    )
      fail();
    entries.set(v.address, v);
  }
  const ids = new Set();
  const within = (a) =>
    a &&
    int(a.height) &&
    date(a.time) &&
    a.height >= g.coverage.start.height &&
    a.height <= s.height &&
    Date.parse(a.time) >= Date.parse(g.coverage.start.time) &&
    Date.parse(a.time) <= Date.parse(s.blockTime);
  for (const p of g.proposals) {
    if (
      !/^[1-9]\d{0,19}$/.test(p.id) ||
      ids.has(p.id) ||
      !within(p.start) ||
      !within(p.end) ||
      p.start.height > p.end.height ||
      Date.parse(p.start.time) > Date.parse(p.end.time) ||
      !['proposal_passed', 'proposal_rejected', 'proposal_failed'].includes(p.end.result) ||
      !Array.isArray(p.votes) ||
      p.votes.length > 1000
    )
      fail();
    ids.add(p.id);
    const voters = new Set(),
      positions = new Set();
    for (const v of p.votes) {
      const position = `${v.height}/${v.scope}/${v.index}`;
      if (
        !address(v.voter) ||
        voters.has(v.voter) ||
        positions.has(position) ||
        !int(v.height) ||
        v.height < p.start.height ||
        v.height > p.end.height ||
        !/^tx:\d+$/.test(v.scope) ||
        !Number.isSafeInteger(v.index) ||
        v.index < 0 ||
        typeof v.option !== 'string' ||
        !v.option ||
        v.option.length > 500
      )
        fail();
      voters.add(v.voter);
      positions.add(position);
    }
  }
  for (const p of g.excluded) {
    if (
      !/^[1-9]\d{0,19}$/.test(p.id) ||
      ids.has(p.id) ||
      !['cancelled', 'voting-start-not-observed'].includes(p.reason)
    )
      fail();
    ids.add(p.id);
  }
  const end = Date.parse(s.blockTime),
    days = 86400000;
  const available = g.proposals
    .filter((p) => Date.parse(p.end.time) >= end - 180 * days)
    .sort(
      (a, b) =>
        Date.parse(b.end.time) - Date.parse(a.end.time) || (BigInt(a.id) > BigInt(b.id) ? -1 : 1)
    );
  const recent = available.filter((p) => Date.parse(p.end.time) >= end - 90 * days);
  const proposals = recent.length >= 10 ? recent : available.slice(0, 10);
  return {
    proposals,
    entries,
    coverage: structuredClone(g.coverage),
    count: proposals.length,
    collecting: Date.parse(g.coverage.start.time) > end - 90 * days || proposals.length < 10,
    excluded: g.excluded.length
  };
}
// This formula supports any explicitly versioned future criterion. Missing/zero
// opportunities earn no verified contribution and never redistribute its weight.
export function scorePoints(base, weights, contributions) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let n = 0n,
    d = 1n;
  for (const [key, weight] of Object.entries(weights)) {
    const q = contributions[key];
    if (!weight || !total || !q) continue;
    const qn = BigInt(q.numerator),
      qd = BigInt(q.denominator);
    if (qd <= 0n || qn < 0n || qn > qd) throw Error('Invalid bonus contribution.');
    const addN = BigInt(1000 - base) * BigInt(weight) * qn,
      addD = BigInt(total) * qd;
    n = n * addD + addN * d;
    d *= addD;
    const g = gcd(n, d);
    n /= g;
    d /= g;
  }
  return { base, bonus: ratio(n, d), total: ratio(BigInt(base) * d + n, d) };
}
export function validatorPoints(config, address, evidence, required = true) {
  const enabled = config.base < 1000 && config.weights.governance > 0;
  if (!enabled)
    return { ...scorePoints(config.base, config.weights, {}), governance: { status: 'disabled' } };
  const entry = evidence?.entries.get(address);
  if (!entry) {
    if (required) fail();
    return { base: config.base, total: null, bonus: null, governance: { status: 'unverified' } };
  }
  const applicable = evidence.proposals.filter((p) => p.start.height >= entry.firstHeight);
  const voted = applicable.filter((p) => p.votes.some((v) => v.voter === address));
  return {
    ...scorePoints(config.base, config.weights, {
      governance: applicable.length ? ratio(BigInt(voted.length), BigInt(applicable.length)) : null
    }),
    governance: {
      status: applicable.length ? 'observed' : 'collecting',
      voted: voted.length,
      applicable: applicable.length,
      programme: evidence.count,
      proposals: applicable.map((p) => ({
        id: p.id,
        endTime: p.end.time,
        vote: p.votes.find((v) => v.voter === address) || null
      }))
    }
  };
}
export function weightedCapped(budget, entries) {
  const result = new Map(entries.map((e) => [e.address, 0n]));
  let common = 1n;
  for (const e of entries) {
    const d = BigInt(e.weight.denominator);
    common = (common / gcd(common, d)) * d;
  }
  let open = entries
    .map((e) => ({
      ...e,
      weight: BigInt(e.weight.numerator) * (common / BigInt(e.weight.denominator))
    }))
    .filter((e) => e.weight > 0n);
  let remaining = budget;
  while (open.length && remaining > 0n) {
    const weight = open.reduce((a, e) => a + e.weight, 0n);
    const limited = open.filter((e) => e.capacity * weight <= remaining * e.weight);
    if (limited.length) {
      const ids = new Set(limited.map((e) => e.address));
      for (const e of limited) {
        result.set(e.address, e.capacity);
        remaining -= e.capacity;
      }
      open = open.filter((e) => !ids.has(e.address));
    } else {
      const shares = open.map((e) => ({
        ...e,
        quota: (remaining * e.weight) / weight,
        remainder: (remaining * e.weight) % weight
      }));
      let extra = remaining - shares.reduce((a, e) => a + e.quota, 0n);
      shares.sort((a, b) =>
        a.remainder === b.remainder
          ? a.address < b.address
            ? -1
            : 1
          : a.remainder > b.remainder
            ? -1
            : 1
      );
      for (const e of shares) {
        result.set(e.address, e.quota + (extra > 0n ? 1n : 0n));
        if (extra > 0n) extra--;
      }
      remaining = 0n;
    }
  }
  return result;
}
