import { PROGRAMME, operator, LIQUID_RESERVE, capFraction } from './juno-delegation-core.mjs';
import { GOVERNANCE, EXECUTE } from './juno-governance-core.mjs';

export const STAKING_TYPES = Object.freeze({
  delegate: '/cosmos.staking.v1beta1.MsgDelegate',
  redelegate: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
  undelegate: '/cosmos.staking.v1beta1.MsgUndelegate'
});
export const canonical = (value) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]])
        )
      : item
  );
const raw = (value) => typeof value === 'string' && /^(0|[1-9]\d{0,29})$/.test(value);
const address = (value) => typeof value === 'string' && operator.test(value);

// Deterministic movement amounts, distinct from eligibility and chain feasibility.
// Unbonding proceeds never fund a delegation in this same atomic proposal.
export function movementPlan(rows) {
  if (
    !Array.isArray(rows) ||
    !rows.length ||
    rows.length > 1000 ||
    new Set(rows.map((v) => v.address)).size !== rows.length ||
    rows.some((v) => !address(v.address) || !raw(v.currentRaw) || !raw(v.targetRaw))
  )
    throw Error('Invalid allocation positions.');
  const positions = rows
    .map(({ address, currentRaw, targetRaw }) => ({ address, currentRaw, targetRaw }))
    .sort((a, b) => (a.address < b.address ? -1 : a.address > b.address ? 1 : 0));
  const donors = [],
    recipients = [],
    moves = [];
  for (const p of positions) {
    const delta = BigInt(p.targetRaw) - BigInt(p.currentRaw);
    if (delta < 0n) donors.push({ address: p.address, left: -delta });
    if (delta > 0n) recipients.push({ address: p.address, left: delta });
  }
  for (const donor of donors)
    for (const recipient of recipients) {
      const n = donor.left < recipient.left ? donor.left : recipient.left;
      if (!n) continue;
      moves.push({
        kind: 'redelegate',
        source: donor.address,
        destination: recipient.address,
        amountRaw: String(n)
      });
      donor.left -= n;
      recipient.left -= n;
    }
  for (const r of recipients)
    if (r.left) moves.push({ kind: 'delegate', destination: r.address, amountRaw: String(r.left) });
  for (const d of donors)
    if (d.left) moves.push({ kind: 'undelegate', source: d.address, amountRaw: String(d.left) });
  const totals = Object.fromEntries(
    Object.keys(STAKING_TYPES).map((kind) => [
      kind,
      String(moves.filter((m) => m.kind === kind).reduce((sum, m) => sum + BigInt(m.amountRaw), 0n))
    ])
  );
  if (moves.length > 500)
    throw Error('This allocation exceeds the supported 500 staking movements.');
  return { positions, moves, totals };
}

