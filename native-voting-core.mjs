import { reader, quorum, canonical, proposalIdentity } from './juno-community-governance.mjs';
import { nativeTally } from './native-governance-display.mjs';
import { governanceOperatorAccount, validateJunoAddress } from './names-profile-core.mjs';
export const VOTE = '/cosmos.gov.v1.MsgVote';
export const choices = Object.freeze({ yes: 1, abstain: 2, no: 3, veto: 4 });
export const labels = Object.freeze({
  yes: 'Yes',
  abstain: 'Abstain',
  no: 'No',
  veto: 'No with veto'
});
const enums = {
  VOTE_OPTION_YES: 'yes',
  VOTE_OPTION_ABSTAIN: 'abstain',
  VOTE_OPTION_NO: 'no',
  VOTE_OPTION_NO_WITH_VETO: 'veto'
};
const S = 10n ** 18n;
function integer(v) {
  if (typeof v !== 'string' || !/^\d{1,80}$/.test(v)) throw Error('Invalid stake amount.');
  return BigInt(v);
}
export function decimal(v) {
  if (typeof v !== 'string' || !/^\d{1,80}(\.\d{1,18})?$/.test(v))
    throw Error('Invalid decimal weight.');
  const [whole, part = ''] = v.split('.');
  return BigInt(whole) * S + BigInt(part.padEnd(18, '0'));
}
// Cosmos LegacyDec uses round-to-nearest, ties-to-even for Mul and Quo.
function round(n, d) {
  const q = n / d,
    r = n % d;
  return q + (r * 2n > d || (r * 2n === d && q % 2n === 1n) ? 1n : 0n);
}
export function ballot(vote) {
  if (!vote) return [];
  const options = vote.options;
  if (!Array.isArray(options) || !options.length || options.length > 4)
    throw Error('Incomplete ballot.');
  const seen = new Set();
  const result = options.map((o) => {
    const key =
      enums[o.option] || Object.keys(choices).find((k) => choices[k] === Number(o.option));
    const weight = decimal(o.weight);
    if (!key || seen.has(key) || weight <= 0n || weight > S)
      throw Error('Invalid weighted ballot.');
    seen.add(key);
    return { key, weight: weight.toString() };
  });
  if (result.reduce((sum, o) => sum + BigInt(o.weight), 0n) !== S)
    throw Error('Ballot weights must total one.');
  return result;
}
export function ballotLabel(options) {
  return !options?.length
    ? 'Not voted'
    : options
        .map((o) => labels[o.key] + (options.length > 1 ? ` ${percent(o.weight, S)}%` : ''))
        .join(' / ');
}
export function percent(n, d) {
  n = BigInt(n);
  d = BigInt(d);
  return d ? (Number((n * 10000n) / d) / 100).toFixed(2) : '0.00';
}
export function votingMetrics(tally, params, bonded, expedited = false, precise = null) {
  const amounts =
    precise?.totalsScaled ||
    Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, (integer(v) * S).toString()]));
  const total = precise
      ? BigInt(precise.totalScaled)
      : Object.values(amounts).reduce((n, v) => n + BigInt(v), 0n),
    stake = integer(bonded) * S;
  const thresholds = Object.fromEntries(
    ['quorum', 'threshold', 'veto_threshold'].map((k) => {
      const raw = decimal(params?.[k === 'threshold' && expedited ? 'expedited_threshold' : k]);
      if (raw < 0n || raw > S) throw Error('Unsupported voting parameters.');
      return [k, raw.toString()];
    })
  );
  if (!stake || total > stake) throw Error('Invalid bonded stake or turnout.');
  return {
    total: (total / S).toString(),
    bonded,
    turnout: percent(total, stake),
    thresholds,
    yesShare: percent(amounts.yes, total - BigInt(amounts.abstain)),
    vetoShare: percent(amounts.veto, total),
    quorumReached: round(total * S, stake) >= BigInt(thresholds.quorum)
  };
}
export async function pages(source, path, field, maxPages = 50) {
  let key = '';
  const result = [],
    seen = new Set();
  for (let page = 0; page < maxPages; page++) {
    const data = await source.get(
      path + '?pagination.limit=100' + (key ? '&pagination.key=' + encodeURIComponent(key) : '')
    );
    if (!Array.isArray(data[field]) || !data.pagination || !('next_key' in data.pagination))
      throw Error('Incomplete paginated voting data.');
    result.push(...data[field]);
    key = data.pagination.next_key;
    if (key === null || key === '') return result;
    if (typeof key !== 'string' || key.length > 1024 || seen.has(key)) break;
    seen.add(key);
  }
  throw Error('Voting dataset exceeds the complete-read limit. No partial totals are shown.');
}
export function participation(validators, votes, delegations, tally, own = null) {
  const all = new Map(),
    active = new Map(),
    accounts = new Map(),
    voters = new Set();
  for (const v of validators) {
    const address = v.operator_address;
    if (all.has(address)) throw Error('Duplicate validator.');
    const account = governanceOperatorAccount(address);
    const tokens = integer(v.tokens),
      shares = decimal(v.delegator_shares);
    const row = {
      address,
      account,
      name: v.description?.moniker || address,
      tokens: tokens.toString(),
      shares,
      deducted: 0n,
      ballot: []
    };
    all.set(address, row);
    accounts.set(account, row);
    if (v.status === 'BOND_STATUS_BONDED') {
      if (!shares) throw Error('Missing bonded shares.');
      active.set(address, row);
    } else if (!['BOND_STATUS_UNBONDED', 'BOND_STATUS_UNBONDING'].includes(v.status))
      throw Error('Unknown staking status.');
  }
  const totals = Object.fromEntries(Object.keys(choices).map((k) => [k, 0n]));
  function stakeFor(address, deduct, options = []) {
    const rows = delegations[address];
    if (!Array.isArray(rows)) throw Error('Missing voter delegations.');
    let power = 0n;
    const seen = new Set(),
      inherited = [];
    for (const row of rows) {
      const d = row.delegation,
        val = all.get(d?.validator_address);
      if (!val || d.delegator_address !== address || seen.has(val.address))
        throw Error('Invalid or duplicate delegation.');
      seen.add(val.address);
      if (!active.has(val.address)) continue;
      const shares = decimal(d.shares);
      if (shares > val.shares) throw Error('Delegation exceeds validator shares.');
      const weight = round(shares * BigInt(val.tokens) * S, val.shares);
      if (deduct) {
        val.deducted += shares;
        for (const o of options) totals[o.key] += round(weight * BigInt(o.weight), S);
      }
      inherited.push({
        name: val.name,
        address: val.address,
        weight: (weight / S).toString(),
        ballot: val.ballot
      });
      power += weight;
    }
    return { power, inherited };
  }
  const direct = votes.map((v) => {
    validateJunoAddress(v.voter);
    if (voters.has(v.voter)) throw Error('Duplicate voting address.');
    voters.add(v.voter);
    const options = ballot(v);
    if (accounts.has(v.voter)) accounts.get(v.voter).ballot = options;
    return { address: v.voter, ballot: options, validator: accounts.get(v.voter)?.name || null };
  });
  let directPower = 0n,
    inheritedPower = 0n;
  for (const row of direct) {
    const { power } = stakeFor(row.address, true, row.ballot);
    row.weight = (power / S).toString();
    directPower += power;
  }
  const rows = [...active.values()].map((v) => {
    if (v.deducted > v.shares) throw Error('Direct delegations exceed validator shares.');
    const effective = round((v.shares - v.deducted) * BigInt(v.tokens) * S, v.shares);
    if (v.ballot.length) {
      for (const o of v.ballot) totals[o.key] += round(effective * BigInt(o.weight), S);
      inheritedPower += effective;
    }
    return {
      address: v.address,
      name: v.name,
      ballot: v.ballot,
      tokens: v.tokens,
      weight: (v.ballot.length ? effective / S : 0n).toString(),
      remaining: (effective / S).toString()
    };
  });
  for (const key of Object.keys(choices))
    if (totals[key] / S !== integer(tally[key]))
      throw Error('Participation does not reconcile with the chain tally. Refresh to retry.');
  const personal = own
    ? {
        ...stakeFor(own, false),
        ballot: direct.find((v) => v.address === own)?.ballot || [],
        validator: accounts.get(own)?.name || null
      }
    : null;
  return {
    totalScaled: (directPower + inheritedPower).toString(),
    totalsScaled: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v.toString()])),
    validators: rows,
    direct,
    directWeight: (directPower / S).toString(),
    inheritedWeight: (inheritedPower / S).toString(),
    own: personal
      ? {
          weight: (personal.power / S).toString(),
          ballot: personal.ballot,
          inherited: personal.inherited,
          validator: personal.validator
        }
      : null
  };
}
export async function readParticipation(endpoints, id, own = null, options = {}) {
  if (!/^[1-9]\d{0,19}$/.test(String(id))) throw Error('Invalid proposal ID.');
  if (own) validateJunoAddress(own);
  let last;
  for (const endpoint of endpoints) {
    try {
      const source = await reader(endpoint, 'juno-1', { ...options, requireHeight: true });
      const { proposal } = await source.get(`/cosmos/gov/v1/proposals/${id}`);
      if (String(proposal?.id) !== String(id)) throw Error('Proposal identity mismatch.');
      if (proposal.status !== 'PROPOSAL_STATUS_VOTING_PERIOD')
        return { historical: true, proposal };
      const [validators, votes, live, parameters, pool] = await Promise.all([
        pages(source, '/cosmos/staking/v1beta1/validators', 'validators'),
        pages(source, `/cosmos/gov/v1/proposals/${id}/votes`, 'votes'),
        source.get(`/cosmos/gov/v1/proposals/${id}/tally`),
        source.get('/cosmos/gov/v1/params/tallying'),
        source.get('/cosmos/staking/v1beta1/pool')
      ]);
      if (votes.some((v) => String(v.proposal_id) !== String(id)))
        throw Error('Vote proposal mismatch.');
      const addresses = [
        ...new Set([...votes.map((v) => validateJunoAddress(v.voter)), ...(own ? [own] : [])])
      ];
      const delegations = {};
      let cursor = 0;
      await Promise.all(
        Array.from({ length: Math.min(4, addresses.length) }, async () => {
          while (cursor < addresses.length) {
            const address = addresses[cursor++];
            delegations[address] = await pages(
              source,
              `/cosmos/staking/v1beta1/delegations/${address}`,
              'delegation_responses'
            );
          }
        })
      );
      const tally = nativeTally(live.tally);
      const detail = participation(validators, votes, delegations, tally, own);
      return {
        ...detail,
        tally,
        proposal,
        metrics: votingMetrics(
          tally,
          parameters.params,
          pool.pool?.bonded_tokens,
          proposal.expedited,
          detail
        ),
        height: source.height,
        endpoint,
        checkedAt: Date.now()
      };
    } catch (error) {
      last = error;
    }
  }
  throw last || Error('Participation unavailable.');
}
export function assertVotingOpen(proposal, now = Date.now()) {
  if (
    proposal?.status !== 'PROPOSAL_STATUS_VOTING_PERIOD' ||
    !Number.isFinite(Date.parse(proposal.voting_end_time)) ||
    Date.parse(proposal.voting_end_time) <= now
  )
    throw Error('The voting period is closed.');
}
export async function voteProof(endpoints, expected, sender, options = {}) {
  validateJunoAddress(sender, true);
  if (!/^[1-9]\d{0,19}$/.test(String(expected?.id))) throw Error('Invalid proposal ID.');
  const proofs = await quorum(
    endpoints,
    async (endpoint) => {
      const source = await reader(endpoint, 'juno-1', { ...options, requireHeight: true });
      const [{ proposal }, balance] = await Promise.all([
        source.get(`/cosmos/gov/v1/proposals/${expected.id}`),
        source.get(`/cosmos/bank/v1beta1/spendable_balances/${sender}/by_denom?denom=ujuno`)
      ]);
      if (canonical(proposalIdentity(proposal)) !== canonical(proposalIdentity(expected)))
        throw Error('The proposal differs from the reviewed content.');
      assertVotingOpen(proposal, options.now ?? Date.now());
      if (balance.balance?.denom !== 'ujuno') throw Error('JUNO fee balance unavailable.');
      integer(balance.balance.amount);
      return { proposal, balance: balance.balance.amount, checkedAt: source.checkedAt };
    },
    (p) => ({ identity: proposalIdentity(p.proposal), deadline: p.proposal.voting_end_time }),
    'Juno vote verification'
  );
  return {
    ...proofs[0],
    balance: proofs.reduce(
      (n, p) => (BigInt(p.balance) < BigInt(n) ? p.balance : n),
      proofs[0].balance
    )
  };
}
