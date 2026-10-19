// Lossless transport only: the review model, policy and fingerprint do not change.
// Repeated consensus identities use a dictionary; validator fields use tuples.
const consensus = /^[A-F0-9]{40}$/;
const fields = [
  'address',
  'consensusAddress',
  'name',
  'tokensRaw',
  'currentRaw',
  'active',
  'jailed',
  'commissionBps'
];
const counts = ['address', 'expected', 'signed', 'absent', 'nil'];
const invalid = () => {
  throw Error('Invalid compact review transport.');
};
export function packReview(value) {
  const addresses = [
    ...new Set([
      ...value.snapshot.validators.map((v) => v.consensusAddress),
      ...value.evidence.records.map(([a]) => a),
      ...(value.activeHistory?.spans.flatMap((s) => s.addresses) || []),
      ...(value.activeHistory?.participation?.validators.map((v) => v.address) || [])
    ])
  ].sort();
  const ids = new Map(addresses.map((a, i) => [a, i])),
    packed = structuredClone(value);
  packed.snapshot.validators = value.snapshot.validators.map((v) =>
    fields.map((key) => (key === 'consensusAddress' ? ids.get(v[key]) : v[key]))
  );
  packed.evidence.records = value.evidence.records.map(([a, record]) => [ids.get(a), record]);
  for (const span of packed.activeHistory?.spans || [])
    span.addresses = span.addresses.map((a) => ids.get(a));
  if (packed.activeHistory?.participation)
    packed.activeHistory.participation.validators =
      value.activeHistory.participation.validators.map((v) =>
        counts.map((key) => (key === 'address' ? ids.get(v[key]) : v[key]))
      );
  return { addresses, value: packed };
}
export function unpackReview(packet) {
  if (
    !packet ||
    Object.keys(packet).sort().join(',') !== 'addresses,value' ||
    !Array.isArray(packet.addresses) ||
    packet.addresses.length > 20000 ||
    packet.addresses.some((a) => typeof a !== 'string' || !consensus.test(a)) ||
    new Set(packet.addresses).size !== packet.addresses.length
  )
    invalid();
  const address = (id) => {
    if (!Number.isInteger(id) || id < 0 || id >= packet.addresses.length) invalid();
    return packet.addresses[id];
  };
  const rows = (values, limit) => {
    if (!Array.isArray(values) || values.length > limit) invalid();
    return values;
  };
  const tuple = (row, keys, identity) => {
    if (!Array.isArray(row) || row.length !== keys.length) invalid();
    return Object.fromEntries(
      keys.map((key, i) => [key, key === identity ? address(row[i]) : row[i]])
    );
  };
  const value = structuredClone(packet.value);
  if (!value?.snapshot || !value.evidence) invalid();
  value.snapshot.validators = rows(value.snapshot.validators, 1000).map((row) =>
    tuple(row, fields, 'consensusAddress')
  );
  value.evidence.records = rows(value.evidence.records, 1000).map((row) => {
    if (!Array.isArray(row) || row.length !== 2) invalid();
    return [address(row[0]), row[1]];
  });
  if (value.activeHistory != null) {
    for (const span of rows(value.activeHistory.spans, 10000)) {
      if (!span || typeof span !== 'object') invalid();
      span.addresses = rows(span.addresses, 200).map(address);
    }
    if (value.activeHistory.participation != null)
      value.activeHistory.participation.validators = rows(
        value.activeHistory.participation.validators,
        20000
      ).map((row) => tuple(row, counts, 'address'));
  }
  return value;
}