// These messages contain only short UTF-8 strings and a nested Coin. Canonical
// re-encoding rejects duplicate/unknown fields, wrong signers and alternate bytes.
function field(id, value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  if (bytes.length >= 128) throw Error('Staking protobuf field is too long.');
  return [id * 8 + 2, bytes.length, ...bytes];
}
export function encodeStaking(move) {
  if (
    !STAKING_TYPES[move?.kind] ||
    !raw(move.amountRaw) ||
    BigInt(move.amountRaw) <= 0n ||
    (move.kind !== 'delegate' && !address(move.source)) ||
    (move.kind !== 'undelegate' && !address(move.destination)) ||
    (move.kind === 'redelegate' && move.source === move.destination)
  )
    throw Error('Invalid programme staking movement.');
  const expected = {
    kind: move.kind,
    ...(move.kind !== 'delegate' ? { source: move.source } : {}),
    ...(move.kind !== 'undelegate' ? { destination: move.destination } : {}),
    amountRaw: move.amountRaw
  };
  if (canonical(move) !== canonical(expected)) throw Error('Unexpected staking movement fields.');
  const coin = [...field(1, 'ujuno'), ...field(2, move.amountRaw)];
  const bytes = [
    ...field(1, PROGRAMME),
    ...field(2, move.source || move.destination),
    ...(move.kind === 'redelegate' ? field(3, move.destination) : []),
    ...field(move.kind === 'redelegate' ? 4 : 3, coin)
  ];
  return { type_url: STAKING_TYPES[move.kind], value: btoa(String.fromCharCode(...bytes)) };
}
function fields(bytes) {
  const result = [];
  for (let i = 0; i < bytes.length; ) {
    const tag = bytes[i++],
      length = bytes[i++];
    if (tag !== (result.length + 1) * 8 + 2 || length >= 128 || i + length > bytes.length)
      throw Error('Invalid staking protobuf.');
    result.push(bytes.slice(i, i + length));
    i += length;
  }
  return result;
}
export function decodeStaking(message) {
  const kind = Object.keys(STAKING_TYPES).find((k) => STAKING_TYPES[k] === message?.type_url);
  if (!kind || typeof message.value !== 'string') throw Error('Unsupported staking message.');
  const values = fields(Uint8Array.from(atob(message.value), (c) => c.charCodeAt(0)));
  const text = (v) => new TextDecoder('utf-8', { fatal: true }).decode(v);
  if (values.length !== (kind === 'redelegate' ? 4 : 3) || text(values[0]) !== PROGRAMME)
    throw Error('Staking delegator must be the programme.');
  const coin = fields(values.at(-1));
  if (coin.length !== 2 || text(coin[0]) !== 'ujuno') throw Error('Expected JUNO staking amount.');
  const move = {
    kind,
    ...(kind !== 'delegate' ? { source: text(values[1]) } : {}),
    ...(kind !== 'undelegate' ? { destination: text(values[kind === 'redelegate' ? 2 : 1]) } : {}),
    amountRaw: text(coin[1])
  };
  if (canonical(message) !== canonical(encodeStaking(move)))
    throw Error('Noncanonical staking message.');
  return move;
}
export function stakingMessages(moves) {
  if (!Array.isArray(moves) || !moves.length || moves.length > 500)
    throw Error('No supported staking movements.');
  return [
    {
      '@type': EXECUTE,
      sender: GOVERNANCE,
      contract: PROGRAMME,
      funds: [],
      msg: {
        execute_admin_msgs: { msgs: moves.map((move) => ({ stargate: encodeStaking(move) })) }
      }
    }
  ];
}
export const isStaking = (messages) =>
  Array.isArray(messages) &&
  messages.some((m) =>
    m?.msg?.execute_admin_msgs?.msgs?.some((v) =>
      Object.values(STAKING_TYPES).includes(v?.stargate?.type_url)
    )
  );
export function assertStaking(messages) {
  const inner = messages?.[0]?.msg?.execute_admin_msgs?.msgs;
  if (!Array.isArray(inner)) throw Error('Expected programme staking messages.');
  const moves = inner.map((m) => decodeStaking(m?.stargate));
  if (canonical(messages) !== canonical(stakingMessages(moves)))
    throw Error('Invalid programme staking envelope.');
  return moves;
}

