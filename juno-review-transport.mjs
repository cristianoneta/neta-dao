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
  if (packed.snapshot.governanceHistory) {
    const g = packed.snapshot.governanceHistory;
    const operators = new Map(value.snapshot.validators.map((v, i) => [v.address, i]));
    const anchor = (a) => [a.height, a.time];
    g.validators = g.validators.map((v) => [operators.get(v.address), v.firstHeight, v.firstTime]);
    g.proposals = g.proposals.map((p) => [
      p.id,
      anchor(p.start),
      anchor(p.end),
      p.end.result,
      p.votes.map((v) => [
        operators.get(v.voter),
        v.height - p.start.height,
        v.scope,
        v.index,
        v.option
      ])
    ]);
    g.transport = 1;
  }
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
  const g = value.snapshot.governanceHistory;
  if (g?.transport !== undefined) {
    if (g.transport !== 1 || value.rule?.schema !== 9) invalid();
    const operator = (i) => {
      if (!Number.isInteger(i) || i < 0 || i >= value.snapshot.validators.length) invalid();
      return value.snapshot.validators[i].address;
    };
    const sized = (row, n) => {
      if (!Array.isArray(row) || row.length !== n) invalid();
      return row;
    };
    const anchor = (row) => {
      const [height, time] = sized(row, 2);
      return { height, time };
    };
    g.validators = rows(g.validators, 1000).map((row) => {
      const [i, firstHeight, firstTime] = sized(row, 3);
      return { address: operator(i), firstHeight, firstTime };
    });
    g.proposals = rows(g.proposals, 1000).map((row) => {
      const [id, start, end, result, votes] = sized(row, 5);
      return {
        id,
        start: anchor(start),
        end: { ...anchor(end), result },
        votes: rows(votes, 1000).map((v) => {
          const [i, height, scope, index, option] = sized(v, 5);
          return { voter: operator(i), height: height + start[0], scope, index, option };
        })
      };
    });
    delete g.transport;
  }
  return value;
}
