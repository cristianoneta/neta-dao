import {
  parseUpgradeHistory,
  observationWindow,
  withinObservationWindow
} from './juno-upgrade-history.mjs';
import { parseReadiness, firstParticipation } from './juno-upgrade-readiness.mjs';

export const PROGRAMME = 'juno1nmezpepv3lx45mndyctz2lzqxa6d9xzd2xumkxf7a6r4nxt0y95qypm6c0';
export const UPGRADE = Object.freeze({
  id: 'juno-v31',
  chainId: 'juno-1',
  height: 42452000,
  haltTime: '2026-10-07T06:56:31.235578431Z'
});
const operator =
  /^junovaloper1(?:[023456789acdefghjklmnpqrstuvwxyz]{38}|[023456789acdefghjklmnpqrstuvwxyz]{58})$/;
const raw = (value) => typeof value === 'string' && /^(0|[1-9]\d{0,29})$/.test(value);
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sum = (values) => values.reduce((a, b) => a + b, 0n);
export function amount(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,20})(\.\d{1,6})?$/.test(value))
    throw Error('Enter a JUNO amount with up to six decimal places.');
  const [whole, decimal = ''] = value.split('.');
  return BigInt(whole) * 1000000n + BigInt(decimal.padEnd(6, '0'));
}
export function units(value) {
  const n = BigInt(value);
  return `${n / 1000000n}.${(n % 1000000n).toString().padStart(6, '0')}`;
}
export function defaultPolicy() {
  return {
    schema: 1,
    chainId: 'juno-1',
    programme: PROGRAMME,
    method: 'equal-capped-v1',
    activeOnly: true,
    factorTenths: 15,
    commissionMaxBps: 1000,
    upgrade: {
      id: UPGRADE.id,
      anchor: 'halt-block-time',
      height: UPGRADE.height,
      haltTime: UPGRADE.haltTime,
      windowSeconds: 18000,
      requireObservedParticipation: true,
      unknownHandling: 'no-target-review-required'
    },
    exclusions: []
  };
}
export function policy(input) {
  const p = structuredClone(input);
  if (
    p?.schema !== 1 ||
    p.chainId !== 'juno-1' ||
    p.programme !== PROGRAMME ||
    p.method !== 'equal-capped-v1' ||
    p.activeOnly !== true ||
    !Number.isInteger(p.factorTenths) ||
    p.factorTenths < 10 ||
    p.factorTenths > 20 ||
    !(
      p.commissionMaxBps === null ||
      (Number.isInteger(p.commissionMaxBps) &&
        p.commissionMaxBps >= 0 &&
        p.commissionMaxBps <= 10000)
    ) ||
    p.upgrade?.id !== UPGRADE.id ||
    p.upgrade.anchor !== 'halt-block-time' ||
    p.upgrade.height !== UPGRADE.height ||
    p.upgrade.haltTime !== UPGRADE.haltTime ||
    p.upgrade.unknownHandling !== 'no-target-review-required' ||
    p.upgrade.windowSeconds !== 18000 ||
    p.upgrade.requireObservedParticipation !== true ||
    !Array.isArray(p.exclusions) ||
    p.exclusions.length > 1000
  )
    throw Error('Invalid rule draft.');
  const seen = new Set();
  p.exclusions = p.exclusions
    .map((e) => {
      if (
        e?.chainId !== 'juno-1' ||
        !operator.test(e.validator) ||
        typeof e.reason !== 'string' ||
        !e.reason.trim() ||
        e.reason.length > 300 ||
        seen.has(e.validator)
      )
        throw Error(
          'Each exclusion needs a unique Juno validator and a reason (up to 300 characters).'
        );
      seen.add(e.validator);
      return { chainId: 'juno-1', validator: e.validator, reason: e.reason.trim() };
    })
    .sort((a, b) => compare(a.validator, b.validator));
  // Explicit allowlist prevents imported fields from changing the approved meaning.
  return {
    ...defaultPolicy(),
    factorTenths: p.factorTenths,
    commissionMaxBps: p.commissionMaxBps,
    exclusions: p.exclusions
  };
}
export function snapshot(data) {
  if (
    data?.schema !== 1 ||
    data.chainId !== 'juno-1' ||
    data.programme !== PROGRAMME ||
    !Number.isSafeInteger(data.height) ||
    data.height < UPGRADE.height ||
    !Number.isFinite(Date.parse(data.blockTime)) ||
    !Number.isFinite(Date.parse(data.collectedAt)) ||
    !raw(data.liquidRaw) ||
    !Array.isArray(data.validators) ||
    data.validators.length < 1 ||
    data.validators.length > 1000 ||
    !Number.isInteger(data.activeCount) ||
    data.activeCount < 1 ||
    data.activeCount > 200 ||
    typeof data.source !== 'string' ||
    !data.source.startsWith('https://') ||
    !Array.isArray(data.redelegations)
  )
    throw Error('Invalid programme snapshot.');
  const seen = new Set(),
    consensus = new Set();
  let active = 0;
  for (const v of data.validators) {
    if (
      !operator.test(v.address) ||
      seen.has(v.address) ||
      !/^[A-F0-9]{40}$/.test(v.consensusAddress) ||
      consensus.has(v.consensusAddress) ||
      typeof v.name !== 'string' ||
      v.name.length > 200 ||
      !raw(v.tokensRaw) ||
      !raw(v.currentRaw) ||
      BigInt(v.currentRaw) > BigInt(v.tokensRaw) ||
      typeof v.active !== 'boolean' ||
      typeof v.jailed !== 'boolean' ||
      !Number.isInteger(v.commissionBps) ||
      v.commissionBps < 0 ||
      v.commissionBps > 10000
    )
      throw Error('Invalid or duplicate validator in snapshot.');
    seen.add(v.address);
    consensus.add(v.consensusAddress);
    if (v.active) active++;
  }
  if (active !== data.activeCount) throw Error('The active consensus set does not reconcile.');
  return structuredClone(data);
}
export function upgradeEvidence(historyData, readinessData) {
  const history = parseUpgradeHistory(historyData, UPGRADE),
    readiness = parseReadiness(readinessData, UPGRADE),
    window = observationWindow(history, 18000);
  if (
    window.start !== Date.parse(UPGRADE.haltTime) ||
    Date.parse(readiness.haltTime) !== window.start
  )
    throw Error('Upgrade archive anchor differs from the proposed rule.');
  const records = new Map();
  for (const address of history.records.keys()) {
    const first = firstParticipation(address, readiness, history),
      within = withinObservationWindow(first, window);
    records.set(address, {
      status: within ? 'observed' : first ? 'late-observation' : 'unknown',
      timestamp: first?.timestamp ?? null,
      evidence: first?.evidence ?? null
    });
  }
  return { records, window };
}
export function capFraction(p, n) {
  return p.factorTenths * 10 <= 30 * n
    ? { numerator: BigInt(p.factorTenths), denominator: BigInt(10 * n) }
    : { numerator: 3n, denominator: 10n };
}
export function equalCapped(budget, entries) {
  let remaining = budget,
    open = entries.map((e) => ({ ...e })).sort((a, b) => compare(a.address, b.address));
  const result = new Map(entries.map((e) => [e.address, 0n]));
  while (open.length && remaining > 0n) {
    const share = remaining / BigInt(open.length),
      limited = open.filter((e) => e.capacity <= share);
    if (limited.length) {
      const ids = new Set(limited.map((e) => e.address));
      for (const e of limited) {
        result.set(e.address, e.capacity);
        remaining -= e.capacity;
      }
      open = open.filter((e) => !ids.has(e.address));
    } else {
      const extra = remaining % BigInt(open.length);
      open.forEach((e, i) => result.set(e.address, share + (BigInt(i) < extra ? 1n : 0n)));
      remaining = 0n;
    }
  }
  return result;
}
export function simulate(inputPolicy, inputSnapshot, budget, evidence) {
  const p = policy(inputPolicy),
    s = snapshot(inputSnapshot),
    totalCurrent = sum(s.validators.map((v) => BigInt(v.currentRaw)));
  if (typeof budget !== 'bigint' || budget <= 0n || budget > totalCurrent + BigInt(s.liquidRaw))
    throw Error('Programme amount must be positive and covered by delegated plus liquid JUNO.');
  if (!evidence?.records || !evidence.window?.coverageComplete)
    throw Error('The upgrade observation window is incomplete.');
  const excluded = new Map(p.exclusions.map((e) => [e.validator, e.reason])),
    cap = capFraction(p, s.activeCount);
  const rows = s.validators.map((v) => {
    const upgrade = evidence.records.get(v.consensusAddress) ?? {
        status: 'unknown',
        timestamp: null,
        evidence: null
      },
      reasons = [];
    if (!v.active || v.jailed) reasons.push('Not active / jailed');
    if (p.commissionMaxBps !== null && v.commissionBps > p.commissionMaxBps)
      reasons.push('Commission above limit');
    if (excluded.has(v.address)) reasons.push(`Manual exclusion: ${excluded.get(v.address)}`);
    if (upgrade.status !== 'observed')
      reasons.push(
        upgrade.status === 'late-observation'
          ? 'First evidence after 5h; upgrade time unverified'
          : 'No evidence within 5h'
      );
    return {
      ...v,
      upgrade,
      reasons,
      eligible: !reasons.length,
      base: BigInt(v.tokensRaw) - BigInt(v.currentRaw)
    };
  });
  const base = sum(rows.filter((v) => v.active).map((v) => v.base));
  let allocated = budget,
    targets = new Map(),
    denominator;
  // Unallocated cash is not bonded stake. Recompute capacity until the bonded
  // denominator agrees with the allocation; never count the old programme twice.
  for (let iteration = 0; iteration < 2000; iteration++) {
    denominator = base + allocated;
    const ceiling = (denominator * cap.numerator) / cap.denominator;
    targets = equalCapped(
      allocated,
      rows
        .filter((v) => v.eligible)
        .map((v) => ({ address: v.address, capacity: ceiling > v.base ? ceiling - v.base : 0n }))
    );
    const next = sum([...targets.values()]);
    if (next === allocated) break;
    allocated = next;
    if (iteration === 1999)
      throw Error('Capacity calculation did not converge; no allocation exported.');
  }
  const result = rows.map((v) => {
    const target = targets.get(v.address) ?? 0n;
    return {
      ...v,
      base: v.base.toString(),
      targetRaw: target.toString(),
      deltaRaw: (target - BigInt(v.currentRaw)).toString(),
      projectedRaw: (v.base + target).toString()
    };
  });
  return {
    schema: 1,
    kind: 'RULE_APPROVAL_DRAFT',
    policy: p,
    snapshotHeight: s.height,
    budgetRaw: budget.toString(),
    allocatedRaw: allocated.toString(),
    unallocatedRaw: (budget - allocated).toString(),
    releasedRaw: (totalCurrent > budget ? totalCurrent - budget : 0n).toString(),
    projectedBondedRaw: denominator.toString(),
    cap: { numerator: cap.numerator.toString(), denominator: cap.denominator.toString() },
    eligibleCount: result.filter((v) => v.eligible).length,
    evidenceReviewCount: result.filter((v) => v.active && v.upgrade.status !== 'observed').length,
    rows: result,
    executionEnabled: false
  };
}
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical(value[k]))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export async function fingerprint(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('');
}