export function checkMovementState(plan, state) {
  if (canonical(plan) !== canonical(movementPlan(plan?.positions)))
    throw Error('Movement plan changed.');
  if (
    !raw(state?.liquidRaw) ||
    !Number.isSafeInteger(state.maxEntries) ||
    state.maxEntries < 1 ||
    !Array.isArray(state.positions) ||
    !Array.isArray(state.validators) ||
    !Array.isArray(state.redelegations) ||
    !Array.isArray(state.unbondings)
  )
    throw Error('Complete staking state is required.');
  const held = (list) =>
    list
      .filter((p) => BigInt(p.currentRaw) > 0n)
      .map((p) => [p.address, p.currentRaw])
      .sort();
  if (
    state.positions.some((p) => !address(p.address) || !raw(p.currentRaw)) ||
    new Set(state.positions.map((p) => p.address)).size !== state.positions.length ||
    canonical(held(state.positions)) !== canonical(held(plan.positions))
  )
    throw Error('Programme holdings changed. Refresh and simulate again.');
  if (BigInt(state.liquidRaw) < BigInt(plan.totals.delegate) + LIQUID_RESERVE)
    throw Error('Spendable funds do not cover new delegations and the 50 JUNO reserve.');
  const validators = new Map(state.validators.map((v) => [v.address, v]));
  const blockers = [];
  for (const move of plan.moves) {
    const target = validators.get(move.destination),
      source = validators.get(move.source);
    if (
      (move.source &&
        (!source || source.exchangeRateValid !== true || BigInt(source.tokensRaw || '0') <= 0n)) ||
      (move.destination &&
        (!target || target.jailed !== false || target.exchangeRateValid !== true))
    )
      blockers.push(
        'A source or destination validator is unavailable, jailed or has an invalid exchange rate.'
      );
    if (move.kind === 'redelegate') {
      const incoming = state.redelegations.filter(
        (r) => r.destination === move.source && r.entries.length
      );
      if (incoming.length)
        blockers.push(
          `Redelegation from ${move.source} is locked by an incoming redelegation. Earliest recorded completion: ${
            incoming
              .flatMap((r) => r.entries)
              .map((e) => e.completionTime)
              .sort()[0]
          }.`
        );
      const count = state.redelegations
        .filter((r) => r.source === move.source && r.destination === move.destination)
        .reduce((n, r) => n + r.entries.length, 0);
      if (count >= state.maxEntries)
        blockers.push(`Redelegation entry limit reached for ${move.source} → ${move.destination}.`);
    }
    if (
      move.kind === 'undelegate' &&
      state.unbondings
        .filter((r) => r.source === move.source)
        .reduce((n, r) => n + r.entries.length, 0) >= state.maxEntries
    )
      blockers.push(`Unbonding entry limit reached for ${move.source}.`);
  }
  return [...new Set(blockers)];
}

// Recheck the live, chain-verifiable eligibility/cap conditions. Historical
// participation remains the dated evidence in the immutable calculation.
export function checkCurrentAllocation(calculation, plan, state) {
  const rule = calculation.rule,
    count = state.activeCount;
  if (!Number.isSafeInteger(count) || count < 1 || count > 200)
    throw Error('Current consensus set is unavailable.');
  const held = new Map(state.positions.map((p) => [p.address, BigInt(p.currentRaw)]));
  const targets = new Map(plan.positions.map((p) => [p.address, BigInt(p.targetRaw)]));
  const available = new Set(state.validators.map((v) => v.address));
  if (
    [
      ...held.keys(),
      ...plan.positions.filter((p) => BigInt(p.targetRaw) > 0n).map((p) => p.address)
    ].some((a) => !available.has(a))
  )
    throw Error('A programme validator is missing from the current chain state.');
  const nodes = state.validators.map((v) => {
    const base = BigInt(v.tokensRaw) - (held.get(v.address) || 0n);
    if (base < 0n) throw Error('Validator holdings exceed current token supply.');
    return { ...v, projected: base + (targets.get(v.address) || 0n) };
  });
  const projected = nodes
    .filter((v) => !v.jailed && v.projected > 0n)
    .sort((a, b) =>
      a.projected > b.projected
        ? -1
        : a.projected < b.projected
          ? 1
          : Number(b.active) - Number(a.active) ||
            (a.address < b.address ? -1 : a.address > b.address ? 1 : 0)
    )
    .slice(0, count);
  const total = projected.reduce((n, v) => n + v.projected, 0n),
    cap = capFraction(rule, count);
  for (const v of nodes.filter((v) => (targets.get(v.address) || 0n) > 0n)) {
    if (v.jailed || v.exchangeRateValid !== true)
      throw Error('A target validator is now unavailable or jailed. Refresh and simulate again.');
    if (
      rule.commissionMaxBps !== null &&
      BigInt(v.commissionAtoms) > BigInt(rule.commissionMaxBps) * 100000000000000n
    )
      throw Error(
        'A recipient now exceeds the approved commission limit. Refresh and simulate again.'
      );
    if (
      rule.schema >= 3 &&
      (!v.active ||
        v.consensusAddress !==
          calculation.snapshot.validators.find((p) => p.address === v.address)?.consensusAddress)
    )
      throw Error(
        'A recipient left the recorded consensus set. Refresh its participation evidence and simulate again.'
      );
    if (v.projected * cap.denominator > total * cap.numerator)
      throw Error(
        'A target now exceeds the approved voting-power cap. Refresh and simulate again.'
      );
  }
}
