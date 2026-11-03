import { assertStaking, stakingMessages, canonical } from './juno-programme-staking.mjs';

// Workshop storage only. Never pass this envelope to MsgSubmitProposal.
// Rebuild the exact, canonical Stargate messages before validation or signing.
const FORMAT = 'cosmoot-staking-actions-1';
export function compactReviewActions(messages) {
  const moves = assertStaking(messages),
    addresses = [];
  const index = (address) => {
    if (!addresses.includes(address)) addresses.push(address);
    return addresses.indexOf(address);
  };
  const rows = moves.map((m) => [
    m.kind === 'redelegate' ? 'r' : m.kind === 'delegate' ? 'd' : 'u',
    ...(m.source ? [index(m.source)] : []),
    ...(m.destination ? [index(m.destination)] : []),
    m.amountRaw
  ]);
  return [{ format: FORMAT, addresses, moves: rows }];
}

export function readReviewActions(raw = '[]') {
  if (typeof raw !== 'string' || raw.length > 250000)
    throw Error('Review actions exceed the supported size.');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw Error('Review actions must be an array.');
  if (!parsed.some((v) => v?.format?.startsWith?.('cosmoot-staking-actions'))) return parsed;
  const packet = parsed[0];
  if (
    parsed.length !== 1 ||
    packet.format !== FORMAT ||
    !Array.isArray(packet.addresses) ||
    !packet.addresses.length ||
    packet.addresses.length > 1000 ||
    new Set(packet.addresses).size !== packet.addresses.length ||
    !Array.isArray(packet.moves) ||
    !packet.moves.length ||
    packet.moves.length > 500
  )
    throw Error('Invalid compact staking actions.');
  const address = (i) => {
    if (!Number.isSafeInteger(i) || i < 0 || i >= packet.addresses.length)
      throw Error('Invalid staking address reference.');
    return packet.addresses[i];
  };
  const moves = packet.moves.map((r) => {
    if (!Array.isArray(r) || !['r', 'd', 'u'].includes(r[0]) || r.length !== (r[0] === 'r' ? 4 : 3))
      throw Error('Invalid compact staking movement.');
    return {
      kind: { r: 'redelegate', d: 'delegate', u: 'undelegate' }[r[0]],
      ...(r[0] !== 'd' ? { source: address(r[1]) } : {}),
      ...(r[0] !== 'u' ? { destination: address(r[r[0] === 'r' ? 2 : 1]) } : {}),
      amountRaw: r.at(-1)
    };
  });
  const messages = stakingMessages(moves);
  if (canonical(parsed) !== canonical(compactReviewActions(messages)))
    throw Error('Noncanonical compact staking actions.');
  return messages;
}
